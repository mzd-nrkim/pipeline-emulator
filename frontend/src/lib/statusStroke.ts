export type StageStatus = 'completed' | 'in_progress' | 'pending' | 'failed' | 'none';

const statusStrokeMap: Record<StageStatus, string> = {
  completed: 'var(--color-status-done)',
  in_progress: 'var(--color-status-running)',
  pending: 'var(--color-status-pending)',
  failed: 'var(--color-status-failed)',
  none: 'var(--color-status-empty)',
};

export function statusStroke(status: StageStatus): string {
  return statusStrokeMap[status];
}
