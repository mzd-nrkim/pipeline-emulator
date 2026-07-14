export async function load({ parent }: { parent: () => Promise<any> }) {
  const { adapter } = await parent();
  return { documents: await adapter.fetchDocuments() };
}
