import { describe, it, expect } from 'vitest';
import { buildNodesAndEdges, KIND_X, KIND_STYLE } from './buildNodesAndEdges.js';
import type { CanvasTopology } from '$lib/api/types.js';

/**
 * 새 토폴로지 (hyundaimotor-lllm 파이프라인 반영):
 *   fan-in  : debezium + nifi + dam → s3-bronze (3 source → 1 sink)
 *   switch  : node-branch (1개)
 *   task 체인: airflow → presidio → docling → kure → valkey
 *   fan-out : valkey → es + kibana + mysql (3 sink)
 *   총 노드 수: 13, 총 엣지 수: 12
 */
const sampleTopology: CanvasTopology = {
  nodes: [
    /* Sources (fan-in 3개) */
    { id: 'node-debezium',  kind: 'source', tool: 'debezium',       config: {} },
    { id: 'node-nifi',      kind: 'source', tool: 'apache-nifi',    config: {} },
    { id: 'node-dam',       kind: 'source', tool: 'dam',            config: {} },
    /* Sink - Bronze */
    { id: 'node-s3-bronze', kind: 'sink',   tool: 's3',             config: {} },
    /* Switch */
    { id: 'node-branch',    kind: 'switch', tool: 'airflow-branch', config: { field: 'source_type' } },
    /* Tasks */
    { id: 'node-airflow',   kind: 'task',   tool: 'apache-airflow', config: { dagId: 'lllm_pipeline' } },
    { id: 'node-presidio',  kind: 'task',   tool: 'presidio',       config: {} },
    { id: 'node-docling',   kind: 'task',   tool: 'docling-langchain', config: {} },
    { id: 'node-kure',      kind: 'task',   tool: 'kure-embedding', config: {} },
    { id: 'node-valkey',    kind: 'task',   tool: 'valkey',         config: {} },
    /* Sinks (fan-out 3개) */
    { id: 'node-es',        kind: 'sink',   tool: 'elasticsearch',  config: {} },
    { id: 'node-kibana',    kind: 'sink',   tool: 'kibana',         config: {} },
    { id: 'node-mysql',     kind: 'sink',   tool: 'mysql',          config: {} },
  ],
  edges: [
    /* fan-in: 3 source → s3-bronze */
    { from: 'node-debezium',  to: 'node-s3-bronze' },
    { from: 'node-nifi',      to: 'node-s3-bronze' },
    { from: 'node-dam',       to: 'node-s3-bronze' },
    /* s3-bronze → branch → airflow */
    { from: 'node-s3-bronze', to: 'node-branch' },
    { from: 'node-branch',    to: 'node-airflow' },
    /* task 체인 */
    { from: 'node-airflow',   to: 'node-presidio' },
    { from: 'node-presidio',  to: 'node-docling' },
    { from: 'node-docling',   to: 'node-kure' },
    { from: 'node-kure',      to: 'node-valkey' },
    /* fan-out: valkey → 3 sink */
    { from: 'node-valkey',    to: 'node-es',     condition: 'elasticsearch' },
    { from: 'node-valkey',    to: 'node-kibana', condition: 'kibana' },
    { from: 'node-valkey',    to: 'node-mysql',  condition: 'mysql' },
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

  it('C(교차): fan-in — 3개 Source가 같은 Sink(s3-bronze)로 연결된다', () => {
    const { edges } = buildNodesAndEdges(sampleTopology);
    const toS3Bronze = edges.filter(e => e.target === 'node-s3-bronze');
    expect(toS3Bronze.length).toBeGreaterThanOrEqual(3);
  });

  it('C(교차): fan-out — Valkey에서 3개 Sink로 연결된다', () => {
    const { edges } = buildNodesAndEdges(sampleTopology);
    const fromValkey = edges.filter(e => e.source === 'node-valkey');
    expect(fromValkey.length).toBeGreaterThanOrEqual(3);
  });

  it('C(교차): branch — Switch 엣지에 condition이 label로 전달된다', () => {
    const { edges } = buildNodesAndEdges(sampleTopology);
    const sw = edges.find(e => e.source === 'node-valkey' && e.target === 'node-es');
    expect(sw?.label).toBe('elasticsearch');
  });

  it('Range: ToolNode.kind가 4종 범위 안에서만 style이 존재한다', () => {
    const kinds: Array<'source' | 'task' | 'switch' | 'sink'> = ['source', 'task', 'switch', 'sink'];
    expect(Object.keys(KIND_STYLE)).toEqual(expect.arrayContaining(kinds));
  });
});
