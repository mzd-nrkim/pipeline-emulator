// TODO: real 모드에서 fetch 실패 시 +error.svelte("백엔드 연결 대기")가 트리거되지 않음.
// CSR 환경에서 load() throw가 SvelteKit error boundary로 전파되지 않는 것으로 보임.
// 수정: error()로 명시 래핑하거나 +layout.ts에서 연결 상태를 사전 확인해 error() 호출.
export async function load({ parent }: { parent: () => Promise<any> }) {
  const { adapter } = await parent();
  const [stages, dimensions] = await Promise.all([
    adapter.fetchStages(),
    adapter.fetchDimensions()
  ]);
  return { stages, dimensions };
}
