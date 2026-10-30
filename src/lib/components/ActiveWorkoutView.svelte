<script lang="ts">
  import { ArrowDown, ArrowLeft, ArrowUp, Bell, CheckCircle2, ChevronDown, ChevronRight, Clock3, EllipsisVertical, Gauge, Medal, Pencil, Plus, Repeat2, Route, Trash2, Weight, XCircle } from '@lucide/svelte'
  import { flip } from 'svelte/animate'
  import { onDestroy, onMount, tick } from 'svelte'
  import { fade, fly } from 'svelte/transition'
  import { getWorkoutPersonalRecords } from '$lib/personal-records'
  import { formatSetDuration, getExerciseTrackingMode, type ExerciseTrackingMode } from '$lib/exercise-tracking'
  import { buildExerciseProgressionResults, buildSetProgressionTargets, defaultProgressionRule } from '$lib/progression'
  import { getActiveRestTimer } from '$lib/rest-timer'
  import { getEquipmentWeightOptions } from '$lib/equipment-settings'
  import { getWorkoutStrengthHighlights } from '$lib/training-science'
  import type { EquipmentSettings, ExerciseDefinition, RoutineTemplate, WorkoutExercise, WorkoutFinishDecision, WorkoutSession, WorkoutSet } from '$lib/types'
  import { DEFAULT_REST_SECONDS } from '$lib/workouts'
  import { formatCountdown, formatElapsed, formatVolume, getCompletedSetCount, getLiveWorkoutVolume, getWorkoutSetCount, newId } from '$lib/utils'
  import { countWorkingSets, createWorkoutSet, getLastWorkingSet, getMatchingPreviousSet, getPreviousWorkoutExercise, getWorkingSetNumber } from '$lib/workout-sets'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import FinishWorkoutDialog from './FinishWorkoutDialog.svelte'
  import ExercisePicker from './ExercisePicker.svelte'
  import ExerciseProgressionSignal from './ExerciseProgressionSignal.svelte'
  import MaxEffortMoment from './MaxEffortMoment.svelte'
  import WorkoutSetRow from './WorkoutSetRow.svelte'

  export let workout: WorkoutSession
  export let workouts: WorkoutSession[]
  export let routines: RoutineTemplate[]
  export let equipmentSettings: EquipmentSettings | null
  export let onBack: () => void
  export let onChange: (workout: WorkoutSession) => void
  export let customExercises: ExerciseDefinition[]
  export let onCreateExercise: (exercise: ExerciseDefinition) => void
  export let onOpenExercise: (exerciseId: string, exerciseName: string) => void
  export let onFinish: (decision: WorkoutFinishDecision) => void
  export let onCancel: () => void

  let now = Date.now()
  let finishDialog: FinishWorkoutDialog
  let cancelDialog: ConfirmDialog
  let deleteDialog: ConfirmDialog
  let optionsOpen = false
  let expandedSetId: string | null = null
  let expandedCompletedExerciseIds = new Set<string>()
  let finishMode: 'routine' | 'one-off' = 'one-off'
  let pendingDelete: { title: string; description: string; action: () => void } | null = null
  let maxEffortMoment: { id: number; exerciseName: string } | null = null
  let maxEffortSequence = 0
  const timer = setInterval(() => { now = Date.now() }, 1_000)
  onDestroy(() => clearInterval(timer))

  onMount(() => {
    let savedScrollY = 0
    try {
      const storedScrollY = Number(sessionStorage.getItem(`lifeos-workout-scroll:${workout.id}`))
      savedScrollY = Number.isFinite(storedScrollY) && storedScrollY > 0 ? storedScrollY : 0
    } catch {
      savedScrollY = 0
    }
    const restoreFrame = window.requestAnimationFrame(() => window.scrollTo(0, savedScrollY))
    return () => window.cancelAnimationFrame(restoreFrame)
  })

  function changeWorkout(changes: Partial<WorkoutSession>) {
    onChange({ ...workout, ...changes, updatedAt: new Date().toISOString() })
  }

  function updateExercise(exerciseId: string, update: (exercise: WorkoutExercise) => WorkoutExercise) {
    changeWorkout({ exercises: workout.exercises.map((exercise) => exercise.id === exerciseId ? update(exercise) : exercise) })
  }

  function addExercise(definition: ExerciseDefinition) {
    const exercise: WorkoutExercise = {
      id: newId(),
      exerciseId: definition.id,
      name: definition.name,
      muscle: definition.muscle,
      secondaryMuscles: definition.secondaryMuscles,
      equipment: definition.equipment,
      notes: '',
      restSeconds: DEFAULT_REST_SECONDS,
      restUntil: null,
      progression: {
        ...defaultProgressionRule(definition.equipment),
        weightOptions: getEquipmentWeightOptions(equipmentSettings, definition.equipment),
      },
      sets: [createWorkoutSet(false, getMatchingPreviousSet(
        getPreviousWorkoutExercise(workouts, definition.id),
        false,
        0,
      ))],
    }
    changeWorkout({ exercises: [...workout.exercises, exercise] })
  }

  function addSet(exerciseId: string) {
    const exercise = workout.exercises.find((item) => item.id === exerciseId)
    if (!exercise) return
    const workingSetIndex = countWorkingSets(exercise.sets)
    const previousExercise = getPreviousWorkoutExercise(workouts, exercise.exerciseId)
    const historicalSet = getMatchingPreviousSet(previousExercise, false, workingSetIndex)
    const nextSet: WorkoutSet = createWorkoutSet(false, historicalSet ?? getLastWorkingSet(exercise.sets))
    const scrollY = window.scrollY
    updateExercise(exerciseId, (item) => ({ ...item, sets: [...item.sets, nextSet] }))
    void tick().then(() => window.scrollTo(0, scrollY))
  }

  function setExpanded(setId: string, expanded: boolean) {
    expandedSetId = expanded ? setId : expandedSetId === setId ? null : expandedSetId
  }

  function setCompletedExerciseExpanded(exerciseId: string, expanded: boolean) {
    const next = new Set(expandedCompletedExerciseIds)
    if (expanded) next.add(exerciseId)
    else next.delete(exerciseId)
    expandedCompletedExerciseIds = next
  }

  function isExerciseComplete(exercise: WorkoutExercise) {
    return exercise.sets.length > 0 && exercise.sets.every((set) => set.completed)
  }

  function exerciseSummary(exercise: WorkoutExercise, trackingMode: ExerciseTrackingMode) {
    let workingSets = 0
    let repetitions = 0
    let volume = 0
    let durationSeconds = 0
    let distanceMeters = 0

    for (const set of exercise.sets) {
      if (!set.completed || set.warmup) continue
      workingSets += 1
      repetitions += set.reps ?? 0
      volume += (set.weight ?? 0) * (set.reps ?? 0)
      durationSeconds += set.durationSeconds ?? 0
      distanceMeters += set.distanceMeters ?? 0
    }

    const setLabel = `${workingSets} ${workingSets === 1 ? 'working set' : 'working sets'}`
    if (trackingMode === 'strength') return `${setLabel} · ${formatVolume(volume)} kg · ${repetitions} reps`
    const duration = formatSetDuration(durationSeconds)
    if (trackingMode === 'distance-duration') return `${setLabel} · ${duration} · ${(distanceMeters / 1_000).toFixed(2)} km`
    return `${setLabel} · ${duration}`
  }

  function showMaxEffortMoment(exerciseName: string) {
    maxEffortSequence += 1
    maxEffortMoment = { id: maxEffortSequence, exerciseName }
  }

  function moveExercise(exerciseId: string, direction: -1 | 1) {
    const index = workout.exercises.findIndex((exercise) => exercise.id === exerciseId)
    const destination = index + direction
    if (index < 0 || destination < 0 || destination >= workout.exercises.length) return
    const exercises = [...workout.exercises]
    const [exercise] = exercises.splice(index, 1)
    exercises.splice(destination, 0, exercise)
    changeWorkout({ exercises })
  }

  function toggleSet(exerciseId: string, setId: string) {
    const exercise = workout.exercises.find((item) => item.id === exerciseId)
    const set = exercise?.sets.find((item) => item.id === setId)
    if (!exercise || !set) return
    const completing = !set.completed
    if (completing && 'Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission()
    }
    const completesExercise = completing && exercise.sets.every((candidate) => candidate.id === setId || candidate.completed)
    if (completesExercise) setCompletedExerciseExpanded(exerciseId, false)
    updateExercise(exerciseId, (item) => ({
      ...item,
      restUntil: completing && item.restSeconds > 0
        ? new Date(Date.now() + item.restSeconds * 1_000).toISOString()
        : null,
      sets: item.sets.map((candidate) => candidate.id === setId ? { ...candidate, completed: completing, completedAt: completing ? new Date().toISOString() : null } : candidate),
    }))
  }

  async function askToDelete(title: string, description: string, action: () => void) {
    pendingDelete = { title, description, action }
    await tick()
    deleteDialog.open()
  }

  function adjustRest(seconds: number) {
    if (!activeRest) return
    const currentEnd = new Date(activeRest.restUntil).getTime()
    const nextEnd = Math.max(Date.now() + 1_000, currentEnd + seconds * 1_000)
    updateExercise(activeRest.sourceExerciseId, (exercise) => ({ ...exercise, restUntil: new Date(nextEnd).toISOString() }))
  }

  function skipRest() {
    if (!activeRest) return
    updateExercise(activeRest.sourceExerciseId, (exercise) => ({ ...exercise, restUntil: null }))
  }

  $: activeRest = getActiveRestTimer(workout, now)

  $: progressionTargets = buildSetProgressionTargets(workout, workouts)
  $: progressionResults = buildExerciseProgressionResults(workout, workouts)
  $: personalRecords = getWorkoutPersonalRecords(workout, workouts)
  $: finishHighlights = personalRecords.map((record) => ({
    id: record.id,
    title: record.exerciseName,
    description: `${record.label} · ${record.formattedValue}`,
  }))
  $: finishProgressionResults = workout.exercises.flatMap((exercise) => {
    const result = progressionResults.get(exercise.id)
    return result && result.status !== 'pending' ? [{ exerciseName: exercise.name, result }] : []
  })
  $: strengthHighlights = getWorkoutStrengthHighlights(workout, workouts)
  $: sourceRoutine = workout.routineId
    ? routines.find((routine) => routine.id === workout.routineId)
    : undefined
  $: finishMode = workout.routineId ? 'routine' : 'one-off'


  $: completedSets = getCompletedSetCount(workout)
  $: liveVolume = getLiveWorkoutVolume(workout)
  $: liveSetCount = getWorkoutSetCount(workout)
  $: finishDescription = `${completedSets} completed ${completedSets === 1 ? 'set' : 'sets'} across ${workout.exercises.length} ${workout.exercises.length === 1 ? 'exercise' : 'exercises'}.`
</script>

<div class={`min-h-dvh bg-canvas ${activeRest ? 'pb-[calc(14rem+env(safe-area-inset-bottom))]' : 'pb-[calc(2rem+env(safe-area-inset-bottom))]'}`}>
  <div class="sticky top-0 z-20 bg-canvas">
    <header class="px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
      <div class="mx-auto flex max-w-7xl items-center gap-3">
        <button class="grid size-11 shrink-0 place-items-center rounded-full border border-ink" on:click={onBack} aria-label="Back to today"><ArrowLeft class="size-5" /></button>
        <div class="min-w-0 flex-1">
          <input class="min-h-11 w-full truncate bg-transparent text-lg font-medium outline-none placeholder:text-muted" value={workout.title} on:input={(event) => changeWorkout({ title: event.currentTarget.value })} aria-label="Workout name" placeholder="Workout name" />
        </div>
        <div class="relative">
          <button class="grid size-11 place-items-center rounded-full text-muted hover:bg-paper hover:text-ink" on:click={() => { optionsOpen = !optionsOpen }} aria-label="Workout options" aria-expanded={optionsOpen}><EllipsisVertical class="size-5" /></button>
          {#if optionsOpen}
            <div class="absolute right-0 top-12 z-30 w-48 rounded-xl bg-paper p-1.5 shadow-[0_8px_28px_color-mix(in_oklch,var(--color-ink)_18%,transparent)]" in:fly={{ y: -5, duration: 160 }} out:fade={{ duration: 100 }}>
              <button class="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-danger hover:bg-danger-soft" on:click={() => { optionsOpen = false; cancelDialog.open() }}><XCircle class="size-4" /> Cancel workout</button>
            </div>
          {/if}
        </div>
        <button class="min-h-11 rounded-full bg-ink px-5 text-sm font-medium text-paper disabled:cursor-not-allowed disabled:bg-panel-deep disabled:text-muted" disabled={completedSets === 0} on:click={() => finishDialog.open()}>Finish</button>
      </div>
    </header>

    <section class="border-y border-rule bg-paper" aria-label="Workout progress">
      <dl class="mx-auto grid max-w-7xl grid-cols-3 divide-x divide-rule px-3 py-3 sm:px-6 lg:px-8">
        <div class="pr-3"><dt class="text-[0.6875rem] uppercase text-muted">Duration</dt><dd class="font-dot mt-1 text-lg tabular-nums">{formatElapsed(workout.startedAt, now)}</dd></div>
        <div class="px-3"><dt class="text-[0.6875rem] uppercase text-muted">Volume</dt><dd class="font-dot mt-1 text-lg tabular-nums">{formatVolume(liveVolume)} <span class="font-sans text-xs text-muted">kg</span></dd></div>
        <div class="pl-3"><dt class="text-[0.6875rem] uppercase text-muted">Sets</dt><dd class="font-dot mt-1 text-lg tabular-nums">{liveSetCount}</dd></div>
      </dl>
    </section>
  </div>


  <main class="mx-auto max-w-7xl py-3 sm:px-6 sm:py-5 lg:px-8">
      <div>
        {#if workout.exercises.length === 0}
          <section class="border-y border-rule bg-accent px-4 py-6 text-accent-ink sm:rounded-2xl sm:border-0 sm:p-6">
            <p class="font-dot text-sm">NEW SESSION</p>
            <p class="mt-8 text-2xl font-medium">Add an exercise to begin</p>
            <p class="mt-2 text-sm text-accent-ink/80">Log weight and reps as you train.</p>
            <div class="mt-6"><ExercisePicker selectedExerciseIds={[]} {customExercises} onSelect={addExercise} onCreate={onCreateExercise} /></div>
          </section>
        {:else}
          <div class="space-y-3">
            {#each workout.exercises as exercise, exerciseIndex (exercise.id)}
              {@const exerciseRecords = personalRecords.filter((record) => record.workoutExerciseId === exercise.id)}
              {@const trackingMode = getExerciseTrackingMode(exercise)}
              {@const progressionResult = progressionResults.get(exercise.id)}
              {@const exerciseComplete = isExerciseComplete(exercise)}
              {@const exerciseCollapsed = exerciseComplete && !expandedCompletedExerciseIds.has(exercise.id)}
              <section class:completed-exercise={exerciseCollapsed} class="border-y border-rule bg-paper px-3 py-4 sm:rounded-2xl sm:border-0 sm:p-5" animate:flip={{ duration: 180 }} in:fly={{ y: 12, duration: 180 }} out:fade={{ duration: 120 }}>
                <div class:pb-4={!exerciseCollapsed} class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="font-dot text-xs tabular-nums text-accent">EXERCISE {String(exerciseIndex + 1).padStart(2, '0')}</p>
                    <button class="mt-1 flex max-w-full items-center gap-1 text-left" on:click={() => onOpenExercise(exercise.exerciseId, exercise.name)}>
                      <span class="truncate text-lg font-medium">{exercise.name}</span><ChevronRight class="size-4 shrink-0 text-muted" />
                    </button>
                    <p class="mt-1 text-xs text-muted">{exercise.muscle} · {exercise.equipment}</p>
                    {#if exerciseRecords.length > 0}
                      <div class="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[0.6875rem] font-medium text-accent" aria-label={`${exerciseRecords.length} personal ${exerciseRecords.length === 1 ? 'record' : 'records'} achieved for ${exercise.name}`}>
                        <Medal class="size-3.5" /> {exerciseRecords.length} {exerciseRecords.length === 1 ? 'personal record' : 'personal records'}
                      </div>
                    {/if}
                  </div>
                  {#if exerciseCollapsed}
                    <button class="flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-paper px-4 text-sm font-medium text-ink" on:click={() => setCompletedExerciseExpanded(exercise.id, true)} aria-label={`Edit completed ${exercise.name}`}><Pencil class="size-4" /> Edit</button>
                  {:else}
                    <div class="flex shrink-0 items-center">
                      {#if exerciseComplete}<button class="grid size-11 place-items-center rounded-full text-success" on:click={() => setCompletedExerciseExpanded(exercise.id, false)} aria-label={`Collapse completed ${exercise.name}`}><CheckCircle2 class="size-4" /></button>{/if}
                      <button class="grid size-11 place-items-center rounded-full text-muted disabled:opacity-25" disabled={exerciseIndex === 0} on:click={() => moveExercise(exercise.id, -1)} aria-label={`Move ${exercise.name} up`}><ArrowUp class="size-4" /></button>
                      <button class="grid size-11 place-items-center rounded-full text-muted disabled:opacity-25" disabled={exerciseIndex === workout.exercises.length - 1} on:click={() => moveExercise(exercise.id, 1)} aria-label={`Move ${exercise.name} down`}><ArrowDown class="size-4" /></button>
                      <button class="grid size-11 place-items-center rounded-full text-muted hover:bg-canvas hover:text-danger" on:click={() => askToDelete(`Remove ${exercise.name}?`, 'Its sets will be removed from this workout.', () => changeWorkout({ exercises: workout.exercises.filter((item) => item.id !== exercise.id) }))} aria-label={`Remove ${exercise.name}`}><Trash2 class="size-4" /></button>
                    </div>
                  {/if}
                </div>

                {#if exerciseCollapsed}
                  <div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-success/20 pt-4">
                    <span class="flex min-w-0 items-center gap-2 text-sm font-medium text-success"><CheckCircle2 class="size-4 shrink-0" /><span class="truncate">{exerciseSummary(exercise, trackingMode)}</span></span>
                    {#if progressionResult}<ExerciseProgressionSignal result={progressionResult} compact={true} />{/if}
                  </div>
                {:else}
                  <div class="mb-4 grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)]">
                    <label class="rounded-xl bg-canvas px-3 py-2"><span class="flex items-center gap-1.5 text-[0.6875rem] font-medium uppercase text-muted"><Bell class="size-3.5" /> Rest timer</span><select class="mt-1 w-full bg-transparent text-sm font-medium outline-none" value={exercise.restSeconds} on:change={(event) => updateExercise(exercise.id, (item) => ({ ...item, restSeconds: Number(event.currentTarget.value) }))}><option value={0}>Off</option><option value={30}>30 seconds</option><option value={60}>1 minute</option><option value={90}>1:30 minutes</option><option value={120}>2 minutes</option><option value={180}>3 minutes</option><option value={300}>5 minutes</option></select></label>
                    <label class="rounded-xl bg-canvas px-3 py-2"><span class="text-[0.6875rem] font-medium uppercase text-muted">Exercise note</span><textarea class="mt-1 min-h-8 w-full resize-y bg-transparent text-sm leading-5 outline-none placeholder:text-muted" value={exercise.notes} on:input={(event) => updateExercise(exercise.id, (item) => ({ ...item, notes: event.currentTarget.value }))} placeholder="Cues, setup, or pain notes"></textarea></label>
                  </div>
                  {#if progressionResult}<div class="mb-3"><ExerciseProgressionSignal result={progressionResult} /></div>{/if}

                  <div>
                    <div class={`set-grid ${trackingMode} px-1 pb-1 text-center text-[0.6875rem] uppercase text-muted`}>
                      <span>Set</span>
                      {#if trackingMode === 'strength'}
                        <span class="set-heading"><Weight class="size-3.5" />kg</span>
                        <span class="set-heading"><Repeat2 class="size-3.5" />Reps</span>
                        <span class="set-heading"><Gauge class="size-3.5" />RPE</span>
                      {:else}
                        <span class="set-heading"><Clock3 class="size-3.5" />Duration</span>
                        {#if trackingMode === 'distance-duration'}<span class="set-heading"><Route class="size-3.5" />Distance</span>{/if}
                      {/if}
                      <span class="set-heading"><ChevronDown class="size-3.5" />Details</span>
                    </div>
                    <div class="space-y-1">
                      {#each exercise.sets as set, setIndex (set.id)}
                        {@const setNumber = getWorkingSetNumber(exercise.sets, setIndex)}
                        <WorkoutSetRow
                          {set}
                          progressionTarget={progressionTargets.get(set.id)}
                          {setIndex}
                          {setNumber}
                          {trackingMode}
                          exerciseName={exercise.name}
                          expanded={expandedSetId === set.id}
                          onExpandedChange={(expanded) => setExpanded(set.id, expanded)}
                          onChange={(changes) => updateExercise(exercise.id, (item) => ({ ...item, sets: item.sets.map((candidate) => {
                            if (candidate.id !== set.id) return candidate
                            const updated = { ...candidate, ...changes }
                            return updated.warmup ? { ...updated, rpe: null } : updated
                          }) }))}
                          onToggle={() => { toggleSet(exercise.id, set.id); expandedSetId = null }}
                          onMaxEffortComplete={() => showMaxEffortMoment(exercise.name)}
                          onDelete={() => askToDelete(set.warmup ? 'Remove warmup set?' : `Remove set ${setNumber}?`, 'This set will be removed from the active workout.', () => { if (expandedSetId === set.id) expandedSetId = null; updateExercise(exercise.id, (item) => ({ ...item, sets: item.sets.filter((candidate) => candidate.id !== set.id) })) })}
                        />
                      {/each}
                    </div>
                    <button class="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-canvas px-4 text-sm font-medium hover:bg-panel" on:click={() => addSet(exercise.id)}><Plus class="size-4 text-accent" /> Add set</button>
                  </div>
                {/if}
              </section>
            {/each}
            <div class="px-3 sm:px-0"><ExercisePicker selectedExerciseIds={workout.exercises.map((exercise) => exercise.exerciseId)} {customExercises} onSelect={addExercise} onCreate={onCreateExercise} /></div>
          </div>
        {/if}
      </div>

  </main>
  {#if activeRest}
    <section class="fixed inset-x-0 bottom-0 z-30 border-t border-accent bg-accent px-3 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-accent-ink sm:px-6 sm:pt-5 lg:left-56 lg:px-8" role="timer" aria-label={`Rest timer. ${activeRest.nextLabel}`}>
      <div class="mx-auto max-w-2xl">
        <div class="text-center">
          <p class="truncate text-xs font-medium uppercase">{activeRest.nextLabel}</p>
          <p class="font-dot mt-2 text-5xl leading-none tabular-nums sm:text-6xl">{formatCountdown(activeRest.remaining)}</p>
        </div>
        <div class="mt-4 grid grid-cols-3 gap-2 sm:mx-auto sm:max-w-md">
          <button class="min-h-12 rounded-full bg-accent-ink/10 px-4 text-sm font-medium" on:click={() => adjustRest(-15)} aria-label="Subtract 15 seconds">−15</button>
          <button class="min-h-12 rounded-full bg-accent-ink/10 px-4 text-sm font-medium" on:click={() => adjustRest(15)} aria-label="Add 15 seconds">+15</button>
          <button class="min-h-12 rounded-full bg-ink px-4 text-sm font-medium text-paper" on:click={skipRest}>Skip</button>
        </div>
      </div>
    </section>
  {/if}
</div>

{#if maxEffortMoment}
  {#key maxEffortMoment.id}
    <MaxEffortMoment exerciseName={maxEffortMoment.exerciseName} onComplete={() => { maxEffortMoment = null }} />
  {/key}
{/if}

<FinishWorkoutDialog bind:this={finishDialog} mode={finishMode} routineName={sourceRoutine?.name ?? workout.title} canUpdateTemplate={Boolean(sourceRoutine && !sourceRoutine.deletedAt)} suggestedRoutineName={`${workout.title} routine`} description={finishDescription} initialNotes={workout.notes} highlights={finishHighlights} {strengthHighlights} progressionResults={finishProgressionResults} onConfirm={onFinish} />
<ConfirmDialog bind:this={cancelDialog} eyebrow="Discard session" title="Cancel this workout?" description="The active session and its set data will be discarded. This cannot be undone." confirmLabel="Cancel workout" onConfirm={onCancel} />
<ConfirmDialog bind:this={deleteDialog} title={pendingDelete?.title ?? 'Remove item?'} description={pendingDelete?.description ?? ''} onConfirm={() => pendingDelete?.action()} />

<style>
  .completed-exercise { background: var(--color-success-soft); }
  .set-grid { display: grid; align-items: center; gap: 0.25rem; }
  .set-grid.strength { grid-template-columns: 1.5rem repeat(3, minmax(2.75rem, 1fr)) 2.75rem; }
  .set-grid.duration { grid-template-columns: 1.5rem minmax(5rem, 1fr) 2.75rem; }
  .set-grid.distance-duration { grid-template-columns: 1.5rem repeat(2, minmax(4.5rem, 1fr)) 2.75rem; }
  .set-heading { display: inline-flex; align-items: center; justify-content: center; gap: 0.2rem; }
  @media (min-width: 640px) {
    .set-grid { gap: 0.5rem; }
    .set-grid.strength { grid-template-columns: 2.5rem repeat(3, minmax(4rem, 1fr)) 3rem; }
    .set-grid.duration { grid-template-columns: 2.5rem minmax(6rem, 1fr) 3rem; }
    .set-grid.distance-duration { grid-template-columns: 2.5rem repeat(2, minmax(6rem, 1fr)) 3rem; }
  }
</style>
