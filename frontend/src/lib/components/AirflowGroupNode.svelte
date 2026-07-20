<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  interface Props {
    data: {
      label?: string;
      displayName?: string;
      width?: number;
      height?: number;
      trigger?: boolean;
      onTrigger?: () => void;
    };
    width?: number;
    height?: number;
  }

  let { data, width, height }: Props = $props();

  const dispatch = createEventDispatcher();

  const title = $derived(data?.displayName ?? data?.label ?? 'Airflow (CeleryExecutor)');
  const showTrigger = $derived(data?.trigger === true);

  function handleTrigger(e: MouseEvent) {
    e.stopPropagation();
    if (data?.onTrigger) {
      data.onTrigger();
    } else {
      dispatch('trigger');
    }
  }
</script>

<div
  class="airflow-group-node"
  style:width="{width ?? 400}px"
  style:height="{height ?? 300}px"
>
  <div class="airflow-group-header">
    <span class="airflow-group-icon">🌊</span>
    <span class="airflow-group-title">{title}</span>
    {#if showTrigger}
      <button
        class="airflow-trigger-btn"
        onclick={handleTrigger}
        title="트리거"
        aria-label="그룹 트리거"
      >
        ▶
      </button>
    {/if}
  </div>
</div>

<style>
  .airflow-group-node {
    border: 2px dashed oklch(0.60 0.12 230);
    border-radius: 12px;
    background: oklch(0.97 0.02 230 / 0.4);
    position: relative;
    box-sizing: border-box;
    pointer-events: none;
  }

  .airflow-group-header {
    position: absolute;
    top: -1px;
    left: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    background: oklch(0.97 0.02 230 / 0.9);
    border: 1px solid oklch(0.60 0.12 230);
    border-radius: 6px;
    padding: 2px 10px;
    font-size: 0.72rem;
    font-weight: 700;
    color: oklch(0.35 0.10 230);
    transform: translateY(-50%);
    pointer-events: none;
    white-space: nowrap;
  }

  .airflow-group-icon {
    font-size: 0.8rem;
  }

  .airflow-group-title {
    letter-spacing: 0.02em;
  }

  .airflow-trigger-btn {
    pointer-events: all;
    background: oklch(0.60 0.12 230);
    color: white;
    border: none;
    border-radius: 4px;
    padding: 1px 6px;
    font-size: 0.65rem;
    cursor: pointer;
    line-height: 1.4;
    transition: background 0.15s;
  }

  .airflow-trigger-btn:hover {
    background: oklch(0.50 0.14 230);
  }

  :global(.dark) .airflow-group-node {
    border-color: oklch(0.55 0.14 230);
    background: oklch(0.20 0.04 230 / 0.35);
  }

  :global(.dark) .airflow-group-header {
    background: oklch(0.20 0.04 230 / 0.9);
    border-color: oklch(0.55 0.14 230);
    color: oklch(0.80 0.10 230);
  }

  :global(.dark) .airflow-trigger-btn {
    background: oklch(0.55 0.14 230);
  }

  :global(.dark) .airflow-trigger-btn:hover {
    background: oklch(0.45 0.16 230);
  }
</style>
