<script lang="ts">
  import { ArrowLeft, ChevronRight, Plus, Search, X } from '@lucide/svelte'
  import { equipmentOptions, muscleOptions } from '$lib/data/exercise-options'
  import { exerciseLibrary } from '$lib/data/exercises'
  import type { ExerciseDefinition } from '$lib/types'
  import ExerciseEquipmentIcon from './ExerciseEquipmentIcon.svelte'
  import ExerciseForm from './ExerciseForm.svelte'

  export let customExercises: ExerciseDefinition[]
  export let onBack: () => void
  export let onCreate: (exercise: ExerciseDefinition) => void
  export let onOpenExercise: (exerciseId: string, exerciseName: string) => void

  let query = ''
  let muscleFilter = ''
  let equipmentFilter = ''
  let creator: HTMLDialogElement

  $: normalizedQuery = query.trim().toLowerCase()
  $: allExercises = [...customExercises, ...exerciseLibrary]
  $: exercises = allExercises
    .filter((exercise) => !muscleFilter || exercise.muscle === muscleFilter)
    .filter((exercise) => !equipmentFilter || exercise.equipment === equipmentFilter)
    .filter((exercise) => !normalizedQuery
      || exercise.name.toLowerCase().includes(normalizedQuery)
      || exercise.muscle.toLowerCase().includes(normalizedQuery)
      || exercise.equipment.toLowerCase().includes(normalizedQuery))
    .sort((a, b) => a.name.localeCompare(b.name))

  function createExercise(exercise: ExerciseDefinition) {
    onCreate(exercise)
    creator.close()
  }
</script>

<div class="mx-auto w-full max-w-6xl px-5 py-6 sm:px-6 lg:px-8 lg:py-7">
  <header class="flex items-start justify-between gap-4">
    <div class="flex min-w-0 items-start gap-3">
      <button class="grid size-11 shrink-0 place-items-center rounded-full border border-ink" on:click={onBack} aria-label="Back to More"><ArrowLeft class="size-5" /></button>
      <div class="min-w-0"><p class="font-dot text-xs text-accent">MOVEMENT INDEX</p><h1 class="mt-2 text-2xl font-medium">Exercises</h1><p class="mt-1 text-sm text-muted">Browse the library or define your own movement.</p></div>
    </div>
    <button class="grid size-11 shrink-0 place-items-center rounded-full border border-ink" on:click={() => creator.showModal()} aria-label="Create exercise"><Plus class="size-5" /></button>
  </header>

  <label class="mt-7 flex min-h-12 items-center gap-3 rounded-xl bg-paper px-4">
    <Search class="size-4 text-muted" /><span class="sr-only">Search all exercises</span><input bind:value={query} class="w-full bg-transparent text-base outline-none placeholder:text-muted" type="search" placeholder="Search name, muscle, or equipment" />
  </label>

  <div class="mt-2 grid grid-cols-2 gap-2">
    <label class="rounded-xl bg-paper px-3 py-2">
      <span class="text-[0.6875rem] font-medium uppercase text-muted">Muscle</span>
      <select bind:value={muscleFilter} class="mt-0.5 w-full bg-transparent text-sm font-medium outline-none" aria-label="Filter exercises by muscle">
        <option value="">All muscles</option>
        {#each muscleOptions as muscle}<option value={muscle}>{muscle}</option>{/each}
      </select>
    </label>
    <label class="rounded-xl bg-paper px-3 py-2">
      <span class="text-[0.6875rem] font-medium uppercase text-muted">Equipment</span>
      <select bind:value={equipmentFilter} class="mt-0.5 w-full bg-transparent text-sm font-medium outline-none" aria-label="Filter exercises by equipment">
        <option value="">All equipment</option>
        {#each equipmentOptions as equipment}<option value={equipment}>{equipment}</option>{/each}
      </select>
    </label>
  </div>

  <div class="mt-5 flex items-center justify-between text-xs text-muted"><span>{exercises.length} of {allExercises.length} exercises</span><span>{customExercises.length} custom</span></div>

  {#if exercises.length > 0}
    <div class="mt-3 divide-y divide-rule border-y border-rule">
      {#each exercises as exercise (exercise.id)}
        <button type="button" class="flex min-h-20 w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-paper active:bg-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink" on:click={() => onOpenExercise(exercise.id, exercise.name)} aria-label={`Open ${exercise.name}`}>
          <span class:custom-mark={exercise.custom} class="grid size-11 shrink-0 place-items-center rounded-full bg-paper"><ExerciseEquipmentIcon equipment={exercise.equipment} muscle={exercise.muscle} /></span>
          <span class="min-w-0 flex-1"><span class="flex items-center gap-2"><span class="truncate font-medium">{exercise.name}</span>{#if exercise.custom}<span class="rounded-full bg-accent-soft px-2 py-0.5 text-[0.625rem] font-medium uppercase text-accent">Custom</span>{/if}</span><span class="mt-1 block text-xs text-muted">{exercise.muscle} · {exercise.equipment}</span></span>
          <ChevronRight class="size-4 shrink-0 text-muted" />
        </button>
      {/each}
    </div>
  {:else}
    <div class="mt-8 rounded-2xl bg-paper p-6"><p class="font-medium">No matching exercises</p><p class="mt-2 text-sm text-muted">Try another name, muscle, or equipment type.</p></div>
  {/if}
</div>

<dialog bind:this={creator} class="fixed inset-x-0 bottom-0 top-auto z-40 m-0 max-h-[88dvh] w-full max-w-none rounded-t-2xl border-0 bg-paper p-0 text-ink backdrop:bg-ink/35 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[min(34rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
  <div class="p-5 sm:p-6">
    <div class="flex items-start justify-between gap-4"><div><p class="font-dot text-xs text-accent">CUSTOM</p><h2 class="mt-2 text-2xl font-medium">Create exercise</h2></div><button class="grid size-11 place-items-center rounded-full bg-canvas text-muted" on:click={() => creator.close()} aria-label="Close exercise creator"><X class="size-5" /></button></div>
    <div class="mt-6"><ExerciseForm onSubmit={createExercise} /></div>
  </div>
</dialog>

<style>
  .custom-mark { background: var(--color-accent); color: var(--color-accent-ink); }
</style>
