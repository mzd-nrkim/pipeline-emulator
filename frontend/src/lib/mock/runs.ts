import type { Run } from '../api/types.js';

export const mockRuns: Run[] = [
  // 정상 케이스 — masking ON, 전 단계 완전 처리
  {
    id: 'run-001',
    startedAt: '2026-07-14T09:00:00Z',
    durationMs: 52300,
    status: 'succeeded',
    config: { masking: true, search: false },
    stageCounts: {
      ingestion: 8,
      bronze_raw: 8,
      silver_structured: 8,
      silver_masked: 8,
      gold_chunked: 24,
      gold_enriched: 24,
      gold_staged: 24,
    },
  },
  // 정상 케이스 — masking OFF, silver_masked 건수 없음
  {
    id: 'run-002',
    startedAt: '2026-07-13T14:30:00Z',
    durationMs: 48700,
    status: 'succeeded',
    config: { masking: false, search: false },
    stageCounts: {
      ingestion: 5,
      bronze_raw: 5,
      silver_structured: 5,
      silver_masked: 0,
      gold_chunked: 15,
      gold_enriched: 15,
      gold_staged: 15,
    },
  },
  // 실패 케이스 — gold_chunked 단계에서 중단
  {
    id: 'run-003',
    startedAt: '2026-07-12T11:00:00Z',
    durationMs: 23100,
    status: 'failed',
    config: { masking: true, search: false },
    stageCounts: {
      ingestion: 5,
      bronze_raw: 5,
      silver_structured: 5,
      silver_masked: 3,
      gold_chunked: 0,
      gold_enriched: 0,
      gold_staged: 0,
    },
    failureReason: 'gold_chunked: Docling 파싱 오류 — 지원하지 않는 PDF 포맷 (3건)',
  },
  // 정상 케이스 — search ON, 대량 문서
  {
    id: 'run-004',
    startedAt: '2026-07-11T08:15:00Z',
    durationMs: 134500,
    status: 'succeeded',
    config: { masking: true, search: true },
    stageCounts: {
      ingestion: 20,
      bronze_raw: 20,
      silver_structured: 19,
      silver_masked: 19,
      gold_chunked: 57,
      gold_enriched: 57,
      gold_staged: 57,
    },
  },
  // 실패 케이스 — silver_structured 단계에서 중단
  {
    id: 'run-005',
    startedAt: '2026-07-10T16:45:00Z',
    durationMs: 8900,
    status: 'failed',
    config: { masking: false, search: false },
    stageCounts: {
      ingestion: 3,
      bronze_raw: 3,
      silver_structured: 0,
      silver_masked: 0,
      gold_chunked: 0,
      gold_enriched: 0,
      gold_staged: 0,
    },
    failureReason: 'silver_structured: KURE 모델 응답 타임아웃 (30s 초과)',
  },
];
