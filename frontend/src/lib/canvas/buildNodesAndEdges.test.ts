import { describe, it, expect } from 'vitest';
import { buildNodesAndEdges, KIND_X, KIND_STYLE } from './buildNodesAndEdges.js';
import type { CanvasTopology } from '$lib/api/types.js';

const sampleTopology: CanvasTopology = {
  nodes: [
    { id: 'src-rdb', kind: 'source', tool: 'Debezium', config: {} },
    { id: 'src-s3',  kind: 'source', tool: 'S3',       config: {} },
    { id: 'mask',    kind: 'task',   tool: 'Masking',   config: {} },
    { id: 'sw1',     kind: 'switch', tool: 'DocRouter', config: { field: 'doc_type' } },
    { id: 'es-sink', kind: 'sink',   tool: 'ES',        config: {} },
    { id: 's3-sink', kind: 'sink',   tool: 'S3',        config: {} },
  ],
  edges: [
    { from: 'src-rdb', to: 'mask' },
    { from: 'src-s3',  to: 'mask' },
    { from: 'mask',    to: 'sw1' },
    { from: 'sw1',     to: 'es-sink', condition: 'structured' },
    { from: 'sw1',     to: 's3-sink', condition: 'unstructured' },
  ],
};

describe('buildNodesAndEdges', () => {
  it('Right: 샘플 토폴로지에서 모든 노드·엣지를 생성한다', () => {
    const { nodes, edges } = buildNodesAndEdges(sampleTopology);
    expect(nodes).toHaveLength(sampleTopology.nodes.length);
    expect(edges).toHaveLength(sampleTopology.edges.length);
  });

  it('Right: 4종 kind가 각자 올바른 x 오프셋을 갖는다', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology);
    for (const n of nodes) {
      const orig = sampleTopology.nodes.find(o => o.id === n.id)!;
      expect(n.position.x).toBe(KIND_X[orig.kind]);
    }
  });

  it('Right: 4종 kind 시각 구분 style이 적용된다', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology);
    for (const n of nodes) {
      const orig = sampleTopology.nodes.find(o => o.id === n.id)!;
      expect(n.style).toBe(KIND_STYLE[orig.kind]);
    }
  });

  it('B(경계): 빈 토폴로지에서 빈 배열 반환, 크래시 없음', () => {
    const { nodes, edges } = buildNodesAndEdges({ nodes: [], edges: [] });
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });

  it('B(경계): 노드 1개 + 엣지 없는 최소 DAG에서 크래시 없음', () => {
    const topo: CanvasTopology = {
      nodes: [{ id: 'solo', kind: 'task', tool: 'Solo', config: {} }],
      edges: [],
    };
    const { nodes, edges } = buildNodesAndEdges(topo);
    expect(nodes).toHaveLength(1);
    expect(edges).toHaveLength(0);
  });

  it('I(역·부정): 존재하지 않는 노드를 가리키는 엣지는 무시한다', () => {
    const topo: CanvasTopology = {
      nodes: [{ id: 'a', kind: 'source', tool: 'A', config: {} }],
      edges: [
        { from: 'a',      to: 'ghost' },
        { from: 'ghost2', to: 'a' },
      ],
    };
    const { edges } = buildNodesAndEdges(topo);
    expect(edges).toHaveLength(0);
  });

  it('C(교차): 렌더된 노드 수 == topology.nodes.length', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology);
    expect(nodes).toHaveLength(sampleTopology.nodes.length);
  });

  it('C(교차): fan-in — 여러 Source가 같은 Task로 연결된다', () => {
    const { edges } = buildNodesAndEdges(sampleTopology);
    const toMask = edges.filter(e => e.target === 'mask');
    expect(toMask.length).toBeGreaterThanOrEqual(2);
  });

  it('C(교차): fan-out — 하나의 Switch에서 여러 Sink로 연결된다', () => {
    const { edges } = buildNodesAndEdges(sampleTopology);
    const fromSw = edges.filter(e => e.source === 'sw1');
    expect(fromSw.length).toBeGreaterThanOrEqual(2);
  });

  it('C(교차): branch — Switch 엣지에 condition이 label로 전달된다', () => {
    const { edges } = buildNodesAndEdges(sampleTopology);
    const sw = edges.find(e => e.source === 'sw1' && e.target === 'es-sink');
    expect(sw?.label).toBe('structured');
  });

  it('Range: ToolNode.kind가 4종 범위 안에서만 style이 존재한다', () => {
    const kinds: Array<'source' | 'task' | 'switch' | 'sink'> = ['source', 'task', 'switch', 'sink'];
    expect(Object.keys(KIND_STYLE)).toEqual(expect.arrayContaining(kinds));
  });
});
