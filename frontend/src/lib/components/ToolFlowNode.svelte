<script lang="ts">
  import { Handle, Position, type NodeProps } from '@xyflow/svelte';

  let { data, selected }: NodeProps = $props();

  const d = $derived(data as Record<string, unknown>);
  const icon = $derived(d.icon as string | undefined);
  const accent = $derived(d.accent as string | undefined);
  const vendor = $derived(d.vendor as string | undefined);
  const displayName = $derived(d.displayName as string | undefined);
  const role = $derived(d.role as string | undefined);
  const trigger = $derived(d.trigger as boolean | undefined);
  const applyMode = $derived(d.applyMode as string | undefined);
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
  class:selected={selected}
  style="--node-accent: {resolvedAccent};"
>
  <!-- 카드 본체 -->
  <div class="node-card">
    <!-- accent 배경 틴트 -->
    <div class="node-card-tint"></div>

    <!-- 아이콘 중앙 배치 -->
    <span class="node-icon">{resolvedIcon}</span>

    <!-- trigger 배지 (우상단 절대 위치) -->
    {#if trigger}
      <span class="trigger-badge" title="trigger">⚡</span>
    {/if}

    <!-- hover/focus 상세 오버레이 -->
    <div class="node-detail" role="tooltip" aria-hidden="true">
      {#if role}
        <span class="detail-row">{role}</span>
      {/if}
      {#if applyMode && applyModeConfig[applyMode]}
        <span class="detail-row">
          {applyModeConfig[applyMode].emoji} {applyModeConfig[applyMode].label}
        </span>
      {/if}
    </div>
  </div>

  <!-- 카드 외부 라벨 블록 -->
  <div class="node-label" class:node-label-muted={outOfTeamScope}>
    <span class="node-display-name">{resolvedDisplayName}</span>
    {#if vendor}
      <span class="node-vendor">{vendor}</span>
    {/if}
  </div>
</div>

<!-- target handle (왼쪽) -->
<Handle type="target" position={Position.Left} style="top: calc(var(--node-card-size) / 2);" />

<!-- source handle(s) (오른쪽) -->
{#if outputs && outputs.length > 1}
  {#each outputs as outputId, i}
    <Handle
      type="source"
      position={Position.Right}
      id={outputId}
      style="top: calc(var(--node-card-size) * {(i + 1) / (outputs.length + 1)});"
    />
  {/each}
{:else}
  <Handle type="source" position={Position.Right} style="top: calc(var(--node-card-size) / 2);" />
{/if}

<style>
  :root {
    --node-card-size: 80px;
  }

  .tool-flow-node {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    font-family: var(--font-sans, 'Inter', ui-sans-serif, system-ui, sans-serif);
  }

  /* 카드 본체 */
  .node-card {
    position: relative;
    width: var(--node-card-size);
    height: var(--node-card-size);
    background: var(--card, var(--surface));
    border: 1px solid var(--border);
    border-left: 4px solid var(--node-accent);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  /* accent 틴트 오버레이 */
  .node-card-tint {
    position: absolute;
    inset: 0;
    background: var(--node-accent);
    opacity: 0.1;
    pointer-events: none;
    border-radius: inherit;
  }

  .node-icon {
    position: relative;
    font-size: 2.2rem;
    line-height: 1;
    z-index: 1;
  }

  /* trigger 배지 — 우상단 절대 위치 */
  .trigger-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    font-size: 0.7rem;
    line-height: 1;
    z-index: 2;
    pointer-events: none;
  }

  /* hover/focus 상세 오버레이 */
  .node-detail {
    display: none;
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--node-accent);
    opacity: 0.92;
    padding: 4px 6px;
    flex-direction: column;
    gap: 2px;
    z-index: 3;
    pointer-events: none;
    border-radius: 0 0 6px 6px;
  }

  .node-card:hover .node-detail,
  .node-card:focus-within .node-detail {
    display: flex;
  }

  .detail-row {
    font-size: 0.6rem;
    color: var(--card, var(--surface));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* 카드 외부 라벨 */
  .node-label {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 4px 2px 0;
    max-width: calc(var(--node-card-size) + 24px);
    text-align: center;
  }

  .node-display-name {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .node-vendor {
    font-size: 0.65rem;
    font-weight: 400;
    color: var(--muted-foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  /* outOfTeamScope grayout */
  .out-of-scope .node-card {
    opacity: 0.5;
  }

  .node-label-muted .node-display-name,
  .node-label-muted .node-vendor {
    color: var(--muted-foreground);
  }

  .out-of-scope .node-card {
    border: 1px dashed var(--border);
    border-left: 4px dashed var(--node-accent);
    background: var(--surface-muted);
  }

  /* 선택 상태 */
  .selected .node-card {
    box-shadow: 0 0 0 2px var(--primary);
  }

  :global(.svelte-flow__node.selected) .node-card {
    box-shadow: 0 0 0 2px var(--primary);
  }
</style>
