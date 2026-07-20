export type ToolCategory = 'source' | 'task' | 'switch' | 'sink';
export type FieldType = 'text' | 'number' | 'select' | 'boolean';
export type ApplyMode = 'runtime' | 'restart' | 'code' | 'readonly';

export interface ConfigField {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];      // select 타입에만 사용
  placeholder?: string;
  group?: string;          // '연결' | '동작' | '인증' 등
  applyMode?: ApplyMode;   // 적용 방식: runtime(즉시) | restart(재기동) | code(코드변경) | readonly(변경불가)
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
      { key: 'connectionPool', label: '연결 풀', type: 'text', group: '연결', applyMode: 'readonly' },
      { key: 'sqlQuery', label: 'SQL 쿼리', type: 'text', group: '동작', applyMode: 'readonly' },
      { key: 'inputDir', label: '입력 디렉토리', type: 'text', group: '동작', applyMode: 'readonly' },
      { key: 'fileFilterRegex', label: '파일 필터 정규식', type: 'text', group: '동작', applyMode: 'readonly' },
      { key: 'outputFormat', label: '출력 형식', type: 'text', group: '동작', applyMode: 'readonly' },
      { key: 'schedulingStrategy', label: '스케줄링 전략', type: 'select', options: ['TIMER_DRIVEN', 'CRON_DRIVEN'], group: '동작', applyMode: 'readonly' },
      { key: 'batchSize', label: '배치 크기', type: 'number', group: '동작', applyMode: 'readonly' },
      { key: 'maxConcurrentTasks', label: '최대 동시 작업', type: 'number', group: '동작', applyMode: 'readonly' },
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
      { key: 'connectorType', label: '커넥터 유형', type: 'text', group: '연결', applyMode: 'readonly' },
      { key: 'dbHost', label: 'DB 호스트', type: 'text', group: '연결', applyMode: 'readonly' },
      { key: 'dbPort', label: 'DB 포트', type: 'number', group: '연결', applyMode: 'readonly' },
      { key: 'dbUser', label: 'DB 사용자', type: 'text', group: '인증', applyMode: 'readonly' },
      { key: 'walMode', label: 'WAL 모드', type: 'text', placeholder: 'binlog (MySQL) / pgoutput (PG)', group: '동작', applyMode: 'readonly' },
      { key: 'dbPassword', label: 'DB 비밀번호', type: 'text', placeholder: '***', group: '인증', applyMode: 'readonly' },
      { key: 'serverName', label: '서버 이름', type: 'text', group: '연결', applyMode: 'readonly' },
      { key: 'tableIncludeList', label: '포함 테이블 목록', type: 'text', placeholder: 'db.table1,db.table2', group: '동작', applyMode: 'readonly' },
      { key: 'offsetStorageTopic', label: '오프셋 저장 토픽', type: 'text', group: '동작', applyMode: 'readonly' },
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
      { key: 'endpoint', label: '엔드포인트', type: 'text', group: '연결', applyMode: 'readonly' },
      { key: 'filePath', label: '파일 경로', type: 'text', group: '동작', applyMode: 'readonly' },
      {
        key: 'outputFormat',
        label: '출력 형식',
        type: 'select',
        options: ['markdown', 'html', 'json'],
        group: '동작',
        applyMode: 'readonly',
      },
      { key: 'apiKey', label: 'API 키', type: 'text', placeholder: '***', group: '인증', applyMode: 'readonly' },
      { key: 'batchSize', label: '배치 크기', type: 'number', group: '동작', applyMode: 'readonly' },
      { key: 'retryCount', label: '재시도 횟수', type: 'number', group: '동작', applyMode: 'readonly' },
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
      { key: 'dagId', label: 'DAG ID', type: 'text', group: '동작', applyMode: 'readonly' },
      { key: 'conf', label: '설정 JSON', type: 'text', group: '동작', applyMode: 'runtime' },
      { key: 'executor', label: '실행기', type: 'text', group: '동작', applyMode: 'readonly' },
      { key: 'triggerRule', label: '트리거 규칙', type: 'select', options: ['all_success', 'all_failed', 'one_success', 'none_failed'], group: '동작', applyMode: 'code' },
      { key: 'retries', label: '재시도 횟수', type: 'number', group: '동작', applyMode: 'code' },
      { key: 'retryDelay', label: '재시도 지연(분)', type: 'number', group: '동작', applyMode: 'code' },
      { key: 'poolSlots', label: '풀 슬롯', type: 'number', group: '동작', applyMode: 'readonly' },
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
      { key: 'recognizers', label: '인식기', type: 'text', placeholder: 'phone,email,rrn,name,address', group: '동작', applyMode: 'readonly' },
      { key: 'nlpEngine', label: 'NLP 엔진', type: 'text', group: '동작', applyMode: 'restart' },
      { key: 'anonymizeStrategy', label: '익명화 전략', type: 'text', group: '동작', applyMode: 'readonly' },
      { key: 'language', label: '언어', type: 'select', options: ['ko', 'en', 'ja', 'zh'], group: '동작', applyMode: 'readonly' },
      { key: 'scoreThreshold', label: '점수 임계값', type: 'number', placeholder: '0.5', group: '동작', applyMode: 'readonly' },
      { key: 'returnDecisionProcess', label: '판정 과정 반환', type: 'boolean', group: '동작', applyMode: 'readonly' },
    ],
  },
  {
    id: 'docling-langchain',
    displayName: 'Structuring',
    vendor: 'Airflow DAG',
    category: 'task',
    icon: '📄',
    accent: '#764ABC',
    configFields: [
      { key: 'chunkSize', label: '청크 크기', type: 'number', group: '동작', applyMode: 'restart' },
      { key: 'chunkOverlap', label: '청크 오버랩', type: 'number', group: '동작', applyMode: 'restart' },
      {
        key: 'strategy',
        label: '청킹 전략',
        type: 'select',
        options: ['structure', 'parent-child', 'contextual'],
        group: '동작',
        applyMode: 'restart',
      },
      { key: 'splitBy', label: '분할 기준', type: 'select', options: ['sentence', 'word', 'page'], group: '동작', applyMode: 'restart' },
      { key: 'maxTokens', label: '최대 토큰', type: 'number', group: '동작', applyMode: 'restart' },
      { key: 'includeMetadata', label: '메타데이터 포함', type: 'boolean', group: '동작', applyMode: 'restart' },
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
      { key: 'modelPath', label: '모델 경로', type: 'text', group: '동작', applyMode: 'restart' },
      { key: 'outputDim', label: '출력 차원', type: 'number', group: '동작', applyMode: 'readonly' },
      { key: 'batchSize', label: '배치 크기', type: 'number', group: '동작', applyMode: 'restart' },
      { key: 'device', label: '디바이스', type: 'select', options: ['cpu', 'cuda', 'mps'], group: '동작', applyMode: 'restart' },
      { key: 'normalize', label: '벡터 정규화', type: 'boolean', group: '동작', applyMode: 'restart' },
      { key: 'precision', label: '정밀도', type: 'select', options: ['fp32', 'fp16', 'int8'], group: '동작', applyMode: 'restart' },
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
      { key: 'host', label: '호스트', type: 'text', group: '연결', applyMode: 'restart' },
      { key: 'port', label: '포트', type: 'number', group: '연결', applyMode: 'restart' },
      { key: 'streamKey', label: '스트림 키', type: 'text', group: '동작', applyMode: 'readonly' },
      { key: 'maxlen', label: '최대 길이', type: 'number', group: '동작', applyMode: 'readonly' },
      { key: 'password', label: '비밀번호', type: 'text', placeholder: '***', group: '인증', applyMode: 'restart' },
      { key: 'db', label: 'DB 번호', type: 'number', group: '연결', applyMode: 'restart' },
      { key: 'consumerGroup', label: '컨슈머 그룹', type: 'text', group: '동작', applyMode: 'readonly' },
      { key: 'ackMode', label: '수신 확인 모드', type: 'select', options: ['auto', 'manual'], group: '동작', applyMode: 'readonly' },
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
      { key: 'field', label: '분기 필드', type: 'text', group: '동작', applyMode: 'code' },
      { key: 'cases', label: '분기 케이스', type: 'text', group: '동작', applyMode: 'code' },
      { key: 'defaultCase', label: '기본 케이스', type: 'text', group: '동작', applyMode: 'code' },
      { key: 'taskGroup', label: '태스크 그룹', type: 'text', group: '동작', applyMode: 'code' },
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
      { key: 'bucket', label: '버킷', type: 'text', group: '연결', applyMode: 'readonly' },
      { key: 'prefix', label: '프리픽스', type: 'text', group: '동작', applyMode: 'readonly' },
      {
        key: 'format',
        label: '저장 형식',
        type: 'select',
        options: ['parquet', 'jsonl'],
        group: '동작',
        applyMode: 'readonly',
      },
      { key: 'region', label: '리전', type: 'text', placeholder: 'ap-northeast-2', group: '연결', applyMode: 'readonly' },
      { key: 'endpoint', label: '엔드포인트', type: 'text', placeholder: 'https://s3.amazonaws.com', group: '연결', applyMode: 'readonly' },
      { key: 'accessKeyId', label: 'Access Key ID', type: 'text', group: '인증', applyMode: 'readonly' },
      { key: 'partitionBy', label: '파티션 기준', type: 'text', placeholder: 'year/month/day', group: '동작', applyMode: 'readonly' },
      { key: 'compressionType', label: '압축 방식', type: 'select', options: ['none', 'snappy', 'gzip', 'zstd'], group: '동작', applyMode: 'readonly' },
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
      { key: 'host', label: '호스트', type: 'text', group: '연결', applyMode: 'restart' },
      { key: 'database', label: '데이터베이스', type: 'text', group: '연결', applyMode: 'restart' },
      { key: 'table', label: '테이블', type: 'text', group: '동작', applyMode: 'readonly' },
      { key: 'batchSize', label: '배치 크기', type: 'number', group: '동작', applyMode: 'readonly' },
      { key: 'port', label: '포트', type: 'number', group: '연결', applyMode: 'restart' },
      { key: 'user', label: '사용자', type: 'text', group: '인증', applyMode: 'restart' },
      { key: 'password', label: '비밀번호', type: 'text', placeholder: '***', group: '인증', applyMode: 'restart' },
      { key: 'ssl', label: 'SSL 사용', type: 'boolean', group: '연결', applyMode: 'restart' },
      { key: 'insertMode', label: '삽입 모드', type: 'select', options: ['insert', 'upsert', 'replace'], group: '동작', applyMode: 'readonly' },
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
      { key: 'index', label: '인덱스', type: 'text', group: '동작', applyMode: 'readonly' },
      { key: 'bulkSize', label: '벌크 크기', type: 'number', group: '동작', applyMode: 'readonly' },
      { key: 'mlNode', label: 'ML 노드', type: 'text', group: '동작', applyMode: 'readonly' },
      { key: 'esFieldInfo', label: 'ES 필드 정보', type: 'text', group: '동작', applyMode: 'readonly' },
      { key: 'host', label: '호스트', type: 'text', group: '연결', applyMode: 'restart' },
      { key: 'username', label: '사용자명', type: 'text', group: '인증', applyMode: 'restart' },
      { key: 'password', label: '비밀번호', type: 'text', placeholder: '***', group: '인증', applyMode: 'restart' },
      { key: 'pipeline', label: 'Ingest Pipeline', type: 'text', group: '동작', applyMode: 'readonly' },
      { key: 'refreshPolicy', label: '갱신 정책', type: 'select', options: ['false', 'true', 'wait_for'], group: '동작', applyMode: 'readonly' },
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
      { key: 'space', label: '스페이스', type: 'text', group: '동작', applyMode: 'readonly' },
      { key: 'dashboardId', label: '대시보드 ID', type: 'text', group: '동작', applyMode: 'readonly' },
      { key: 'host', label: '호스트', type: 'text', group: '연결', applyMode: 'restart' },
      { key: 'username', label: '사용자명', type: 'text', group: '인증', applyMode: 'restart' },
      { key: 'indexPattern', label: '인덱스 패턴', type: 'text', group: '동작', applyMode: 'readonly' },
      { key: 'refreshInterval', label: '새로고침 간격(s)', type: 'number', group: '동작', applyMode: 'readonly' },
    ],
  },
  {
    id: 'zookeeper',
    displayName: 'Apache ZooKeeper 3.9',
    vendor: 'Apache',
    category: 'source',
    icon: '⚙️',
    accent: '#D22128',
    configFields: [
      { key: 'connectString', label: '연결 문자열', type: 'text', group: '연결', applyMode: 'readonly' },
      { key: 'sessionTimeout', label: '세션 타임아웃(ms)', type: 'number', group: '동작', applyMode: 'readonly' },
      { key: 'tickTime', label: 'Tick Time(ms)', type: 'number', group: '동작', applyMode: 'readonly' },
    ],
  },
  {
    id: 'mock-api',
    displayName: 'Mock API (Enrichment)',
    vendor: '내부',
    category: 'task',
    icon: '🔌',
    accent: '#10B981',
    configFields: [
      { key: 'endpoint', label: '엔드포인트', type: 'text', group: '연결', applyMode: 'readonly' },
      { key: 'method', label: 'HTTP 메서드', type: 'select', options: ['GET', 'POST', 'PUT', 'PATCH'], group: '동작', applyMode: 'readonly' },
      { key: 'responseTemplate', label: '응답 템플릿', type: 'text', group: '동작', applyMode: 'runtime' },
      { key: 'latencyMs', label: '응답 지연(ms)', type: 'number', placeholder: '100', group: '동작', applyMode: 'runtime' },
      { key: 'statusCode', label: '응답 상태 코드', type: 'number', placeholder: '200', group: '동작', applyMode: 'runtime' },
      { key: 'authToken', label: '인증 토큰', type: 'text', placeholder: '***', group: '인증', applyMode: 'readonly' },
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
