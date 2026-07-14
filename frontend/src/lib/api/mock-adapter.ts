import { stages, runs, documents, searchResults, dimensions } from '../mock/selectors.js';
import type { Stage, Run, Document, SearchResult, Dimension } from './types.js';

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

/* SSE stub (Week 2 활성화) */
export function subscribePipelineStatus(_onChange: (event: unknown) => void): () => void {
  return () => {}; // noop cleanup
}
