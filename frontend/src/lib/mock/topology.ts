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
 * infra   : mysql-container → debezium/nifi (dependency), es → kibana (dependency)
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
        recognizers: 'phone,email,rrn',
        nlpEngine: 'spacy_ko',
        anonymizeStrategy: 'replace',
      },
    },
    {
      id: 'node-docling',
      role: 'transform',
      tool: 'docling-langchain',
      label: 'Docling Chunker',
      config: {
        chunkSize: 512,
        chunkOverlap: 64,
        strategy: 'parent-child',
      },
    },
    {
      id: 'node-kure',
      role: 'transform',
      tool: 'kure-embedding',
      label: 'KURE Embedding',
      config: {
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
      config: {
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
      config: {
        host: 'mysql',
        database: 'source_db',
        port: 3306,
        table: '*',
        batchSize: 1000,
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
    { from: 'node-airflow',  to: 'node-presidio', channels: ['data'] },
    { from: 'node-presidio', to: 'node-docling',  channels: ['data'] },
    { from: 'node-docling',  to: 'node-kure',     channels: ['data'] },
    { from: 'node-kure',     to: 'node-valkey',   channels: ['data'] },

    /* fan-out: valkey → es + mysql */
    { from: 'node-valkey', to: 'node-es',    channels: ['data'] },
    { from: 'node-valkey', to: 'node-mysql', channels: ['data'] },

    /* infra dependency: es → kibana */
    { from: 'node-es', to: 'node-kibana', channels: ['dependency'] as ('data' | 'dependency')[] },

    /* infra: MySQL 컨테이너 → Debezium/NiFi (의존성) */
    { from: 'node-mysql-container', to: 'node-debezium', channels: ['dependency'] as ('data' | 'dependency')[] },
    { from: 'node-mysql-container', to: 'node-nifi',     channels: ['dependency'] as ('data' | 'dependency')[] },
  ],
};
