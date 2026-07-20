import type { CanvasTopology } from '../api/types.js';

/**
 * 실측 캔버스 토폴로지 (hyundaimotor-lllm 파이프라인 실측값 반영)
 *
 * 구조:
 *   [debezium] ──┐
 *   [nifi]     ──┼──→ [s3-bronze] ──→ [airflow*] ──→ [docling] ──→ [presidio] ──→ [kure] ──→ [mock-api] ──→ [es]
 *   [dam]      ──┘                                                                                          └──→ [mysql]
 *
 * (* trigger=true)
 * data 채널: ─── / dependency 채널(infra뷰 전용): ···→
 * fan-in  : debezium + nifi + dam → s3-bronze
 * fan-out : mock-api → es (data), mock-api → mysql (data)
 * infra   : mysql-container → debezium (dependency), zookeeper → nifi (dependency), es → kibana (dependency)
 *           valkey → debezium (dependency, CDC Redis Stream 싱크), valkey → airflow (dependency, Celery 브로커)
 *           es → airflow (dependency)
 * silver chain : airflow → silver_1(docling) → silver_2(presidio) → gold_3(kure) → gold_4(mock-api) → {es, mysql}
 * valkey는 데이터 스테이지 아님 — Celery 브로커(airflow) + CDC Redis Stream 싱크(debezium), dependency 채널 전용
 *
 * ── 실측 교정 사항 ────────────────────────────────────────────────────────────
 * T1-1: node-kure modelPath → sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2, outputDim 384
 * T1-2: node-es index → pdis_cft, mlNode 제거, esFieldInfo → text,dense_vector
 * T1-3: node-airflow executor → SequentialExecutor, dagId → 실제 개별 DAG 목록 표기
 * T1-4: node-presidio recognizers → phone,rrn,email,bank_account, nlpEngine → ko_core_news_lg
 * T1-5: node-docling chunkSize/chunkOverlap 제거, content_format=json 반영
 * T1-6: node-mysql/node-mysql-container database → pipeline_emulator, node-mysql table → silver_/gold_ 실제 테이블
 * T1-7: node-s3-bronze bucket → 미명시, prefix → pdis/pcqlty/rdb/ 반영
 * ──────────────────────────────────────────────────────────────────────────────
 */
export const realTopology: CanvasTopology = {
  nodes: [
    /* ── Sources (fan-in 3개) ── */
    {
      id: 'node-debezium',
      role: 'ingest',
      tool: 'debezium',
      label: 'Debezium CDC',
      deployStatus: 'absent',
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
      deployStatus: 'absent',
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
      deployStatus: 'planned',
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
        // T1-7: bucket 미명시(실측 미확정), prefix는 실측 S3 key 구조 반영
        prefix: 'pdis/pcqlty/rdb/',
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
        // T1-3: executor 실측값, dagId는 실제 개별 DAG 목록
        dagIds: [
          'silver_1_structuring',
          'silver_2_masking',
          'gold_3_chunking',
          'gold_4_enrichment',
          'gold_5_field_mapping',
          'gold_6_archive',
        ],
        conf: '{}',
        executor: 'SequentialExecutor',
      },
    },
    {
      id: 'node-presidio',
      role: 'transform',
      tool: 'presidio',
      label: 'Presidio PII',
      config: {
        dagId: 'silver_2_masking',
        // T1-4: recognizers 실측값, nlpEngine 추가
        recognizers: 'phone,rrn,email,bank_account',
        nlpEngine: 'ko_core_news_lg',
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
        // T1-5: chunkSize/chunkOverlap 제거, structuring 성격(RDB→JSON) 반영
        strategy: 'structuring',
        content_format: 'json',
      },
    },
    {
      id: 'node-kure',
      role: 'transform',
      tool: 'kure-embedding',
      label: 'KURE Chunking & Embedding',
      config: {
        dagId: 'gold_3_chunking',
        // T1-1: modelPath 실측값, outputDim 384, 청킹(섹션 3분할) 담당
        label: '청킹(섹션 3분할) 담당',
        description: '섹션 단위 3분할 청킹 후 다국어 문장 임베딩 수행',
        modelPath: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
        outputDim: 384,
        batchSize: 32,
      },
    },
    /* ── 인프라: Valkey (dependency 채널 전용, 데이터뷰 미표시) ── */
    {
      id: 'node-valkey',
      role: 'broker',
      tool: 'valkey',
      label: 'Valkey',
      displayNameOverride: 'Valkey (Redis)',
      deployStatus: 'absent',
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
        // T1-2: index 실측값, mlNode 제거, esFieldInfo 실측
        index: 'pdis_cft',
        bulkSize: 100,
        esFieldInfo: 'text,dense_vector',
      },
    },
    {
      id: 'node-es-search',
      role: 'index',
      tool: 'elasticsearch',
      label: 'Elasticsearch Indexing',
      deployStatus: 'active',
      config: {
        dagId: 'gold_6_es_indexing',
        index: 'pdis_cft',
        bulkSize: 100,
        esFieldInfo: 'text,dense_vector',
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
        // T1-6: database 실측값 통일, table 실측 테이블명
        database: 'pipeline_emulator',
        table: 'silver_documents,gold_staged_documents,gold_enriched_documents',
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
        // T1-6: database 실측값 통일
        database: 'pipeline_emulator',
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
      displayNameOverride: 'Mock API (Enrichment)',
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
    /* gold_5 field_mapping(staging) → gold_6 es_indexing */
    { from: 'node-es',       to: 'node-es-search', channels: ['data'] },
    /* gold_5 field_mapping → gold_staged_documents (MySQL) */
    { from: 'node-mock-api', to: 'node-mysql',    channels: ['data'] },

    /* infra dependency: es → kibana */
    { from: 'node-es', to: 'node-kibana', channels: ['dependency'] as ('data' | 'dependency')[] },

    /* infra: MySQL 컨테이너 → Debezium (의존성) */
    { from: 'node-mysql-container', to: 'node-debezium', channels: ['dependency'] as ('data' | 'dependency')[] },
    /* debezium depends_on: valkey + DEBEZIUM_SINK_REDIS_ADDRESS (CDC Redis Stream 싱크) */
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
    /* airflow CELERY_BROKER_URL=redis://valkey (Celery 브로커) */
    { from: 'node-valkey',          to: 'node-airflow',  channels: ['dependency'] as ('data' | 'dependency')[] },
    /* nifi depends_on: zookeeper + NIFI_ZK_CONNECT_STRING */
    { from: 'node-zookeeper',       to: 'node-nifi',     channels: ['dependency'] as ('data' | 'dependency')[] },
  ],
};
