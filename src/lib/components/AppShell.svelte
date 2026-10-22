<script lang="ts">
  import { Activity, CalendarDays, CircleGauge, Cloud, Dumbbell, Ellipsis, Layers3, Library, Timer } from '@lucide/svelte'
  import { getActiveRestTimer } from '$lib/rest-timer'
  import type { AppView, WorkoutSession } from '$lib/types'
  import { formatCountdown, formatElapsed } from '$lib/utils'

  export let view: AppView
  export let onNavigate: (view: AppView) => void
  export let online: boolean
  export let syncLabel: string
  export let activeWorkout: WorkoutSession | undefined
  export let now: number
  export let onResume: () => void

  $: moreActive = view === 'more' || view === 'report' || view === 'routines' || view === 'exercises' || view === 'exercise' || view === 'settings'

  $: activeRest = getActiveRestTimer(activeWorkout, now)
</script>


<div class="min-h-dvh bg-canvas text-ink">
  <aside class="fixed inset-y-0 left-0 z-20 hidden w-56 border-r border-rule bg-canvas px-5 py-6 lg:flex lg:flex-col">
    <button class="flex items-center gap-3 text-left" on:click={() => onNavigate('today')} aria-label="LifeOS home">
      <span class="relative grid size-10 place-items-center rounded-full border-2 border-ink"><CircleGauge class="size-6" /><span class="absolute right-0 top-0 size-2.5 rounded-full bg-accent"></span></span>
      <span><span class="font-dot block text-lg">LIFEOS</span><span class="block text-xs text-muted">TRAINING SYSTEM</span></span>
    </button>
    <nav class="mt-10 space-y-2" aria-label="Primary navigation">
      <button class:active-nav={view === 'today'} class="side-nav" on:click={() => onNavigate('today')} aria-current={view === 'today' ? 'page' : undefined}><Dumbbell class="size-4" />Today</button>
      <button class:active-nav={view === 'report'} class="side-nav" on:click={() => onNavigate('report')} aria-current={view === 'report' ? 'page' : undefined}><Activity class="size-4" />Progress report</button>
      <button class:active-nav={view === 'history' || view === 'workout-history'} class="side-nav" on:click={() => onNavigate('history')} aria-current={view === 'history' || view === 'workout-history' ? 'page' : undefined}><CalendarDays class="size-4" />History</button>
      <button class:active-nav={view === 'routines'} class="side-nav" on:click={() => onNavigate('routines')} aria-current={view === 'routines' ? 'page' : undefined}><Layers3 class="size-4" />Routines</button>
      <button class:active-nav={view === 'exercises' || view === 'exercise'} class="side-nav" on:click={() => onNavigate('exercises')} aria-current={view === 'exercises' || view === 'exercise' ? 'page' : undefined}><Library class="size-4" />Exercises</button>
      <button class:active-nav={view === 'settings'} class="side-nav" on:click={() => onNavigate('settings')} aria-current={view === 'settings' ? 'page' : undefined}><Cloud class="size-4" />Data &amp; AI</button>
    </nav>
    <div class="mt-auto">
      {#if activeWorkout && view !== 'workout'}
        <button class="mb-3 w-full rounded-2xl bg-accent p-4 text-left text-accent-ink" on:click={onResume}>
          <span class="block truncate text-sm font-medium">{activeRest ? activeRest.nextLabel : activeWorkout.title}</span>
          <span class="mt-2 flex items-center justify-between gap-2"><span class="font-dot inline-flex items-center gap-1.5 text-xs tabular-nums">{#if activeRest}<Timer class="size-3.5" />REST {formatCountdown(activeRest.remaining)}{:else}{formatElapsed(activeWorkout.startedAt, now)}{/if}</span><span class="rounded-full bg-ink px-2.5 py-1 text-[0.6875rem] text-paper">Resume</span></span>
        </button>
      {/if}
      <div class="rounded-full bg-paper px-4 py-3 text-xs text-muted">
        <div class="flex items-center gap-2"><span class:bg-success={online} class:bg-muted={!online} class="size-2 rounded-full"></span>{online ? syncLabel : 'Saved offline'}</div>
      </div>
    </div>
  </aside>

  <main class:pb-44={Boolean(activeWorkout) && view !== 'workout'} class="min-h-dvh pb-24 lg:ml-56 lg:pb-0"><slot /></main>

  {#if view !== 'workout' && activeWorkout}
    <button class="fixed inset-x-4 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4rem)] z-20 flex min-h-16 items-center justify-between rounded-2xl bg-accent px-4 text-left text-accent-ink lg:hidden" on:click={onResume} aria-label={`Resume ${activeWorkout.title}`}>
      <span class="min-w-0"><span class="block truncate text-sm font-medium">{activeRest ? activeRest.nextLabel : activeWorkout.title}</span><span class="font-dot mt-1 flex items-center gap-1.5 text-xs tabular-nums">{#if activeRest}<Timer class="size-3.5" />REST {formatCountdown(activeRest.remaining)}{:else}{formatElapsed(activeWorkout.startedAt, now)}{/if}</span></span>
      <span class="ml-4 flex shrink-0 items-center gap-2 rounded-full bg-ink px-3 py-2 text-xs text-paper"><Dumbbell class="size-4" />Resume</span>
    </button>
  {/if}
  {#if view !== 'workout'}
    <nav class="bottom-nav fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-30 grid w-[13.25rem] -translate-x-1/2 grid-cols-3 rounded-[1.5rem] bg-paper p-1.5 lg:hidden" aria-label="Primary navigation">
      <button class:active-tab={view === 'history' || view === 'workout-history'} class="bottom-tab" on:click={() => onNavigate('history')} aria-label="History" aria-current={view === 'history' || view === 'workout-history' ? 'page' : undefined}><CalendarDays class="size-5" /><span class="sr-only">History</span></button>
      <button class:active-tab={view === 'today'} class="bottom-tab" on:click={() => onNavigate('today')} aria-label="Today" aria-current={view === 'today' ? 'page' : undefined}><Dumbbell class="size-5" /><span class="sr-only">Today</span></button>
      <button class:active-tab={moreActive} class="bottom-tab" on:click={() => onNavigate('more')} aria-label="More" aria-current={moreActive ? 'page' : undefined}><Ellipsis class="size-5" /><span class="sr-only">More</span></button>
    </nav>
  {/if}
</div>

<style>
  .side-nav { display: flex; min-height: 2.75rem; width: 100%; align-items: center; gap: 0.75rem; border-radius: 9999px; padding-inline: 1rem; color: var(--color-muted); font-size: 0.875rem; font-weight: 500; }
  .side-nav:hover { color: var(--color-ink); }
  .side-nav.active-nav { background: var(--color-ink); color: var(--color-paper); }
  .bottom-nav { box-shadow: 0 0.75rem 2.5rem color-mix(in srgb, var(--color-ink) 14%, transparent); }
  .bottom-tab { display: grid; min-height: 3rem; place-items: center; border-radius: 1.125rem; color: var(--color-muted); }
  .bottom-tab.active-tab { background: var(--color-canvas); color: var(--color-ink); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-ink) 5%, transparent), 0 0.25rem 0.75rem color-mix(in srgb, var(--color-ink) 8%, transparent); }
</style>
