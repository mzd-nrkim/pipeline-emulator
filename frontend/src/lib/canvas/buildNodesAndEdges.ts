import type { CanvasTopology, ToolNode, ToolRole } from '$lib/api/types.js';
import { getToolEntry } from './toolCatalog.js';

const COL_GAP = 280;
const ROW_GAP = 140;
const ROUTE_Y = -48;
const EDGE_OFF = 24;

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
    collapsed?: boolean;
    childCount?: number;
    onTitleClick?: () => void;
    onToggleCollapse?: () => void;
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
  hideOrphans: boolean = true,
  collapsedGroups: Set<string> = new Set()
): { nodes: FlowNode[]; edges: FlowEdge[] } {

  // 1. 채널 필터: 현재 view에 해당하는 채널을 가진 엣지만 포함
  const nodeIdSet = new Set(topo.nodes.map(n => n.id));
  let visibleEdges = topo.edges.filter(e =>
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
  let visibleNodes = hideOrphans
    ? topo.nodes.filter(n => connectedIds.has(n.id))
    : topo.nodes;

  // B-2: data 뷰에서 그룹 컨테이너 노드(자식이 있는 노드)를 leaf 배열에서 제외
  if (view === 'data') {
    const containerIds = new Set(
      topo.nodes.filter(n => (n as any).parentId).map(n => (n as any).parentId as string)
    );
    visibleNodes = visibleNodes.filter(n => !containerIds.has(n.id));
  }

  // collapsed 그룹 처리: collapsedGroups에 속한 그룹의 자식 노드 ID set 수집
  const collapsedChildIds = new Set<string>();
  // childId → 소속 collapsed groupId 매핑 (경계 엣지 재배선에 사용)
  const childToGroup = new Map<string, string>();
  if (collapsedGroups.size > 0) {
    for (const node of topo.nodes) {
      const nodeParentId = (node as any).parentId as string | undefined;
      if (nodeParentId && collapsedGroups.has(nodeParentId)) {
        collapsedChildIds.add(node.id);
        childToGroup.set(node.id, nodeParentId);
      }
    }
    // visibleNodes에서 collapsed 그룹 자식 제외
    visibleNodes = visibleNodes.filter(n => !collapsedChildIds.has(n.id));
    // 경계 엣지 재배선: 양 끝∈C → drop, from∈C&&to∉C → (G,to), from∉C&&to∈C → (from,G), 둘 다∉C → 유지
    const seenEdgeKeys = new Set<string>();
    const rewiredEdges: typeof visibleEdges = [];
    for (const e of visibleEdges) {
      const fromInC = collapsedChildIds.has(e.from);
      const toInC = collapsedChildIds.has(e.to);
      if (fromInC && toInC) continue; // 내부 엣지 drop
      let newFrom = fromInC ? childToGroup.get(e.from)! : e.from;
      let newTo = toInC ? childToGroup.get(e.to)! : e.to;
      if (newFrom === newTo) continue; // self-loop drop (G→자신)
      const key = `${newFrom}->${newTo}`;
      if (seenEdgeKeys.has(key)) continue; // dedupe (C-2)
      seenEdgeKeys.add(key);
      rewiredEdges.push(fromInC || toInC ? { ...e, from: newFrom, to: newTo } : e);
    }
    visibleEdges = rewiredEdges;
  }

  // 3. 배치 계산: data·infra 공통 위상정렬 depth 계층 배치 (LR 방향)
  //    depth = X축(좌→우 의존 방향), 같은 depth = Y축 분산. 결정적·비겹침.
  // C-3: collapsed groupId를 정점으로 주입 — data 뷰에서 node-airflow 등 컨테이너는 visibleNodes에 없으므로
  // 재배선 엣지로 depth 산출을 위해 synthetic 정점으로 추가
  const collapsedGroupSyntheticNodes = [...collapsedGroups]
    .filter(gId => topo.nodes.some(n => (n as any).parentId === gId))
    .map(id => ({ id }) as import('$lib/api/types.js').ToolNode);
  const allDepthNodes = collapsedGroupSyntheticNodes.length > 0
    ? [...visibleNodes, ...collapsedGroupSyntheticNodes]
    : visibleNodes;
  const depth = computeDepths(allDepthNodes, visibleEdges);
  const depthCounters = new Map<number, number>();
  const posCache = new Map<string, { x: number; y: number }>();
  // visibleNodes + collapsed groupIds를 함께 posCache에 등록
  for (const n of allDepthNodes) {
    const d = depth.get(n.id) ?? 0;
    const idx = depthCounters.get(d) ?? 0;
    depthCounters.set(d, idx + 1);
    posCache.set(n.id, { x: d * COL_GAP, y: idx * ROW_GAP });
  }
  const getPosition = (nodeId: string) => posCache.get(nodeId) ?? { x: 0, y: 0 };

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
    const inDataView = view === 'data';
    return {
      id: n.id,
      type: 'tool',
      position: getPosition(n.id),
      ...(inDataView && nodeGroupId ? { parentId: nodeGroupId, extent: 'parent' as const } : {}),
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
        ...(inDataView && nodeGroupId ? { parentId: nodeGroupId } : {}),
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
    const depthGap = depth.get(e.to)! - depth.get(e.from)!;
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
      ...(view === 'infra'
        ? depthGap > 1
          ? { type: 'infra-step', class: 'infra-step', data: { routeY: ROUTE_Y } }
          : { type: 'smoothstep' }
        : {}),
    };
  });

  // 5. group 노드 생성 (data뷰에서만, 그룹 소속 노드가 있을 때)
  // A-1/A-2/A-3 통합: 자식 0-origin 재배치 + 그룹 박스 크기 산출 + trigger:true
  const groupNodes: FlowNode[] = [];
  if (view === 'data') {
    // 노드들의 distinct parentId를 수집해 각 그룹 노드 생성 (하드코딩 제거)
    // collapsed 그룹은 자식이 visibleNodes에서 제거됐으므로 topo.nodes에서도 수집
    const visibleGroupIds = new Set(nodes.filter(n => n.parentId).map(n => n.parentId!));
    for (const gId of collapsedGroups) {
      if (topo.nodes.some(n => (n as any).parentId === gId)) visibleGroupIds.add(gId);
    }
    const groupParentIds = [...visibleGroupIds];
    // 노드 폭 ≈ 200, 패딩: 좌우 60씩, 상하 60/100
    const NODE_WIDTH = 200;
    const PAD_X = 60;
    const PAD_TOP = 60;
    const PAD_BOTTOM = 100;
    const NODE_HEIGHT = 100;
    for (const groupId of groupParentIds) {
      const isCollapsed = collapsedGroups.has(groupId);
      const childNodes = nodes.filter(n => n.parentId === groupId);
      // collapsed 그룹은 자식이 visibleNodes에서 제거됐으므로 topo.nodes에서 실제 자식 수 산출
      const actualChildCount = isCollapsed
        ? topo.nodes.filter(n => (n as any).parentId === groupId).length
        : childNodes.length;

      if (actualChildCount === 0) continue;

      let absMinX = 0;
      let absMinY = 0;

      if (childNodes.length > 0) {
        // A-2: A-1 전에 원래 절대 좌표(위상정렬 결과)에서 그룹 박스 절대 position 캡처
        absMinX = Math.min(...childNodes.map(n => n.position.x));
        absMinY = Math.min(...childNodes.map(n => n.position.y));

        if (!isCollapsed) {
          // A-1: 원래 절대 x 기준 오름차순 정렬 (DAG 깊이 = 위상정렬 결과)
          const sortedChildren = [...childNodes].sort((a, b) => a.position.x - b.position.x);
          sortedChildren.forEach((child, idx) => {
            child.position = { x: PAD_X + idx * COL_GAP, y: PAD_TOP };
          });
        }
      }

      // A-2: 그룹 박스 크기 = 자식 수 기준 (0-origin 상대좌표)
      const groupWidth = (actualChildCount - 1) * COL_GAP + NODE_WIDTH + PAD_X * 2;
      const groupHeight = NODE_HEIGHT + PAD_TOP + PAD_BOTTOM;

      const container = topo.nodes.find(n => n.id === groupId);
      const containerEntry = getToolEntry(container?.tool ?? '');
      const meta = containerEntry
        ? {
            label: `${containerEntry.icon} ${containerEntry.displayName}`,
            toolId: container!.tool,
            displayName: containerEntry.displayName,
            vendor: containerEntry.vendor,
            icon: containerEntry.icon,
            accent: containerEntry.accent,
            role: (container as any).role ?? 'group',
          }
        : {
            label: '📦 ' + groupId,
            toolId: 'unknown',
            displayName: groupId,
            vendor: 'Unknown',
            icon: '📦',
            accent: '#888888',
            role: 'group',
          };
      const finalWidth = isCollapsed ? 200 : groupWidth;
      const finalHeight = isCollapsed ? 100 : groupHeight;
      groupNodes.push({
        id: groupId,
        type: 'group',
        // A-2: 그룹 박스 절대 position = 원래 자식 절대 minX/minY - 패딩
        position: isCollapsed ? getPosition(groupId) : { x: absMinX - PAD_X, y: absMinY - PAD_TOP },
        data: {
          ...meta,
          // A-3: 그룹 노드에 trigger:true 부여
          trigger: true,
          deployStatus: 'active',
          collapsed: isCollapsed,
          childCount: actualChildCount,
        },
        ...(({ width: finalWidth, height: finalHeight } as any)),
      });
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

