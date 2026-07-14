import * as mockAdapter from '$lib/api/mock-adapter.js';

export async function load() {
  const [stages, dimensions] = await Promise.all([
    mockAdapter.fetchStages(),
    mockAdapter.fetchDimensions()
  ]);
  return { stages, dimensions };
}
