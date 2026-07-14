<script lang="ts">
  import { page } from '$app/state';
  import type { Snippet } from 'svelte';
  import '../app.css';

  let { children }: { children: Snippet } = $props();

  const currentPath = $derived(page.url.pathname);
  const mode = $derived(page.params.mode ?? 'sample');

  const subPath = $derived.by(() => {
    const parts = currentPath.split('/');
    if (parts.length > 2 && (parts[1] === 'sample' || parts[1] === 'real')) {
      const rest = parts.slice(2).join('/');
      return rest ? '/' + rest : '';
    }
    return '';
  });

  const navItems = $derived([
    { href: `/${mode}`, label: '개요', id: 'overview' },
    { href: `/${mode}/pipeline`, label: '파이프라인', id: 'pipeline' },
    { href: `/${mode}/documents`, label: '문서', id: 'documents' },
    { href: `/${mode}/search`, label: '검색', id: 'search' },
    { href: '/settings', label: '설정', id: 'settings' },
    { href: '/components', label: '컴포넌트', id: 'components' },
  ]);

  function isActive(href: string, id: string) {
    if (id === 'overview') return currentPath === `/${mode}` || currentPath === '/';
    if (id === 'settings' || id === 'components') return currentPath.startsWith(href);
    return currentPath.startsWith(href);
  }
</script>

<div class="flex min-h-screen flex-col bg-background">
  <!-- 헤더 -->
  <header class="sticky top-0 z-50 border-b border-border bg-surface">
    <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
      <div class="flex items-center gap-2">
        <span class="text-lg font-extrabold tracking-tight text-foreground">PipeScale</span>
        <span class="rounded-sm border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
          {mode === 'real' ? 'DB 모드' : '샘플 모드'}
        </span>
      </div>
      <!-- 모드 토글 -->
      <div class="flex items-center gap-1" role="group" aria-label="모드 전환">
        <a
          href={`/sample${subPath}`}
          aria-pressed={mode === 'sample'}
          class={[
            'px-2.5 py-1 text-xs font-mono font-bold border rounded-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
            mode === 'sample'
              ? 'bg-foreground text-background border-foreground'
              : 'border-border text-muted-foreground hover:bg-surface-muted',
          ].join(' ')}
        >
          샘플
        </a>
        <a
          href={`/real${subPath}`}
          aria-pressed={mode === 'real'}
          class={[
            'px-2.5 py-1 text-xs font-mono font-bold border rounded-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
            mode === 'real'
              ? 'bg-foreground text-background border-foreground'
              : 'border-border text-muted-foreground hover:bg-surface-muted',
          ].join(' ')}
        >
          실제
        </a>
      </div>
    </div>
    <!-- 탭 네비게이션 -->
    <nav class="mx-auto max-w-7xl border-t border-border px-4 sm:px-6" aria-label="주요 탐색">
      <ul class="flex gap-0" role="tablist">
        {#each navItems as item}
          {@const active = isActive(item.href, item.id)}
          <li role="presentation">
            <a
              href={item.href}
              role="tab"
              aria-selected={active}
              aria-current={active ? 'page' : undefined}
              class={[
                'inline-block border-b-2 px-4 py-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {item.label}
            </a>
          </li>
        {/each}
      </ul>
    </nav>
  </header>

  <!-- 콘텐츠 영역 -->
  <main class="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
    {@render children()}
  </main>
</div>
