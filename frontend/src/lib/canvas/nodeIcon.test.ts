import { describe, it, expect } from 'vitest';
import { resolveNodeIcon } from './nodeIcon.js';

describe('resolveNodeIcon', () => {
  // Right TC — brand 매핑
  it('apache-nifi → brand/apachenifi', () => {
    expect(resolveNodeIcon('apache-nifi', '🔧')).toEqual({ kind: 'brand', slug: 'apachenifi' });
  });

  it('mysql → brand/mysql', () => {
    expect(resolveNodeIcon('mysql', '🔧')).toEqual({ kind: 'brand', slug: 'mysql' });
  });

  // Right TC — lucide 매핑
  it('debezium → lucide/Activity', () => {
    expect(resolveNodeIcon('debezium', '🔧')).toEqual({ kind: 'lucide', name: 'Activity' });
  });

  // Boundary TC — 미매핑 toolId + fallbackEmoji 존재 → emoji 반환
  it('unknown-tool + fallbackEmoji="🔧" → emoji/🔧', () => {
    expect(resolveNodeIcon('unknown-tool', '🔧')).toEqual({ kind: 'emoji', char: '🔧' });
  });

  // Inverse TC — 미매핑 toolId + fallbackEmoji='' → emoji/❓ 강등
  it('unknown-tool + fallbackEmoji="" → emoji/❓', () => {
    expect(resolveNodeIcon('unknown-tool', '')).toEqual({ kind: 'emoji', char: '❓' });
  });

  // Boundary TC — toolId 미매핑이지만 category 매핑 존재 → lucide/Radio
  it('unknown-tool + category="source" → lucide/Radio', () => {
    expect(resolveNodeIcon('unknown-tool', '🔧', 'source')).toEqual({ kind: 'lucide', name: 'Radio' });
  });
});
