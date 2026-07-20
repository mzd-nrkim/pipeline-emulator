import type { CanvasTopology, ToolNode, ToolRole } from '$lib/api/types.js';
import { getToolEntry } from './toolCatalog.js';

const COL_GAP = 280;
const ROW_GAP = 140;

// infra 뷰 계층 grouping 배치 상수
const INFRA_COL_GAP = 300;
const INFRA_ROW_GAP = 160;
const INFRA_START_X = 60;
const INFRA_START_Y = 60;

/**
 * infra 뷰 계층 정의 (dependency 채널 전용)
 * 계층 순서: storage → ingestion → processing → serving
 */
const INFRA_LAYER_ORDER = ['storage', 'broker', 'ingestion', 'processing', 'serving', 'other'] as const;
type InfraLayer = typeof INFRA_LAYER_ORDER[number];

/** 노드 ID → infra 계층 매핑 */
const INFRA_LAYER_MAP: Record<string, InfraLayer> = {
  // storage: 인프라 컨테이너 / 스토리지 / coordination
  'node-mysql-container': 'storage',
  'node-seaweedfs':       'storage',
  'node-zookeeper':       'storage',
  'node-es':              'serving',
  'node-mysql':           'storage',
  'node-s3-bronze':       'storage',
  // broker: 메시지 브로커
  'node-valkey':          'broker',
  // ingestion: 수집 도구
  'node-debezium':        'ingestion',
  'node-nifi':            'ingestion',
  'node-dam':             'ingestion',
  // processing: 처리 / 오케스트레이션 (DAG 내부 실행 노드는 infra 노드 아님 — 매핑 제외)
  'node-airflow':         'processing',
  'node-mock-api':        'processing',
  // serving: 시각화 / API 서빙
  'node-kibana':          'serving',
};

/** 노드 ID로 infra 계층을 반환. 매핑이 없으면 'other' */
function getInfraLayer(nodeId: string): InfraLayer {
  return INFRA_LAYER_MAP[nodeId] ?? 'other';
}

/**
 * infra 뷰 전용 계층 grouping 배치 계산
 * - y축: 계층별 고정 (storage=0, ingestion=1, processing=2, serving=3, other=4)
 * - x축: 계층 내 노드 순번 균등 분배
 * - computeDepths를 사용하지 않아 in-degree 0 오판 해소
 */
function computeInfraPositions(
  nodes: import('$lib/api/types.js').ToolNode[]
): Map<string, { x: number; y: number }> {
  // 계층별 노드 그룹핑
  const layerGroups = new Map<InfraLayer, string[]>();
  for (const layer of INFRA_LAYER_ORDER) {
    layerGroups.set(layer, []);
  }
  for (const n of nodes) {
    const layer = getInfraLayer(n.id);
    layerGroups.get(layer)!.push(n.id);
  }

  const positions = new Map<string, { x: number; y: number }>();
  let layerIndex = 0;
  for (const layer of INFRA_LAYER_ORDER) {
    const ids = layerGroups.get(layer)!;
    if (ids.length === 0) continue;
    const y = INFRA_START_Y + layerIndex * INFRA_ROW_GAP;
    ids.forEach((id, i) => {
      const x = INFRA_START_X + i * INFRA_COL_GAP;
      positions.set(id, { x, y });
    });
    layerIndex++;
  }
  return positions;
}

export interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    displayName: string;
    vendor: string;
    icon: string;
    accent: string;
    role: string;
    trigger: boolean;
    isInfra?: boolean;
    applyMode?: string;
    outputs?: string[];
    outOfTeamScope?: boolean;
    deployStatus: 'active' | 'planned' | 'absent';
  };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  animated: boolean;
  label?: string;
  sourceHandle?: string;
}

export function buildNodesAndEdges(
  topo: CanvasTopology,
  view: 'data' | 'infra' = 'data',
  hideOrphans: boolean = true
): { nodes: FlowNode[]; edges: FlowEdge[] } {

  // 1. 채널 필터: 현재 view에 해당하는 채널을 가진 엣지만 포함
  const nodeIdSet = new Set(topo.nodes.map(n => n.id));
  const visibleEdges = topo.edges.filter(e =>
    nodeIdSet.has(e.from) &&
    nodeIdSet.has(e.to) &&
    e.channels.includes(view === 'data' ? 'data' : 'dependency')
  );

  // 2. 가시 그래프에서 연결된 노드 ID 집합 (고아 노드 숨김 조건부)
  const connectedIds = new Set<string>();
  for (const e of visibleEdges) {
    connectedIds.add(e.from);
    connectedIds.add(e.to);
  }
  const visibleNodes = hideOrphans
    ? topo.nodes.filter(n => connectedIds.has(n.id))
    : topo.nodes;

  // 3. 배치 계산: infra 뷰는 계층 grouping, data 뷰는 위상정렬 depth
  let getPosition: (nodeId: string) => { x: number; y: number };

  if (view === 'infra') {
    // infra 뷰: 계층 grouping 배치 (computeDepths 미사용 — in-degree 0 오판 해소)
    const infraPos = computeInfraPositions(visibleNodes);
    getPosition = (nodeId) => infraPos.get(nodeId) ?? { x: 0, y: 0 };
  } else {
    // data 뷰: 기존 위상정렬 X좌표 (Kahn's algorithm + 최장 경로)
    const depth = computeDepths(visibleNodes, visibleEdges);
    const depthCounters = new Map<number, number>();
    const posCache = new Map<string, { x: number; y: number }>();
    for (const n of visibleNodes) {
      const d = depth.get(n.id) ?? 0;
      const idx = depthCounters.get(d) ?? 0;
      depthCounters.set(d, idx + 1);
      posCache.set(n.id, { x: d * COL_GAP, y: idx * ROW_GAP });
    }
    getPosition = (nodeId) => posCache.get(nodeId) ?? { x: 0, y: 0 };
  }

  // applyMode 우선순위 맵
  const APPLY_MODE_PRIORITY: Record<string, number> = {
    readonly: 4,
    code: 3,
    restart: 2,
    runtime: 1,
  };

  /** configFields에서 대표 applyMode 계산 (가장 제약 강한 값 우선) */
  function getRepresentativeApplyMode(toolId: string): string | undefined {
    const entry = getToolEntry(toolId);
    if (!entry || !entry.configFields || entry.configFields.length === 0) return undefined;
    let best: string | undefined;
    let bestPriority = -1;
    for (const field of entry.configFields) {
      const mode = field.applyMode;
      if (mode) {
        const priority = APPLY_MODE_PRIORITY[mode] ?? 0;
        if (priority > bestPriority) {
          bestPriority = priority;
          best = mode;
        }
      }
    }
    return best;
  }

  // route 노드별 condition 목록 수집 (condition 있는 엣지의 소스 노드 기준)
  const nodeConditions = new Map<string, string[]>();
  for (const e of visibleEdges) {
    if (e.condition) {
      const list = nodeConditions.get(e.from) ?? [];
      list.push(e.condition);
      nodeConditions.set(e.from, list);
    }
  }

  // 4. FlowNode 생성
  const nodes: FlowNode[] = visibleNodes.map(n => {
    const entry = getToolEntry(n.tool);
    const displayName = n.displayNameOverride ?? (entry ? entry.displayName : (n.tool || n.id));
    const catalogData = entry
      ? { displayName, vendor: entry.vendor, icon: entry.icon, accent: entry.accent }
      : { displayName, vendor: 'Unknown', icon: '❓', accent: '#6B7280' };

    const applyMode = getRepresentativeApplyMode(n.tool);
    const conditions = nodeConditions.get(n.id);
    const outputs = conditions && conditions.length > 0
      ? conditions.map(c => `source-${c}`)
      : undefined;

    return {
      id: n.id,
      type: 'tool',
      position: getPosition(n.id),
      data: {
        label: `${catalogData.icon} ${catalogData.displayName}\n[${n.role}]`,
        ...catalogData,
        role: n.role,
        trigger: n.trigger ?? false,
        isInfra: view === 'infra',
        outOfTeamScope: n.outOfTeamScope ?? false,
        deployStatus: n.deployStatus ?? 'active',
        ...(applyMode !== undefined ? { applyMode } : {}),
        ...(outputs !== undefined ? { outputs } : {}),
      },
    };
  });

  // 6. FlowEdge 생성
  const edges: FlowEdge[] = visibleEdges.map((e, i) => ({
    id: `e-${e.from}-${e.to}-${i}`,
    source: e.from,
    target: e.to,
    animated: view === 'data',
    label: e.condition ?? undefined,
    ...(e.condition ? { sourceHandle: `source-${e.condition}` } : {}),
  }));

  return { nodes, edges };
}

// 위상정렬 + 최장경로 depth 계산
function computeDepths(
  nodes: ToolNode[],
  edges: { from: string; to: string }[]
): Map<string, number> {
  const successors = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const n of nodes) {
    successors.set(n.id, []);
    inDegree.set(n.id, 0);
  }
  for (const e of edges) {
    successors.get(e.from)?.push(e.to);
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
  }

  const depth = new Map<string, number>();
  const queue: string[] = [];

  // 소스 노드(진입차수 0)에서 시작
  for (const n of nodes) {
    if ((inDegree.get(n.id) ?? 0) === 0) {
      depth.set(n.id, 0);
      queue.push(n.id);
    }
  }

  // BFS로 최장경로 depth 계산
  while (queue.length > 0) {
    const id = queue.shift()!;
    const d = depth.get(id) ?? 0;
    for (const succ of successors.get(id) ?? []) {
      const newDepth = Math.max(depth.get(succ) ?? 0, d + 1);
      const isNewOrBetter = !depth.has(succ) || depth.get(succ)! < newDepth;
      depth.set(succ, newDepth);
      inDegree.set(succ, (inDegree.get(succ) ?? 0) - 1);
      if ((inDegree.get(succ) ?? 0) === 0 || isNewOrBetter) {
        if (!queue.includes(succ)) queue.push(succ);
      }
    }
  }

  // 사이클·미방문 fallback
  const maxDepth = depth.size > 0 ? Math.max(...depth.values()) : 0;
  for (const n of nodes) {
    if (!depth.has(n.id)) depth.set(n.id, maxDepth + 1);
  }

  return depth;
}

