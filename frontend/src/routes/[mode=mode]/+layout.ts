import { error } from '@sveltejs/kit';
import * as mockAdapter from '$lib/api/mock-adapter.js';
import * as realAdapter from '$lib/api/real-adapter.js';

export async function load({ params }: { params: { mode: string } }) {
  const adapter = params.mode === 'real' ? realAdapter : mockAdapter;
  if (params.mode === 'real') {
    try {
      await realAdapter.fetchStages();
    } catch {
      throw error(503, '백엔드 연결 대기');
    }
  }
  return { adapter };
}
