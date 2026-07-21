import type { LogSource, LogLevel, LogLine, LogResponse } from '../api/types.js';

interface GenerateLogsParams {
  nodeId: string;
  tool: string;
  source: LogSource;
  dagId?: string;
  tail?: number;
  now?: number;
}

function getFlavor(tool: string): string {
  if (tool === 'mysql' || tool === 'postgresql') return 'mysql';
  if (tool === 'elasticsearch') return 'es';
  if (tool === 'apache-nifi') return 'nifi';
  if (tool === 'apache-airflow') return 'airflow';
  if (tool === 'valkey') return 'valkey';
  if (tool === 'debezium') return 'debezium';
  if (tool.includes('app')) return 'app';
  return 'generic';
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h += s.charCodeAt(i);
  }
  return h;
}

type FlavorPool = Array<{ message: string; level: LogLevel }>;

const flavorPools: Record<string, FlavorPool> = {
  mysql: [
    { message: '[MySQL] [INFO] Query executed in 23ms on {nodeId}', level: 'INFO' },
    { message: '[MySQL] [DEBUG] Connection pool: 5/10 active', level: 'DEBUG' },
    { message: '[MySQL] [INFO] Transaction committed successfully', level: 'INFO' },
    { message: '[MySQL] [WARN] Slow query detected: 1200ms on {nodeId}', level: 'WARN' },
    { message: '[MySQL] [DEBUG] Index scan on table: documents', level: 'DEBUG' },
  ],
  es: [
    { message: '[ES] [INFO] Document indexed successfully', level: 'INFO' },
    { message: '[ES] [DEBUG] Shard routing: primary', level: 'DEBUG' },
    { message: '[ES] [INFO] Search request completed in 12ms', level: 'INFO' },
    { message: '[ES] [WARN] Bulk indexing queue approaching limit', level: 'WARN' },
    { message: '[ES] [DEBUG] Refresh interval triggered on {nodeId}', level: 'DEBUG' },
  ],
  nifi: [
    { message: '[NiFi] [INFO] FlowFile transferred to success', level: 'INFO' },
    { message: '[NiFi] [WARN] Back pressure threshold approaching', level: 'WARN' },
    { message: '[NiFi] [INFO] Processor {nodeId} scheduled', level: 'INFO' },
    { message: '[NiFi] [DEBUG] Queue depth: 42 FlowFiles', level: 'DEBUG' },
    { message: '[NiFi] [ERROR] Connection timeout to downstream processor', level: 'ERROR' },
  ],
  airflow: [
    { message: '[Airflow] [INFO] Scheduler heartbeat', level: 'INFO' },
    { message: '[Airflow] [DEBUG] DAG parsing completed', level: 'DEBUG' },
    { message: '[Airflow] [INFO] Task instance queued on {nodeId}', level: 'INFO' },
    { message: '[Airflow] [WARN] Executor queue filling up', level: 'WARN' },
    { message: '[Airflow] [DEBUG] Worker heartbeat received', level: 'DEBUG' },
  ],
  valkey: [
    { message: '[Valkey] [INFO] SET operation completed', level: 'INFO' },
    { message: '[Valkey] [DEBUG] Cache hit ratio: 94.2%', level: 'DEBUG' },
    { message: '[Valkey] [INFO] Key expiry processed on {nodeId}', level: 'INFO' },
    { message: '[Valkey] [DEBUG] AOF rewrite triggered', level: 'DEBUG' },
    { message: '[Valkey] [WARN] Memory usage at 78% of maxmemory', level: 'WARN' },
  ],
  debezium: [
    { message: '[Debezium] [INFO] CDC event captured from {nodeId}', level: 'INFO' },
    { message: '[Debezium] [DEBUG] Offset committed', level: 'DEBUG' },
    { message: '[Debezium] [INFO] Snapshot completed for table: records', level: 'INFO' },
    { message: '[Debezium] [WARN] Lag detected on connector {nodeId}', level: 'WARN' },
    { message: '[Debezium] [DEBUG] Heartbeat event received', level: 'DEBUG' },
  ],
  app: [
    { message: '[App] [INFO] Request processed in 45ms', level: 'INFO' },
    { message: '[App] [DEBUG] Cache hit for key: {nodeId}', level: 'DEBUG' },
    { message: '[App] [INFO] Health check passed', level: 'INFO' },
    { message: '[App] [WARN] Response time exceeded 500ms threshold', level: 'WARN' },
    { message: '[App] [DEBUG] Dependency injection resolved', level: 'DEBUG' },
  ],
  generic: [
    { message: '[{nodeId}] [INFO] Service running', level: 'INFO' },
    { message: '[{nodeId}] [DEBUG] Heartbeat OK', level: 'DEBUG' },
    { message: '[{nodeId}] [INFO] Processing completed', level: 'INFO' },
    { message: '[{nodeId}] [WARN] Resource usage elevated', level: 'WARN' },
    { message: '[{nodeId}] [DEBUG] Configuration reloaded', level: 'DEBUG' },
  ],
};

export function generateLogs(params: GenerateLogsParams): LogResponse {
  const { nodeId, tool, source, dagId, now: nowParam } = params;
  const tail = params.tail ?? 30;
  const now = nowParam ?? Date.now();

  if (tail === 0) {
    return { source, nodeId, lines: [] };
  }

  const seed = simpleHash(nodeId);
  const lines: LogLine[] = [];

  if (source === 'airflow') {
    for (let i = tail - 1; i >= 0; i--) {
      const ts = new Date(now - i * 1000).toISOString();
      const taskinstance = `taskinstance[${(seed + i) % 100}]`;
      let message: string;
      let level: LogLevel = 'INFO';

      if (dagId) {
        const idx = i % 3;
        if (idx === 0) {
          message = `[${ts}] {${taskinstance}} INFO - Task started for dag: ${dagId}`;
        } else if (idx === 1) {
          message = `[${ts}] {${taskinstance}} INFO - Executing task on ${nodeId}`;
        } else {
          message = `[${ts}] {${taskinstance}} INFO - Task instance finished`;
        }
      } else {
        message = `[${ts}] {{airflow}} INFO - Scheduler running`;
      }

      lines.push({ ts, level, message });
    }
  } else {
    // source === 'container'
    const flavor = getFlavor(tool);
    const pool = flavorPools[flavor] ?? flavorPools['generic'];

    for (let i = tail - 1; i >= 0; i--) {
      const ts = new Date(now - i * 1000).toISOString();
      const poolIdx = (seed + i) % pool.length;
      const entry = pool[poolIdx];
      const message = entry.message
        .replace('{nodeId}', nodeId)
        .replace('{ts}', ts);
      const level: LogLevel = entry.level;
      lines.push({ ts, level, message });
    }
  }

  return { source, nodeId, lines };
}
