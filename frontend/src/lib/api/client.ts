import type { Stage, Run, Document, SearchResult, Dimension } from './types.js';
import * as mockAdapter from './mock-adapter.js';
import * as realAdapter from './real-adapter.js';

const USE_MOCK = !import.meta.env.PUBLIC_UI_BACKEND_URL;

export const api = USE_MOCK ? mockAdapter : realAdapter;

export type { Stage, Run, Document, SearchResult, Dimension };
