<script lang="ts">
  import { Handle, Position, type NodeProps } from '@xyflow/svelte';
  import type { ComponentType } from 'svelte';
  import PlannedBadge from './PlannedBadge.svelte';
  import { resolveNodeIcon } from '../canvas/nodeIcon.js';
  import { siApachenifi, siApacheairflow, siMysql, siElasticsearch, siKibana, siLangchain } from 'simple-icons/icons';
  import Activity from 'lucide-svelte/icons/activity';
  import Archive from 'lucide-svelte/icons/archive';
  import Database from 'lucide-svelte/icons/database';
  import Shield from 'lucide-svelte/icons/shield';
  import Binary from 'lucide-svelte/icons/binary';
  import Globe from 'lucide-svelte/icons/globe';
  import Layers from 'lucide-svelte/icons/layers';
  import Radio from 'lucide-svelte/icons/radio';
  import Cpu from 'lucide-svelte/icons/cpu';
  import GitBranch from 'lucide-svelte/icons/git-branch';

  const SI_ICONS: Record<string, { path: string }> = {
    apachenifi: siApachenifi,
    apacheairflow: siApacheairflow,
    mysql: siMysql,
    elasticsearch: siElasticsearch,
    kibana: siKibana,
    langchain: siLangchain,
  };

  const LUCIDE_ICONS: Record<string, ComponentType> = {
    Activity,
    Archive,
    Database,
    Shield,
    Binary,
    Globe,
    Layers,
    Radio,
    Cpu,
    GitBranch,
  };

  let { data, selected }: NodeProps = $props();

  const d = $derived(data as Record<string, unknown>);
  const icon = $derived(d.icon as string | undefined);
  const accent = $derived(d.accent as string | undefined);
  const vendor = $derived(d.vendor as string | undefined);
  const displayName = $derived(d.displayName as string | undefined);
  const label = $derived(d.label as string | undefined);
  const role = $derived(d.role as string | undefined);
  const trigger = $derived(d.trigger as boolean | undefined);
  const applyMode = $derived(d.applyMode as string | undefined);
  const outputs = $derived(d.outputs as string[] | undefined);

  const outOfTeamScope = $derived(d.outOfTeamScope as boolean | undefined);
  const deployStatus = $derived((d.deployStatus as string | undefined) ?? 'active');

  const iconSpec = $derived(resolveNodeIcon(d.toolId as string ?? '', d.icon as string ?? '❓', d.category as string | undefined));
  const resolvedAccent = $derived(accent || 'var(--primary)');
  const resolvedDisplayName = $derived(displayName || label || 'Unnamed');

  const applyModeConfig: Record<string, { emoji: string; label: string }> = {
    runtime: { emoji: '🟢', label: 'runtime' },
    restart: { emoji: '🟡', label: 'restart' },
    code: { emoji: '🔵', label: 'code' },
    readonly: { emoji: '🔒', label: 'readonly' },
  };

</script>

<div
  class="tool-flow-node"
  class:out-of-scope={outOfTeamScope}
  class:status-planned={deployStatus === 'planned'}
  class:status-absent={deployStatus === 'absent'}
  class:selected={selected}
  style="--node-accent: {resolvedAccent};"
>
  <!-- 카드 본체 (가로형: 좌측 아이콘 + 우측 텍스트) -->
  <div class="node-card">
    <!-- 좌측 아이콘 영역 -->
    <div class="node-icon-area">
      {#if iconSpec.kind === 'brand' && SI_ICONS[iconSpec.slug]}
        <svg class="node-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
          <path d={SI_ICONS[iconSpec.slug].path}/>
        </svg>
      {:else if iconSpec.kind === 'lucide' && LUCIDE_ICONS[iconSpec.name]}
        <svelte:component this={LUCIDE_ICONS[iconSpec.name]} class="node-icon" size={44} strokeWidth={1.75}/>
      {:else}
        <span class="node-icon">{iconSpec.kind === 'emoji' ? iconSpec.char : '❓'}</span>
      {/if}
    </div>

    <!-- 우측 텍스트 영역 -->
    <div class="node-text-area">
      <span class="node-display-name">{resolvedDisplayName}</span>
      {#if vendor}
        <span class="node-vendor">{vendor}</span>
      {/if}
    </div>

    <!-- trigger 배지 (우상단 절대 위치) -->
    {#if trigger}
      <span class="trigger-badge" title="trigger">⚡</span>
    {/if}

    <!-- deployStatus 배지 -->
    {#if deployStatus === 'planned'}
      <PlannedBadge label="예정" />
    {:else if deployStatus === 'absent'}
      <PlannedBadge label="없음" />
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
</div>

<!-- target handle (왼쪽, 세로 중앙) -->
<Handle type="target" position={Position.Left} style="top: calc(var(--node-card-height) / 2);" />

<!-- source handle(s) (오른쪽, 균등 세로 분배) -->
{#if outputs && outputs.length > 1}
  {#each outputs as outputId, i}
    <Handle
      type="source"
      position={Position.Right}
      id={outputId}
      style="top: calc(var(--node-card-height) * {(i + 1) / (outputs.length + 1)});"
    />
  {/each}
{:else}
  <Handle type="source" position={Position.Right} style="top: calc(var(--node-card-height) / 2);" />
{/if}

<style>
  :root {
    --node-card-width: 180px;
    --node-card-height: 64px;
    --node-icon-size: 44px;
  }

  .tool-flow-node {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
    font-family: var(--font-sans, 'Inter', ui-sans-serif, system-ui, sans-serif);
  }

  /* 카드 본체 — 가로형 flex */
  .node-card {
    position: relative;
    width: var(--node-card-width);
    height: var(--node-card-height);
    background: var(--card, var(--surface));
    border: 1px solid var(--border);
    border-radius: 8px;
    display: flex;
    flex-direction: row;
    align-items: center;
    overflow: hidden;
  }

  /* 좌측 아이콘 영역 — 고정 너비, 세로 중앙 */
  .node-icon-area {
    flex: 0 0 var(--node-icon-size);
    width: var(--node-icon-size);
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
  }

  .node-icon {
    position: relative;
    font-size: var(--node-icon-size);
    line-height: 1;
    z-index: 1;
    width: var(--node-icon-size);
    height: var(--node-icon-size);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--node-accent, currentColor);
    fill: currentColor;
  }

  .node-icon svg {
    width: 100%;
    height: 100%;
    fill: currentColor;
    color: var(--node-accent, currentColor);
  }

  /* 우측 텍스트 영역 — flex-grow, 좌측 구분선 */
  .node-text-area {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    padding: 4px 8px 4px 6px;
    border-left: 1px solid var(--border);
    overflow: hidden;
  }

  .node-display-name {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    line-height: 1.3;
  }

  .node-vendor {
    font-size: 0.7rem;
    font-weight: 400;
    color: var(--muted-foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    line-height: 1.2;
  }

  /* trigger 배지 — 우상단 절대 위치 */
  .trigger-badge {
    position: absolute;
    top: 3px;
    right: 3px;
    font-size: 0.65rem;
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
    padding: 3px 6px;
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
    font-size: 0.68rem;
    color: var(--card, var(--surface));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* outOfTeamScope grayout — opacity를 wrapper에 적용해 DOM 쿼리로 검출 가능하게 */
  .out-of-scope {
    opacity: 0.5;
  }

  /* deployStatus grayout — outOfTeamScope와 독립·중첩 안전 */
  .status-planned {
    opacity: 0.65;
  }

  .status-absent {
    opacity: 0.4;
    border-style: dashed;
  }

  .out-of-scope .node-card {
    border: 1px dashed var(--border);
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
