/* Week 2 ui-backend 실제 어댑터 */
import type { Stage, Run, Document, SearchResult, Dimension, CanvasTopology } from './types.js';

const BASE = import.meta.env.PUBLIC_UI_BACKEND_URL ?? 'http://localhost:8001';

export async function fetchStages(): Promise<Stage[]> {
  const res = await fetch(`${BASE}/stages`);
  if (!res.ok) throw new Error(`fetchStages: ${res.status}`);
  return res.json();
}

export async function fetchRuns(): Promise<Run[]> {
  const res = await fetch(`${BASE}/runs`);
  if (!res.ok) throw new Error(`fetchRuns: ${res.status}`);
  return res.json();
}

export async function fetchDocuments(): Promise<Document[]> {
  throw new Error('real-adapter: documents API — Week 2 범위 외');
}

export async function fetchSearch(_query: string): Promise<SearchResult[]> {
  throw new Error('real-adapter: search — ES 스트레치 범위');
}

export async function fetchDimensions(): Promise<Dimension[]> {
  const res = await fetch(`${BASE}/config`);
  if (!res.ok) throw new Error(`fetchDimensions: ${res.status}`);
  const { flags } = await res.json();
  return Object.entries(flags as Record<string, string>).map(([key, val]) => ({
    key,
    label: key,
    description: '',
    values: [val],
    current: val,
  }));
}

import { mockTopology } from '../mock/topology.js';

export async function fetchCanvasTopology(): Promise<CanvasTopology> {
  // 파이프라인 토폴로지는 고정 구조 — real 모드에서도 동일한 DAG 그래프 사용
  return mockTopology;
}

export async function triggerNode(nodeId: string, conf: Record<string, unknown>): Promise<{ dag_run_id: string }> {
  const res = await fetch(`${BASE}/nodes/${nodeId}/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conf }),
  });
  if (!res.ok) throw new Error(`triggerNode: ${res.status}`);
  return res.json();
}

export async function setNodeConfig(nodeId: string, config: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${BASE}/nodes/${nodeId}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config }),
  });
  if (!res.ok) throw new Error(`setNodeConfig: ${res.status}`);
}

export function subscribePipelineStatus(onChange: (event: unknown) => void): () => void {
  const es = new EventSource(`${BASE}/sse/stages`);
  es.onmessage = (e: MessageEvent) => {
    try { onChange(JSON.parse(e.data)); } catch { /* ignore */ }
  };
  es.onerror = () => { es.close(); };
  return () => es.close();
}
