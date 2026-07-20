import { describe, it, expect } from 'vitest';
import { buildNodesAndEdges } from './buildNodesAndEdges.js';
import type { CanvasTopology } from '$lib/api/types.js';
import { getToolEntry } from './toolCatalog.js';

/**
 * 새 토폴로지 (hyundaimotor-lllm 파이프라인 반영, 교정된 데이터 흐름):
 *   fan-in  : debezium + nifi + dam → s3-bronze (3 ingest → 1 store)
 *   trigger : airflow (transform, trigger=true)
 *   task 체인: airflow → docling(silver_1) → presidio(silver_2) → kure(gold_3) → mock-api(gold_4)
 *   fan-out : mock-api → es + mysql (data 채널)
 *   dependency: es → kibana
 *              mysql-container → debezium
 *              valkey → debezium, valkey → airflow (Celery 브로커 / CDC Redis 싱크)
 *   Valkey: infra 노드 (데이터 체인에서 제거, dependency 채널 전용)
 *   총 노드 수: 14 (mock-api 추가, valkey=infra), 총 엣지 수: 14 (data:10, dependency:4)
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
    /* Transform 체인: docling(silver_1)→presidio(silver_2)→kure(gold_3)→mock-api(gold_4) */
    { id: 'node-docling',   role: 'transform',  tool: 'docling-langchain', config: {} },
    { id: 'node-presidio',  role: 'transform',  tool: 'presidio',          config: {} },
    { id: 'node-kure',      role: 'transform',  tool: 'kure-embedding',    config: {} },
    { id: 'node-mock-api',  role: 'transform',  tool: 'presidio',          config: {} },
    /* Infra: Valkey (dependency 채널 전용, 데이터 체인에서 제거) */
    { id: 'node-valkey',    role: 'broker',         tool: 'valkey',        config: {} },
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
    /* s3-bronze → airflow 직결 */
    { from: 'node-s3-bronze', to: 'node-airflow',   channels: ['data'] },
    /* transform 체인: airflow→docling→presidio→kure→mock-api (data) */
    { from: 'node-airflow',   to: 'node-docling',   channels: ['data'] },
    { from: 'node-docling',   to: 'node-presidio',  channels: ['data'] },
    { from: 'node-presidio',  to: 'node-kure',      channels: ['data'] },
    { from: 'node-kure',      to: 'node-mock-api',  channels: ['data'] },
    /* fan-out: mock-api → es + mysql (data) */
    { from: 'node-mock-api',  to: 'node-es',        channels: ['data'],       condition: 'elasticsearch' },
    { from: 'node-mock-api',  to: 'node-mysql',     channels: ['data'],       condition: 'mysql' },
    /* dependency 채널: es → kibana */
    { from: 'node-es',        to: 'node-kibana',    channels: ['dependency'] as ('data' | 'dependency')[] },
    /* dependency 채널: mysql-container → debezium */
    { from: 'node-mysql-container', to: 'node-debezium', channels: ['dependency'] as ('data' | 'dependency')[] },
    /* dependency 채널: valkey → debezium (CDC Redis Stream 싱크) */
    { from: 'node-valkey',    to: 'node-debezium',  channels: ['dependency'] as ('data' | 'dependency')[] },
    /* dependency 채널: valkey → airflow (Celery 브로커) */
    { from: 'node-valkey',    to: 'node-airflow',   channels: ['dependency'] as ('data' | 'dependency')[] },
  ],
};

describe('buildNodesAndEdges', () => {
  /* ── Right: 기본 동작 ────────────────────────────────────────── */

  it('Right: data 뷰에서 data 채널 노드·엣지를 생성한다', () => {
    const { nodes, edges } = buildNodesAndEdges(sampleTopology, 'data');
    // kibana(dependency only)·valkey(infra)·mysql-container(dependency only) → data 뷰 미표시
    // 14노드 - 3 = 11노드
    expect(nodes).toHaveLength(11);
    // data 채널 엣지 10개 (3 fan-in + s3→airflow + 4 체인 + 2 fan-out)
    expect(edges).toHaveLength(10);
  });

  it('Right: 데이터뷰 위상정렬 X좌표가 단조 증가(Ordering)', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology, 'data');
    // 각 노드의 x 좌표는 0 이상이고 COL_GAP(280) 단위
    for (const n of nodes) {
      expect(n.position.x).toBeGreaterThanOrEqual(0);
      expect(n.position.x % 280).toBe(0);
    }
    // 소스(debezium/nifi/dam)가 최소 x, 말단(mock-api→es/mysql)이 최대 x
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

  it('채널 필터: infra 뷰에서 dependency 노드만 표시 (es·kibana·mysql-container·debezium·valkey·airflow)', () => {
    const { nodes, edges } = buildNodesAndEdges(sampleTopology, 'infra');
    // dependency 채널 엣지: es→kibana, mysql-container→debezium, valkey→debezium, valkey→airflow (4개)
    expect(edges).toHaveLength(4);
    // dependency에 관여하는 노드만: es, kibana, mysql-container, debezium, valkey, airflow
    expect(nodes).toHaveLength(6);
    const ids = nodes.map(n => n.id);
    expect(ids).toContain('node-es');
    expect(ids).toContain('node-kibana');
    expect(ids).toContain('node-mysql-container');
    expect(ids).toContain('node-debezium');
    expect(ids).toContain('node-valkey');
    expect(ids).toContain('node-airflow');
  });

  it('infra 뷰: dependency 엣지만 포함, mysql-container·debezium·valkey·airflow·es·kibana 표시', () => {
    const { nodes, edges } = buildNodesAndEdges(sampleTopology, 'infra');
    const nodeIds = nodes.map(n => n.id);
    expect(nodeIds).toContain('node-mysql-container');
    expect(nodeIds).toContain('node-debezium');
    expect(nodeIds).toContain('node-valkey');
    expect(nodeIds).toContain('node-airflow');
    expect(nodeIds).toContain('node-es');
    expect(nodeIds).toContain('node-kibana');
    // data-only 노드는 infra 뷰에서 숨김 (nifi는 dependency 엣지 없으므로 미표시)
    expect(nodeIds).not.toContain('node-presidio');
    expect(nodeIds).not.toContain('node-nifi');
    expect(edges.every(e => !e.animated)).toBe(true); // infra 뷰는 animated=false
  });

  // E-2: infra 뷰 회귀 테스트 — node-airflow 존재·dependency 엣지 유지 단언
  it('E-2(infra회귀): infra 뷰에서 node-airflow 노드가 존재한다', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology, 'infra');
    const airflow = nodes.find(n => n.id === 'node-airflow');
    expect(airflow).toBeDefined();
  });

  it('E-2(infra회귀): infra 뷰에서 node-airflow로 향하는 dependency 엣지(valkey→airflow)가 유지된다', () => {
    const { edges } = buildNodesAndEdges(sampleTopology, 'infra');
    const airflowEdge = edges.find(e => e.source === 'node-valkey' && e.target === 'node-airflow');
    expect(airflowEdge).toBeDefined();
  });

  it('E-2(infra회귀): infra 뷰에서 node-airflow가 data-edge 없이 dependency 엣지만 유지된다', () => {
    const { edges } = buildNodesAndEdges(sampleTopology, 'infra');
    // infra 뷰는 dependency 채널 엣지만 포함 — animated=false 확인
    const airflowEdges = edges.filter(e => e.target === 'node-airflow' || e.source === 'node-airflow');
    expect(airflowEdges.length).toBeGreaterThan(0);
    for (const e of airflowEdges) {
      expect(e.animated).toBe(false);
    }
  });

  it('infra 뷰: mysql-container와 debezium이 유한 좌표를 가진다 (force-directed 배치)', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology, 'infra');
    const mysqlNode = nodes.find(n => n.id === 'node-mysql-container');
    const debeziumNode = nodes.find(n => n.id === 'node-debezium');
    expect(mysqlNode).toBeDefined();
    expect(debeziumNode).toBeDefined();
    expect(Number.isFinite(mysqlNode!.position.x)).toBe(true);
    expect(Number.isFinite(mysqlNode!.position.y)).toBe(true);
    expect(Number.isFinite(debeziumNode!.position.x)).toBe(true);
    expect(Number.isFinite(debeziumNode!.position.y)).toBe(true);
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
    const validRoles = new Set(['ingest', 'transform', 'route', 'store', 'index', 'broker', 'coordinate', 'visualize']);
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

  it('Cardinality: fan-out(1→2) — mock-api에서 나가는 data 엣지가 정확히 2개 (es+mysql=2개)', () => {
    const { edges } = buildNodesAndEdges(sampleTopology, 'data');
    const fromMockApi = edges.filter(e => e.source === 'node-mock-api');
    expect(fromMockApi).toHaveLength(2);
  });

  it('fan-out mock-api→es, mock-api→mysql 엣지 유지 (data view)', () => {
    const { edges } = buildNodesAndEdges(sampleTopology, 'data');
    const fromMockApi = edges.filter(e => e.source === 'node-mock-api');
    const targets = fromMockApi.map(e => e.target);
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
    // mock-api → es(condition='elasticsearch'), mock-api → mysql(condition='mysql')
    const mockApi = nodes.find(n => n.id === 'node-mock-api')!;
    expect(mockApi.data.outputs).toBeDefined();
    expect(mockApi.data.outputs).toContain('source-elasticsearch');
    expect(mockApi.data.outputs).toContain('source-mysql');
    expect(mockApi.data.outputs).toHaveLength(2);
  });

  it('route outputs: condition 없는 일반 노드는 data.outputs 미전달', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology, 'data');
    const debezium = nodes.find(n => n.id === 'node-debezium')!;
    expect(debezium.data.outputs).toBeUndefined();
  });

  it('sourceHandle: condition 있는 엣지에 sourceHandle 필드 설정', () => {
    const { edges } = buildNodesAndEdges(sampleTopology, 'data');
    const esEdge = edges.find(e => e.source === 'node-mock-api' && e.target === 'node-es');
    expect(esEdge?.sourceHandle).toBe('source-elasticsearch');

    const mysqlEdge = edges.find(e => e.source === 'node-mock-api' && e.target === 'node-mysql');
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

  /* ── hideOrphans: 고아 노드 토글 ────────────────────────────── */

  it('hideOrphans=true(기본값): data 뷰 고아 노드 숨김 — 기존 동작 유지', () => {
    const { nodes: defaultNodes } = buildNodesAndEdges(sampleTopology, 'data');
    const { nodes: explicitTrue } = buildNodesAndEdges(sampleTopology, 'data', true);
    // 기본값과 명시적 true 결과가 동일
    expect(defaultNodes.length).toBe(explicitTrue.length);
    // kibana·mysql-container·valkey는 data 뷰에서 dependency-only/infra → 숨김
    const ids = defaultNodes.map(n => n.id);
    expect(ids).not.toContain('node-kibana');
    expect(ids).not.toContain('node-mysql-container');
    expect(ids).not.toContain('node-valkey');
  });

  it('hideOrphans=false: data 뷰에서 연결 없는 노드도 표시', () => {
    const { nodes: withOrphans } = buildNodesAndEdges(sampleTopology, 'data', false);
    const { nodes: withoutOrphans } = buildNodesAndEdges(sampleTopology, 'data', true);
    expect(withOrphans.length).toBeGreaterThan(withoutOrphans.length);
    const ids = withOrphans.map(n => n.id);
    expect(ids).toContain('node-kibana');
    expect(ids).toContain('node-mysql-container');
    expect(ids).toContain('node-valkey');
  });

  /* ── deployStatus 폴백 ───────────────────────────────────────── */

  it('deployStatus: 미지정 노드 data.deployStatus === "active" 폴백', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology, 'data');
    for (const n of nodes) {
      expect(n.data.deployStatus).toBe('active');
    }
  });

  it('deployStatus: planned 지정 노드 data.deployStatus === "planned"', () => {
    const topoWithStatus: CanvasTopology = {
      nodes: [
        { id: 'node-a', role: 'ingest', tool: 'debezium', config: {}, deployStatus: 'planned' as const },
        { id: 'node-b', role: 'store',  tool: 's3', config: {} },
      ],
      edges: [{ from: 'node-a', to: 'node-b', channels: ['data'] }],
    };
    const { nodes } = buildNodesAndEdges(topoWithStatus, 'data');
    const nodeA = nodes.find(n => n.id === 'node-a')!;
    const nodeB = nodes.find(n => n.id === 'node-b')!;
    expect(nodeA.data.deployStatus).toBe('planned');
    expect(nodeB.data.deployStatus).toBe('active');
  });

  /* ── displayNameOverride: per-node 라벨 override ────────────── */

  it('displayNameOverride: override 노드 카드 제목 = override 값', () => {
    const topoWithOverride: CanvasTopology = {
      nodes: [
        { id: 'node-source', role: 'store', tool: 'mysql', config: {}, displayNameOverride: 'MySQL 원본 DB' },
        { id: 'node-sink',   role: 'store', tool: 'mysql', config: {} },
      ],
      edges: [{ from: 'node-source', to: 'node-sink', channels: ['data'] }],
    };
    const { nodes } = buildNodesAndEdges(topoWithOverride, 'data');
    const source = nodes.find(n => n.id === 'node-source')!;
    const sink = nodes.find(n => n.id === 'node-sink')!;
    expect(source.data.displayName).toBe('MySQL 원본 DB');
    expect(sink.data.displayName).toBe('MySQL (Silver/Gold)');
  });

  it('displayNameOverride: 미지정 노드는 카탈로그 displayName 그대로', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology, 'data');
    const mysql = nodes.find(n => n.id === 'node-mysql')!;
    expect(mysql.data.displayName).toBe('MySQL (Silver/Gold)');
  });

  /* ── condition → label ───────────────────────────────────────── */

  it('condition이 있는 엣지는 label로 전달된다', () => {
    const { edges } = buildNodesAndEdges(sampleTopology, 'data');
    const esEdge = edges.find(e => e.source === 'node-mock-api' && e.target === 'node-es');
    expect(esEdge?.label).toBe('elasticsearch');
  });

  /* ── outOfTeamScope 전달 ─────────────────────────────────────── */

  it('outOfTeamScope: node-es data.outOfTeamScope === true (data 뷰)', () => {
    const topoWithScope: CanvasTopology = {
      nodes: [
        ...sampleTopology.nodes.map(n =>
          n.id === 'node-es' || n.id === 'node-kibana'
            ? { ...n, outOfTeamScope: true }
            : n
        ),
      ],
      edges: sampleTopology.edges,
    };
    const { nodes } = buildNodesAndEdges(topoWithScope, 'data');
    const esNode = nodes.find(n => n.id === 'node-es')!;
    expect(esNode).toBeDefined();
    expect(esNode.data.outOfTeamScope).toBe(true);
  });

  it('outOfTeamScope: node-kibana data.outOfTeamScope === true (infra 뷰)', () => {
    const topoWithScope: CanvasTopology = {
      nodes: [
        ...sampleTopology.nodes.map(n =>
          n.id === 'node-es' || n.id === 'node-kibana'
            ? { ...n, outOfTeamScope: true }
            : n
        ),
      ],
      edges: sampleTopology.edges,
    };
    const { nodes } = buildNodesAndEdges(topoWithScope, 'infra');
    const kibanaNode = nodes.find(n => n.id === 'node-kibana')!;
    expect(kibanaNode).toBeDefined();
    expect(kibanaNode.data.outOfTeamScope).toBe(true);
  });

  it('outOfTeamScope: 미설정 노드 data.outOfTeamScope === false', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology, 'data');
    const debeziumNode = nodes.find(n => n.id === 'node-debezium')!;
    expect(debeziumNode.data.outOfTeamScope).toBe(false);
  });

  /* ── INFRA_LAYER_MAP: node-es → serving 계층 ────────────────── */

  it('infra 뷰: node-es가 유한 좌표를 가진다 (force-directed 배치)', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology, 'infra');
    const esNode = nodes.find(n => n.id === 'node-es')!;
    const kibanaNode = nodes.find(n => n.id === 'node-kibana')!;
    expect(esNode).toBeDefined();
    expect(kibanaNode).toBeDefined();
    expect(Number.isFinite(esNode.position.x)).toBe(true);
    expect(Number.isFinite(esNode.position.y)).toBe(true);
    expect(Number.isFinite(kibanaNode.position.x)).toBe(true);
    expect(Number.isFinite(kibanaNode.position.y)).toBe(true);
  });

  it('infra 뷰: node-es·node-debezium이 유한 좌표를 가진다 (force-directed 배치)', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology, 'infra');
    const esNode = nodes.find(n => n.id === 'node-es')!;
    const debeziumNode = nodes.find(n => n.id === 'node-debezium')!;
    expect(esNode).toBeDefined();
    expect(debeziumNode).toBeDefined();
    expect(Number.isFinite(esNode.position.x)).toBe(true);
    expect(Number.isFinite(esNode.position.y)).toBe(true);
    expect(Number.isFinite(debeziumNode.position.x)).toBe(true);
    expect(Number.isFinite(debeziumNode.position.y)).toBe(true);
  });

  it('infra 뷰: node-mysql-container·node-es가 유한 좌표를 가진다 (force-directed 배치)', () => {
    const { nodes } = buildNodesAndEdges(sampleTopology, 'infra');
    const mysqlContainerNode = nodes.find(n => n.id === 'node-mysql-container')!;
    const esNode = nodes.find(n => n.id === 'node-es')!;
    expect(mysqlContainerNode).toBeDefined();
    expect(esNode).toBeDefined();
    expect(Number.isFinite(mysqlContainerNode.position.x)).toBe(true);
    expect(Number.isFinite(mysqlContainerNode.position.y)).toBe(true);
    expect(Number.isFinite(esNode.position.x)).toBe(true);
    expect(Number.isFinite(esNode.position.y)).toBe(true);
  });

  it('infra 뷰 결정성: 동일 토폴로지 2회 호출 시 좌표 동일', () => {
    const { nodes: nodes1 } = buildNodesAndEdges(sampleTopology, 'infra');
    const { nodes: nodes2 } = buildNodesAndEdges(sampleTopology, 'infra');
    expect(nodes1.length).toBe(nodes2.length);
    nodes1.forEach((n1, i) => {
      const n2 = nodes2[i];
      expect(n1.position.x).toBe(n2.position.x);
      expect(n1.position.y).toBe(n2.position.y);
    });
  });

  /* ── Group 노드·parentId·viaTable ───────────────────────────── */

  const groupTopology: CanvasTopology = {
    nodes: [
      { id: 'node-airflow',   role: 'transform', tool: 'apache-airflow', config: {}, trigger: true },
      { id: 'node-docling',   role: 'transform', tool: 'docling-langchain', config: {}, parentId: 'node-airflow-group' },
      { id: 'node-presidio',  role: 'transform', tool: 'presidio',          config: {}, parentId: 'node-airflow-group' },
      { id: 'node-kure',      role: 'transform', tool: 'kure-embedding',    config: {}, parentId: 'node-airflow-group' },
      { id: 'node-mock-api',  role: 'transform', tool: 'presidio',          config: {}, displayNameOverride: 'Mock API' },
      { id: 'node-es',        role: 'index',     tool: 'elasticsearch',     config: {} },
    ],
    edges: [
      { from: 'node-airflow',  to: 'node-docling',  channels: ['data'], viaTable: 'bronze_structured_raw' } as any,
      { from: 'node-docling',  to: 'node-presidio', channels: ['data'], viaTable: 'silver_structured_documents' } as any,
      { from: 'node-presidio', to: 'node-kure',     channels: ['data'], viaTable: 'silver_masked_documents' } as any,
      { from: 'node-kure',     to: 'node-mock-api', channels: ['data', 'dependency'] as ('data' | 'dependency')[], viaTable: 'gold_chunked_documents' } as any,
      { from: 'node-mock-api', to: 'node-es',       channels: ['data'], viaTable: 'gold_enriched_documents' } as any,
    ],
  };

  // B-2a: presidio가 docling 앞에 정의된 픽스처 — 실제 topology.ts L128 순서 버그 재현
  const reorderedGroupTopology: CanvasTopology = {
    nodes: [
      { id: 'node-airflow',   role: 'transform', tool: 'apache-airflow', config: {}, trigger: true },
      { id: 'node-presidio',  role: 'transform', tool: 'presidio',          config: {}, parentId: 'node-airflow-group' },
      { id: 'node-docling',   role: 'transform', tool: 'docling-langchain', config: {}, parentId: 'node-airflow-group' },
      { id: 'node-kure',      role: 'transform', tool: 'kure-embedding',    config: {}, parentId: 'node-airflow-group' },
      { id: 'node-mock-api',  role: 'transform', tool: 'presidio',          config: {}, displayNameOverride: 'Mock API' },
      { id: 'node-es',        role: 'index',     tool: 'elasticsearch',     config: {} },
    ],
    edges: [
      { from: 'node-airflow',  to: 'node-docling',  channels: ['data'], viaTable: 'bronze_structured_raw' } as any,
      { from: 'node-docling',  to: 'node-presidio', channels: ['data'], viaTable: 'silver_structured_documents' } as any,
      { from: 'node-presidio', to: 'node-kure',     channels: ['data'], viaTable: 'silver_masked_documents' } as any,
      { from: 'node-kure',     to: 'node-mock-api', channels: ['data', 'dependency'] as ('data' | 'dependency')[], viaTable: 'gold_chunked_documents' } as any,
      { from: 'node-mock-api', to: 'node-es',       channels: ['data'], viaTable: 'gold_enriched_documents' } as any,
    ],
  };

  it('E-1(DAG순서): presidio가 먼저 정의된 픽스처에서도 docling이 가장 작은 x(idx=0)', () => {
    const PAD_X = 60;
    const COL_GAP = 280;
    const { nodes } = buildNodesAndEdges(reorderedGroupTopology, 'data');
    const docling  = nodes.find(n => n.id === 'node-docling')!;
    const presidio = nodes.find(n => n.id === 'node-presidio')!;
    const kure     = nodes.find(n => n.id === 'node-kure')!;
    expect(docling).toBeDefined();
    expect(presidio).toBeDefined();
    expect(kure).toBeDefined();
    // DAG 깊이 정렬 후: docling(idx=0) < presidio(idx=1) < kure(idx=2)
    expect(docling.position.x).toBe(PAD_X);
    expect(presidio.position.x).toBe(PAD_X + COL_GAP);
    expect(kure.position.x).toBe(PAD_X + 2 * COL_GAP);
  });

  it('Group: data 뷰에서 type:group 노드가 생성된다', () => {
    const { nodes } = buildNodesAndEdges(groupTopology, 'data');
    const groupNode = nodes.find(n => n.id === 'node-airflow-group');
    expect(groupNode).toBeDefined();
    expect(groupNode!.type).toBe('group');
  });

  it('Group: group 노드는 nodes 배열 앞에 위치한다', () => {
    const { nodes } = buildNodesAndEdges(groupTopology, 'data');
    expect(nodes[0].id).toBe('node-airflow-group');
  });

  it('Group: 자식 노드에 parentId와 extent가 설정된다', () => {
    const { nodes } = buildNodesAndEdges(groupTopology, 'data');
    const docling = nodes.find(n => n.id === 'node-docling')!;
    expect(docling).toBeDefined();
    expect(docling.parentId).toBe('node-airflow-group');
    expect(docling.extent).toBe('parent');
  });

  it('Group: group 미소속 노드(mock-api, es)는 parentId 미설정', () => {
    const { nodes } = buildNodesAndEdges(groupTopology, 'data');
    const mockApi = nodes.find(n => n.id === 'node-mock-api')!;
    const es = nodes.find(n => n.id === 'node-es')!;
    expect(mockApi.parentId).toBeUndefined();
    expect(es.parentId).toBeUndefined();
  });

  it('Group: infra 뷰에서는 group 노드가 생성되지 않는다', () => {
    const { nodes } = buildNodesAndEdges(groupTopology, 'infra');
    const groupNode = nodes.find(n => n.type === 'group');
    expect(groupNode).toBeUndefined();
  });

  // E-1: 자식 상대좌표·박스 크기 기대값 테스트 (PAD-origin 기준)
  it('E-1(상대좌표): 그룹 자식(docling, presidio, kure)의 position.x가 PAD-origin(PAD_X, PAD_X+COL_GAP, PAD_X+2*COL_GAP)', () => {
    const COL_GAP = 280;
    const PAD_X = 60;
    const PAD_TOP = 60;
    const { nodes } = buildNodesAndEdges(groupTopology, 'data');
    const docling  = nodes.find(n => n.id === 'node-docling')!;
    const presidio = nodes.find(n => n.id === 'node-presidio')!;
    const kure     = nodes.find(n => n.id === 'node-kure')!;
    expect(docling).toBeDefined();
    expect(presidio).toBeDefined();
    expect(kure).toBeDefined();
    // PAD-origin: 첫 자식 x=PAD_X, 두 번째 x=PAD_X+COL_GAP, 세 번째 x=PAD_X+2*COL_GAP
    expect(docling.position.x).toBe(PAD_X);
    expect(presidio.position.x).toBe(PAD_X + COL_GAP);
    expect(kure.position.x).toBe(PAD_X + 2 * COL_GAP);
    // 모든 자식 y = PAD_TOP
    expect(docling.position.y).toBe(PAD_TOP);
    expect(presidio.position.y).toBe(PAD_TOP);
    expect(kure.position.y).toBe(PAD_TOP);
  });

  it('E-1(non-overlap): 인접 자식 position.x 차이가 COL_GAP(280) — non-overlap 보장', () => {
    const COL_GAP = 280;
    const { nodes } = buildNodesAndEdges(groupTopology, 'data');
    const childNodes = nodes.filter(n => n.parentId === 'node-airflow-group')
      .sort((a, b) => a.position.x - b.position.x);
    expect(childNodes.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < childNodes.length; i++) {
      expect(childNodes[i].position.x - childNodes[i - 1].position.x).toBe(COL_GAP);
    }
  });

  it('E-1(박스크기): 그룹 박스 width >= 자식 3개 * 노드폭(200) — 전 자식 포함', () => {
    const NODE_WIDTH = 200;
    const { nodes } = buildNodesAndEdges(groupTopology, 'data');
    const groupNode = nodes.find(n => n.id === 'node-airflow-group')!;
    expect(groupNode).toBeDefined();
    const groupWidth = (groupNode as any).width as number;
    expect(groupWidth).toBeGreaterThanOrEqual(3 * NODE_WIDTH);
  });

  it('E-1(그룹trigger): 그룹 노드 data.trigger === true', () => {
    const { nodes } = buildNodesAndEdges(groupTopology, 'data');
    const groupNode = nodes.find(n => n.id === 'node-airflow-group')!;
    expect(groupNode).toBeDefined();
    expect(groupNode.data.trigger).toBe(true);
  });

  it('viaTable: viaTable이 있는 엣지는 label로 표시된다', () => {
    const { edges } = buildNodesAndEdges(groupTopology, 'data');
    const doclingEdge = edges.find(e => e.source === 'node-docling' && e.target === 'node-presidio');
    expect(doclingEdge).toBeDefined();
    expect(doclingEdge!.label).toBe('silver_structured_documents');
  });

  it('viaTable: condition 없고 viaTable 있는 엣지에 label이 viaTable 값', () => {
    const { edges } = buildNodesAndEdges(groupTopology, 'data');
    const kureEdge = edges.find(e => e.source === 'node-kure' && e.target === 'node-mock-api');
    expect(kureEdge).toBeDefined();
    expect(kureEdge!.label).toBe('gold_chunked_documents');
  });

  /* ── group nodes: 다중 그룹 topology ───────────────────────── */

  describe('group nodes', () => {
    /**
     * 두 그룹(alpha, beta)에 각각 2개 자식 배치한 fixture.
     * parentId는 그룹 소속을 결정하는 트리거 필드.
     */
    const multiGroupTopology: CanvasTopology = {
      nodes: [
        // 그룹 alpha 자식 2개
        { id: 'node-alpha-1', role: 'transform', tool: 'docling-langchain', config: {}, parentId: 'node-group-alpha' },
        { id: 'node-alpha-2', role: 'transform', tool: 'presidio',          config: {}, parentId: 'node-group-alpha' },
        // 그룹 beta 자식 2개
        { id: 'node-beta-1',  role: 'transform', tool: 'kure-embedding',    config: {}, parentId: 'node-group-beta' },
        { id: 'node-beta-2',  role: 'index',     tool: 'elasticsearch',     config: {}, parentId: 'node-group-beta' },
        // 그룹 미소속 노드
        { id: 'node-standalone', role: 'ingest', tool: 'debezium',          config: {} },
      ],
      edges: [
        { from: 'node-standalone', to: 'node-alpha-1', channels: ['data'] },
        { from: 'node-alpha-1',    to: 'node-alpha-2', channels: ['data'] },
        { from: 'node-alpha-2',    to: 'node-beta-1',  channels: ['data'] },
        { from: 'node-beta-1',     to: 'node-beta-2',  channels: ['data'] },
      ],
    };

    // Right: 그룹 소속 노드가 있는 data 뷰에서 그룹 id별 group 노드가 생성됨
    it('Right: data 뷰에서 각 parentId에 대응하는 group 노드가 생성된다', () => {
      const { nodes } = buildNodesAndEdges(multiGroupTopology, 'data');
      const alphaGroup = nodes.find(n => n.id === 'node-group-alpha');
      const betaGroup  = nodes.find(n => n.id === 'node-group-beta');
      expect(alphaGroup).toBeDefined();
      expect(alphaGroup!.type).toBe('group');
      expect(betaGroup).toBeDefined();
      expect(betaGroup!.type).toBe('group');
    });

    // B(경계): 그룹 소속 노드 0개면 group 노드 0개 — sampleTopology 회귀
    it('B(경계): parentId 없는 sampleTopology에서 group 노드가 생성되지 않는다', () => {
      const { nodes } = buildNodesAndEdges(sampleTopology, 'data');
      const groupNodes = nodes.filter(n => n.type === 'group');
      expect(groupNodes).toHaveLength(0);
    });

    // I(역·부정): 서로 다른 그룹키 2종에서 각 group 노드가 자기 자식만 포함
    it('I(역·부정): alpha group 노드는 beta 자식을 포함하지 않고, beta group 노드는 alpha 자식을 포함하지 않는다', () => {
      const { nodes } = buildNodesAndEdges(multiGroupTopology, 'data');
      // alpha 자식 노드 확인
      const alphaChild1 = nodes.find(n => n.id === 'node-alpha-1')!;
      const alphaChild2 = nodes.find(n => n.id === 'node-alpha-2')!;
      // beta 자식 노드 확인
      const betaChild1 = nodes.find(n => n.id === 'node-beta-1')!;
      const betaChild2 = nodes.find(n => n.id === 'node-beta-2')!;
      // alpha 자식은 node-group-alpha에만 소속
      expect(alphaChild1.parentId).toBe('node-group-alpha');
      expect(alphaChild2.parentId).toBe('node-group-alpha');
      // beta 자식은 node-group-beta에만 소속
      expect(betaChild1.parentId).toBe('node-group-beta');
      expect(betaChild2.parentId).toBe('node-group-beta');
      // 교차 소속이 없음을 명시적으로 확인
      expect(alphaChild1.parentId).not.toBe('node-group-beta');
      expect(betaChild1.parentId).not.toBe('node-group-alpha');
    });

    // C(교차확인): 각 group 노드의 경계가 해당 그룹 자식 좌표에서만 산출됨
    // A-1/A-2 이후 자식은 PAD-origin 상대좌표, 그룹 박스는 원래 절대 좌표 기반
    it('C(교차확인): 각 group 노드의 width가 소속 자식들을 모두 포함하기에 충분하다', () => {
      const COL_GAP = 280;
      const NODE_WIDTH = 200;
      const PAD_X = 60;
      const { nodes } = buildNodesAndEdges(multiGroupTopology, 'data');
      const alphaGroup = nodes.find(n => n.id === 'node-group-alpha')!;
      const betaGroup  = nodes.find(n => n.id === 'node-group-beta')!;
      expect(alphaGroup).toBeDefined();
      expect(betaGroup).toBeDefined();

      // alpha 자식들의 상대좌표 (PAD-origin)
      const alphaChildren = nodes.filter(n => n.parentId === 'node-group-alpha');
      expect(alphaChildren.length).toBe(2);
      // 자식 2개: position.x = PAD_X, PAD_X+COL_GAP
      const sortedAlpha = alphaChildren.sort((a, b) => a.position.x - b.position.x);
      expect(sortedAlpha[0].position.x).toBe(PAD_X);
      expect(sortedAlpha[1].position.x).toBe(PAD_X + COL_GAP);

      // beta 자식들의 상대좌표 (PAD-origin)
      const betaChildren = nodes.filter(n => n.parentId === 'node-group-beta');
      expect(betaChildren.length).toBe(2);
      const sortedBeta = betaChildren.sort((a, b) => a.position.x - b.position.x);
      expect(sortedBeta[0].position.x).toBe(PAD_X);
      expect(sortedBeta[1].position.x).toBe(PAD_X + COL_GAP);

      // 그룹 박스 width >= 자식 2개 포함 최소 크기
      const alphaWidth = (alphaGroup as any).width as number;
      const betaWidth  = (betaGroup as any).width as number;
      expect(alphaWidth).toBeGreaterThanOrEqual((2 - 1) * COL_GAP + NODE_WIDTH);
      expect(betaWidth).toBeGreaterThanOrEqual((2 - 1) * COL_GAP + NODE_WIDTH);

      // alpha 그룹과 beta 그룹은 서로 다른 절대 위치에 배치됨 (독립 산출 확인)
      const alphaPos = alphaGroup.position;
      const betaPos  = betaGroup.position;
      const positionsDiffer = alphaPos.x !== betaPos.x || alphaPos.y !== betaPos.y;
      expect(positionsDiffer).toBe(true);
    });
  });

  /* ── infra 뷰 엣지 type:'smoothstep'(꺾은선/직교) ────────────── */

  it('Cardinality: infra 뷰 엣지 모두에 type:"smoothstep" 부여', () => {
    const { edges } = buildNodesAndEdges(sampleTopology, 'infra');
    expect(edges.length).toBeGreaterThan(0);
    for (const e of edges) {
      expect(e.type).toBe('smoothstep');
    }
  });

  it('Cardinality: data 뷰 엣지는 type 미부여', () => {
    const { edges } = buildNodesAndEdges(sampleTopology, 'data');
    for (const e of edges) {
      expect((e as any).type).toBeUndefined();
    }
  });

  /* ── edge badge props: labelBgBorderRadius pill 보장 ─────────── */

  describe('edge badge props', () => {
    const conditionalTopology: CanvasTopology = {
      nodes: [
        { id: 'node-a', role: 'ingest',    tool: 'debezium',       config: {} },
        { id: 'node-b', role: 'store',     tool: 's3',             config: {} },
        { id: 'node-c', role: 'transform', tool: 'apache-airflow', config: {} },
        { id: 'node-d', role: 'store',     tool: 'mysql',          config: {} },
        { id: 'node-e', role: 'index',     tool: 'elasticsearch',  config: {} },
      ],
      edges: [
        { from: 'node-a', to: 'node-b', channels: ['data'], condition: true  } as any,
        { from: 'node-a', to: 'node-c', channels: ['data'], condition: false } as any,
        { from: 'node-a', to: 'node-d', channels: ['data'], condition: 'default' } as any,
        { from: 'node-b', to: 'node-e', channels: ['data'], viaTable: 'bronze_raw' } as any,
      ],
    };

    // Right: condition true/false/string — each conditional edge has labelBgBorderRadius=9999
    it('Right: conditional edge (condition=true) has labelBgBorderRadius set to 9999', () => {
      const { edges } = buildNodesAndEdges(conditionalTopology, 'data');
      const edge = edges.find(e => e.source === 'node-a' && e.target === 'node-b');
      expect(edge).toBeDefined();
      expect((edge as any).labelBgBorderRadius).toBe(9999);
    });

    it('Right: conditional edge (condition=false) has labelBgBorderRadius set to 9999', () => {
      const { edges } = buildNodesAndEdges(conditionalTopology, 'data');
      const edge = edges.find(e => e.source === 'node-a' && e.target === 'node-c');
      expect(edge).toBeDefined();
      expect((edge as any).labelBgBorderRadius).toBe(9999);
    });

    it('Right: conditional edge (condition="default") has labelBgBorderRadius set to 9999', () => {
      const { edges } = buildNodesAndEdges(conditionalTopology, 'data');
      const edge = edges.find(e => e.source === 'node-a' && e.target === 'node-d');
      expect(edge).toBeDefined();
      expect((edge as any).labelBgBorderRadius).toBe(9999);
    });

    // B(경계): viaTable 라벨 엣지(condition 없음)에도 labelBgBorderRadius 세팅 확인
    it('B(boundary): viaTable edge (no condition) also has labelBgBorderRadius set to 9999', () => {
      const { edges } = buildNodesAndEdges(conditionalTopology, 'data');
      const edge = edges.find(e => e.source === 'node-b' && e.target === 'node-e');
      expect(edge).toBeDefined();
      expect((edge as any).labelBgBorderRadius).toBe(9999);
    });

    // C(교차확인): labelBgPadding:[6,2] + labelBgBorderRadius:9999 조합이 기대 pill 파라미터와 일치
    it('C(cross-check): labeled edge has both labelBgPadding:[6,2] and labelBgBorderRadius:9999 for pill shape', () => {
      const { edges } = buildNodesAndEdges(conditionalTopology, 'data');
      // condition 있는 엣지로 검증
      const condEdge = edges.find(e => e.source === 'node-a' && e.target === 'node-d');
      expect(condEdge).toBeDefined();
      expect((condEdge as any).labelBgPadding).toEqual([6, 2]);
      expect((condEdge as any).labelBgBorderRadius).toBe(9999);

      // viaTable 엣지로도 동일 검증
      const viaEdge = edges.find(e => e.source === 'node-b' && e.target === 'node-e');
      expect(viaEdge).toBeDefined();
      expect((viaEdge as any).labelBgPadding).toEqual([6, 2]);
      expect((viaEdge as any).labelBgBorderRadius).toBe(9999);
    });
  });
});
