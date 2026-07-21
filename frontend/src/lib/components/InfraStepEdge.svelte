<script lang="ts">
  import type { EdgeProps } from '@xyflow/svelte';

  type $$Props = EdgeProps & { data: { routeY: number } };

  export let sourceX: $$Props['sourceX'];
  export let sourceY: $$Props['sourceY'];
  export let targetX: $$Props['targetX'];
  export let targetY: $$Props['targetY'];
  export let data: $$Props['data'];
  export let markerEnd: $$Props['markerEnd'] = undefined;

  const EDGE_OFF = 24;

  $: routeY = data?.routeY ?? -48;
  $: pathD = [
    `M ${sourceX} ${sourceY}`,
    `L ${sourceX + EDGE_OFF} ${sourceY}`,
    `L ${sourceX + EDGE_OFF} ${routeY}`,
    `L ${targetX - EDGE_OFF} ${routeY}`,
    `L ${targetX - EDGE_OFF} ${targetY}`,
    `L ${targetX} ${targetY}`
  ].join(' ');
</script>

<path d={pathD} marker-end={markerEnd} class="svelte-flow__edge-path" />
