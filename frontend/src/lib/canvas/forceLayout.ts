import { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide } from 'd3-force';

/**
 * dependency 엣지 기반 결정적 force 배치 좌표 계산
 * - 초기 좌표: 인덱스 기반 원형 배치 (Math.random 미사용 → 결정적)
 * - force: 반발(-300) + 엣지 인력(150) + 중심(400,300) + 겹침방지(60)
 * - 동기 tick: 300회
 */
export function computeForceLayout(
  nodes: { id: string }[],
  edges: { source: string; target: string }[]
): { id: string; x: number; y: number }[] {
  if (nodes.length === 0) return [];

  const R = 200;
  const simNodes = nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    return {
      id: n.id,
      x: 400 + R * Math.cos(angle),
      y: 300 + R * Math.sin(angle),
    };
  });

  const simEdges = edges.map(e => ({ source: e.source, target: e.target }));

  const simulation = forceSimulation(simNodes)
    .force('charge', forceManyBody().strength(-300))
    .force(
      'link',
      forceLink<typeof simNodes[number], typeof simEdges[number]>(simEdges)
        .id(d => d.id)
        .distance(150)
    )
    .force('center', forceCenter(400, 300))
    .force('collide', forceCollide(60))
    .stop();

  for (let i = 0; i < 300; i++) {
    simulation.tick();
  }

  return simNodes.map(n => ({
    id: n.id,
    x: Number.isFinite(n.x) ? n.x : 0,
    y: Number.isFinite(n.y) ? n.y : 0,
  }));
}
