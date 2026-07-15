import type { CanvasTopology } from '../api/types.js';

/**
 * 샘플 캔버스 토폴로지 (hyundaimotor-lllm 파이프라인 반영)
 *
 * 구조:
 *   [debezium] ──┐
 *   [nifi]     ──┼──→ [s3-bronze] ──→ [branch] ──→ [airflow] ──→ [presidio] ──→ [docling] ──→ [kure] ──→ [valkey] ──┬──→ [es]
 *   [dam]      ──┘                                                                                                    ├──→ [kibana]
 *                                                                                                                     └──→ [mysql]
 *
 * fan-in  : debezium + nifi + dam → s3-bronze
 * branch  : s3-bronze → branch(switch) → airflow
 * fan-out : valkey → es + kibana + mysql
 */
export const mockTopology: CanvasTopology = {
  nodes: [
    /* ── Sources (fan-in 3개) ── */
    {
      id: 'node-debezium',
      kind: 'source',
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
      kind: 'source',
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
      kind: 'source',
      tool: 'dam',
      label: 'DAM API',
      config: {
        endpoint: 'https://dam.internal/api',
        outputFormat: 'markdown',
      },
    },

    /* ── Sink - Bronze ── */
    {
      id: 'node-s3-bronze',
      kind: 'sink',
      tool: 's3',
      label: 'S3 Bronze',
      config: {
        bucket: 'lllm-bronze',
        prefix: 'raw/',
        format: 'parquet',
      },
    },

    /* ── Switch ── */
    {
      id: 'node-branch',
      kind: 'switch',
      tool: 'airflow-branch',
      label: '수집유형 분기',
      config: {
        field: 'source_type',
        cases: ['rdb', 'unstructured', 'both'],
      },
    },

    /* ── Tasks ── */
    {
      id: 'node-airflow',
      kind: 'task',
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
      kind: 'task',
      tool: 'presidio',
      label: 'Presidio PII',
      config: {
        recognizers: 'phone,email,ssn',
        nlpEngine: 'spacy_ko',
        anonymizeStrategy: 'replace',
      },
    },
    {
      id: 'node-docling',
      kind: 'task',
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
      kind: 'task',
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
      kind: 'task',
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
      kind: 'sink',
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
      kind: 'sink',
      tool: 'kibana',
      label: 'Kibana',
      config: {
        space: 'lllm',
        dashboardId: 'pipeline-monitor',
      },
    },
    {
      id: 'node-mysql',
      kind: 'sink',
      tool: 'mysql',
      label: 'MySQL Archive',
      config: {
        host: 'mysql',
        database: 'lllm_silver',
        table: 'processed_docs',
        batchSize: 500,
      },
    },
  ],

  edges: [
    /* fan-in: 3 Source → s3-bronze */
    { from: 'node-debezium', to: 'node-s3-bronze' },
    { from: 'node-nifi',     to: 'node-s3-bronze' },
    { from: 'node-dam',      to: 'node-s3-bronze' },

    /* s3-bronze → branch(switch) */
    { from: 'node-s3-bronze', to: 'node-branch' },

    /* branch → airflow */
    { from: 'node-branch', to: 'node-airflow' },

    /* task 체인 */
    { from: 'node-airflow',  to: 'node-presidio' },
    { from: 'node-presidio', to: 'node-docling' },
    { from: 'node-docling',  to: 'node-kure' },
    { from: 'node-kure',     to: 'node-valkey' },

    /* fan-out: valkey → 3 Sink */
    { from: 'node-valkey', to: 'node-es' },
    { from: 'node-valkey', to: 'node-kibana' },
    { from: 'node-valkey', to: 'node-mysql' },
  ],
};
