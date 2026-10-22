<script lang="ts">
  import { Activity, ChevronRight, Cloud, Layers3, Library } from '@lucide/svelte'
  import type { AppView } from '$lib/types'

  export let online: boolean
  export let syncLabel: string
  export let onNavigate: (view: AppView) => void
</script>

<div class="mx-auto w-full max-w-5xl px-5 py-6 sm:px-6 lg:px-8 lg:py-7">
  <header>
    <p class="font-dot text-xs text-accent">INDEX</p>
    <h1 class="mt-2 text-2xl font-medium">More</h1>
    <p class="mt-1 text-sm text-muted">Manage your training library and local data.</p>
  </header>

  <nav class="mt-8 divide-y divide-rule overflow-hidden rounded-2xl bg-paper" aria-label="More destinations">
    <button class="destination" on:click={() => onNavigate('report')}>
      <span class="destination-icon"><Activity class="size-5" /></span>
      <span class="min-w-0 flex-1"><span class="block text-base font-medium">Progress report</span><span class="mt-1 block text-xs text-muted">Trends, workload, routines, and next decisions</span></span>
      <ChevronRight class="size-5 shrink-0 text-muted" />
    </button>
    <button class="destination" on:click={() => onNavigate('routines')}>
      <span class="destination-icon"><Layers3 class="size-5" /></span>
      <span class="min-w-0 flex-1"><span class="block text-base font-medium">Routines</span><span class="mt-1 block text-xs text-muted">Templates and training cycle</span></span>
      <ChevronRight class="size-5 shrink-0 text-muted" />
    </button>
    <button class="destination" on:click={() => onNavigate('exercises')}>
      <span class="destination-icon"><Library class="size-5" /></span>
      <span class="min-w-0 flex-1"><span class="block text-base font-medium">Exercises</span><span class="mt-1 block text-xs text-muted">Movement library and custom exercises</span></span>
      <ChevronRight class="size-5 shrink-0 text-muted" />
    </button>
    <button class="destination" on:click={() => onNavigate('settings')}>
      <span class="destination-icon"><Cloud class="size-5" /></span>
      <span class="min-w-0 flex-1">
        <span class="block text-base font-medium">Data & AI</span>
        <span class="mt-1 flex items-center gap-1.5 text-xs text-muted"><span class:bg-success={online} class:bg-muted={!online} class="size-1.5 rounded-full"></span>{online ? syncLabel : 'Saved offline'}</span>
      </span>
      <ChevronRight class="size-5 shrink-0 text-muted" />
    </button>
  </nav>
</div>

<style>
  .destination { display: flex; min-height: 5rem; width: 100%; align-items: center; gap: 0.875rem; padding: 1rem; text-align: left; }
  .destination:hover { background: var(--color-canvas); }
  .destination-icon { display: grid; width: 2.75rem; height: 2.75rem; flex: none; place-items: center; border-radius: 9999px; background: var(--color-canvas); }
  @media (min-width: 640px) { .destination { padding-inline: 1.25rem; } }
</style>
