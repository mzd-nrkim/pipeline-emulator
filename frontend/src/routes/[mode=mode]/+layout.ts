import * as mockAdapter from '$lib/api/mock-adapter.js';
import * as realAdapter from '$lib/api/real-adapter.js';

export function load({ params }: { params: { mode: string } }) {
  const adapter = params.mode === 'real' ? realAdapter : mockAdapter;
  return { adapter };
}
