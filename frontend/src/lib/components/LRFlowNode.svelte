<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';

  let { data } = $props();
</script>

<Handle type="target" position={Position.Left} />
{data.label}
<Handle type="source" position={Position.Right} />
