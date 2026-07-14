/* Week 2에서 구현 — 현재 stub */
import type { Stage, Run, Document, SearchResult, Dimension } from './types.js';

const BASE = import.meta.env.PUBLIC_UI_BACKEND_URL ?? 'http://localhost:8000';

export async function fetchStages(): Promise<Stage[]> {
  throw new Error('real-adapter: Week 2에서 구현 예정');
}

export async function fetchRuns(): Promise<Run[]> {
  throw new Error('real-adapter: Week 2에서 구현 예정');
}

export async function fetchDocuments(): Promise<Document[]> {
  throw new Error('real-adapter: Week 2에서 구현 예정');
}

export async function fetchSearch(_query: string): Promise<SearchResult[]> {
  throw new Error('real-adapter: Week 2에서 구현 예정');
}

export async function fetchDimensions(): Promise<Dimension[]> {
  throw new Error('real-adapter: Week 2에서 구현 예정');
}

export function subscribePipelineStatus(onChange: (event: unknown) => void): () => void {
  const es = new EventSource(`${BASE}/pipeline/events`);
  es.onmessage = (e: MessageEvent) => {
    try { onChange(JSON.parse(e.data)); } catch { /* ignore */ }
  };
  return () => es.close();
}
