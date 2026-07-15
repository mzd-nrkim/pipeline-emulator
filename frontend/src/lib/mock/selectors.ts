import { mockStages } from './pipeline.js';
import { mockDocuments } from './documents.js';
import { mockRuns } from './runs.js';
import { mockDimensions } from './config.js';
import { mockSearchResults } from './search.js';
import { mockTopology } from './topology.js';

export const stages = mockStages;
export const documents = mockDocuments;
export const runs = mockRuns;
export const dimensions = mockDimensions;
export const searchResults = mockSearchResults;
export const topology = mockTopology;

/* 파생 데이터 (화면 간 숫자 drift 방지) */
export const totalDocs = documents.length;
export const maskedDocs = documents.filter(d => d.masked).length;
export const stageDocCounts = Object.fromEntries(
  stages.map(s => [s.id, s.docsOut])
);
