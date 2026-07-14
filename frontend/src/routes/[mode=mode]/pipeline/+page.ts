export async function load({ parent }: { parent: () => Promise<any> }) {
  const { adapter } = await parent();
  const [stages, runs] = await Promise.all([
    adapter.fetchStages(),
    adapter.fetchRuns()
  ]);
  return { stages, runs };
}
