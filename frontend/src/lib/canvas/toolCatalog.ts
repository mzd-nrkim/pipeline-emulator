export type ToolCategory = 'source' | 'task' | 'switch' | 'sink';
export type FieldType = 'text' | 'number' | 'select' | 'boolean';

export interface ConfigField {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];      // select 타입에만 사용
  placeholder?: string;
  group?: string;          // '연결' | '동작' | '인증' 등
}

export interface ToolCatalogEntry {
  id: string;
  displayName: string;
  vendor: string;
  category: ToolCategory;
  icon: string;            // 이모지 또는 약어 배지 (svg 경로 폴백)
  accent: string;          // 벤더 브랜드 색 hex
  configFields: ConfigField[];
}

const catalog: ToolCatalogEntry[] = [
  {
    id: 'apache-nifi',
    displayName: 'Apache NiFi 2.8.0',
    vendor: 'Apache',
    category: 'source',
    icon: '🔄',
    accent: '#728E9B',
    configFields: [
      { key: 'connectionPool', label: '연결 풀', type: 'text', group: '연결' },
      { key: 'sqlQuery', label: 'SQL 쿼리', type: 'text', group: '동작' },
      { key: 'inputDir', label: '입력 디렉토리', type: 'text', group: '동작' },
      { key: 'fileFilterRegex', label: '파일 필터 정규식', type: 'text', group: '동작' },
      { key: 'outputFormat', label: '출력 형식', type: 'text', group: '동작' },
    ],
  },
  {
    id: 'debezium',
    displayName: 'Debezium 3.4.0.Final',
    vendor: 'Debezium',
    category: 'source',
    icon: '📡',
    accent: '#FF0000',
    configFields: [
      { key: 'connectorType', label: '커넥터 유형', type: 'text', group: '연결' },
      { key: 'dbHost', label: 'DB 호스트', type: 'text', group: '연결' },
      { key: 'dbPort', label: 'DB 포트', type: 'number', group: '연결' },
      { key: 'dbUser', label: 'DB 사용자', type: 'text', group: '인증' },
      { key: 'walMode', label: 'WAL 모드', type: 'text', group: '동작' },
    ],
  },
  {
    id: 'dam',
    displayName: 'DAM (외부 API)',
    vendor: 'External',
    category: 'source',
    icon: '📁',
    accent: '#6B7280',
    configFields: [
      { key: 'endpoint', label: '엔드포인트', type: 'text', group: '연결' },
      { key: 'filePath', label: '파일 경로', type: 'text', group: '동작' },
      {
        key: 'outputFormat',
        label: '출력 형식',
        type: 'select',
        options: ['markdown', 'html', 'json'],
        group: '동작',
      },
    ],
  },
  {
    id: 'apache-airflow',
    displayName: 'Apache Airflow 3.1.5',
    vendor: 'Apache',
    category: 'task',
    icon: '✈️',
    accent: '#017CEE',
    configFields: [
      { key: 'dagId', label: 'DAG ID', type: 'text', group: '동작' },
      { key: 'conf', label: '설정 JSON', type: 'text', group: '동작' },
      { key: 'executor', label: '실행기', type: 'text', group: '동작' },
    ],
  },
  {
    id: 'presidio',
    displayName: 'Presidio 2-Layer',
    vendor: 'Microsoft',
    category: 'task',
    icon: '🛡️',
    accent: '#00BCF2',
    configFields: [
      { key: 'recognizers', label: '인식기', type: 'text', group: '동작' },
      { key: 'nlpEngine', label: 'NLP 엔진', type: 'text', group: '동작' },
      { key: 'anonymizeStrategy', label: '익명화 전략', type: 'text', group: '동작' },
    ],
  },
  {
    id: 'docling-langchain',
    displayName: 'Docling + LangChain',
    vendor: 'Docling/LangChain',
    category: 'task',
    icon: '📄',
    accent: '#764ABC',
    configFields: [
      { key: 'chunkSize', label: '청크 크기', type: 'number', group: '동작' },
      { key: 'chunkOverlap', label: '청크 오버랩', type: 'number', group: '동작' },
      {
        key: 'strategy',
        label: '청킹 전략',
        type: 'select',
        options: ['structure', 'parent-child', 'contextual'],
        group: '동작',
      },
    ],
  },
  {
    id: 'kure-embedding',
    displayName: 'KURE-v1 (ONNX INT8)',
    vendor: 'KURE',
    category: 'task',
    icon: '🔢',
    accent: '#8B5CF6',
    configFields: [
      { key: 'modelPath', label: '모델 경로', type: 'text', group: '동작' },
      { key: 'outputDim', label: '출력 차원', type: 'number', group: '동작' },
      { key: 'batchSize', label: '배치 크기', type: 'number', group: '동작' },
    ],
  },
  {
    id: 'valkey',
    displayName: 'Valkey 8.1.4',
    vendor: 'Valkey',
    category: 'task',
    icon: '⚡',
    accent: '#DC382D',
    configFields: [
      { key: 'host', label: '호스트', type: 'text', group: '연결' },
      { key: 'port', label: '포트', type: 'number', group: '연결' },
      { key: 'streamKey', label: '스트림 키', type: 'text', group: '동작' },
      { key: 'maxlen', label: '최대 길이', type: 'number', group: '동작' },
    ],
  },
  {
    id: 'airflow-branch',
    displayName: '수집유형 분기',
    vendor: 'Apache',
    category: 'switch',
    icon: '🔀',
    accent: '#017CEE',
    configFields: [
      { key: 'field', label: '분기 필드', type: 'text', group: '동작' },
      { key: 'cases', label: '분기 케이스', type: 'text', group: '동작' },
    ],
  },
  {
    id: 's3',
    displayName: 'S3 (Bronze/아카이브)',
    vendor: 'AWS',
    category: 'sink',
    icon: '🪣',
    accent: '#FF9900',
    configFields: [
      { key: 'bucket', label: '버킷', type: 'text', group: '연결' },
      { key: 'prefix', label: '프리픽스', type: 'text', group: '동작' },
      {
        key: 'format',
        label: '저장 형식',
        type: 'select',
        options: ['parquet', 'jsonl'],
        group: '동작',
      },
    ],
  },
  {
    id: 'mysql',
    displayName: 'MySQL (Silver/Gold)',
    vendor: 'Oracle',
    category: 'sink',
    icon: '🗄️',
    accent: '#4479A1',
    configFields: [
      { key: 'host', label: '호스트', type: 'text', group: '연결' },
      { key: 'database', label: '데이터베이스', type: 'text', group: '연결' },
      { key: 'table', label: '테이블', type: 'text', group: '동작' },
      { key: 'batchSize', label: '배치 크기', type: 'number', group: '동작' },
    ],
  },
  {
    id: 'elasticsearch',
    displayName: 'Elasticsearch 9.2.5',
    vendor: 'Elastic',
    category: 'sink',
    icon: '🔍',
    accent: '#FEC514',
    configFields: [
      { key: 'index', label: '인덱스', type: 'text', group: '동작' },
      { key: 'bulkSize', label: '벌크 크기', type: 'number', group: '동작' },
      { key: 'mlNode', label: 'ML 노드', type: 'text', group: '동작' },
      { key: 'esFieldInfo', label: 'ES 필드 정보', type: 'text', group: '동작' },
    ],
  },
  {
    id: 'kibana',
    displayName: 'Kibana 9.2.5',
    vendor: 'Elastic',
    category: 'sink',
    icon: '📊',
    accent: '#FEC514',
    configFields: [
      { key: 'space', label: '스페이스', type: 'text', group: '동작' },
      { key: 'dashboardId', label: '대시보드 ID', type: 'text', group: '동작' },
    ],
  },
];

const catalogMap: Map<string, ToolCatalogEntry> = new Map(
  catalog.map((entry) => [entry.id, entry])
);

export function getToolEntry(id: string): ToolCatalogEntry | undefined {
  return catalogMap.get(id);
}

export { catalog as toolCatalog };
