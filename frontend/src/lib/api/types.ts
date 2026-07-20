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
  failureReason?: string;
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

/* 캔버스 토폴로지 계약 */
export type SourceKind = 'rdb' | 's3' | 'unstructured';

export type ToolRole =
  | 'ingest'      // 데이터 수집 (NiFi, Debezium, DAM)
  | 'transform'   // 데이터 변환/처리 (Presidio, Docling, KURE, Airflow)
  | 'route'       // 조건부 라우팅 (Branch - 향후 확장용)
  | 'store'       // 데이터 저장 (S3, MySQL)
  | 'index'       // 검색 인덱싱 (Elasticsearch)
  | 'broker'      // 메시지 브로커 (Valkey)
  | 'visualize';  // 시각화 (Kibana)

export interface ToolNode {
  id: string;
  label?: string;
  role: ToolRole;
  trigger?: boolean;
  /** 카탈로그 id 참조 — toolCatalog.ts의 ToolCatalogEntry.id 값과 일치해야 한다 */
  tool: string;
  config: Record<string, unknown>;
  outOfTeamScope?: boolean;
}

export interface Edge {
  from: string;
  to: string;
  channels: ('data' | 'dependency')[];  // 이 엣지가 나타날 뷰 집합
  condition?: string;
}

export interface CanvasTopology {
  nodes: ToolNode[];
  edges: Edge[];
}
