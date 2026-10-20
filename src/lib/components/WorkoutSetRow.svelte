<script lang="ts">
  import { ArrowRight, Check, ChevronDown, CircleDot, Flame, MessageSquare, Minus, Trash2, TrendingDown, TrendingUp } from '@lucide/svelte'
  import { fly } from 'svelte/transition'
  import { formatSetDuration } from '$lib/exercise-tracking'
  import type { ExerciseTrackingMode } from '$lib/exercise-tracking'
  import { getSetProgressionOutcome, type SetProgressionOutcome, type SetProgressionTarget } from '$lib/progression'
  import type { WorkoutSet } from '$lib/types'
  import RpeCurve from './RpeCurve.svelte'

  export let set: WorkoutSet
  export let setIndex: number
  export let setNumber: number | null
  export let trackingMode: ExerciseTrackingMode
  export let exerciseName: string
  export let expanded: boolean
  export let progressionTarget: SetProgressionTarget | undefined
  export let onExpandedChange: (expanded: boolean) => void
  export let onChange: (changes: Partial<WorkoutSet>) => void
  export let onToggle: () => void
  export let onDelete: () => void
  export let onMaxEffortComplete: () => void

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
    if (target.action === 'increase-load') return 'Rep ceiling reached—advance the load.'
    if (target.action === 'add-rep') return 'Keep the load and add one repetition.'
    if (target.action === 'repeat') return 'Repeat this prescription before progressing.'
    return 'Complete this set to establish its baseline.'
  }

  function progressionOutcomeLabel(outcome: SetProgressionOutcome) {
    if (outcome === 'progressed') return 'Progressed'
    if (outcome === 'maintained') return 'Maintained'
    if (outcome === 'below-previous') return 'Below previous'
    return 'Baseline logged'
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

  function handleRpeChange(rpe: WorkoutSet['rpe']) {
    if (set.completed && rpe === 10 && set.rpe !== 10) {
      maxEffortPulse += 1
      onMaxEffortComplete()
    }
    onChange({ rpe })
  }

  function handleToggle() {
    if (!set.completed && set.rpe === 10) {
      maxEffortPulse += 1
      onMaxEffortComplete()
    }
    onToggle()
    onExpandedChange(false)
  }

  $: hasMetadata = Boolean(set.notes.trim())
  let maxEffortPulse = 0
  $: maxEffort = !set.warmup && set.completed && set.rpe === 10
  $: progressionOutcome = progressionTarget ? getSetProgressionOutcome(set, progressionTarget) : null
  $: setLabel = set.warmup ? 'warmup set' : `set ${setNumber ?? setIndex + 1}`
  $: revealed = offset < 0
</script>

<div class={`set-shell${set.completed ? ' completed-row' : ''}${revealed ? ' revealed' : ''}${maxEffort ? ' max-effort' : ''}`}>
  <button
    type="button"
    class="delete-action"
    class:revealed
    tabindex={revealed ? 0 : -1}
    aria-hidden={!revealed}
    aria-label={`Delete ${exerciseName}, ${setLabel}`}
    on:click={deleteSet}
  ><Trash2 class="size-5" /><span>Delete</span></button>

  <div
    class:dragging
    class="set-surface"
    style={`transform:translateX(${offset}px)`}
    on:pointerdown={startSwipe}
    role="group"
    aria-label={`${exerciseName}, ${setLabel}${maxEffort ? ', max effort' : ''}`}
    on:pointermove={moveSwipe}
    on:pointerup={finishSwipe}
    on:pointercancel={finishSwipe}
  >
    <div class={`set-grid ${trackingMode} px-1 py-1`}>
      <button type="button" class="relative grid min-h-11 place-items-center" on:click={() => onExpandedChange(!expanded)} aria-label={`${exerciseName}, ${setLabel} details`} aria-expanded={expanded}>
        {#if maxEffort}
          <Flame class="max-effort-flame" color="var(--color-accent)" fill="var(--color-accent)" strokeWidth={1.5} aria-hidden="true" />
        {:else}
          <span class="set-number font-dot text-base text-muted tabular-nums">{set.warmup ? 'W' : setNumber}</span>
        {/if}
        {#if hasMetadata}<span class="absolute right-0.5 top-1 size-1.5 rounded-full bg-accent"></span>{/if}
      </button>
      {#if trackingMode === 'strength'}
        <input class="set-input" type="number" inputmode="decimal" min="0" step="0.5" value={set.weight ?? ''} on:input={(event) => onChange({ weight: numberFromInput(event.currentTarget.value) })} aria-label={`${exerciseName}, ${setLabel}, weight in kilograms`} placeholder="—" />
        <input class="set-input" type="number" inputmode="numeric" min="0" step="1" value={set.reps ?? ''} on:input={(event) => onChange({ reps: numberFromInput(event.currentTarget.value) })} aria-label={`${exerciseName}, ${setLabel}, repetitions`} placeholder="—" />
        {#if set.warmup}
          <span class="warmup-rpe text-muted" aria-label="RPE is not applicable to a warmup set">N/A</span>
        {:else}
          <button type="button" class:rpe-set={set.rpe !== null} class="rpe-button" on:click={() => onExpandedChange(true)} aria-label={`${exerciseName}, ${setLabel}, choose RPE`} aria-expanded={expanded}>{set.rpe ?? '—'}</button>
        {/if}
      {:else}
        <input class="set-input" type="text" inputmode="decimal" value={set.durationSeconds === null ? '' : formatSetDuration(set.durationSeconds)} on:change={(event) => onChange({ durationSeconds: durationFromInput(event.currentTarget.value) })} aria-label={`${exerciseName}, ${setLabel}, duration in minutes and seconds`} placeholder="m:ss" />
        {#if trackingMode === 'distance-duration'}
          <input class="set-input" type="number" inputmode="decimal" min="0" step="0.01" value={set.distanceMeters === null ? '' : set.distanceMeters / 1_000} on:input={(event) => onChange({ distanceMeters: distanceFromInput(event.currentTarget.value) })} aria-label={`${exerciseName}, ${setLabel}, distance in kilometers`} placeholder="km" />
        {/if}
      {/if}
      <button type="button" class:completed-control={set.completed} class="detail-control grid size-11 place-items-center rounded-full" on:click={() => onExpandedChange(!expanded)} aria-label={`${expanded ? 'Close' : 'Open'} details for ${exerciseName}, ${setLabel}`} aria-expanded={expanded}><ChevronDown class={`size-5 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`} /></button>
    </div>
    {#if trackingMode === 'strength' && progressionOutcome}
      <div class={`outcome-strip ${progressionOutcome}`} aria-label={`Progression: ${progressionOutcomeLabel(progressionOutcome)}`}>
        {#if progressionOutcome === 'progressed'}<TrendingUp class="size-3.5" />
        {:else if progressionOutcome === 'maintained'}<Minus class="size-3.5" />
        {:else if progressionOutcome === 'below-previous'}<TrendingDown class="size-3.5" />
        {:else}<CircleDot class="size-3.5" />{/if}
        <span><span class="target-label">Progression</span><span class="outcome-label">{progressionOutcomeLabel(progressionOutcome)}</span></span>
        <span class="outcome-result">{formatPerformance(set.weight, set.reps)}</span>
      </div>
    {:else if trackingMode === 'strength' && progressionTarget && progressionTarget.previousReps !== null}
      <div class="target-strip">
        <span><span class="target-label">Prev</span>{formatPerformance(progressionTarget.previousWeight, progressionTarget.previousReps)}</span>
        <ArrowRight class="size-3.5 text-muted" />
        <span class="text-accent-strong"><span class="target-label">Target</span>{formatPerformance(progressionTarget.targetWeight, progressionTarget.targetReps)}</span>
      </div>
    {/if}
  </div>

  {#if expanded}
    <div class="relative z-10 border-t border-rule bg-paper px-2 pb-3 pt-2" in:fly={{ y: -6, duration: 180 }}>
      {#if trackingMode === 'strength' && progressionTarget && !set.completed}
        <section class="mb-3 rounded-xl bg-canvas p-3" aria-label={`Progression target for ${exerciseName}, ${setLabel}`}>
          <p class="text-[0.625rem] font-medium uppercase text-muted">Progression target</p>
          <p class="mt-1 text-sm font-medium">{progressionReason(progressionTarget)}</p>
          {#if progressionTarget.previousReps !== null || progressionTarget.targetReps !== null}
            <div class="mt-3 flex items-center gap-2 text-sm tabular-nums"><span>{formatPerformance(progressionTarget.previousWeight, progressionTarget.previousReps)}</span><ArrowRight class="size-4 text-muted" /><span class="font-medium text-accent-strong">{formatPerformance(progressionTarget.targetWeight, progressionTarget.targetReps)}</span></div>
          {/if}
        </section>
      {/if}
      {#if trackingMode === 'strength' && !set.warmup}<RpeCurve value={set.rpe} disabled={false} onChange={handleRpeChange} />{/if}
      <label class="mt-2 block rounded-xl bg-canvas px-3 py-2"><span class="flex items-center gap-1.5 text-[0.6875rem] font-medium uppercase text-muted"><MessageSquare class="size-3.5" /> Set note</span><textarea class="mt-1 min-h-12 w-full resize-y bg-transparent text-sm leading-5 outline-none placeholder:text-muted" value={set.notes} on:input={(event) => onChange({ notes: event.currentTarget.value })} placeholder={trackingMode === 'strength' ? 'Form, pain, tempo, or setup' : 'Pace, incline, or setup'}></textarea></label>
      <div class="mt-3 grid gap-2">
        <button type="button" class:completed-action={set.completed} class="done-action flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium" on:click={handleToggle} aria-label={`${set.completed ? 'Mark incomplete' : 'Complete'} ${exerciseName}, ${setLabel}`}><Check class="size-4" />{set.completed ? 'Mark set incomplete' : 'Complete set'}</button>
        <button type="button" class="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-danger-soft px-4 text-sm font-medium text-danger" on:click={deleteSet}><Trash2 class="size-4" /> Delete set</button>
      </div>
    </div>
  {/if}
  {#key maxEffortPulse}
    {#if maxEffortPulse > 0}<span class="max-effort-flash" aria-hidden="true"></span>{/if}
  {/key}
</div>

<style>
  .set-shell { position: relative; overflow: hidden; border-radius: 0.75rem; background: var(--color-paper); }
  .set-shell.max-effort { outline: 1px solid var(--color-accent); outline-offset: -1px; }
  .set-shell.revealed { background: var(--color-danger); }
  .set-surface { position: relative; z-index: 1; background: var(--color-paper); touch-action: pan-y; transition: transform 180ms cubic-bezier(0.25, 1, 0.5, 1); }
  .set-surface.dragging { transition: none; }
  .set-grid { display: grid; align-items: center; gap: 0.25rem; }
  .set-grid.strength { grid-template-columns: 1.5rem repeat(3, minmax(2.75rem, 1fr)) 2.75rem; }
  .set-grid.duration { grid-template-columns: 1.5rem minmax(5rem, 1fr) 2.75rem; }
  .set-grid.distance-duration { grid-template-columns: 1.5rem repeat(2, minmax(4.5rem, 1fr)) 2.75rem; }
  .target-strip, .outcome-strip { display: flex; min-height: 1.9rem; align-items: center; gap: 0.5rem; border-top: 1px solid var(--color-rule); padding: 0.35rem 0.5rem 0.45rem; font-size: 0.6875rem; font-variant-numeric: tabular-nums; }
  .target-strip { justify-content: center; }
  .outcome-strip { padding-inline: 0.75rem; }
  .outcome-strip.progressed { color: var(--color-success); }
  .outcome-strip.below-previous { color: var(--color-danger); }
  .outcome-strip.maintained, .outcome-strip.baseline { color: var(--color-ink); }
  .outcome-label { font-weight: 600; }
  .outcome-result { margin-inline-start: auto; color: var(--color-muted); }
  .target-label { margin-inline-end: 0.3rem; color: var(--color-muted); font-size: 0.5625rem; font-weight: 600; text-transform: uppercase; }
  .set-input, .rpe-button, .warmup-rpe { min-height: 2.75rem; min-width: 0; border: 0; border-radius: 0.75rem; background: var(--color-canvas); padding-inline: 0.25rem; text-align: center; font-size: 1rem; font-weight: 500; font-variant-numeric: tabular-nums; outline: none; }
  .warmup-rpe { display: grid; place-items: center; font-size: 0.625rem; font-weight: 600; letter-spacing: 0.04em; }
  @media (min-width: 640px) and (hover: hover) and (pointer: fine) { .set-input:focus-visible, .rpe-button:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 1px; } }
  .set-shell.completed-row .set-number { color: var(--color-ink); }
  .rpe-button.rpe-set { color: var(--color-accent); }
  .max-effort-flame { width: 1.25rem; height: 1.25rem; }
  .max-effort-flash { position: absolute; inset: 0; z-index: 20; border: 2px solid var(--color-accent); border-radius: inherit; pointer-events: none; opacity: 0; animation: max-effort-heat 420ms cubic-bezier(0.25, 1, 0.5, 1); }
  @keyframes max-effort-heat {
    0% { opacity: 0; transform: scale(0.985); }
    35% { opacity: 0.9; transform: scale(1); }
    100% { opacity: 0; transform: scale(1); }
  }
  .detail-control { background: var(--color-canvas); color: var(--color-muted); transition: background-color 160ms cubic-bezier(0.25, 1, 0.5, 1), color 160ms cubic-bezier(0.25, 1, 0.5, 1); }
  .detail-control.completed-control { background: var(--color-ink); color: var(--color-paper); }
  .done-action { background: var(--color-ink); color: var(--color-paper); }
  .done-action.completed-action { background: var(--color-canvas); color: var(--color-ink); }
  .delete-action { position: absolute; inset-block: 0; inset-inline-end: 0; z-index: 0; display: flex; width: 4.75rem; flex-direction: column; align-items: center; justify-content: center; gap: 0.2rem; background: var(--color-danger); color: var(--color-paper); font-size: 0.6875rem; font-weight: 600; opacity: 0; transition: opacity 120ms; }
  .delete-action.revealed { opacity: 1; }
  @media (min-width: 640px) {
    .set-grid { gap: 0.5rem; }
    .set-grid.strength { grid-template-columns: 2.5rem repeat(3, minmax(4rem, 1fr)) 3rem; }
    .set-grid.duration { grid-template-columns: 2.5rem minmax(6rem, 1fr) 3rem; }
    .set-grid.distance-duration { grid-template-columns: 2.5rem repeat(2, minmax(6rem, 1fr)) 3rem; }
    .set-input, .rpe-button { padding-inline: 0.5rem; }
  }
  @media (prefers-reduced-motion: reduce) {
    .max-effort-flash { animation: none; }
  }
</style>
