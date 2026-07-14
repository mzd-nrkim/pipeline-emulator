/* Week 2 ui-backend API 응답 타입 선점 */

export type StageStatus = 'completed' | 'in_progress' | 'pending' | 'failed' | 'none';
export type Layer = 'Bronze' | 'Silver' | 'Gold' | 'Serving';
export type Priority = 'S' | 'A' | 'B' | 'C' | 'D' | 'E';
export type SecurityClass = 'RESTRICTED' | 'INTERNAL' | 'PUBLIC';
export type VehicleModel = 'NX01' | 'NX02' | 'GN01';

export interface Stage {
  id: string;
  index: number;
  name: string;
  layer: Layer;
  status: StageStatus;
  docsIn: number;
  docsOut: number;
  description: string;
  lastRunAt: string | null;
  durationMs: number | null;
  planned?: boolean;
  failureReason?: string;
}

export interface PiiCount {
  type: string;
  label: string;
  count: number;
  planned?: boolean;
}

export interface RunConfig {
  masking: boolean;
  search: boolean;
}

export interface Run {
  id: string;
  startedAt: string;
  durationMs: number;
  status: 'succeeded' | 'failed' | 'in_progress';
  config: RunConfig;
  stageCounts?: Record<string, number>;
}

export interface Document {
  id: string;
  priority: Priority;
  security: SecurityClass;
  stageReached: string;
  masked: boolean;
  vehicleModel: VehicleModel;
  title: string;
  piiCounts?: PiiCount[];
}

export interface SearchResult {
  id: string;
  title: string;
  summary: string;
  priority: Priority;
  security: SecurityClass;
  vehicleModel: VehicleModel;
  score: number;
  keywordScore: number;
  semanticScore: number;
  highlight: string;
}

export interface Dimension {
  key: string;
  label: string;
  description: string;
  values: string[];
  current: string;
  planned?: boolean;
  dependsOn?: string;
}

/* SSE 이벤트 (Week 2 활성화) */
export interface PipelineStatusEvent {
  stageId: string;
  status: StageStatus;
  docsOut: number;
  timestamp: string;
}
