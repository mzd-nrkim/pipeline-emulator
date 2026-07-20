/**
 * nodeIcon.ts
 * 3단 폴백 아이콘 리졸버: brand (simple-icons) → lucide → emoji
 */

export type NodeIconSpec =
  | { kind: 'brand'; slug: string }
  | { kind: 'lucide'; name: string }
  | { kind: 'emoji'; char: string };

/** toolId → simple-icons slug (v16.27.0 기준 존재 확인 완료) */
export const BRAND_ICON_MAP: Record<string, string> = {
  'apache-nifi': 'apachenifi',
  'apache-airflow': 'apacheairflow',
  'airflow-branch': 'apacheairflow',
  'mysql': 'mysql',
  'elasticsearch': 'elasticsearch',
  'kibana': 'kibana',
  'docling-langchain': 'langchain',
};

/** toolId → lucide icon name (brand slug 미존재 toolId 폴백) */
export const LUCIDE_ICON_MAP: Record<string, string> = {
  'debezium': 'Activity',      // CDC 스트리밍
  's3': 'Archive',             // 오브젝트 스토리지
  'valkey': 'Database',        // 캐시/브로커
  'presidio': 'Shield',        // PII 마스킹
  'kure-embedding': 'Binary',  // 임베딩 모델
  'dam': 'Globe',              // 외부 API
  'zookeeper': 'Layers',       // 협조 서비스
};

/**
 * toolId에 대응하는 아이콘 스펙을 반환한다.
 * 우선순위: brand → lucide → emoji(fallbackEmoji)
 */
export function resolveNodeIcon(toolId: string, fallbackEmoji: string): NodeIconSpec {
  const brandSlug = BRAND_ICON_MAP[toolId];
  if (brandSlug !== undefined) {
    return { kind: 'brand', slug: brandSlug };
  }

  const lucideName = LUCIDE_ICON_MAP[toolId];
  if (lucideName !== undefined) {
    return { kind: 'lucide', name: lucideName };
  }

  return { kind: 'emoji', char: fallbackEmoji || '❓' };
}
