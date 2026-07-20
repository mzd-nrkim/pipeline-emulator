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

  const liveCount = $derived(d.liveCount as number | undefined);
  const outOfTeamScope = $derived(d.outOfTeamScope as boolean | undefined);
  const deployStatus = $derived((d.deployStatus as string | undefined) ?? 'active');
  const category = $derived(d.category as string ?? 'task');
  const runtimeHealth = $derived((d.runtimeHealth as string | undefined) ?? 'unknown');

  const iconSpec = $derived(resolveNodeIcon(d.toolId as string ?? '', d.icon as string ?? '❓', d.category as string | undefined));
  const resolvedAccent = $derived(accent || 'var(--primary)');
  const resolvedDisplayName = $derived(displayName || label || 'Unnamed');

  const isInfra = $derived(d.isInfra as boolean | undefined);
  const serviceControlEnabled = $derived((d.serviceControlEnabled as boolean | undefined) ?? false);
  const hasServiceControl = $derived(serviceControlEnabled && runtimeHealth !== 'unknown');

  let confirmingStop = $state(false);

  const applyModeConfig: Record<string, { emoji: string; label: string }> = {
    runtime: { emoji: '🟢', label: 'runtime' },
    restart: { emoji: '🟡', label: 'restart' },
    code: { emoji: '🔵', label: 'code' },
    readonly: { emoji: '🔒', label: 'readonly' },
  };

  async function handleServiceStop() {
    const ok = window.confirm('컨테이너를 중지합니다. 계속하시겠습니까?');
    if (!ok) return;
    const { api } = await import('../api/client.js');
    const serviceId = (d.serviceId as string | undefined) ?? (d.toolId as string | undefined) ?? '';
    await api.setServicePower(serviceId, 'stop');
  }

  async function handleServiceStart() {
    const { api } = await import('../api/client.js');
    const serviceId = (d.serviceId as string | undefined) ?? (d.toolId as string | undefined) ?? '';
    await api.setServicePower(serviceId, 'start');
  }

</script>

<div
  class="tool-flow-node"
  class:out-of-scope={outOfTeamScope}
  class:status-planned={deployStatus === 'planned'}
  class:status-absent={deployStatus === 'absent'}
  class:selected={selected}
  class:cat-source={category === 'source'}
  class:cat-task={category === 'task'}
  class:cat-switch={category === 'switch'}
  class:cat-sink={category === 'sink'}
  style="--node-accent: {resolvedAccent};"
>
  <!-- 카드 본체 (n8n 정사각) -->
  <div class="node-card">
    {#if iconSpec.kind === 'brand' && SI_ICONS[iconSpec.slug]}
      <svg class="node-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
        <path d={SI_ICONS[iconSpec.slug].path}/>
      </svg>
    {:else if iconSpec.kind === 'lucide' && LUCIDE_ICONS[iconSpec.name]}
      <svelte:component this={LUCIDE_ICONS[iconSpec.name]} class="node-icon" size={44} strokeWidth={1.75}/>
    {:else}
      <span class="node-icon">{iconSpec.kind === 'emoji' ? iconSpec.char : '❓'}</span>
    {/if}

    <!-- 런타임 헬스 신호등 dot (좌상단) -->
    {#if runtimeHealth === 'up'}
      <span class="runtime-health-dot runtime-health-up" title="up"></span>
    {:else if runtimeHealth === 'down'}
      <span class="runtime-health-dot runtime-health-down" title="down"></span>
    {:else if runtimeHealth === 'degraded'}
      <span class="runtime-health-dot runtime-health-degraded" title="degraded"></span>
    {/if}

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
  <div class="node-label" class:node-label-muted={outOfTeamScope}>
    <span class="node-display-name">{resolvedDisplayName}</span>
    {#if vendor}
      <span class="node-vendor">{vendor}</span>
    {/if}
    {#if liveCount && liveCount > 0}
      <span class="text-[9px] font-mono text-muted-foreground">{liveCount}건</span>
    {/if}
  </div>

  {#if hasServiceControl}
    <div class="service-control-bar">
      {#if runtimeHealth === 'up' || runtimeHealth === 'degraded'}
        <button
          class="svc-btn svc-btn-stop"
          title="서비스 중지"
          onclick={handleServiceStop}
        >🔴 중지</button>
      {:else if runtimeHealth === 'down'}
        <button
          class="svc-btn svc-btn-start"
          title="서비스 시작"
          onclick={handleServiceStart}
        >🟢 시작</button>
      {/if}
    </div>
  {/if}
</div>

<!-- target handle (왼쪽, 세로 중앙) -->
<Handle type="target" position={Position.Left} style="top: calc(var(--node-card-size) / 2); {isInfra ? 'visibility: hidden;' : ''}" />

<!-- source handle(s) (오른쪽, 균등 세로 분배) -->
{#if outputs && outputs.length > 1}
  {#each outputs as outputId, i}
    <Handle
      type="source"
      position={Position.Right}
      id={outputId}
      style="top: calc(var(--node-card-size) * {(i + 1) / (outputs.length + 1)}); {isInfra ? 'visibility: hidden;' : ''}"
    />
  {/each}
{:else}
  <Handle type="source" position={Position.Right} style="top: calc(var(--node-card-size) / 2); {isInfra ? 'visibility: hidden;' : ''}" />
{/if}

<style>
  :root {
    --node-card-size: 80px;
    --node-icon-size: 44px;
  }

  .tool-flow-node {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    font-family: var(--font-sans, 'Inter', ui-sans-serif, system-ui, sans-serif);
  }

  /* 카드 본체 — n8n 정사각 flex */
  .node-card {
    position: relative;
    width: var(--node-card-size);
    height: var(--node-card-size);
    background: var(--card, var(--surface));
    border: 1px solid var(--border);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    overflow: hidden;
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

  /* 외부 라벨 */
  .node-label {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    max-width: var(--node-card-size);
    gap: 2px;
    margin-top: 4px;
  }

  .node-label-muted {
    opacity: 0.5;
  }

  .node-display-name {
    font-size: 11px;
    font-weight: 500;
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: var(--node-card-size);
  }

  .node-vendor {
    font-size: 10px;
    color: var(--muted-foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: var(--node-card-size);
  }

  /* 런타임 헬스 신호등 dot — 좌상단 절대 위치 */
  .runtime-health-dot {
    position: absolute;
    top: 4px;
    left: 4px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    z-index: 2;
    pointer-events: none;
  }

  .runtime-health-up {
    background-color: #22c55e;
  }

  .runtime-health-down {
    background-color: #ef4444;
  }

  .runtime-health-degraded {
    background-color: #eab308;
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
  }

  .status-absent .node-card {
    border-style: dashed;
  }

  .out-of-scope .node-card {
    border: 1px dashed var(--border);
    background: var(--surface-muted);
  }

  /* 카테고리별 저채도 테두리 — 벤더 accent(강색)와 색 축 분리 */
  .cat-source .node-card {
    border-color: var(--cat-source-border);
  }

  .cat-switch .node-card {
    border-color: var(--cat-switch-border);
  }

  .cat-sink .node-card {
    border-color: var(--cat-sink-border);
  }

  /* .cat-task .node-card — 기본값(--border) 유지, 추가 스타일 불필요 */

  /* 서비스 제어 버튼 바 */
  .service-control-bar {
    display: flex;
    gap: 4px;
    margin-top: 4px;
    justify-content: center;
  }

  .svc-btn {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--card, var(--surface));
    color: var(--foreground);
    cursor: pointer;
    white-space: nowrap;
    line-height: 1.4;
  }

  .svc-btn:hover {
    background: var(--muted);
  }

  .svc-btn-stop {
    border-color: #ef4444;
  }

  .svc-btn-start {
    border-color: #22c55e;
  }

  /* 선택 상태 */
  .selected .node-card {
    box-shadow: 0 0 0 2px var(--primary);
  }

  :global(.svelte-flow__node.selected) .node-card {
    box-shadow: 0 0 0 2px var(--primary);
  }
</style>
