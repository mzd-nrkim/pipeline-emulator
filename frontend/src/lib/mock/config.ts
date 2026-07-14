import type { Dimension } from '../api/types.js';

export const mockDimensions: Dimension[] = [
  {
    key: 'masking',
    label: 'PII 마스킹',
    description: '정규식 기반 PII 감지 및 마스킹 활성화',
    values: ['off', 'on'],
    current: 'on',
  },
  {
    key: 'search_serving',
    label: '검색 서빙',
    description: 'Elasticsearch 인덱싱 및 검색 API 활성화',
    values: ['off', 'on'],
    current: 'off',
    planned: true,
  },
  {
    key: 'chunking',
    label: '청킹 방식',
    description: '문서 분할 방식 (문단/고정/의미 기반)',
    values: ['paragraph', 'fixed', 'semantic'],
    current: 'paragraph',
  },
  {
    key: 'enrichment',
    label: '엔리치먼트',
    description: '키워드·개체명·요약 추출 방식',
    values: ['rule-based', 'llm'],
    current: 'rule-based',
    planned: false,
  },
  {
    key: 'presidio_layer',
    label: 'Presidio 레이어',
    description: '이름·주소 마스킹 (Presidio 2-Layer NER)',
    values: ['layer1', 'layer2'],
    current: 'layer1',
    planned: true,
  },
  {
    key: 'distributed',
    label: '분산 실행',
    description: 'CeleryExecutor 분산 워커 활성화',
    values: ['off', 'on'],
    current: 'off',
    planned: true,
  },
  {
    key: 'es_cluster',
    label: 'ES 클러스터',
    description: 'Elasticsearch 멀티 노드 클러스터 구성',
    values: ['single', 'cluster'],
    current: 'single',
    planned: true,
  },
];
