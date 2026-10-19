<script lang="ts">
  import { ArrowRight, Check, ChevronDown, Flame, MessageSquare, Trash2 } from '@lucide/svelte'
  import { fly } from 'svelte/transition'
  import { formatSetDuration } from '$lib/exercise-tracking'
  import type { ExerciseTrackingMode } from '$lib/exercise-tracking'
  import type { SetProgressionTarget } from '$lib/progression'
  import type { WorkoutSet } from '$lib/types'
  import RpeCurve from './RpeCurve.svelte'

  export let set: WorkoutSet
  export let setIndex: number
  export let trackingMode: ExerciseTrackingMode
  export let exerciseName: string
  export let expanded: boolean
  export let progressionTarget: SetProgressionTarget | undefined
  export let onExpandedChange: (expanded: boolean) => void
  export let onChange: (changes: Partial<WorkoutSet>) => void
  export let onToggle: () => void
  export let onDelete: () => void

  let offset = 0
  let dragStartX = 0
  let dragStartY = 0
  let dragOrigin = 0
  let dragging = false
  let horizontalGesture = false
  const deleteWidth = 76

  function numberFromInput(value: string) {
    if (value === '') return null
    const number = Number(value)
    return Number.isFinite(number) ? number : null
  }

  function durationFromInput(value: string) {
    if (value.trim() === '') return null
    const parts = value.split(':').map((part) => Number(part))
    if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null
    if (parts.length === 3) return Math.round((parts[0] * 3_600) + (parts[1] * 60) + parts[2])
    if (parts.length === 2) return Math.round((parts[0] * 60) + parts[1])
    return Math.round(parts[0] * 60)
  }

  function distanceFromInput(value: string) {
    const kilometers = numberFromInput(value)
    return kilometers === null ? null : Math.round(kilometers * 1_000)
  }

  function formatPerformance(weight: number | null, reps: number | null) {
    if (reps === null) return '—'
    return `${weight === null || weight === 0 ? 'BW' : `${weight}kg`} × ${reps}`
  }

  function progressionReason(target: SetProgressionTarget) {
    if (target.autoregulation) return target.autoregulation.reason
    if (target.action === 'increase-load') return 'Rep ceiling reached—advance the load.'
    if (target.action === 'add-rep') return 'Keep the load and add one repetition.'
    if (target.action === 'repeat') return 'Repeat this prescription before progressing.'
    return 'Complete this set to establish its baseline.'
  }

  function startSwipe(event: PointerEvent) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    dragStartX = event.clientX
    dragStartY = event.clientY
    dragOrigin = offset
    dragging = true
    horizontalGesture = false
  }

  function moveSwipe(event: PointerEvent) {
    if (!dragging) return
    const deltaX = event.clientX - dragStartX
    const deltaY = event.clientY - dragStartY
    if (!horizontalGesture && Math.abs(deltaX) > 7 && Math.abs(deltaX) > Math.abs(deltaY)) {
      horizontalGesture = true
      ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    }
    if (!horizontalGesture) return
    event.preventDefault()
    offset = Math.max(-deleteWidth, Math.min(0, dragOrigin + deltaX))
  }

  function finishSwipe() {
    if (!dragging) return
    dragging = false
    offset = horizontalGesture && offset < -deleteWidth / 2 ? -deleteWidth : 0
  }

  function deleteSet() {
    offset = 0
    onDelete()
  }

  $: hasMetadata = (trackingMode === 'strength' && set.failure) || Boolean(set.notes.trim())
  $: revealed = offset < 0
</script>

<div class:completed-row={set.completed} class:revealed class="set-shell">
  <button
    type="button"
    class="delete-action"
    class:revealed
    tabindex={revealed ? 0 : -1}
    aria-hidden={!revealed}
    aria-label={`Delete ${exerciseName}, set ${setIndex + 1}`}
    on:click={deleteSet}
  ><Trash2 class="size-5" /><span>Delete</span></button>

  <div
    class:dragging
    class="set-surface"
    style={`transform:translateX(${offset}px)`}
    on:pointerdown={startSwipe}
    role="group"
    aria-label={`${exerciseName}, set ${setIndex + 1}`}
    on:pointermove={moveSwipe}
    on:pointerup={finishSwipe}
    on:pointercancel={finishSwipe}
  >
    <div class={`set-grid ${trackingMode} px-1 py-1`}>
      <button type="button" class="relative grid min-h-11 place-items-center" on:click={() => onExpandedChange(!expanded)} aria-label={`${exerciseName}, set ${setIndex + 1} details`} aria-expanded={expanded}>
        <span class="set-number font-dot text-base text-muted tabular-nums">{setIndex + 1}</span>
        {#if hasMetadata}<span class="absolute right-0.5 top-1 size-1.5 rounded-full bg-accent"></span>{/if}
      </button>
      {#if trackingMode === 'strength'}
        <input class="set-input" type="number" inputmode="decimal" min="0" step="0.5" value={set.weight ?? ''} on:input={(event) => onChange({ weight: numberFromInput(event.currentTarget.value) })} aria-label={`${exerciseName}, set ${setIndex + 1}, weight in kilograms`} placeholder="—" />
        <input class="set-input" type="number" inputmode="numeric" min="0" step="1" value={set.reps ?? ''} on:input={(event) => onChange({ reps: numberFromInput(event.currentTarget.value) })} aria-label={`${exerciseName}, set ${setIndex + 1}, repetitions`} placeholder="—" />
        <button type="button" class:rpe-set={set.rpe !== null} class="rpe-button" on:click={() => onExpandedChange(true)} aria-label={`${exerciseName}, set ${setIndex + 1}, choose RPE`} aria-expanded={expanded}>{set.rpe ?? '—'}</button>
      {:else}
        <input class="set-input" type="text" inputmode="decimal" value={set.durationSeconds === null ? '' : formatSetDuration(set.durationSeconds)} on:change={(event) => onChange({ durationSeconds: durationFromInput(event.currentTarget.value) })} aria-label={`${exerciseName}, set ${setIndex + 1}, duration in minutes and seconds`} placeholder="m:ss" />
        {#if trackingMode === 'distance-duration'}
          <input class="set-input" type="number" inputmode="decimal" min="0" step="0.01" value={set.distanceMeters === null ? '' : set.distanceMeters / 1_000} on:input={(event) => onChange({ distanceMeters: distanceFromInput(event.currentTarget.value) })} aria-label={`${exerciseName}, set ${setIndex + 1}, distance in kilometers`} placeholder="km" />
        {/if}
      {/if}
      <button type="button" class:completed-control={set.completed} class="detail-control grid size-11 place-items-center rounded-full" on:click={() => onExpandedChange(!expanded)} aria-label={`${expanded ? 'Close' : 'Open'} details for ${exerciseName}, set ${setIndex + 1}`} aria-expanded={expanded}><ChevronDown class={`size-5 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`} /></button>
    </div>
    {#if trackingMode === 'strength' && progressionTarget && progressionTarget.previousReps !== null}
      <div class="target-strip">
        <span><span class="target-label">Prev</span>{formatPerformance(progressionTarget.previousWeight, progressionTarget.previousReps)}</span>
        <ArrowRight class="size-3.5 text-muted" />
        <span class="text-accent-strong"><span class="target-label">Target</span>{formatPerformance(progressionTarget.targetWeight, progressionTarget.targetReps)}</span>
      </div>
    {/if}
  </div>

  {#if expanded}
    <div class="relative z-10 border-t border-rule bg-paper px-2 pb-3 pt-2" in:fly={{ y: -6, duration: 180 }}>
      {#if trackingMode === 'strength' && progressionTarget}
        <section class="mb-3 rounded-xl bg-canvas p-3" aria-label={`Adaptive target for ${exerciseName}, set ${setIndex + 1}`}>
          <div class="flex items-start justify-between gap-3">
            <div><p class="text-[0.625rem] font-medium uppercase text-muted">{progressionTarget.autoregulation?.source === 'live' ? 'Live adjustment' : 'Progression target'}</p><p class="mt-1 text-sm font-medium">{progressionReason(progressionTarget)}</p></div>
            <span class="shrink-0 rounded-full bg-paper px-2.5 py-1 text-[0.625rem] font-medium uppercase text-muted">{progressionTarget.autoregulation?.confidence ?? 'low'} confidence</span>
          </div>
          {#if progressionTarget.previousReps !== null || progressionTarget.targetReps !== null}
            <div class="mt-3 flex items-center gap-2 text-sm tabular-nums"><span>{formatPerformance(progressionTarget.previousWeight, progressionTarget.previousReps)}</span><ArrowRight class="size-4 text-muted" /><span class="font-medium text-accent-strong">{formatPerformance(progressionTarget.targetWeight, progressionTarget.targetReps)}</span></div>
          {/if}
          {#if progressionTarget.autoregulation?.estimated1Rm !== null && progressionTarget.autoregulation?.estimated1Rm !== undefined}
            <p class="mt-2 text-[0.6875rem] text-muted">Set-derived estimated 1RM: {progressionTarget.autoregulation.estimated1Rm} kg</p>
          {/if}
        </section>
      {/if}
      {#if trackingMode === 'strength'}<RpeCurve value={set.rpe} disabled={false} onChange={(rpe) => onChange({ rpe })} />{/if}
      <div class={`mt-2 grid gap-2 ${trackingMode === 'strength' ? 'sm:grid-cols-[12rem_minmax(0,1fr)]' : ''}`}>
        {#if trackingMode === 'strength'}
          <button type="button" class:failure-active={set.failure} class="failure-toggle" role="switch" aria-checked={set.failure} on:click={() => onChange({ failure: !set.failure })}>
            <Flame class="size-4" /><span><span class="block text-xs font-medium">Failure set</span><span class="block text-[0.6875rem] opacity-70">{set.failure ? 'Reached failure' : 'Stopped before failure'}</span></span>
          </button>
        {/if}
        <label class="rounded-xl bg-canvas px-3 py-2"><span class="flex items-center gap-1.5 text-[0.6875rem] font-medium uppercase text-muted"><MessageSquare class="size-3.5" /> Set note</span><textarea class="mt-1 min-h-12 w-full resize-y bg-transparent text-sm leading-5 outline-none placeholder:text-muted" value={set.notes} on:input={(event) => onChange({ notes: event.currentTarget.value })} placeholder={trackingMode === 'strength' ? 'Form, pain, tempo, or setup' : 'Pace, incline, or setup'}></textarea></label>
      </div>
      <div class="mt-3 grid gap-2">
        <button type="button" class:completed-action={set.completed} class="done-action flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium" on:click={() => { onToggle(); onExpandedChange(false) }} aria-label={`${set.completed ? 'Mark incomplete' : 'Complete'} ${exerciseName}, set ${setIndex + 1}`}><Check class="size-4" />{set.completed ? 'Mark set incomplete' : 'Complete set'}</button>
        <button type="button" class="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-danger-soft px-4 text-sm font-medium text-danger" on:click={deleteSet}><Trash2 class="size-4" /> Delete set</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .set-shell { position: relative; overflow: hidden; border-radius: 0.75rem; background: var(--color-paper); }
  .set-shell.revealed { background: var(--color-danger); }
  .set-surface { position: relative; z-index: 1; background: var(--color-paper); touch-action: pan-y; transition: transform 180ms cubic-bezier(0.25, 1, 0.5, 1); }
  .set-surface.dragging { transition: none; }
  .set-grid { display: grid; align-items: center; gap: 0.25rem; }
  .set-grid.strength { grid-template-columns: 1.5rem repeat(3, minmax(2.75rem, 1fr)) 2.75rem; }
  .set-grid.duration { grid-template-columns: 1.5rem minmax(5rem, 1fr) 2.75rem; }
  .set-grid.distance-duration { grid-template-columns: 1.5rem repeat(2, minmax(4.5rem, 1fr)) 2.75rem; }
  .target-strip { display: flex; min-height: 1.9rem; align-items: center; justify-content: center; gap: 0.5rem; border-top: 1px solid var(--color-rule); padding: 0.35rem 0.5rem 0.45rem; font-size: 0.6875rem; font-variant-numeric: tabular-nums; }
  .target-label { margin-inline-end: 0.3rem; color: var(--color-muted); font-size: 0.5625rem; font-weight: 600; text-transform: uppercase; }
  .set-input, .rpe-button { min-height: 2.75rem; min-width: 0; border: 0; border-radius: 0.75rem; background: var(--color-canvas); padding-inline: 0.25rem; text-align: center; font-size: 1rem; font-weight: 500; font-variant-numeric: tabular-nums; outline: none; }
  @media (min-width: 640px) and (hover: hover) and (pointer: fine) { .set-input:focus-visible, .rpe-button:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 1px; } }
  .set-shell.completed-row .set-number { color: var(--color-ink); }
  .rpe-button.rpe-set { color: var(--color-accent); }
  .detail-control { background: var(--color-canvas); color: var(--color-muted); transition: background-color 160ms cubic-bezier(0.25, 1, 0.5, 1), color 160ms cubic-bezier(0.25, 1, 0.5, 1); }
  .detail-control.completed-control { background: var(--color-ink); color: var(--color-paper); }
  .done-action { background: var(--color-ink); color: var(--color-paper); }
  .done-action.completed-action { background: var(--color-canvas); color: var(--color-ink); }
  .delete-action { position: absolute; inset-block: 0; inset-inline-end: 0; z-index: 0; display: flex; width: 4.75rem; flex-direction: column; align-items: center; justify-content: center; gap: 0.2rem; background: var(--color-danger); color: var(--color-paper); font-size: 0.6875rem; font-weight: 600; opacity: 0; transition: opacity 120ms; }
  .delete-action.revealed { opacity: 1; }
  .failure-toggle { display: flex; min-height: 3.75rem; align-items: center; gap: 0.65rem; border-radius: 0.75rem; background: var(--color-canvas); padding-inline: 0.75rem; text-align: left; color: var(--color-muted); }
  .failure-toggle.failure-active { background: var(--color-ink); color: var(--color-paper); }
  @media (min-width: 640px) {
    .set-grid { gap: 0.5rem; }
    .set-grid.strength { grid-template-columns: 2.5rem repeat(3, minmax(4rem, 1fr)) 3rem; }
    .set-grid.duration { grid-template-columns: 2.5rem minmax(6rem, 1fr) 3rem; }
    .set-grid.distance-duration { grid-template-columns: 2.5rem repeat(2, minmax(6rem, 1fr)) 3rem; }
    .set-input, .rpe-button { padding-inline: 0.5rem; }
  }
</style>
