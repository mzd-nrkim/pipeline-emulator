import type { CanvasTopology } from '../api/types.js';

/**
 * 샘플 캔버스 토폴로지 (hyundaimotor-lllm 파이프라인 반영)
 *
 * 구조:
 *   [debezium] ──┐
 *   [nifi]     ──┼──→ [s3-bronze] ──→ [airflow*] ──→ [presidio] ──→ [docling] ──→ [kure] ──→ [valkey] ──┬──→ [es] ──→ [kibana](infra)
 *   [dam]      ──┘                                                                                         └──→ [mysql]
 *
 * (* trigger=true)
 * data 채널: ─── / dependency 채널(infra뷰 전용): ···→
 * fan-in  : debezium + nifi + dam → s3-bronze
 * fan-out : valkey → es + mysql
 * infra   : mysql-container → debezium (dependency), zookeeper → nifi (dependency), es → kibana (dependency)
 *           valkey → debezium (dependency), es → airflow (dependency)
 *
 * ── 노드↔DAG↔docker 서비스 대응표 (SSOT — node-* 규약) ────────────────────────
 * 노드 ID            role               dagId                       docker 서비스
 * ──────────────────────────────────────────────────────────────────────────────
 * node-debezium      ingest             (없음, 수집 전용)            debezium
 * node-nifi          ingest             (없음, 수집 전용)            nifi
 * node-dam           ingest             (없음, 수집 전용)            dam
 * node-s3-bronze     store              (없음, 스토리지)             seaweedfs/s3
 * node-airflow       transform          (오케스트레이터 — trigger)   airflow
 * node-presidio      transform          silver_2_masking            presidio
 * node-docling       transform          silver_1_structuring        airflow (DAG 내 실행)
 * node-kure          transform          gold_3_chunking             airflow (DAG 내 실행)
 * node-valkey        broker             (없음, 브로커)               valkey
 * node-es            index              gold_5_field_mapping        elasticsearch
 * node-mysql         store              (없음, 아카이브)             mysql
 * node-mysql-container store            (없음, 인프라)               mysql
 * node-seaweedfs     store              (없음, 인프라)               seaweedfs
 * node-mock-api      transform          gold_4_enrichment           mock-api
 * node-zookeeper     coordinate         (없음, 인프라)               zookeeper
 * ──────────────────────────────────────────────────────────────────────────────
 * STAGE_DAG_MAP 키(ui-backend): node-presidio·node-docling·node-kure·node-es·node-mock-api
 *
 * ── docker-compose.yml 의존 엣지 대응표 (dependency 채널 전용) ──────────────────
 * 서비스          depends_on / 연결 env                  → topology 엣지
 * ─────────────────────────────────────────────────────────────────────────────
 * airflow         depends_on: mysql                      mysql-container → airflow
 *                 MYSQL_HOST=mysql                       mysql-container → airflow (동일, 통합)
 *                 SEAWEEDFS_ENDPOINT=http://seaweedfs    seaweedfs       → airflow
 *                 CHUNKING_API_URL=http://mock-api       mock-api        → airflow
 *                 ENRICH_API_URL=http://mock-api         mock-api        → airflow (동일, 통합)
 *                 ES_HOST=elasticsearch                  es              → airflow (+신규)
 * debezium        dbHost=mysql (config)                  mysql-container → debezium (기존)
 *                 DEBEZIUM_SINK_REDIS_ADDRESS=valkey     valkey          → debezium (+신규)
 * nifi            NIFI_ZK_CONNECT_STRING=zookeeper       zookeeper       → nifi (+신규, mysql 제거)
 * kibana          (elasticsearch 내장 의존)              es              → kibana (기존)
 * ─────────────────────────────────────────────────────────────────────────────
 * 제거: mysql-container → nifi (nifi는 mysql 미의존 — 허위 엣지)
 * airflow는 SequentialExecutor라 valkey(브로커) 의존 없음 — 의도적 부재
 */
export const mockTopology: CanvasTopology = {
  nodes: [
    /* ── Sources (fan-in 3개) ── */
    {
      id: 'node-debezium',
      role: 'ingest',
      tool: 'debezium',
      label: 'Debezium CDC',
      config: {
        connectorType: 'mysql',
        dbHost: 'mysql',
        dbPort: 3306,
        dbUser: 'debezium',
        walMode: 'binlog',
      },
    },
    {
      id: 'node-nifi',
      role: 'ingest',
      tool: 'apache-nifi',
      label: 'Apache NiFi',
      config: {
        connectionPool: 'dbcp2',
        sqlQuery: 'SELECT * FROM docs',
        outputFormat: 'parquet',
      },
    },
    {
      id: 'node-dam',
      role: 'ingest',
      tool: 'dam',
      label: 'DAM API',
      config: {
        endpoint: 'https://dam.internal/api',
        outputFormat: 'markdown', // 'markdown' | 'html' | 'json'
      },
    },

    /* ── Sink - Bronze ── */
    {
      id: 'node-s3-bronze',
      role: 'store',
      tool: 's3',
      label: 'S3 Bronze',
      config: {
        bucket: 'lllm-bronze',
        prefix: 'raw/',
        format: 'parquet',
      },
    },

    /* ── Tasks ── */
    {
      id: 'node-airflow',
      role: 'transform',
      trigger: true,
      tool: 'apache-airflow',
      label: 'Airflow DAG',
      config: {
        dagId: 'lllm_pipeline',
        conf: '{}',
        executor: 'CeleryExecutor',
      },
    },
    {
      id: 'node-presidio',
      role: 'transform',
      tool: 'presidio',
      label: 'Presidio PII',
      config: {
        dagId: 'silver_2_masking',
        recognizers: 'phone,email,rrn',
        nlpEngine: 'spacy_ko',
        anonymizeStrategy: 'replace',
      },
    },
    {
      id: 'node-docling',
      role: 'transform',
      tool: 'docling-langchain',
      label: 'Docling Structuring',
      config: {
        dagId: 'silver_1_structuring',
        chunkSize: 512,
        chunkOverlap: 64,
        strategy: 'parent-child',
      },
    },
    {
      id: 'node-kure',
      role: 'transform',
      tool: 'kure-embedding',
      label: 'KURE Chunking & Embedding',
      config: {
        dagId: 'gold_3_chunking',
        modelPath: 'models/kure-v1.onnx',
        outputDim: 768,
        batchSize: 32,
      },
    },
    {
      id: 'node-valkey',
      role: 'broker',
      tool: 'valkey',
      label: 'Valkey Broker',
      config: {
        host: 'valkey',
        port: 6379,
        streamKey: 'lllm:stream',
        maxlen: 10000,
      },
    },

    /* ── Sinks (fan-out 3개) ── */
    {
      id: 'node-es',
      role: 'index',
      tool: 'elasticsearch',
      label: 'Elasticsearch',
      outOfTeamScope: true,
      config: {
        dagId: 'gold_5_field_mapping',
        index: 'lllm-docs',
        bulkSize: 100,
        mlNode: 'ml-node-1',
        esFieldInfo: 'text,vector',
      },
    },
    {
      id: 'node-kibana',
      role: 'visualize',
      tool: 'kibana',
      label: 'Kibana',
      outOfTeamScope: true,
      config: {
        space: 'lllm',
        dashboardId: 'pipeline-monitor',
      },
    },
    {
      id: 'node-mysql',
      role: 'store',
      tool: 'mysql',
      label: 'MySQL Archive',
      config: {
        host: 'mysql',
        database: 'lllm_silver',
        table: 'processed_docs',
        batchSize: 500,
      },
    },

    /* ── 인프라 컨테이너 노드 (dependency 채널 전용, 데이터뷰 미표시) ── */
    {
      id: 'node-mysql-container',
      role: 'store',
      tool: 'mysql',
      label: 'MySQL 원본 DB',
      displayNameOverride: 'MySQL 원본 DB',
      config: {
        host: 'mysql',
        database: 'source_db',
        port: 3306,
        table: '*',
        batchSize: 1000,
      },
    },
    {
      id: 'node-seaweedfs',
      role: 'store',
      tool: 's3',
      label: 'SeaweedFS (S3)',
      config: {
        endpoint: 'http://seaweedfs:8333',
        port: 8333,
      },
    },
    {
      id: 'node-mock-api',
      role: 'transform',
      tool: 'presidio',
      label: 'Mock API (Enrichment)',
      config: {
        dagId: 'gold_4_enrichment',
        chunkUrl: 'http://mock-api:8000/chunk',
        enrichUrl: 'http://mock-api:8000/enrich',
        port: 8000,
      },
    },
    {
      id: 'node-zookeeper',
      role: 'coordinate',
      tool: 'zookeeper',
      label: 'ZooKeeper 3.9',
      config: {
        connectString: 'zookeeper:2181',
        tickTime: 2000,
      },
    },
  ],

  edges: [
    /* fan-in: 3 ingest → s3-bronze */
    { from: 'node-debezium', to: 'node-s3-bronze', channels: ['data'] },
    { from: 'node-nifi',     to: 'node-s3-bronze', channels: ['data'] },
    { from: 'node-dam',      to: 'node-s3-bronze', channels: ['data'] },

    /* s3-bronze → airflow (직결, branch 제거) */
    { from: 'node-s3-bronze', to: 'node-airflow', channels: ['data'] },

    /* task 체인 */
    { from: 'node-airflow',  to: 'node-docling',  channels: ['data'] },
    { from: 'node-docling',  to: 'node-presidio', channels: ['data'] },
    { from: 'node-presidio', to: 'node-kure',     channels: ['data'] },
    { from: 'node-kure',     to: 'node-mock-api', channels: ['data'] },
    { from: 'node-mock-api', to: 'node-es',       channels: ['data'] },
    { from: 'node-kure',     to: 'node-valkey',   channels: ['data'] },

    /* fan-out: valkey → es + mysql */
    { from: 'node-valkey', to: 'node-es',    channels: ['data'] },
    { from: 'node-valkey', to: 'node-mysql', channels: ['data'] },

    /* infra dependency: es → kibana */
    { from: 'node-es', to: 'node-kibana', channels: ['dependency'] as ('data' | 'dependency')[] },

    /* infra: MySQL 컨테이너 → Debezium (의존성) */
    { from: 'node-mysql-container', to: 'node-debezium', channels: ['dependency'] as ('data' | 'dependency')[] },
    /* debezium depends_on: valkey + DEBEZIUM_SINK_REDIS_ADDRESS + schema history redis */
    { from: 'node-valkey',          to: 'node-debezium', channels: ['dependency'] as ('data' | 'dependency')[] },

    /* infra: docker-compose depends_on + env 기반 확충 */
    /* airflow depends_on: mysql + MYSQL_HOST=mysql */
    { from: 'node-mysql-container', to: 'node-airflow',  channels: ['dependency'] as ('data' | 'dependency')[] },
    /* airflow SEAWEEDFS_ENDPOINT=http://seaweedfs:8333 */
    { from: 'node-seaweedfs',       to: 'node-airflow',  channels: ['dependency'] as ('data' | 'dependency')[] },
    /* airflow CHUNKING_API_URL + ENRICH_API_URL → mock-api */
    { from: 'node-mock-api',        to: 'node-airflow',  channels: ['dependency'] as ('data' | 'dependency')[] },
    /* airflow depends_on: elasticsearch + ES_HOST */
    { from: 'node-es',              to: 'node-airflow',  channels: ['dependency'] as ('data' | 'dependency')[] },
    /* nifi depends_on: zookeeper + NIFI_ZK_CONNECT_STRING */
    { from: 'node-zookeeper',       to: 'node-nifi',     channels: ['dependency'] as ('data' | 'dependency')[] },
    /* airflow는 SequentialExecutor라 valkey(브로커) 의존 없음 — 의도적 부재 */
  ],
};
