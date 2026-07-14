import * as mockAdapter from '$lib/api/mock-adapter.js';

export async function load() {
  return { documents: await mockAdapter.fetchDocuments() };
}
