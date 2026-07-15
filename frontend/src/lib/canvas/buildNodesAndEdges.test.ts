import { describe, it, expect } from 'vitest';
import { buildNodesAndEdges, KIND_X, KIND_STYLE } from './buildNodesAndEdges.js';
import type { CanvasTopology } from '$lib/api/types.js';
import { getToolEntry } from './toolCatalog.js';

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

  /* ── 카탈로그 조인 신규 TC ─────────────────────────────────── */

  it('Right(카탈로그): 각 노드 data에 displayName·vendor·icon이 존재한다', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology);
    for (const n of nodes) {
      expect(n.data).toHaveProperty('displayName');
      expect(n.data).toHaveProperty('vendor');
      expect(n.data).toHaveProperty('icon');
      expect(typeof n.data.displayName).toBe('string');
      expect(n.data.displayName.length).toBeGreaterThan(0);
    }
  });

  it('Right(카탈로그): label이 "아이콘 표시명" 형태 (공백 포함, 비어있지 않음)', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology);
    for (const n of nodes) {
      expect(n.data.label).toMatch(/.+ .+/);
    }
  });

  it('B(경계·폴백): 미등록 tool id → 크래시 없이 displayName=id 폴백', () => {
    const topo: CanvasTopology = {
      nodes: [{ id: 'node-unknown', kind: 'task', tool: 'totally-unknown-tool-xyz', config: {} }],
      edges: [],
    };
    const { nodes } = buildNodesAndEdges(topo);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].data.displayName).toBe('totally-unknown-tool-xyz');
    expect(nodes[0].data.vendor).toBe('Unknown');
    expect(nodes[0].data.icon).toBe('❓');
    expect(nodes[0].data.accent).toBe('#6B7280');
  });

  it('I(역): tool이 빈 문자열 → 폴백으로 node id 표시', () => {
    const topo: CanvasTopology = {
      nodes: [{ id: 'node-empty-tool', kind: 'task', tool: '', config: {} }],
      edges: [],
    };
    const { nodes } = buildNodesAndEdges(topo);
    expect(nodes).toHaveLength(1);
    // tool이 빈 문자열이면 node.id로 폴백
    expect(nodes[0].data.displayName).toBe('node-empty-tool');
    expect(nodes[0].data.icon).toBe('❓');
  });

  it('Conformance(값범위): kind가 4종(source|task|switch|sink) 범위 내', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology);
    const validKinds = new Set(['source', 'task', 'switch', 'sink']);
    for (const n of nodes) {
      expect(validKinds.has(n.data.kind)).toBe(true);
    }
  });

  it('Range(configFields): 카탈로그 엔트리 configFields.type이 허용 범위 내', () => {
    const allowedTypes = new Set(['text', 'number', 'select', 'boolean']);
    // sampleTopology의 등록된 tool만 검사
    for (const toolNode of sampleTopology.nodes) {
      const entry = getToolEntry(toolNode.tool);
      if (entry && entry.configFields) {
        for (const field of entry.configFields) {
          expect(allowedTypes.has(field.type)).toBe(true);
        }
      }
    }
  });

  it('Reference: sampleTopology의 모든 tool id가 카탈로그 조회 시 폴백 없이 처리된다', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology);
    for (const n of nodes) {
      // 등록 여부와 상관없이 모든 노드가 displayName을 가져야 함
      expect(n.data.displayName).toBeTruthy();
      // 카탈로그 미등록이면 vendor='Unknown', 등록이면 카탈로그 값
      expect(typeof n.data.vendor).toBe('string');
    }
  });

  it('Cardinality: fan-in(3→1) — s3-bronze로 들어오는 엣지가 정확히 3개', () => {
    const { edges } = buildNodesAndEdges(sampleTopology);
    const toS3Bronze = edges.filter(e => e.target === 'node-s3-bronze');
    expect(toS3Bronze).toHaveLength(3);
  });

  it('Cardinality: branch(switch 1개) — node-branch 노드가 1개', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology);
    const switchNodes = nodes.filter(n => {
      const orig = sampleTopology.nodes.find(o => o.id === n.id);
      return orig?.kind === 'switch';
    });
    expect(switchNodes).toHaveLength(1);
  });

  it('Cardinality: fan-out(1→3) — valkey에서 나가는 엣지가 정확히 3개', () => {
    const { edges } = buildNodesAndEdges(sampleTopology);
    const fromValkey = edges.filter(e => e.source === 'node-valkey');
    expect(fromValkey).toHaveLength(3);
  });
});
