<script lang="ts">
  import { Activity, BookmarkPlus, Medal, RefreshCw, X } from '@lucide/svelte'
  import type { ExerciseProgressionResult } from '$lib/progression'
  import type { WorkoutFinishDecision, WorkoutFinishDisposition } from '$lib/types'
  import type { WorkoutStrengthHighlight } from '$lib/training-science'
  import RpeCurve from './RpeCurve.svelte'
  import ExerciseProgressionSignal from './ExerciseProgressionSignal.svelte'

  export let mode: 'routine' | 'changed' | 'one-off'
  export let routineName = ''
  export let suggestedRoutineName = ''
  export let description: string
  export let initialNotes = ''
  export let highlights: Array<{ id: string; title: string; description: string }> = []
  export let onConfirm: (decision: WorkoutFinishDecision) => void
  export let strengthHighlights: WorkoutStrengthHighlight[] = []
  export let progressionResults: Array<{ exerciseName: string; result: ExerciseProgressionResult }> = []

  let dialog: HTMLDialogElement
  let notes = ''
  let newRoutineName = ''
  let sessionRpe: number | null = null

  export function open() {
    notes = initialNotes
    newRoutineName = suggestedRoutineName
    sessionRpe = null
    dialog.showModal()
  }

  function finish(disposition: WorkoutFinishDisposition) {
    if (disposition === 'new-routine' && !newRoutineName.trim()) return
    if (sessionRpe === null) return
    onConfirm({ notes: notes.trim(), sessionRpe, disposition, routineName: newRoutineName.trim() })
    dialog.close()
  }
</script>

<dialog bind:this={dialog} class="fixed inset-x-0 bottom-0 top-auto z-40 m-0 max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border-0 bg-paper p-0 text-ink backdrop:bg-ink/35 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[min(30rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
  <div class="px-5 pb-6 pt-6 sm:px-6">
    <div class="flex items-start justify-between gap-4"><div><p class="font-dot text-xs text-accent">WORKOUT COMPLETE</p><h2 class="mt-2 text-2xl font-medium">Finish workout?</h2><p class="mt-2 text-sm leading-6 text-muted">{description}</p></div><button class="grid size-11 shrink-0 place-items-center rounded-full bg-canvas text-muted" on:click={() => dialog.close()} aria-label="Close finish dialog"><X class="size-5" /></button></div>

    {#if highlights.length > 0}
      <section class="mt-5 rounded-xl bg-canvas p-3" aria-label="Personal records achieved">
        <p class="flex items-center gap-2 text-xs font-medium uppercase"><Medal class="size-4 text-accent" />Personal records achieved</p>
        <ul class="mt-2 divide-y divide-rule">
          {#each highlights as highlight (highlight.id)}
            <li class="flex items-start gap-3 py-2.5"><span class="font-dot grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-xs text-accent">PR</span><span class="min-w-0"><span class="block truncate text-sm font-medium">{highlight.title}</span><span class="mt-0.5 block text-xs text-muted">{highlight.description}</span></span></li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if progressionResults.length > 0}
      <section class="mt-5 rounded-xl bg-canvas p-3" aria-label="First-set progression results">
        <p class="text-xs font-medium uppercase">First-set results</p>
        <ul class="mt-2 divide-y divide-rule">
          {#each progressionResults as item (item.result.workoutExerciseId)}
            <li class="flex items-center justify-between gap-3 py-2.5">
              <span class="min-w-0 truncate text-sm font-medium">{item.exerciseName}</span>
              <ExerciseProgressionSignal result={item.result} compact={true} />
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if strengthHighlights.length > 0}
      <section class="mt-5 rounded-xl bg-canvas p-3" aria-label="Session strength estimates">
        <p class="flex items-center gap-2 text-xs font-medium uppercase"><Activity class="size-4 text-accent" />RPE-adjusted strength</p>
        <ul class="mt-2 divide-y divide-rule">
          {#each strengthHighlights as highlight (highlight.exerciseId)}
            <li class="flex items-center justify-between gap-3 py-2.5"><span class="min-w-0"><span class="block truncate text-sm font-medium">{highlight.exerciseName}</span><span class="mt-0.5 block text-[0.6875rem] uppercase text-muted">{highlight.confidence} confidence · derived estimate</span></span><span class="shrink-0 text-right"><span class="font-dot text-lg">{highlight.estimated1Rm}</span><span class="ml-1 text-xs text-muted">kg</span>{#if highlight.changeFromPreviousBest !== null}<span class="mt-0.5 block text-[0.6875rem] text-muted">{highlight.changeFromPreviousBest > 0 ? '+' : ''}{highlight.changeFromPreviousBest}% vs best</span>{/if}</span></li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if mode === 'changed'}
      <section class="mt-5 rounded-xl bg-accent-soft p-4"><p class="flex items-center gap-2 text-sm font-medium text-accent"><RefreshCw class="size-4" />Routine changed</p><p class="mt-2 text-xs leading-5 text-accent">Exercise order, set counts, rest timers, or routine notes differ from {routineName}. Choose what to keep.</p></section>
    {:else if mode === 'one-off'}
      <section class="mt-5 rounded-xl bg-canvas p-4"><p class="flex items-center gap-2 text-sm font-medium"><BookmarkPlus class="size-4" />One-off workout</p><p class="mt-2 text-xs leading-5 text-muted">Keep this session as one-off history or turn its structure into a reusable routine.</p></section>
    {/if}

    {#if mode !== 'routine'}
      <label class="mt-5 block"><span class="text-xs font-medium uppercase text-muted">New routine name</span><input bind:value={newRoutineName} class="mt-2 min-h-12 w-full rounded-xl border-0 bg-canvas px-4 text-base outline-none placeholder:text-muted" placeholder="Routine name" aria-label="New routine name" /></label>
    {/if}

    <section class="mt-5" aria-labelledby="session-effort-heading">
      <div class="mb-2"><p id="session-effort-heading" class="text-xs font-medium uppercase">Overall session effort</p><p class="mt-1 text-xs text-muted">Required for your systemic training-load history.</p></div>
      <RpeCurve value={sessionRpe} onChange={(value) => { sessionRpe = value }} />
    </section>

    <label class="mt-5 block"><span class="text-xs font-medium uppercase">Workout notes</span><textarea bind:value={notes} class="mt-2 min-h-24 w-full resize-y rounded-xl border-0 bg-canvas p-4 text-base leading-6 outline-none placeholder:text-muted" placeholder="How did it feel?" aria-label="Workout notes"></textarea></label>

    {#if mode === 'routine'}
      <div class="mt-6 grid grid-cols-2 gap-2"><button class="min-h-12 rounded-xl bg-canvas px-4 text-sm font-medium" on:click={() => dialog.close()}>Cancel</button><button class="min-h-12 rounded-xl bg-accent px-4 text-sm font-medium text-accent-ink disabled:bg-panel-deep disabled:text-muted" disabled={sessionRpe === null} on:click={() => finish('routine')}>Finish workout</button></div>
    {:else}
      <div class="mt-6 grid gap-2">
        {#if mode === 'changed'}<button class="min-h-12 rounded-xl bg-accent px-4 text-sm font-medium text-accent-ink disabled:bg-panel-deep disabled:text-muted" disabled={sessionRpe === null} on:click={() => finish('update-routine')}>Update {routineName}</button>{/if}
        <button class="min-h-12 rounded-xl bg-ink px-4 text-sm font-medium text-paper disabled:bg-panel-deep disabled:text-muted" disabled={!newRoutineName.trim() || sessionRpe === null} on:click={() => finish('new-routine')}>Save as new routine</button>
        <button class="min-h-12 rounded-xl bg-canvas px-4 text-sm font-medium disabled:text-muted" disabled={sessionRpe === null} on:click={() => finish('one-off')}>Finish as one-off</button>
        <button class="min-h-11 text-sm text-muted" on:click={() => dialog.close()}>Cancel</button>
      </div>
    {/if}
  </div>
</dialog>
