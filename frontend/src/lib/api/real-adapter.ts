/* Week 2 ui-backend 실제 어댑터 */
import { PUBLIC_UI_BACKEND_URL } from '$env/static/public';
import type { Stage, Run, Document, SearchResult, Dimension, CanvasTopology } from './types.js';

const BASE = PUBLIC_UI_BACKEND_URL || 'http://localhost:8001';

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
  const res = await fetch(`${BASE}/documents`);
  if (!res.ok) throw new Error(`fetchDocuments: ${res.status}`);
  return res.json();
}

export async function fetchSearch(query: string, mode: string = 'keyword'): Promise<SearchResult[]> {
  const res = await fetch(`${BASE}/search?q=${encodeURIComponent(query)}&mode=${mode}&size=20`);
  if (!res.ok) return [];
  const raw: any[] = await res.json();
  return raw.map((r) => {
    const tags = r.metadata_tags || {};
    return {
      id: String(r.staged_id ?? ''),
      title: r.summary || r.chunk_content?.slice(0, 80) || '',
      summary: r.summary || '',
      priority: (tags.importance_code ?? 'A') as import('./types.js').Priority,
      security: (r.pclrty_class ?? 'INTERNAL') as import('./types.js').SecurityClass,
      vehicleModel: (tags.vehicle_model ?? 'NX01') as import('./types.js').VehicleModel,
      score: r.score ?? 0,
      keywordScore: r.keyword_score ?? 0,
      semanticScore: r.semantic_score ?? 0,
      highlight: r.chunk_content?.slice(0, 200) || '',
    };
  });
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

import { realTopology } from '../mock/realTopology.js';

export async function fetchCanvasTopology(): Promise<CanvasTopology> {
  // 파이프라인 토폴로지는 고정 구조 — real 모드에서도 동일한 DAG 그래프 사용
  return realTopology;
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

export async function fetchServiceHealth(): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${BASE}/health/services`);
    if (!res.ok) return {};
    return res.json();
  } catch {
    return {};
  }
}

export async function setNodeConfig(nodeId: string, config: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/nodes/${nodeId}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config }),
  });
  if (!res.ok) {
    let detail = `setNodeConfig: ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch { /* ignore */ }
    throw new Error(detail);
  }
  return res.json();
}

export function subscribePipelineStatus(onChange: (event: unknown) => void): () => void {
  const es = new EventSource(`${BASE}/sse/stages`);
  es.onmessage = (e: MessageEvent) => {
    try { onChange(JSON.parse(e.data)); } catch { /* ignore */ }
  };
  es.onerror = () => { es.close(); };
  return () => es.close();
}
