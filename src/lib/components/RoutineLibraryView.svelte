<script lang="ts">
  import { ArrowDown, ArrowLeft, ArrowUp, ChevronRight, Dumbbell, Pencil, Play, Plus, Trash2, X } from '@lucide/svelte'
  import { tick } from 'svelte'
  import type { AiSettings } from '$lib/ai-coach'
  import type { EquipmentSettings, ExerciseDefinition, ProgressionRule, RoutineExercise, RoutineTemplate, TrainingCycle, TrainingProfile, WorkoutSession } from '$lib/types'
  import { createRoutineExercise, getRoutineMuscleGroups } from '$lib/routines'
  import { supportsProgression } from '$lib/progression'
  import { getEquipmentWeightOptions } from '$lib/equipment-settings'
  import { newId } from '$lib/utils'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import ContextualAiInsight from './ContextualAiInsight.svelte'
  import ExercisePicker from './ExercisePicker.svelte'
  import TrainingCyclePanel from './TrainingCyclePanel.svelte'

  export let routines: RoutineTemplate[]
  export let trainingCycle: TrainingCycle | null
  export let customExercises: ExerciseDefinition[]
  export let activeWorkout: WorkoutSession | undefined
  export let onBack: () => void
  export let onSave: (routine: RoutineTemplate) => void
  export let onDelete: (routine: RoutineTemplate) => void
  export let onStart: (routine: RoutineTemplate) => void
  export let onCreateExercise: (exercise: ExerciseDefinition) => void
  export let onSaveCycle: (cycle: TrainingCycle) => void
  export let onDeleteCycle: (cycle: TrainingCycle) => void
  export let workouts: WorkoutSession[]
  export let exercises: ExerciseDefinition[]
  export let trainingProfile: TrainingProfile | null
  export let aiSettings: AiSettings
  export let online: boolean
  export let equipmentSettings: EquipmentSettings | null

  let editor: HTMLDialogElement
  let deleteDialog: ConfirmDialog
  let draft: RoutineTemplate | null = null
  let pendingDelete: RoutineTemplate | null = null

  function progressionLoadSummary(rule: ProgressionRule, equipment: string) {
    const rackSize = getEquipmentWeightOptions(equipmentSettings, equipment).length
    if (rackSize > 0) return `${equipment} rack · ${rackSize} loads`
    return rule.weightIncrement === null ? 'manual load' : `+${rule.weightIncrement}kg`
  }

  function newDraft(): RoutineTemplate {
    const timestamp = new Date().toISOString()
    return {
      id: newId(),
      name: '',
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      exercises: [],
    }
  }

  function openCreate() {
    draft = newDraft()
    editor.showModal()
  }

  function openEdit(routine: RoutineTemplate) {
    draft = structuredClone(routine)
    editor.showModal()
  }

  function closeEditor() {
    editor.close()
    draft = null
  }

  function saveDraft() {
    if (!draft || !draft.name.trim() || draft.exercises.length === 0) return
    onSave({ ...draft, name: draft.name.trim(), updatedAt: new Date().toISOString(), deletedAt: null })
    closeEditor()
  }

  function addExercise(exercise: ExerciseDefinition) {
    if (!draft || draft.exercises.some((item) => item.exerciseId === exercise.id)) return
    draft = { ...draft, exercises: [...draft.exercises, createRoutineExercise(exercise)] }
  }

  function updateExercise(exerciseId: string, changes: Partial<RoutineExercise>) {
    if (!draft) return
    draft = {
      ...draft,
      exercises: draft.exercises.map((exercise) => exercise.id === exerciseId ? { ...exercise, ...changes } : exercise),
    }
  }

  function updateProgression(exerciseId: string, changes: Partial<ProgressionRule>) {
    if (!draft) return
    draft = {
      ...draft,
      exercises: draft.exercises.map((exercise) => exercise.id === exerciseId
        ? { ...exercise, progression: { ...exercise.progression, ...changes } }
        : exercise),
    }
  }


  function moveExercise(index: number, direction: -1 | 1) {
    if (!draft) return
    const destination = index + direction
    if (destination < 0 || destination >= draft.exercises.length) return
    const exercises = [...draft.exercises]
    const [exercise] = exercises.splice(index, 1)
    exercises.splice(destination, 0, exercise)
    draft = { ...draft, exercises }
  }

  function removeExercise(exerciseId: string) {
    if (!draft) return
    draft = { ...draft, exercises: draft.exercises.filter((exercise) => exercise.id !== exerciseId) }
  }

  async function askToDelete(routine: RoutineTemplate) {
    pendingDelete = routine
    await tick()
    deleteDialog.open()
  }
</script>

<div class="mx-auto min-w-0 w-full max-w-6xl px-5 py-6 sm:px-6 lg:px-8 lg:py-7">
  <header class="flex min-w-0 items-start justify-between gap-4">
    <div class="flex min-w-0 items-start gap-3">
      <button class="grid size-11 shrink-0 place-items-center rounded-full border border-ink" on:click={onBack} aria-label="Back to More"><ArrowLeft class="size-5" /></button>
      <div class="min-w-0"><p class="font-dot text-xs text-accent">PROGRAM INDEX</p><h1 class="mt-2 text-2xl font-medium">Routines</h1><p class="mt-1 text-sm text-muted">Reusable workout structures for the sessions you repeat.</p></div>
    </div>
    <button class="grid size-11 shrink-0 place-items-center rounded-full border border-ink" on:click={openCreate} aria-label="Create routine"><Plus class="size-5" /></button>
  </header>

  <TrainingCyclePanel {trainingCycle} {routines} onSave={onSaveCycle} onDelete={onDeleteCycle} />

  {#if routines.length > 0}
    <div class="mt-7 grid min-w-0 gap-3 md:grid-cols-2">
      {#each routines as routine (routine.id)}
        <article class="min-w-0 rounded-2xl bg-paper p-4 sm:p-5">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0"><p class="font-dot text-xs text-accent">{routine.exercises.length} {routine.exercises.length === 1 ? 'EXERCISE' : 'EXERCISES'}</p><h2 class="mt-2 truncate text-xl font-medium">{routine.name}</h2><p class="mt-2 truncate text-sm leading-5 text-muted">{getRoutineMuscleGroups(routine)}</p></div>
            <button class="grid size-11 shrink-0 place-items-center rounded-full bg-canvas text-muted hover:text-ink" on:click={() => openEdit(routine)} aria-label={`Edit ${routine.name}`}><Pencil class="size-4" /></button>
          </div>
          <div class="mt-6 grid grid-cols-[1fr_auto] gap-2">
            <button class="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-paper disabled:bg-panel-deep disabled:text-muted" disabled={Boolean(activeWorkout)} on:click={() => onStart(routine)}><Play class="size-4" />{activeWorkout ? 'Workout active' : 'Start routine'}</button>
            <button class="grid size-12 place-items-center rounded-xl bg-danger-soft text-danger" on:click={() => askToDelete(routine)} aria-label={`Delete ${routine.name}`}><Trash2 class="size-4" /></button>
          </div>
          <div class="mt-2">
            <ContextualAiInsight
              kind="routine-review"
              subjectId={routine.id}
              title={`Review ${routine.name}`}
              description="Check this routine’s exercise selection and set distribution against your profile and logged trends."
              actionLabel="Review routine with AI"
              {workouts}
              {routines}
              {exercises}
              {trainingProfile}
              {aiSettings}
              {online}
              collapsible={true}
              initiallyOpen={false}
            />
          </div>
        </article>
      {/each}
    </div>
  {:else}
    <section class="mt-8 rounded-2xl bg-paper p-6 sm:p-8">
      <span class="grid size-12 place-items-center rounded-full bg-canvas"><Dumbbell class="size-5" /></span>
      <h2 class="mt-6 text-xl font-medium">Build your first routine</h2>
      <p class="mt-2 max-w-md text-sm leading-6 text-muted">Name it Push, Pull, Legs—or anything that matches how you train—then arrange its exercises and default set counts.</p>
      <button class="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-medium text-paper sm:w-auto" on:click={openCreate}><Plus class="size-4" /> Create routine</button>
    </section>
  {/if}
</div>

<dialog bind:this={editor} class="fixed inset-x-0 bottom-0 top-auto z-40 m-0 max-h-[92dvh] w-full max-w-none overflow-x-hidden overflow-y-auto rounded-t-2xl border-0 bg-paper p-0 text-ink backdrop:bg-ink/35 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[min(44rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
  {#if draft}
    <div class="sticky top-0 z-10 flex min-w-0 items-start justify-between gap-4 border-b border-rule bg-paper px-5 py-5 sm:px-6">
      <div class="min-w-0"><p class="font-dot text-xs text-accent">ROUTINE TEMPLATE</p><h2 class="mt-2 truncate text-2xl font-medium">{routines.some((routine) => routine.id === draft?.id) ? 'Edit routine' : 'Create routine'}</h2></div>
      <button class="grid size-11 shrink-0 place-items-center rounded-full bg-canvas text-muted" on:click={closeEditor} aria-label="Close routine editor"><X class="size-5" /></button>
    </div>

    <div class="min-w-0 px-5 py-5 sm:px-6">
      <label class="block"><span class="text-xs font-medium uppercase text-muted">Routine name</span><input bind:value={draft.name} class="mt-2 min-h-12 w-full rounded-xl border-0 bg-canvas px-4 text-base outline-none placeholder:text-muted" placeholder="Push, Pull, Legs…" aria-label="Routine name" /></label>

      <div class="mt-7 flex items-center justify-between"><div><p class="text-sm font-medium">Exercises</p><p class="mt-1 text-xs text-muted">Order and defaults used when starting this routine.</p></div><span class="font-dot text-xl">{draft.exercises.length}</span></div>

      {#if draft.exercises.length > 0}
        <div class="mt-3 space-y-2">
          {#each draft.exercises as exercise, index (exercise.id)}
            <section class="rounded-xl bg-canvas p-3">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0"><p class="truncate text-sm font-medium">{exercise.name}</p><p class="mt-1 text-xs text-muted">{exercise.muscle} · {exercise.equipment}</p></div>
                <div class="flex shrink-0">
                  <button class="grid size-10 place-items-center rounded-full text-muted disabled:opacity-25" disabled={index === 0} on:click={() => moveExercise(index, -1)} aria-label={`Move ${exercise.name} up`}><ArrowUp class="size-4" /></button>
                  <button class="grid size-10 place-items-center rounded-full text-muted disabled:opacity-25" disabled={index === draft.exercises.length - 1} on:click={() => moveExercise(index, 1)} aria-label={`Move ${exercise.name} down`}><ArrowDown class="size-4" /></button>
                  <button class="grid size-10 place-items-center rounded-full text-danger" on:click={() => removeExercise(exercise.id)} aria-label={`Remove ${exercise.name}`}><Trash2 class="size-4" /></button>
                </div>
              </div>
              <div class="mt-3 grid grid-cols-[minmax(0,1fr)_8rem] gap-2">
                <label class="rounded-xl bg-paper px-3 py-2"><span class="text-[0.6875rem] font-medium uppercase text-muted">Rest timer</span><select class="mt-1 w-full bg-transparent text-sm font-medium outline-none" value={exercise.restSeconds} on:change={(event) => updateExercise(exercise.id, { restSeconds: Number(event.currentTarget.value) })}><option value={0}>Off</option><option value={30}>30 seconds</option><option value={60}>1 minute</option><option value={90}>1:30 minutes</option><option value={120}>2 minutes</option><option value={180}>3 minutes</option><option value={300}>5 minutes</option></select></label>
                <div class="rounded-xl bg-paper px-2 py-2"><span class="block text-center text-[0.6875rem] font-medium uppercase text-muted">Sets</span><div class="mt-1 grid grid-cols-3 items-center"><button class="grid size-8 place-items-center rounded-full text-lg" disabled={exercise.setCount <= 1} on:click={() => updateExercise(exercise.id, { setCount: Math.max(1, exercise.setCount - 1) })} aria-label={`Remove a set from ${exercise.name}`}>−</button><span class="font-dot text-center text-lg">{exercise.setCount}</span><button class="grid size-8 place-items-center rounded-full text-lg" disabled={exercise.setCount >= 20} on:click={() => updateExercise(exercise.id, { setCount: Math.min(20, exercise.setCount + 1) })} aria-label={`Add a set to ${exercise.name}`}>+</button></div></div>
                <button
                  type="button"
                  class={`col-span-2 flex min-h-12 items-center gap-3 rounded-xl px-3 text-left ${exercise.hasWarmupSet ? 'bg-accent-soft text-accent' : 'bg-paper text-muted'}`}
                  role="switch"
                  aria-checked={exercise.hasWarmupSet}
                  on:click={() => updateExercise(exercise.id, { hasWarmupSet: !exercise.hasWarmupSet })}
                >
                  <span class="font-dot grid size-8 shrink-0 place-items-center rounded-full bg-canvas text-sm">W</span>
                  <span><span class="block text-xs font-medium">Warmup set</span><span class="mt-0.5 block text-[0.6875rem] opacity-75">{exercise.hasWarmupSet ? 'Included before working sets' : 'Optional · not counted as a working set'}</span></span>
                </button>
              </div>
              <label class="mt-2 block rounded-xl bg-paper px-3 py-2"><span class="text-[0.6875rem] font-medium uppercase text-muted">Routine note</span><input class="mt-1 w-full bg-transparent text-sm outline-none placeholder:text-muted" value={exercise.notes} on:input={(event) => updateExercise(exercise.id, { notes: event.currentTarget.value })} placeholder="Setup or coaching cue" aria-label={`${exercise.name} routine note`} /></label>
              {#if supportsProgression(exercise)}
                <details class="mt-2 rounded-xl bg-paper">
                  <summary class="flex min-h-11 items-center justify-between gap-3 px-3 text-sm font-medium">
                    <span>First-set progression</span>
                    <span class="min-w-0 truncate text-right text-xs font-normal text-muted">{exercise.progression.minReps}–{exercise.progression.maxReps} reps · {progressionLoadSummary(exercise.progression, exercise.equipment)}</span>
                  </summary>
                  <div class="border-t border-rule p-3">
                    <p class="mb-3 text-xs leading-5 text-muted">Sets the target for the first working set. Later sets remain fatigue context.</p>
                    <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <label><span class="block text-[0.625rem] font-medium uppercase text-muted">Min reps</span><input class="mt-1 min-h-10 w-full rounded-xl bg-canvas px-3 text-sm outline-none" type="number" min="1" max="30" value={exercise.progression.minReps} on:change={(event) => { const minReps = Math.max(1, Number(event.currentTarget.value)); updateProgression(exercise.id, { minReps, maxReps: Math.max(minReps, exercise.progression.maxReps) }) }} /></label>
                      <label><span class="block text-[0.625rem] font-medium uppercase text-muted">Max reps</span><input class="mt-1 min-h-10 w-full rounded-xl bg-canvas px-3 text-sm outline-none" type="number" min={exercise.progression.minReps} max="50" value={exercise.progression.maxReps} on:change={(event) => updateProgression(exercise.id, { maxReps: Math.max(exercise.progression.minReps, Number(event.currentTarget.value)) })} /></label>
                      <label class="col-span-2 sm:col-span-1"><span class="block text-[0.625rem] font-medium uppercase text-muted">Fixed load step</span><select class="mt-1 min-h-10 w-full rounded-xl bg-canvas px-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-45" value={exercise.progression.weightIncrement ?? 0} disabled={getEquipmentWeightOptions(equipmentSettings, exercise.equipment).length > 0} on:change={(event) => { const value = Number(event.currentTarget.value); updateProgression(exercise.id, { weightIncrement: value > 0 ? value : null }) }}><option value={0}>Manual</option><option value={1}>1 kg</option><option value={1.25}>1.25 kg</option><option value={2}>2 kg</option><option value={2.5}>2.5 kg</option><option value={5}>5 kg</option></select></label>
                    </div>
                    {#if getEquipmentWeightOptions(equipmentSettings, exercise.equipment).length > 0}
                      <p class="mt-2 text-xs leading-5 text-muted">Uses the exact {exercise.equipment} rack from Equipment settings. Clear that rack to use this fixed step.</p>
                    {:else}
                      <p class="mt-2 text-xs leading-5 text-muted">No {exercise.equipment} rack is configured, so this fixed step is used.</p>
                    {/if}
                  </div>
                </details>
              {/if}
            </section>
          {/each}
        </div>
      {:else}
        <p class="mt-3 rounded-xl bg-canvas px-4 py-6 text-sm text-muted">Add at least one exercise to save this routine.</p>
      {/if}

      <div class="mt-3"><ExercisePicker selectedExerciseIds={draft.exercises.map((exercise) => exercise.exerciseId)} {customExercises} onSelect={addExercise} onCreate={onCreateExercise} /></div>

      <button class="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-medium text-accent-ink disabled:bg-panel disabled:text-muted" disabled={!draft.name.trim() || draft.exercises.length === 0} on:click={saveDraft}>Save routine <ChevronRight class="size-4" /></button>
    </div>
  {/if}
</dialog>

<ConfirmDialog bind:this={deleteDialog} eyebrow="Routine template" title={`Delete ${pendingDelete?.name ?? 'routine'}?`} description="Existing workout history is kept. This routine will no longer appear when starting a workout." confirmLabel="Delete routine" onConfirm={() => { if (pendingDelete) onDelete(pendingDelete) }} />
