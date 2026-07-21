import { describe, it, expect } from 'vitest';
import { generateLogs } from './logs.js';
import type { LogLevel } from '../api/types.js';

const VALID_LEVELS: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

describe('generateLogs', () => {
  // Right: source='container', tool='mysql'
  it('returns non-empty lines with correct shape for container/mysql', () => {
    const result = generateLogs({ nodeId: 'node-1', tool: 'mysql', source: 'container' });
    expect(result.lines.length).toBeGreaterThan(0);
    for (const line of result.lines) {
      expect(line).toHaveProperty('ts');
      expect(line).toHaveProperty('level');
      expect(line).toHaveProperty('message');
      expect(typeof line.ts).toBe('string');
      expect(typeof line.level).toBe('string');
      expect(typeof line.message).toBe('string');
    }
  });

  // Right: source='airflow' + dagId → message contains dagId
  it('includes dagId in at least one message for airflow source', () => {
    const dagId = 'test-dag';
    const result = generateLogs({ nodeId: 'node-2', tool: 'apache-airflow', source: 'airflow', dagId });
    const hasdag = result.lines.some((l) => l.message.includes(dagId));
    expect(hasdag).toBe(true);
  });

  // Boundary/Cardinality: tail=0 → empty lines
  it('returns empty lines when tail=0', () => {
    const result = generateLogs({ nodeId: 'node-3', tool: 'mysql', source: 'container', tail: 0 });
    expect(result.lines).toEqual([]);
  });

  // Boundary/Cardinality: tail=5 → lines.length <= 5
  it('returns at most 5 lines when tail=5', () => {
    const result = generateLogs({ nodeId: 'node-4', tool: 'mysql', source: 'container', tail: 5 });
    expect(result.lines.length).toBeLessThanOrEqual(5);
  });

  // Existence: unknown tool → no error, lines produced (generic fallback)
  it('does not throw for unknown tool id and produces lines', () => {
    expect(() => {
      const result = generateLogs({ nodeId: 'node-5', tool: 'unknown-tool', source: 'container' });
      expect(result.lines.length).toBeGreaterThan(0);
    }).not.toThrow();
  });

  // Existence: source='airflow' without dagId → no throw
  it('does not throw for airflow source with no dagId', () => {
    expect(() => {
      generateLogs({ nodeId: 'node-6', tool: 'apache-airflow', source: 'airflow' });
    }).not.toThrow();
  });

  // Deterministic: same now + args → identical result
  it('returns identical result for same arguments and same now', () => {
    const params = { nodeId: 'node-7', tool: 'postgresql', source: 'container' as const, now: 1700000000000 };
    const r1 = generateLogs(params);
    const r2 = generateLogs(params);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  // Deterministic/Time: different now → different ts values
  it('produces different timestamps when now differs', () => {
    const base = { nodeId: 'node-8', tool: 'elasticsearch', source: 'container' as const };
    const r1 = generateLogs({ ...base, now: 1700000000000 });
    const r2 = generateLogs({ ...base, now: 1700000009999 });
    const ts1 = r1.lines.map((l) => l.ts);
    const ts2 = r2.lines.map((l) => l.ts);
    expect(ts1).not.toEqual(ts2);
  });

  // Range: all levels are valid
  it('produces only valid log levels for all lines', () => {
    const result = generateLogs({ nodeId: 'node-9', tool: 'apache-nifi', source: 'container' });
    for (const line of result.lines) {
      expect(VALID_LEVELS).toContain(line.level);
    }
  });
});
