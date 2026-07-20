<script lang="ts">
  import { useSvelteFlow, type EdgeProps } from '@xyflow/svelte';
  import { computeBboxIntersection } from '$lib/canvas/floatingEdge.js';

  let { source, target, markerEnd }: EdgeProps = $props();

  const { getNode } = useSvelteFlow();

  const pathData = $derived.by(() => {
    const srcNode = getNode(source);
    const tgtNode = getNode(target);
    if (!srcNode || !tgtNode) return '';
    const sw = srcNode.width ?? 180;
    const sh = srcNode.height ?? 64;
    const tw = tgtNode.width ?? 180;
    const th = tgtNode.height ?? 64;
    const srcCx = srcNode.position.x + sw / 2;
    const srcCy = srcNode.position.y + sh / 2;
    const tgtCx = tgtNode.position.x + tw / 2;
    const tgtCy = tgtNode.position.y + th / 2;
    const p1 = computeBboxIntersection(srcCx, srcCy, tgtCx, tgtCy, sw, sh);
    const p2 = computeBboxIntersection(tgtCx, tgtCy, srcCx, srcCy, tw, th);
    return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
  });
</script>

{#if pathData}
  <path
    class="svelte-flow__edge-path"
    d={pathData}
    stroke="var(--muted-foreground)"
    stroke-width="1.5"
    stroke-dasharray="5 4"
    fill="none"
    marker-end={markerEnd}
  />
{/if}
