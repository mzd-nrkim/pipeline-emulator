export async function load({ parent }: { parent: () => Promise<any> }) {
  const { adapter } = await parent();
  const [stages, dimensions] = await Promise.all([
    adapter.fetchStages(),
    adapter.fetchDimensions()
  ]);
  return { stages, dimensions };
}
