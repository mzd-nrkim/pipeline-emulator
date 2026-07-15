export async function load({ parent }: { parent: () => Promise<any> }) {
  const { adapter } = await parent();
  const [stages, runs, topology] = await Promise.all([
    adapter.fetchStages(),
    adapter.fetchRuns(),
    adapter.fetchCanvasTopology()
  ]);
  return { stages, runs, topology };
}
