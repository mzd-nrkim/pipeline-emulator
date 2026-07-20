import { describe, it, expect } from 'vitest';
import { buildNodesAndEdges } from './buildNodesAndEdges.js';
import type { CanvasTopology } from '$lib/api/types.js';
import { getToolEntry } from './toolCatalog.js';

/**
 * 새 토폴로지 (hyundaimotor-lllm 파이프라인 반영, Phase B 재설계):
 *   fan-in  : debezium + nifi + dam → s3-bronze (3 ingest → 1 store)
 *   trigger : airflow (transform, trigger=true)
 *   task 체인: airflow → presidio → docling → kure → valkey
 *   fan-out : valkey → es + mysql (data 채널)
 *   dependency: es → kibana (dependency 채널만)
 *              mysql-container → debezium, mysql-container → nifi (dependency 채널만)
 *   총 노드 수: 13 (mysql-container 추가), 총 엣지 수: 13 (data:10, dependency:3)
 */
const sampleTopology: CanvasTopology = {
  nodes: [
    /* Ingest (fan-in 3개) */
    { id: 'node-debezium',  role: 'ingest',     tool: 'debezium',          config: {} },
    { id: 'node-nifi',      role: 'ingest',     tool: 'apache-nifi',       config: {} },
    { id: 'node-dam',       role: 'ingest',     tool: 'dam',               config: {} },
    /* Store - Bronze */
    { id: 'node-s3-bronze', role: 'store',      tool: 's3',                config: {} },
    /* Transform - Trigger */
    { id: 'node-airflow',   role: 'transform',  tool: 'apache-airflow',    config: { dagId: 'lllm_pipeline' }, trigger: true },
    /* Transform 체인 */
    { id: 'node-presidio',  role: 'transform',  tool: 'presidio',          config: {} },
    { id: 'node-docling',   role: 'transform',  tool: 'docling-langchain', config: {} },
    { id: 'node-kure',      role: 'transform',  tool: 'kure-embedding',    config: {} },
    /* Broker */
    { id: 'node-valkey',    role: 'broker',     tool: 'valkey',            config: {} },
    /* Index */
    { id: 'node-es',        role: 'index',      tool: 'elasticsearch',     config: {} },
    /* Visualize */
    { id: 'node-kibana',    role: 'visualize',  tool: 'kibana',            config: {} },
    /* Store - Silver/Gold */
    { id: 'node-mysql',     role: 'store',      tool: 'mysql',             config: {} },
    /* Infra: mysql-container (dependency 소스) */
    { id: 'node-mysql-container', role: 'store' as const, tool: 'mysql', config: { host: 'mysql', port: 3306 } },
  ],
  edges: [
    /* fan-in: 3 ingest → s3-bronze (data) */
    { from: 'node-debezium',  to: 'node-s3-bronze', channels: ['data'] },
    { from: 'node-nifi',      to: 'node-s3-bronze', channels: ['data'] },
    { from: 'node-dam',       to: 'node-s3-bronze', channels: ['data'] },
    /* s3-bronze → airflow 직결 (branch 제거) */
    { from: 'node-s3-bronze', to: 'node-airflow',   channels: ['data'] },
    /* transform 체인 (data) */
    { from: 'node-airflow',   to: 'node-presidio',  channels: ['data'] },
    { from: 'node-presidio',  to: 'node-docling',   channels: ['data'] },
    { from: 'node-docling',   to: 'node-kure',      channels: ['data'] },
    { from: 'node-kure',      to: 'node-valkey',    channels: ['data'] },
    /* fan-out: valkey → es + mysql (data) */
    { from: 'node-valkey',    to: 'node-es',        channels: ['data'],       condition: 'elasticsearch' },
    { from: 'node-valkey',    to: 'node-mysql',     channels: ['data'],       condition: 'mysql' },
    /* kibana: dependency 채널만 */
    { from: 'node-es',        to: 'node-kibana',    channels: ['dependency'] },
    /* infra: mysql-container → debezium/nifi (dependency) */
    { from: 'node-mysql-container', to: 'node-debezium', channels: ['dependency'] as ('data' | 'dependency')[] },
    { from: 'node-mysql-container', to: 'node-nifi',     channels: ['dependency'] as ('data' | 'dependency')[] },
  ],
};

describe('buildNodesAndEdges', () => {
  /* ── Right: 기본 동작 ────────────────────────────────────────── */

  it('Right: data 뷰에서 data 채널 노드·엣지를 생성한다', () => {
    const { nodes, edges } = buildNodesAndEdges(sampleTopology, 'data');
    // kibana는 dependency only → data 뷰에서 미표시 (11노드)
    expect(nodes).toHaveLength(11);
    // data 채널 엣지 10개
    expect(edges).toHaveLength(10);
  });

  it('Right: 데이터뷰 위상정렬 X좌표가 단조 증가(Ordering)', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology, 'data');
    // 각 노드의 x 좌표는 0 이상이고 COL_GAP(280) 단위
    for (const n of nodes) {
      expect(n.position.x).toBeGreaterThanOrEqual(0);
      expect(n.position.x % 280).toBe(0);
    }
    // 소스(debezium/nifi/dam)가 최소 x, 말단(es/mysql)이 최대 x
    const debeziumNode = nodes.find(n => n.id === 'node-debezium')!;
    const esNode = nodes.find(n => n.id === 'node-es')!;
    expect(debeziumNode.position.x).toBeLessThan(esNode.position.x);
  });

  it('Right: 노드 type이 "tool"이다', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology, 'data');
    for (const n of nodes) {
      expect(n.type).toBe('tool');
    }
  });

  /* ── B(경계): 빈/최소 토폴로지 ──────────────────────────────── */

  it('B(경계): 빈 토폴로지에서 빈 배열 반환, 크래시 없음', () => {
    const { nodes, edges } = buildNodesAndEdges({ nodes: [], edges: [] });
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });

  it('빈 topology 크래시 없음 (infra 뷰)', () => {
    expect(() => buildNodesAndEdges({ nodes: [], edges: [] }, 'infra')).not.toThrow();
  });

  /* ── I(역·부정): ghost 노드·채널 필터 ───────────────────────── */

  it('I(역·부정): 존재하지 않는 노드를 가리키는 엣지는 무시한다', () => {
    const topo: CanvasTopology = {
      nodes: [{ id: 'a', role: 'ingest', tool: 'A', config: {} }],
      edges: [
        { from: 'a',      to: 'ghost',  channels: ['data'] },
        { from: 'ghost2', to: 'a',      channels: ['data'] },
      ],
    };
    const { edges } = buildNodesAndEdges(topo, 'data');
    expect(edges).toHaveLength(0);
  });

  /* ── 채널 필터 ───────────────────────────────────────────────── */

  it('채널 필터: data 뷰에서 kibana(dependency only) 미표시', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology, 'data');
    const kibana = nodes.find(n => n.id === 'node-kibana');
    expect(kibana).toBeUndefined();
  });

  it('채널 필터: infra 뷰에서 dependency 노드만 표시 (es·kibana·mysql-container·debezium·nifi)', () => {
    const { nodes, edges } = buildNodesAndEdges(sampleTopology, 'infra');
    // dependency 채널 엣지: es→kibana, mysql-container→debezium, mysql-container→nifi (3개)
    expect(edges).toHaveLength(3);
    // dependency에 관여하는 노드만: es, kibana, mysql-container, debezium, nifi
    expect(nodes).toHaveLength(5);
    const ids = nodes.map(n => n.id);
    expect(ids).toContain('node-es');
    expect(ids).toContain('node-kibana');
    expect(ids).toContain('node-mysql-container');
    expect(ids).toContain('node-debezium');
    expect(ids).toContain('node-nifi');
  });

  it('infra 뷰: dependency 엣지만 포함, mysql-container·debezium·nifi·es·kibana 표시', () => {
    const { nodes, edges } = buildNodesAndEdges(sampleTopology, 'infra');
    const nodeIds = nodes.map(n => n.id);
    expect(nodeIds).toContain('node-mysql-container');
    expect(nodeIds).toContain('node-debezium');
    expect(nodeIds).toContain('node-nifi');
    expect(nodeIds).toContain('node-es');
    expect(nodeIds).toContain('node-kibana');
    // data-only 노드는 infra 뷰에서 숨김
    expect(nodeIds).not.toContain('node-airflow');
    expect(nodeIds).not.toContain('node-presidio');
    expect(edges.every(e => !e.animated)).toBe(true); // infra 뷰는 animated=false
  });

  it('infra 뷰: mysql-container의 Y좌표가 debezium/nifi보다 작음 (계층 순서: storage < ingestion)', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology, 'infra');
    const mysqlNode = nodes.find(n => n.id === 'node-mysql-container');
    const debeziumNode = nodes.find(n => n.id === 'node-debezium');
    expect(mysqlNode).toBeDefined();
    expect(debeziumNode).toBeDefined();
    // infra 뷰는 Y축으로 계층 분리(storage < ingestion), X축은 동일 계층 내 순서
    expect(mysqlNode!.position.y).toBeLessThan(debeziumNode!.position.y);
  });

  it('뷰 왕복: data→infra→data 전환 후 data 뷰 엣지 수 동일', () => {
    const { edges: dataEdges1 } = buildNodesAndEdges(sampleTopology, 'data');
    buildNodesAndEdges(sampleTopology, 'infra'); // infra 뷰 전환
    const { edges: dataEdges2 } = buildNodesAndEdges(sampleTopology, 'data');
    expect(dataEdges2.length).toBe(dataEdges1.length); // 상태 오염 없음
  });

  /* ── 카탈로그 조인 ───────────────────────────────────────────── */

  it('Right(카탈로그): 각 노드 data에 displayName·vendor·icon이 존재한다', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology, 'data');
    for (const n of nodes) {
      expect(n.data).toHaveProperty('displayName');
      expect(n.data).toHaveProperty('vendor');
      expect(n.data).toHaveProperty('icon');
      expect(typeof n.data.displayName).toBe('string');
      expect(n.data.displayName.length).toBeGreaterThan(0);
    }
  });

  it('Right(카탈로그): label이 "아이콘 표시명" 형태 (공백 포함, 비어있지 않음)', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology, 'data');
    for (const n of nodes) {
      expect(n.data.label).toMatch(/.+ .+/);
    }
  });

  it('B(경계·폴백): 미등록 tool id → 크래시 없이 displayName=id 폴백', () => {
    const topo: CanvasTopology = {
      nodes: [
        { id: 'node-unknown-a', role: 'ingest', tool: 'totally-unknown-tool-xyz', config: {} },
        { id: 'node-unknown-b', role: 'store',  tool: 'another-unknown',          config: {} },
      ],
      edges: [
        { from: 'node-unknown-a', to: 'node-unknown-b', channels: ['data'] },
      ],
    };
    const { nodes } = buildNodesAndEdges(topo, 'data');
    expect(nodes).toHaveLength(2);
    const unknownNode = nodes.find(n => n.id === 'node-unknown-a')!;
    expect(unknownNode.data.displayName).toBe('totally-unknown-tool-xyz');
    expect(unknownNode.data.vendor).toBe('Unknown');
    expect(unknownNode.data.icon).toBe('❓');
    expect(unknownNode.data.accent).toBe('#6B7280');
  });

  it('I(역): tool이 빈 문자열 → 폴백으로 node id 표시', () => {
    const topo: CanvasTopology = {
      nodes: [
        { id: 'node-empty-a', role: 'ingest', tool: '',         config: {} },
        { id: 'node-empty-b', role: 'store',  tool: 'some-tool', config: {} },
      ],
      edges: [
        { from: 'node-empty-a', to: 'node-empty-b', channels: ['data'] },
      ],
    };
    const { nodes } = buildNodesAndEdges(topo, 'data');
    expect(nodes).toHaveLength(2);
    const emptyToolNode = nodes.find(n => n.id === 'node-empty-a')!;
    // tool이 빈 문자열이면 node.id로 폴백
    expect(emptyToolNode.data.displayName).toBe('node-empty-a');
    expect(emptyToolNode.data.icon).toBe('❓');
  });

  /* ── Conformance: role 값 범위 ───────────────────────────────── */

  it('Conformance(값범위): data.role이 ToolRole 유니온 내 값', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology, 'data');
    const validRoles = new Set(['ingest', 'transform', 'route', 'store', 'index', 'broker', 'visualize']);
    for (const n of nodes) {
      expect(validRoles.has(n.data.role)).toBe(true);
    }
  });

  it('Range(configFields): 카탈로그 엔트리 configFields.type이 허용 범위 내', () => {
    const allowedTypes = new Set(['text', 'number', 'select', 'boolean']);
    for (const toolNode of sampleTopology.nodes) {
      const entry = getToolEntry(toolNode.tool);
      if (entry && entry.configFields) {
        for (const field of entry.configFields) {
          expect(allowedTypes.has(field.type)).toBe(true);
        }
      }
    }
  });

  it('Reference: sampleTopology의 모든 visible tool id가 displayName을 가진다', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology, 'data');
    for (const n of nodes) {
      expect(n.data.displayName).toBeTruthy();
      expect(typeof n.data.vendor).toBe('string');
    }
  });

  /* ── Cardinality: fan-in / fan-out ──────────────────────────── */

  it('Cardinality: fan-in(3→1) — s3-bronze로 들어오는 엣지가 정확히 3개', () => {
    const { edges } = buildNodesAndEdges(sampleTopology, 'data');
    const toS3Bronze = edges.filter(e => e.target === 'node-s3-bronze');
    expect(toS3Bronze).toHaveLength(3);
  });

  it('fan-in 3→s3-bronze 엣지 유지 (data view)', () => {
    const { edges } = buildNodesAndEdges(sampleTopology, 'data');
    const sources = edges.filter(e => e.target === 'node-s3-bronze').map(e => e.source);
    expect(sources).toContain('node-debezium');
    expect(sources).toContain('node-nifi');
    expect(sources).toContain('node-dam');
  });

  it('Cardinality: fan-out(1→2) — valkey에서 나가는 data 엣지가 정확히 2개 (kibana 제거로 mysql+es=2개)', () => {
    const { edges } = buildNodesAndEdges(sampleTopology, 'data');
    const fromValkey = edges.filter(e => e.source === 'node-valkey');
    expect(fromValkey).toHaveLength(2);
  });

  it('fan-out valkey→es, valkey→mysql 엣지 유지 (data view)', () => {
    const { edges } = buildNodesAndEdges(sampleTopology, 'data');
    const fromValkey = edges.filter(e => e.source === 'node-valkey');
    const targets = fromValkey.map(e => e.target);
    expect(targets).toContain('node-es');
    expect(targets).toContain('node-mysql');
  });

  /* ── trigger 필드 ──────────────────────────────────────────── */

  /* ── data.trigger 필드 ───────────────────────────────────────── */

  it('airflow 노드 data.trigger === true', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology, 'data');
    const airflow = nodes.find(n => n.id === 'node-airflow')!;
    expect(airflow.data.trigger).toBe(true);
  });

  it('trigger 미설정 노드 data.trigger === false', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology, 'data');
    const debezium = nodes.find(n => n.id === 'node-debezium')!;
    expect(debezium.data.trigger).toBe(false);
  });

  /* ── infra 뷰 isInfra 플래그 ─────────────────────────────────── */

  it('infra 뷰에서 노드 data.isInfra === true', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology, 'infra');
    for (const n of nodes) {
      expect(n.data.isInfra).toBe(true);
    }
  });

  it('data 뷰에서 노드 data.isInfra === false', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology, 'data');
    for (const n of nodes) {
      expect(n.data.isInfra).toBe(false);
    }
  });

  /* ── applyMode 배지 ─────────────────────────────────────────── */

  it('applyMode: 카탈로그 configFields가 있는 노드는 applyMode가 정의된다', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology, 'data');
    // debezium은 all readonly → applyMode='readonly'
    const debezium = nodes.find(n => n.id === 'node-debezium')!;
    if (getToolEntry('debezium')?.configFields?.length) {
      expect(debezium.data.applyMode).toBeDefined();
      expect(['readonly', 'code', 'restart', 'runtime']).toContain(debezium.data.applyMode);
    }
  });

  it('applyMode: airflow는 readonly > code > runtime 혼재 → 대표값 readonly', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology, 'data');
    const airflow = nodes.find(n => n.id === 'node-airflow')!;
    // apache-airflow configFields: readonly, runtime, code 혼재 → 가장 제약 강한 readonly
    expect(airflow.data.applyMode).toBe('readonly');
  });

  it('applyMode: 미등록 tool은 applyMode 미정의', () => {
    const topo: CanvasTopology = {
      nodes: [
        { id: 'node-x', role: 'ingest', tool: 'totally-unknown-tool-xyz', config: {} },
        { id: 'node-y', role: 'store',  tool: 'another-unknown',          config: {} },
      ],
      edges: [{ from: 'node-x', to: 'node-y', channels: ['data'] }],
    };
    const { nodes } = buildNodesAndEdges(topo, 'data');
    const x = nodes.find(n => n.id === 'node-x')!;
    expect(x.data.applyMode).toBeUndefined();
  });

  /* ── route outputs / sourceHandle ───────────────────────────── */

  it('route outputs: condition 있는 엣지 소스 노드에 data.outputs 배열 생성', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology, 'data');
    // valkey → es(condition='elasticsearch'), valkey → mysql(condition='mysql')
    const valkey = nodes.find(n => n.id === 'node-valkey')!;
    expect(valkey.data.outputs).toBeDefined();
    expect(valkey.data.outputs).toContain('source-elasticsearch');
    expect(valkey.data.outputs).toContain('source-mysql');
    expect(valkey.data.outputs).toHaveLength(2);
  });

  it('route outputs: condition 없는 일반 노드는 data.outputs 미전달', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology, 'data');
    const debezium = nodes.find(n => n.id === 'node-debezium')!;
    expect(debezium.data.outputs).toBeUndefined();
  });

  it('sourceHandle: condition 있는 엣지에 sourceHandle 필드 설정', () => {
    const { edges } = buildNodesAndEdges(sampleTopology, 'data');
    const esEdge = edges.find(e => e.source === 'node-valkey' && e.target === 'node-es');
    expect(esEdge?.sourceHandle).toBe('source-elasticsearch');

    const mysqlEdge = edges.find(e => e.source === 'node-valkey' && e.target === 'node-mysql');
    expect(mysqlEdge?.sourceHandle).toBe('source-mysql');
  });

  it('sourceHandle: condition 없는 엣지는 sourceHandle 미설정', () => {
    const { edges } = buildNodesAndEdges(sampleTopology, 'data');
    const debeziumEdge = edges.find(e => e.source === 'node-debezium');
    expect(debeziumEdge?.sourceHandle).toBeUndefined();
  });

  /* ── animated 엣지 ───────────────────────────────────────────── */

  it('data 뷰 엣지 animated=true', () => {
    const { edges } = buildNodesAndEdges(sampleTopology, 'data');
    for (const e of edges) {
      expect(e.animated).toBe(true);
    }
  });

  it('infra 뷰 엣지 animated=false', () => {
    const { edges } = buildNodesAndEdges(sampleTopology, 'infra');
    for (const e of edges) {
      expect(e.animated).toBe(false);
    }
  });

  /* ── condition → label ───────────────────────────────────────── */

  it('condition이 있는 엣지는 label로 전달된다', () => {
    const { edges } = buildNodesAndEdges(sampleTopology, 'data');
    const esEdge = edges.find(e => e.source === 'node-valkey' && e.target === 'node-es');
    expect(esEdge?.label).toBe('elasticsearch');
  });
});
