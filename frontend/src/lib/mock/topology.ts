import type { CanvasTopology } from '../api/types.js';

/**
 * 샘플 캔버스 토폴로지
 *
 * 구조:
 *   [rdb-source] ──┐
 *                  ├──→ [masking-task] ──→ [switch] ──(doc_type=structured)──→ [chunking-task] ──┬──→ [es-sink]
 *   [s3-source]  ──┘                                └──(doc_type=unstructured)──→ [raw-sink]      └──→ [s3-sink]
 *
 * fan-in  : rdb-source + s3-source → masking-task
 * branch  : switch → chunking-task (structured) / raw-sink (unstructured)
 * fan-out : chunking-task → es-sink + s3-sink
 */
export const mockTopology: CanvasTopology = {
  nodes: [
    /* ── Sources ── */
    {
      id: 'rdb-source',
      kind: 'source',
      tool: 'rdb_loader',
      config: {
        sourceKind: 'rdb',
        host: 'localhost',
        port: 5432,
        database: 'vehicle_docs',
        table: 'documents',
      },
    },
    {
      id: 's3-source',
      kind: 'source',
      tool: 's3_loader',
      config: {
        sourceKind: 's3',
        bucket: 'raw-docs-bucket',
        prefix: 'uploads/',
      },
    },

    /* ── Tasks ── */
    {
      id: 'masking-task',
      kind: 'task',
      tool: 'pii_masker',
      config: {
        dagId: 'silver_2_masking',
        fields: ['name', 'email', 'phone'],
        strategy: 'replace',
      },
    },
    {
      id: 'chunking-task',
      kind: 'task',
      tool: 'text_chunker',
      config: {
        dagId: 'gold_3_chunking',
        chunkSize: 512,
        overlap: 64,
        strategy: 'sentence',
      },
    },

    /* ── Switch ── */
    {
      id: 'doc-type-switch',
      kind: 'switch',
      tool: 'condition_router',
      config: {
        field: 'doc_type',
        cases: ['structured', 'unstructured'],
      },
    },

    /* ── Sinks ── */
    {
      id: 'es-sink',
      kind: 'sink',
      tool: 'elasticsearch_writer',
      config: {
        index: 'vehicle-docs-v1',
        bulkSize: 100,
      },
    },
    {
      id: 's3-sink',
      kind: 'sink',
      tool: 's3_writer',
      config: {
        bucket: 'processed-docs-bucket',
        prefix: 'chunked/',
        format: 'jsonl',
      },
    },
    {
      id: 'raw-sink',
      kind: 'sink',
      tool: 's3_writer',
      config: {
        bucket: 'raw-unstructured-bucket',
        prefix: 'unstructured/',
        format: 'binary',
      },
    },
  ],

  edges: [
    /* fan-in: 두 Source → masking-task */
    { from: 'rdb-source', to: 'masking-task' },
    { from: 's3-source', to: 'masking-task' },

    /* masking → switch */
    { from: 'masking-task', to: 'doc-type-switch' },

    /* branch: switch 분기 */
    { from: 'doc-type-switch', to: 'chunking-task', condition: 'doc_type=structured' },
    { from: 'doc-type-switch', to: 'raw-sink', condition: 'doc_type=unstructured' },

    /* fan-out: chunking-task → es-sink + s3-sink */
    { from: 'chunking-task', to: 'es-sink' },
    { from: 'chunking-task', to: 's3-sink' },
  ],
};
