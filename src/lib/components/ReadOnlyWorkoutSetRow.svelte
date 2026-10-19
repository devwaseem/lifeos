<script lang="ts">
  import { Flame, MessageSquare } from '@lucide/svelte'
  import { formatSetDistance, formatSetDuration, getSupplementalSetNote } from '$lib/exercise-tracking'
  import type { ExerciseTrackingMode } from '$lib/exercise-tracking'
  import type { WorkoutSet } from '$lib/types'

  export let set: WorkoutSet
  export let setIndex: number
  export let exerciseName: string
  export let trackingMode: ExerciseTrackingMode = 'strength'

  $: note = getSupplementalSetNote(set.notes, trackingMode)
</script>

<div class="set-shell" role="group" aria-label={`${exerciseName}, set ${setIndex + 1}`}>
  <div class={`set-grid ${trackingMode} px-1 py-1`}>
    <span class="grid min-h-11 place-items-center font-dot text-base text-ink tabular-nums">{setIndex + 1}</span>
    {#if trackingMode === 'strength'}
      <span class="set-value" aria-label={set.weight === null ? 'No weight recorded' : `${set.weight} kilograms`}>{set.weight ?? '—'}</span>
      <span class="set-value" aria-label={set.reps === null ? 'No repetitions recorded' : `${set.reps} repetitions`}>{set.reps ?? '—'}</span>
      <span class:rpe-set={set.rpe !== null} class="set-value" aria-label={set.rpe === null ? 'No RPE recorded' : `RPE ${set.rpe}`}>{set.rpe ?? '—'}</span>
    {:else}
      <span class="set-value" aria-label={set.durationSeconds === null ? 'No duration recorded' : `${set.durationSeconds} seconds`}>{formatSetDuration(set.durationSeconds)}</span>
      {#if trackingMode === 'distance-duration'}
        <span class="set-value" aria-label={set.distanceMeters === null ? 'No distance recorded' : `${set.distanceMeters} meters`}>{formatSetDistance(set.distanceMeters)}</span>
      {/if}
    {/if}
  </div>

  {#if (trackingMode === 'strength' && set.failure) || note}
    <div class="set-metadata">
      {#if trackingMode === 'strength' && set.failure}
        <span class="failure-record"><Flame class="size-3.5" aria-hidden="true" />To failure</span>
      {/if}
      {#if note}
        <p class="note-record"><MessageSquare class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /><span><span class="sr-only">Set note: </span>{note}</span></p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .set-shell { overflow: hidden; border-radius: 0.75rem; background: var(--color-paper); }
  .set-grid { display: grid; align-items: center; gap: 0.25rem; }
  .set-grid.strength { grid-template-columns: 1.5rem repeat(3, minmax(2.75rem, 1fr)); }
  .set-grid.duration { grid-template-columns: 1.5rem minmax(5rem, 1fr); }
  .set-grid.distance-duration { grid-template-columns: 1.5rem repeat(2, minmax(4.5rem, 1fr)); }
  .set-value { display: grid; min-height: 2.75rem; min-width: 0; place-items: center; border-radius: 0.75rem; background: var(--color-canvas); padding-inline: 0.25rem; text-align: center; font-size: 1rem; font-weight: 500; font-variant-numeric: tabular-nums; }
  .set-value.rpe-set { color: var(--color-accent); }
  .set-metadata { display: flex; min-width: 0; flex-wrap: wrap; align-items: flex-start; gap: 0.4rem 0.75rem; margin: 0.2rem 0.25rem 0.5rem 2rem; color: var(--color-muted); }
  .failure-record { display: inline-flex; flex: none; align-items: center; gap: 0.3rem; color: var(--color-accent); font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; }
  .note-record { display: flex; min-width: 0; flex: 1 1 12rem; gap: 0.4rem; font-size: 0.75rem; line-height: 1.15rem; }
  @media (min-width: 640px) {
    .set-grid { gap: 0.5rem; }
    .set-grid.strength { grid-template-columns: 2.5rem repeat(3, minmax(4rem, 1fr)); }
    .set-grid.duration { grid-template-columns: 2.5rem minmax(6rem, 1fr); }
    .set-grid.distance-duration { grid-template-columns: 2.5rem repeat(2, minmax(6rem, 1fr)); }
    .set-value { padding-inline: 0.5rem; }
    .set-metadata { margin-left: 3.5rem; }
  }
</style>
