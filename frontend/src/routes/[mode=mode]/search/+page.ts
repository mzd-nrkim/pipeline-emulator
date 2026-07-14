import type { SearchResult, Dimension } from '$lib/api/types.js';

export async function load({ url, parent }: { url: URL; parent: () => Promise<any> }) {
  const query = url.searchParams.get('q') ?? '';
  const { adapter } = await parent();
  const [results, dimensions] = await Promise.all([
    query ? adapter.fetchSearch(query) : Promise.resolve([] as SearchResult[]),
    adapter.fetchDimensions()
  ]);
  return { results, dimensions };
}
