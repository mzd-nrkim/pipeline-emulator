import * as mockAdapter from '$lib/api/mock-adapter.js';
import type { SearchResult, Dimension } from '$lib/api/types.js';

export async function load({ url }: { url: URL }) {
  const query = url.searchParams.get('q') ?? '';
  const [results, dimensions] = await Promise.all([
    query ? mockAdapter.fetchSearch(query) : Promise.resolve([] as SearchResult[]),
    mockAdapter.fetchDimensions()
  ]);
  return { results, dimensions };
}
