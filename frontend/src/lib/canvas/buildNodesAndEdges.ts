import type { CanvasTopology, ToolNode, ToolRole } from '$lib/api/types.js';
import { getToolEntry } from './toolCatalog.js';

// 데이터뷰 role 기반 스타일
export const ROLE_STYLE: Record<ToolRole, string> = {
  ingest:    'border: 2px solid #3b82f6; background: #eff6ff; padding: 8px; border-radius: 4px; font-size: 11px; cursor: pointer;',
  transform: 'border: 2px solid #22c55e; background: #f0fdf4; padding: 8px; border-radius: 4px; font-size: 11px; cursor: pointer;',
  route:     'border: 2px solid #f97316; background: #fff7ed; padding: 8px; border-radius: 4px; font-size: 11px; cursor: pointer;',
  store:     'border: 2px solid #a855f7; background: #faf5ff; padding: 8px; border-radius: 4px; font-size: 11px; cursor: pointer;',
  index:     'border: 2px solid #fec514; background: #fffbeb; padding: 8px; border-radius: 4px; font-size: 11px; cursor: pointer;',
  broker:    'border: 2px solid #dc382d; background: #fff1f1; padding: 8px; border-radius: 4px; font-size: 11px; cursor: pointer;',
  visualize: 'border: 2px solid #6b7280; background: #f9fafb; padding: 8px; border-radius: 4px; font-size: 11px; cursor: pointer;',
};

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
const INFRA_LAYER_ORDER = ['storage', 'ingestion', 'processing', 'serving', 'other'] as const;
type InfraLayer = typeof INFRA_LAYER_ORDER[number];

/** 노드 ID → infra 계층 매핑 */
const INFRA_LAYER_MAP: Record<string, InfraLayer> = {
  // storage: 인프라 컨테이너 / 스토리지
  'node-mysql-container': 'storage',
  'node-seaweedfs':       'storage',
  'node-valkey':          'storage',
  'node-es':              'storage',
  'node-mysql':           'storage',
  's3':                   'storage',
  'node-s3-bronze':       'storage',
  // ingestion: 수집 도구
  'node-debezium':        'ingestion',
  'node-nifi':            'ingestion',
  'node-dam':             'ingestion',
  // processing: 처리 / 오케스트레이션
  'node-airflow':         'processing',
  'node-presidio':        'processing',
  'node-docling':         'processing',
  'node-kure':            'processing',
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
  };
  style?: string;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  animated: boolean;
  label?: string;
}

export function buildNodesAndEdges(
  topo: CanvasTopology,
  view: 'data' | 'infra' = 'data'
): { nodes: FlowNode[]; edges: FlowEdge[] } {

  // 1. 채널 필터: 현재 view에 해당하는 채널을 가진 엣지만 포함
  const nodeIdSet = new Set(topo.nodes.map(n => n.id));
  const visibleEdges = topo.edges.filter(e =>
    nodeIdSet.has(e.from) &&
    nodeIdSet.has(e.to) &&
    e.channels.includes(view === 'data' ? 'data' : 'dependency')
  );

  // 2. 가시 그래프에서 연결된 노드 ID 집합 (고아 노드 숨김)
  const connectedIds = new Set<string>();
  for (const e of visibleEdges) {
    connectedIds.add(e.from);
    connectedIds.add(e.to);
  }
  const visibleNodes = topo.nodes.filter(n => connectedIds.has(n.id));

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

  // 4. FlowNode 생성
  const nodes: FlowNode[] = visibleNodes.map(n => {
    const entry = getToolEntry(n.tool);
    const catalogData = entry
      ? { displayName: entry.displayName, vendor: entry.vendor, icon: entry.icon, accent: entry.accent }
      : { displayName: n.tool || n.id, vendor: 'Unknown', icon: '❓', accent: '#6B7280' };

    const style = getNodeStyle(n, view, catalogData.accent);

    return {
      id: n.id,
      type: 'lrnode',
      position: getPosition(n.id),
      data: {
        label: `${catalogData.icon} ${catalogData.displayName}\n[${n.role}]`,
        ...catalogData,
        role: n.role,
        trigger: n.trigger ?? false,
      },
      style,
    };
  });

  // 6. FlowEdge 생성
  const edges: FlowEdge[] = visibleEdges.map((e, i) => ({
    id: `e-${e.from}-${e.to}-${i}`,
    source: e.from,
    target: e.to,
    animated: view === 'data',
    label: e.condition ?? undefined,
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

function getNodeStyle(n: ToolNode, view: 'data' | 'infra', accentColor: string): string {
  if (view === 'infra') {
    return `border: 2px solid ${accentColor}; background: #f9fafb; padding: 8px; border-radius: 4px; font-size: 11px; cursor: pointer;`;
  }
  const base = ROLE_STYLE[n.role] ?? ROLE_STYLE.transform;
  return n.trigger ? base.replace('border: 2px solid', 'border: 2px dashed') : base;
}
