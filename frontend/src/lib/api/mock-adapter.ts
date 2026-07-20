import { stages, runs, documents, searchResults, dimensions, topology } from '../mock/selectors.js';
import type { Stage, Run, Document, SearchResult, Dimension, CanvasTopology, PiiCount, TaskInstance } from './types.js';

export async function fetchStages(): Promise<Stage[]> {
  return stages;
}

export async function fetchRuns(): Promise<Run[]> {
  return runs;
}

export async function fetchDocuments(): Promise<Document[]> {
  return documents;
}

export async function fetchSearch(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  return searchResults.filter(r =>
    r.title.includes(query) || r.summary.includes(query)
  );
}

export async function fetchDimensions(): Promise<Dimension[]> {
  return dimensions;
}

export async function fetchCanvasTopology(): Promise<CanvasTopology> {
  return topology;
}

export async function triggerNode(nodeId: string, _conf: Record<string, unknown>): Promise<{ dag_run_id: string }> {
  return { dag_run_id: `mock-run-${nodeId}-${Date.now()}` };
}

export async function setNodeConfig(_nodeId: string, _config: Record<string, unknown>): Promise<void> {
  // mock noop
}

export async function fetchServiceHealth(): Promise<Record<string, string>> {
  return { 'node-airflow': 'up', 'node-mysql': 'up', 'node-es': 'up' };
}

export async function setServicePower(service: string, action: 'start' | 'stop' | 'restart'): Promise<void> {
  console.log(`[mock] setServicePower: service=${service} action=${action}`);
}

/* SSE stub (Week 2 활성화) */
export function subscribePipelineStatus(_onChange: (event: unknown) => void): () => void {
  return () => {}; // noop cleanup
}

export function fetchPiiStats(): PiiCount[] {
  return [
    { type: 'total', label: '전체 감지', count: 42 },
    { type: 'masked', label: '마스킹 완료', count: 38 },
    { type: 'unmasked', label: '미마스킹', count: 4, planned: true },
  ];
}

export function fetchExecutions(_dagId: string, _runId: string): TaskInstance[] {
  return [
    { taskId: 'bronze_ingest', state: 'completed', startDate: null, endDate: null, durationMs: 1230, tryNumber: 1 },
    { taskId: 'bronze_mask', state: 'completed', startDate: null, endDate: null, durationMs: 890, tryNumber: 1 },
    { taskId: 'silver_enrich', state: 'in_progress', startDate: null, endDate: null, durationMs: null, tryNumber: 1 },
    { taskId: 'gold_export', state: 'none', startDate: null, endDate: null, durationMs: null, tryNumber: 1 },
  ];
}
