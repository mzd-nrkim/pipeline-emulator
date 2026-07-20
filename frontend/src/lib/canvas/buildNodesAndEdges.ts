import type { CanvasTopology, ToolNode, ToolRole } from '$lib/api/types.js';
import { getToolEntry } from './toolCatalog.js';
import { computeForceLayout } from './forceLayout.js';

const COL_GAP = 280;
const ROW_GAP = 140;

export interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    toolId: string;
    category?: string;
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
    runtimeHealth: 'up' | 'down' | 'degraded' | 'unknown';
    parentId?: string;
    groupId?: string;
  };
  parentId?: string;
  extent?: 'parent';
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  animated: boolean;
  label?: string;
  labelStyle?: string;
  labelBgStyle?: string;
  labelBgPadding?: [number, number];
  labelBgBorderRadius?: number;
  labelClassName?: string;
  sourceHandle?: string;
  type?: string;
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
    // infra 뷰: force-directed 배치 (d3-force, 결정적 초기 좌표, 300 tick)
    const forcePositions = computeForceLayout(
      visibleNodes,
      visibleEdges.map(e => ({ source: e.from, target: e.to }))
    );
    const forcePosMap = new Map(forcePositions.map(p => [p.id, { x: p.x, y: p.y }]));
    getPosition = (nodeId) => forcePosMap.get(nodeId) ?? { x: 0, y: 0 };
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

    const nodeGroupId = (n as any).parentId as string | undefined;
    return {
      id: n.id,
      type: 'tool',
      position: getPosition(n.id),
      ...(nodeGroupId ? { parentId: nodeGroupId, extent: 'parent' as const } : {}),
      data: {
        label: `${catalogData.icon} ${catalogData.displayName}\n[${n.role}]`,
        toolId: n.tool,
        category: entry?.category,
        ...catalogData,
        role: n.role,
        trigger: n.trigger ?? false,
        isInfra: view === 'infra',
        outOfTeamScope: n.outOfTeamScope ?? false,
        deployStatus: n.deployStatus ?? 'active',
        runtimeHealth: n.runtimeHealth ?? 'unknown',
        ...(applyMode !== undefined ? { applyMode } : {}),
        ...(outputs !== undefined ? { outputs } : {}),
        ...(nodeGroupId ? { parentId: nodeGroupId } : {}),
      },
    };
  });

  // 6. FlowEdge 생성
  const edges: FlowEdge[] = visibleEdges.map((e, i) => {
    const condition = e.condition ?? undefined;
    const conditionClass = condition === 'true'
      ? 'edge-label-true'
      : condition === 'false'
        ? 'edge-label-false'
        : condition
          ? 'edge-label-default'
          : undefined;
    return {
      id: `e-${e.from}-${e.to}-${i}`,
      source: e.from,
      target: e.to,
      animated: view === 'data',
      label: condition ?? (e as any).viaTable,
      labelBgPadding: [6, 2] as [number, number],
      labelBgBorderRadius: 9999,
      labelStyle: 'font-size: 0.7rem; font-weight: 600; text-transform: lowercase;',
      labelBgStyle: 'fill-opacity: 1;',
      ...(conditionClass ? { labelClassName: conditionClass } : {}),
      ...(condition ? { sourceHandle: `source-${condition}` } : {}),
      ...(view === 'infra' ? { type: 'infra-floating' } : {}),
    };
  });

  // 5. group 노드 생성 (data뷰에서만, 그룹 소속 노드가 있을 때)
  // A-1/A-2/A-3 통합: 자식 0-origin 재배치 + 그룹 박스 크기 산출 + trigger:true
  const groupNodes: FlowNode[] = [];
  if (view === 'data') {
    // 노드들의 distinct parentId를 수집해 각 그룹 노드 생성 (하드코딩 제거)
    const groupParentIds = [...new Set(nodes.filter(n => n.parentId).map(n => n.parentId!))];
    const groupMeta: Record<string, { label: string; toolId: string; displayName: string; vendor: string; icon: string; accent: string; role: string }> = {
      'node-airflow-group': {
        label: 'Airflow (CeleryExecutor)',
        toolId: 'apache-airflow',
        displayName: 'Airflow (CeleryExecutor)',
        vendor: 'Apache',
        icon: '🌊',
        accent: '#017CEE',
        role: 'orchestrator',
      },
    };
    // 노드 폭 ≈ 200, 패딩: 좌우 60씩, 상하 60/100
    const NODE_WIDTH = 200;
    const PAD_X = 60;
    const PAD_TOP = 60;
    const PAD_BOTTOM = 100;
    const NODE_HEIGHT = 100;
    for (const groupId of groupParentIds) {
      const childNodes = nodes.filter(n => n.parentId === groupId);
      if (childNodes.length > 0) {
        // A-2: A-1 전에 원래 절대 좌표(위상정렬 결과)에서 그룹 박스 절대 position 캡처
        const origXs = childNodes.map(n => n.position.x);
        const origYs = childNodes.map(n => n.position.y);
        const absMinX = Math.min(...origXs);
        const absMinY = Math.min(...origYs);

        // A-1: 그룹 자식 0-origin 상대좌표 재배치 (x = idx*COL_GAP, y = 0)
        childNodes.forEach((child, idx) => {
          child.position = { x: idx * COL_GAP, y: 0 };
        });

        // A-2: 그룹 박스 크기 = 자식 수 기준 (0-origin 상대좌표)
        const childCount = childNodes.length;
        const groupWidth = (childCount - 1) * COL_GAP + NODE_WIDTH + PAD_X * 2;
        const groupHeight = NODE_HEIGHT + PAD_TOP + PAD_BOTTOM;

        const meta = groupMeta[groupId] ?? {
          label: groupId,
          toolId: 'unknown',
          displayName: groupId,
          vendor: 'Unknown',
          icon: '📦',
          accent: '#888888',
          role: 'group',
        };
        groupNodes.push({
          id: groupId,
          type: 'group',
          // A-2: 그룹 박스 절대 position = 원래 자식 절대 minX/minY - 패딩
          position: { x: absMinX - PAD_X, y: absMinY - PAD_TOP },
          data: {
            ...meta,
            // A-3: 그룹 노드에 trigger:true 부여
            trigger: true,
            deployStatus: 'active',
          },
          ...(({ width: groupWidth, height: groupHeight } as any)),
        });
      }
    }
  }

  // 그룹 노드를 앞에 놓아야 자식 노드가 그 위에 렌더됨
  return { nodes: [...groupNodes, ...nodes], edges };
}

/**
 * 헬스 폴링 헬퍼 — 5s 주기, 탭 비활성 중단, 실패 시 backoff(최대 30s)
 * @returns cleanup 함수 (clearInterval/clearTimeout)
 */
export function startHealthPolling(
  adapter: { fetchServiceHealth: () => Promise<Record<string, string>> },
  onUpdate: (health: Record<string, string>) => void
): () => void {
  const BASE_INTERVAL = 5000;
  const MAX_INTERVAL = 30000;

  let timerId: ReturnType<typeof setTimeout> | null = null;
  let currentInterval = BASE_INTERVAL;
  let destroyed = false;

  async function tick() {
    if (destroyed) return;
    if (typeof document !== 'undefined' && document.hidden) {
      // 탭 비활성 시 중단, 다음 visibility change 때 재개
      timerId = null;
      return;
    }
    try {
      const health = await adapter.fetchServiceHealth();
      onUpdate(health);
      currentInterval = BASE_INTERVAL;
    } catch {
      currentInterval = Math.min(currentInterval * 2, MAX_INTERVAL);
    }
    if (!destroyed) {
      timerId = setTimeout(tick, currentInterval);
    }
  }

  // 탭 가시성 복귀 시 즉시 재개
  function onVisibilityChange() {
    if (!document.hidden && timerId === null && !destroyed) {
      tick();
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  timerId = setTimeout(tick, BASE_INTERVAL);

  return () => {
    destroyed = true;
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
  };
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

