<script lang="ts">
  import { Handle, Position, type NodeProps } from '@xyflow/svelte';

  let { data }: NodeProps = $props();

  const d = $derived(data as Record<string, unknown>);
  const icon = $derived(d.icon as string | undefined);
  const accent = $derived(d.accent as string | undefined);
  const vendor = $derived(d.vendor as string | undefined);
  const displayName = $derived(d.displayName as string | undefined);
  const role = $derived(d.role as string | undefined);
  const trigger = $derived(d.trigger as boolean | undefined);
  const applyMode = $derived(d.applyMode as string | undefined);
  const status = $derived(d.status as string | undefined);
  const outputs = $derived(d.outputs as string[] | undefined);

  const outOfTeamScope = $derived(d.outOfTeamScope as boolean | undefined);

  const resolvedIcon = $derived(icon || '❓');
  const resolvedAccent = $derived(accent || 'var(--primary)');
  const resolvedDisplayName = $derived(displayName || 'Unnamed');

  const applyModeConfig: Record<string, { emoji: string; label: string }> = {
    runtime: { emoji: '🟢', label: 'runtime' },
    restart: { emoji: '🟡', label: 'restart' },
    code: { emoji: '🔵', label: 'code' },
    readonly: { emoji: '🔴', label: 'readonly' },
  };

</script>

<div
  class="tool-flow-node"
  class:out-of-scope={outOfTeamScope}
  style="--node-accent: {resolvedAccent};"
>
  <!-- accent 헤더 바 (outOfTeamScope이면 회색 헤더) -->
  <div class="node-header" class:node-header-gray={outOfTeamScope}>
    <span class="node-icon">{resolvedIcon}</span>
    <div class="node-title">
      <span class="node-display-name" class:node-display-name-gray={outOfTeamScope}>{resolvedDisplayName}</span>
      {#if vendor}
        <span class="node-vendor" class:node-vendor-gray={outOfTeamScope}>{vendor}</span>
      {/if}
    </div>
  </div>

  <!-- 배지 행 -->
  <div class="node-badges">
    {#if role}
      <span class="badge badge-role">{role}</span>
    {/if}
    {#if trigger}
      <span class="badge badge-trigger">⚡ trigger</span>
    {/if}
    {#if applyMode && applyModeConfig[applyMode]}
      <span class="badge badge-apply-mode">
        {applyModeConfig[applyMode].emoji} {applyModeConfig[applyMode].label}
      </span>
    {/if}
    {#if status}
      <span class="badge badge-status">{status}</span>
    {/if}
  </div>
</div>

<!-- target handle (왼쪽) -->
<Handle type="target" position={Position.Left} />

<!-- source handle(s) (오른쪽) -->
{#if outputs && outputs.length > 1}
  {#each outputs as outputId, i}
    <Handle
      type="source"
      position={Position.Right}
      id={outputId}
      style="top: {((i + 1) / (outputs.length + 1)) * 100}%;"
    />
  {/each}
{:else}
  <Handle type="source" position={Position.Right} />
{/if}

<style>
  .tool-flow-node {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    min-width: 160px;
    max-width: 220px;
    overflow: hidden;
    font-family: var(--font-sans, 'Inter', ui-sans-serif, system-ui, sans-serif);
  }

  .node-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: var(--node-accent);
    color: #fff;
  }

  .node-icon {
    font-size: 1.5rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .node-title {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .node-display-name {
    font-size: 0.875rem;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #fff;
  }

  .node-vendor {
    font-size: 0.6875rem;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.78);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .node-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 6px 10px 8px;
    background: var(--surface);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    font-size: 0.6875rem;
    font-weight: 500;
    padding: 1px 6px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--surface-muted, oklch(0.97 0.005 250));
    color: var(--foreground);
    white-space: nowrap;
  }

  .badge-role {
    background: var(--secondary, oklch(0.96 0.005 250));
    color: var(--foreground);
  }

  .badge-trigger {
    background: var(--primary);
    color: #fff;
    border-color: transparent;
  }

  .badge-apply-mode {
    background: var(--surface-muted, oklch(0.97 0.005 250));
  }

  .badge-status {
    background: var(--surface-muted, oklch(0.97 0.005 250));
    color: var(--muted-foreground);
  }

  /* outOfTeamScope grayout */
  .out-of-scope {
    border: 1px dashed #d1d5db;
    background: #f3f4f6;
    opacity: 0.6;
  }

  .node-header-gray {
    background: #d1d5db;
  }

  .node-display-name-gray {
    color: #374151;
  }

  .node-vendor-gray {
    color: rgba(55, 65, 81, 0.78);
  }
</style>
