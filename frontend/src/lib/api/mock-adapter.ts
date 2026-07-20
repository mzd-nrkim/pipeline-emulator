import { stages, runs, documents, searchResults, dimensions, topology } from '../mock/selectors.js';
import type { Stage, Run, Document, SearchResult, Dimension, CanvasTopology } from './types.js';

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
