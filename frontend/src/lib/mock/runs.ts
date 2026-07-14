import type { Run } from '../api/types.js';

export const mockRuns: Run[] = [
  {
    id: 'run-001',
    startedAt: '2026-07-14T09:00:00Z',
    durationMs: 52300,
    status: 'succeeded',
    config: { masking: true, search: false },
    stageCounts: {
      ingestion: 5, bronze_raw: 5, silver_structured: 5,
      silver_masked: 5, gold_chunked: 15, gold_enriched: 15, gold_staged: 15,
    },
  },
  {
    id: 'run-002',
    startedAt: '2026-07-13T14:30:00Z',
    durationMs: 48700,
    status: 'succeeded',
    config: { masking: false, search: false },
    stageCounts: {
      ingestion: 5, bronze_raw: 5, silver_structured: 5,
      silver_masked: 0, gold_chunked: 15, gold_enriched: 15, gold_staged: 15,
    },
  },
  {
    id: 'run-003',
    startedAt: '2026-07-12T11:00:00Z',
    durationMs: 23100,
    status: 'failed',
    config: { masking: true, search: false },
    stageCounts: {
      ingestion: 5, bronze_raw: 5, silver_structured: 5,
      silver_masked: 3, gold_chunked: 0, gold_enriched: 0, gold_staged: 0,
    },
  },
];
