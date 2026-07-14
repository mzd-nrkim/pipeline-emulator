import * as mockAdapter from '$lib/api/mock-adapter.js';

export async function load() {
  const [stages, runs] = await Promise.all([
    mockAdapter.fetchStages(),
    mockAdapter.fetchRuns()
  ]);
  return { stages, runs };
}
