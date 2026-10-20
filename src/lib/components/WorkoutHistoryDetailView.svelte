<script lang="ts">
  import { ArrowLeft, Check, ChevronRight, HeartPulse, Trash2 } from '@lucide/svelte'
  import type { AppleHealthExportRecord } from '$lib/apple-health'
  import { getExerciseTrackingMode } from '$lib/exercise-tracking'
  import { buildExerciseProgressionResults } from '$lib/progression'
  import type { WorkoutSession } from '$lib/types'
  import { formatDuration, formatShortDate, formatTime, formatVolume, getCompletedSetCount, getWorkoutVolume } from '$lib/utils'
  import { getWorkingSetNumber } from '$lib/workout-sets'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import ReadOnlyWorkoutSetHeader from './ReadOnlyWorkoutSetHeader.svelte'
  import ReadOnlyWorkoutSetRow from './ReadOnlyWorkoutSetRow.svelte'
  import ExerciseProgressionSignal from './ExerciseProgressionSignal.svelte'

  export let workout: WorkoutSession
  export let workouts: WorkoutSession[]
  export let onBack: () => void
  export let onOpenExercise: (exerciseId: string, exerciseName: string) => void
  export let onDelete: () => void
  export let appleHealthExport: AppleHealthExportRecord | undefined
  export let canExportToAppleHealth = false
  export let onExportAppleHealth: () => void

  let deleteDialog: ConfirmDialog
  $: completedExercises = workout.exercises.filter((exercise) => exercise.sets.some((set) => set.completed))
  $: progressionResults = buildExerciseProgressionResults(workout, workouts)
</script>

<div class="mx-auto w-full max-w-4xl px-5 py-6 sm:px-8 lg:py-8">
  <header>
    <button class="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-medium text-muted hover:text-ink" on:click={onBack} aria-label="Back to workout history"><ArrowLeft class="size-4" />History</button>
    <p class="font-dot mt-6 text-xs text-accent">SAVED SESSION</p>
    <h1 class="mt-2 text-3xl font-medium text-balance">{workout.title}</h1>
    <p class="mt-2 text-sm text-muted">{formatShortDate(workout.completedAt ?? workout.startedAt)} · Started {formatTime(workout.startedAt)}</p>
  </header>

  <dl class="mt-7 grid grid-cols-3 divide-x divide-rule overflow-hidden rounded-2xl bg-paper">
    <div class="min-w-0 px-3 py-4 sm:px-5"><dt class="text-[0.6875rem] font-medium uppercase text-muted">Time</dt><dd class="font-dot mt-2 truncate text-xl tabular-nums sm:text-2xl">{formatDuration(workout.startedAt, workout.completedAt)}</dd></div>
    <div class="min-w-0 px-3 py-4 sm:px-5"><dt class="text-[0.6875rem] font-medium uppercase text-muted">Sets</dt><dd class="font-dot mt-2 truncate text-xl tabular-nums sm:text-2xl">{getCompletedSetCount(workout)}</dd></div>
    <div class="min-w-0 px-3 py-4 sm:px-5"><dt class="text-[0.6875rem] font-medium uppercase text-muted">Volume</dt><dd class="font-dot mt-2 truncate text-xl tabular-nums sm:text-2xl">{formatVolume(getWorkoutVolume(workout))}<span class="font-sans ml-1 text-[0.6875rem] text-muted">kg</span></dd></div>
  </dl>

  {#if workout.checkIn}
    <section class="mt-6 rounded-2xl bg-paper p-5" aria-labelledby="pre-workout-check-in-heading">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="pre-workout-check-in-heading" class="text-base font-medium">Pre-workout check-in</h2>
        <p class="text-xs text-muted">{formatShortDate(workout.checkIn.recordedAt)} · {formatTime(workout.checkIn.recordedAt)}</p>
      </div>
      <dl class="mt-4 grid grid-cols-3 divide-x divide-rule sm:grid-cols-5">
        <div class="px-2 first:pl-0 sm:px-3"><dt class="text-[0.625rem] uppercase text-muted">Sleep</dt><dd class="font-dot mt-1 text-lg tabular-nums">{workout.checkIn.sleepQuality}/5</dd></div>
        <div class="px-2 sm:px-3"><dt class="text-[0.625rem] uppercase text-muted">Energy</dt><dd class="font-dot mt-1 text-lg tabular-nums">{workout.checkIn.energy}/5</dd></div>
        <div class="px-2 sm:px-3"><dt class="text-[0.625rem] uppercase text-muted">Soreness</dt><dd class="font-dot mt-1 text-lg tabular-nums">{workout.checkIn.soreness}/5</dd></div>
        <div class="mt-4 border-l-0 px-2 first:pl-0 sm:mt-0 sm:border-l sm:px-3"><dt class="text-[0.625rem] uppercase text-muted">Stress</dt><dd class="font-dot mt-1 text-lg tabular-nums">{workout.checkIn.stress}/5</dd></div>
        <div class="mt-4 px-2 sm:mt-0 sm:px-3"><dt class="text-[0.625rem] uppercase text-muted">Motivation</dt><dd class="font-dot mt-1 text-lg tabular-nums">{workout.checkIn.motivation}/5</dd></div>
      </dl>
      {#if workout.checkIn.painPresent || workout.checkIn.illnessPresent}
        <p class="mt-4 text-sm text-danger">{workout.checkIn.painPresent ? 'Pain recorded' : ''}{workout.checkIn.painPresent && workout.checkIn.illnessPresent ? ' · ' : ''}{workout.checkIn.illnessPresent ? 'Illness recorded' : ''}</p>
      {/if}
      {#if workout.checkIn.notes}<p class="mt-3 text-sm leading-6 text-pretty">{workout.checkIn.notes}</p>{/if}
    </section>
  {/if}

  {#if canExportToAppleHealth || appleHealthExport?.status === 'exported'}
    <section class="mt-6 rounded-2xl bg-paper p-5" aria-labelledby="apple-health-heading">
      <div class="flex items-start gap-3">
        <span class={`grid size-10 shrink-0 place-items-center rounded-full ${appleHealthExport?.status === 'exported' ? 'bg-success-soft text-success' : 'bg-accent-soft text-accent'}`}>
          {#if appleHealthExport?.status === 'exported'}<Check class="size-5" />{:else}<HeartPulse class="size-5" />{/if}
        </span>
        <div class="min-w-0 flex-1">
          <h2 id="apple-health-heading" class="text-base font-medium">Apple Health</h2>
          {#if appleHealthExport?.status === 'exported'}
            <p class="mt-1 text-sm text-muted">Added {appleHealthExport.exportedAt ? `${formatShortDate(appleHealthExport.exportedAt)} · ${formatTime(appleHealthExport.exportedAt)}` : 'successfully'}.</p>
          {:else}
            <p class="mt-1 text-sm leading-6 text-muted text-pretty">Add this session as a Traditional Strength Training workout using your LifeOS shortcut.</p>
          {/if}
        </div>
      </div>

      {#if appleHealthExport?.lastError}<p class="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{appleHealthExport.lastError}</p>{/if}
      {#if canExportToAppleHealth && appleHealthExport?.status !== 'exported'}
        <button class="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-medium text-accent-ink sm:w-auto" on:click={onExportAppleHealth}><HeartPulse class="size-4" />{appleHealthExport?.status === 'exporting' ? 'Try export again' : 'Add to Apple Health'}</button>
      {/if}
    </section>
  {/if}

  {#if workout.notes}
    <section class="mt-6 rounded-2xl bg-paper p-5" aria-labelledby="session-note-heading"><p id="session-note-heading" class="text-[0.6875rem] font-medium uppercase text-muted">Session note</p><p class="mt-2 text-sm leading-6 text-pretty">{workout.notes}</p></section>
  {/if}

  <div class="mt-6 space-y-3">
    {#each completedExercises as exercise, exerciseIndex (exercise.id)}
      {@const completedSets = exercise.sets.filter((set) => set.completed)}
      {@const completedWorkingSetCount = completedSets.filter((set) => !set.warmup).length}
      {@const trackingMode = getExerciseTrackingMode(exercise)}
      {@const progressionResult = progressionResults.get(exercise.id)}
      <section class="rounded-2xl bg-paper p-4 sm:p-5" aria-label={`${exercise.name}, ${completedWorkingSetCount} completed working ${completedWorkingSetCount === 1 ? 'set' : 'sets'}`}>
        <div class="flex items-start justify-between gap-4 pb-4">
          <div class="min-w-0">
            <p class="font-dot text-xs tabular-nums text-accent">EXERCISE {String(exerciseIndex + 1).padStart(2, '0')}</p>
            <button class="mt-1 flex max-w-full items-center gap-1 text-left" on:click={() => onOpenExercise(exercise.exerciseId, exercise.name)}>
              <span class="truncate text-lg font-medium">{exercise.name}</span><ChevronRight class="size-4 shrink-0 text-muted" />
            </button>
            <p class="mt-1 text-xs text-muted">{exercise.muscle} · {exercise.equipment}</p>
          </div>
          <div class="flex shrink-0 flex-col items-end gap-2">
            {#if progressionResult}<ExerciseProgressionSignal result={progressionResult} compact={true} />{/if}
            <span class="rounded-full bg-canvas px-2.5 py-1 text-[0.625rem] font-medium uppercase text-muted">{completedWorkingSetCount} working {completedWorkingSetCount === 1 ? 'set' : 'sets'}</span>
          </div>
        </div>

        {#if exercise.notes}<div class="mb-4 rounded-xl bg-canvas px-3 py-2"><span class="text-[0.6875rem] font-medium uppercase text-muted">Exercise note</span><p class="mt-1 text-sm leading-5">{exercise.notes}</p></div>{/if}

        <ReadOnlyWorkoutSetHeader {trackingMode} />
        <div class="space-y-1">
          {#each completedSets as set, setIndex (set.id)}
            {@const setNumber = getWorkingSetNumber(completedSets, setIndex)}
            <ReadOnlyWorkoutSetRow {set} {setIndex} {setNumber} exerciseName={exercise.name} {trackingMode} />
          {/each}
        </div>
      </section>
    {/each}
  </div>

  {#if workout.sessionRpe !== null}<p class="mt-5 text-sm text-muted">Session RPE {workout.sessionRpe}</p>{/if}

  <section class="mt-12 border-t border-rule pt-6" aria-labelledby="delete-workout-heading">
    <h2 id="delete-workout-heading" class="text-sm font-medium">Delete saved workout</h2>
    <p class="mt-1 text-sm leading-6 text-muted">Remove this session from workout history on every synced device.</p>
    <button class="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-danger px-5 text-sm font-medium text-danger-ink sm:w-auto" on:click={() => deleteDialog.open()}><Trash2 class="size-4" />Delete workout</button>
  </section>
</div>

<ConfirmDialog bind:this={deleteDialog} eyebrow="Delete saved workout" title={`Delete ${workout.title}?`} description="This session and all of its saved set data will be removed from workout history on every synced device. This cannot be undone." confirmLabel="Delete workout" onConfirm={onDelete} />
