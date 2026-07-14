import type { SearchResult } from '../api/types.js';

export const mockSearchResults: SearchResult[] = [
  {
    id: 'AP00005928||1',
    title: 'CFT 문제이력 NX01 우선순위S 1번',
    summary: 'NX01 차종의 CFT 문제이력으로, PII 마스킹이 적용된 최고 우선순위 문서입니다.',
    priority: 'S',
    security: 'RESTRICTED',
    vehicleModel: 'NX01',
    score: 0.95,
    keywordScore: 0.92,
    semanticScore: 0.98,
    highlight: '...문제 내용 중 <mark>핵심 키워드</mark>가 포함됩니다...',
  },
  {
    id: 'AP00005929||1',
    title: 'CFT 문제이력 NX01 우선순위A 1번',
    summary: 'NX01 차종의 A등급 문제이력입니다.',
    priority: 'A',
    security: 'INTERNAL',
    vehicleModel: 'NX01',
    score: 0.82,
    keywordScore: 0.85,
    semanticScore: 0.79,
    highlight: '...관련 내용이 <mark>일치</mark>합니다...',
  },
];
