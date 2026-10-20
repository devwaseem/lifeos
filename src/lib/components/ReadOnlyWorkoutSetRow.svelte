<script lang="ts">
  import { Flame, MessageSquare } from '@lucide/svelte'
  import { formatSetDistance, formatSetDuration, getSupplementalSetNote } from '$lib/exercise-tracking'
  import type { ExerciseTrackingMode } from '$lib/exercise-tracking'
  import type { WorkoutSet } from '$lib/types'

  export let set: WorkoutSet
  export let setIndex: number
  export let setNumber: number | null
  export let exerciseName: string
  export let trackingMode: ExerciseTrackingMode = 'strength'

  $: note = getSupplementalSetNote(set.notes, trackingMode)
  $: setLabel = set.warmup ? 'warmup set' : `set ${setNumber ?? setIndex + 1}`
  $: maxEffort = !set.warmup && set.completed && set.rpe === 10
</script>

<div class={`set-shell${maxEffort ? ' max-effort' : ''}`} role="group" aria-label={`${exerciseName}, ${setLabel}${maxEffort ? ', max effort' : ''}`}>
  <div class={`set-grid ${trackingMode} px-1 py-1`}>
    <span class="set-number grid min-h-11 place-items-center font-dot text-base text-ink tabular-nums">{#if maxEffort}<Flame class="max-effort-flame" color="var(--color-accent)" fill="var(--color-accent)" strokeWidth={1.5} aria-hidden="true" />{:else}{set.warmup ? 'W' : setNumber}{/if}</span>
    {#if trackingMode === 'strength'}
      <span class="set-value" aria-label={set.weight === null ? 'No weight recorded' : `${set.weight} kilograms`}>{set.weight ?? '—'}</span>
      <span class="set-value" aria-label={set.reps === null ? 'No repetitions recorded' : `${set.reps} repetitions`}>{set.reps ?? '—'}</span>
      <span class:rpe-set={set.rpe !== null} class:warmup-rpe={set.warmup} class="set-value" aria-label={set.warmup ? 'RPE is not applicable to a warmup set' : set.rpe === null ? 'No RPE recorded' : `RPE ${set.rpe}`}>{set.warmup ? 'N/A' : set.rpe ?? '—'}</span>
    {:else}
      <span class="set-value" aria-label={set.durationSeconds === null ? 'No duration recorded' : `${set.durationSeconds} seconds`}>{formatSetDuration(set.durationSeconds)}</span>
      {#if trackingMode === 'distance-duration'}
        <span class="set-value" aria-label={set.distanceMeters === null ? 'No distance recorded' : `${set.distanceMeters} meters`}>{formatSetDistance(set.distanceMeters)}</span>
      {/if}
    {/if}
  </div>

  {#if note}
    <div class="set-metadata">
      <p class="note-record"><MessageSquare class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /><span><span class="sr-only">Set note: </span>{note}</span></p>
    </div>
  {/if}
</div>

<style>
  .set-shell { overflow: hidden; border-radius: 0.75rem; background: var(--color-paper); }
  .set-shell.max-effort { outline: 1px solid var(--color-accent); outline-offset: -1px; }
  .set-grid { display: grid; align-items: center; gap: 0.25rem; }
  .set-grid.strength { grid-template-columns: 1.5rem repeat(3, minmax(2.75rem, 1fr)); }
  .set-grid.duration { grid-template-columns: 1.5rem minmax(5rem, 1fr); }
  .set-grid.distance-duration { grid-template-columns: 1.5rem repeat(2, minmax(4.5rem, 1fr)); }
  .set-value { display: grid; min-height: 2.75rem; min-width: 0; place-items: center; border-radius: 0.75rem; background: var(--color-canvas); padding-inline: 0.25rem; text-align: center; font-size: 1rem; font-weight: 500; font-variant-numeric: tabular-nums; }
  .set-value.rpe-set { color: var(--color-accent); }
  .set-value.warmup-rpe { color: var(--color-muted); font-size: 0.625rem; font-weight: 600; letter-spacing: 0.04em; }
  .max-effort-flame { width: 1.25rem; height: 1.25rem; }
  .set-metadata { display: flex; min-width: 0; flex-wrap: wrap; align-items: flex-start; gap: 0.4rem 0.75rem; margin: 0.2rem 0.25rem 0.5rem 2rem; color: var(--color-muted); }
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
