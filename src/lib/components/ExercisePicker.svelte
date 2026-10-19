<script lang="ts">
  import { ArrowLeft, Check, Plus, Search, X } from '@lucide/svelte'
  import { tick } from 'svelte'
  import { equipmentOptions, muscleOptions } from '$lib/data/exercise-options'
  import { exerciseLibrary } from '$lib/data/exercises'
  import type { ExerciseDefinition } from '$lib/types'
  import ExerciseEquipmentIcon from './ExerciseEquipmentIcon.svelte'
  import ExerciseForm from './ExerciseForm.svelte'

  export let selectedExerciseIds: string[]
  export let customExercises: ExerciseDefinition[] = []
  export let onSelect: (exercise: ExerciseDefinition) => void
  export let onCreate: (exercise: ExerciseDefinition) => void

  let dialog: HTMLDialogElement
  let searchInput: HTMLInputElement
  let query = ''
  let muscleFilter = ''
  let equipmentFilter = ''
  let creating = false

  $: normalizedQuery = query.trim().toLowerCase()
  $: allExercises = [...exerciseLibrary, ...customExercises]
  $: filteredExercises = allExercises
    .filter((exercise) => !muscleFilter || exercise.muscle === muscleFilter)
    .filter((exercise) => !equipmentFilter || exercise.equipment === equipmentFilter)
    .filter((exercise) => !normalizedQuery
      || exercise.name.toLowerCase().includes(normalizedQuery)
      || exercise.muscle.toLowerCase().includes(normalizedQuery)
      || exercise.equipment.toLowerCase().includes(normalizedQuery))
    .sort((a, b) => a.name.localeCompare(b.name))

  async function openPicker() {
    creating = false
    dialog.showModal()
    await tick()
    searchInput.focus()
  }

  function closePicker() {
    dialog.close()
    query = ''
    muscleFilter = ''
    equipmentFilter = ''
    creating = false
  }

  function createExercise(exercise: ExerciseDefinition) {
    onCreate(exercise)
    onSelect(exercise)
    closePicker()
  }
</script>

<button class="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-paper hover:bg-accent sm:w-auto" on:click={openPicker}>
  <Plus class="size-4" /> Add exercise
</button>

<dialog bind:this={dialog} class="fixed inset-x-0 bottom-0 top-auto z-40 m-0 max-h-[88dvh] w-full max-w-none rounded-t-2xl border-0 bg-paper p-0 text-ink backdrop:bg-ink/35 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[min(36rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
  <div class="px-5 pb-4 pt-6 sm:px-6">
    <div class="flex items-start justify-between gap-4">
      <div class="flex items-start gap-2">
        {#if creating}<button class="grid size-10 place-items-center rounded-full bg-canvas text-muted" on:click={() => { creating = false }} aria-label="Back to exercise library"><ArrowLeft class="size-4" /></button>{/if}
        <div><p class="font-dot text-xs text-accent">{creating ? 'CUSTOM' : 'LIBRARY'}</p><h2 class="mt-2 text-2xl font-medium text-balance">{creating ? 'Create exercise' : 'Add exercise'}</h2></div>
      </div>
      <button class="grid size-11 place-items-center rounded-full bg-canvas text-muted hover:text-ink" on:click={closePicker} aria-label="Close exercise picker"><X class="size-5" /></button>
    </div>

    {#if creating}
      <div class="mt-6"><ExerciseForm onSubmit={createExercise} submitLabel="Create and add" /></div>
    {:else}
      <label class="mt-5 flex min-h-12 items-center gap-3 rounded-xl bg-canvas px-4">
        <Search class="size-4 text-muted" /><span class="sr-only">Search exercises</span>
        <input bind:this={searchInput} bind:value={query} class="w-full bg-transparent text-base outline-none placeholder:text-muted" type="search" placeholder="Search exercises" />
      </label>
      <div class="mt-2 grid grid-cols-2 gap-2">
        <select bind:value={muscleFilter} class="min-h-11 rounded-xl border-0 bg-canvas px-3 text-sm font-medium outline-none" aria-label="Filter exercises by muscle">
          <option value="">All muscles</option>
          {#each muscleOptions as muscle}<option value={muscle}>{muscle}</option>{/each}
        </select>
        <select bind:value={equipmentFilter} class="min-h-11 rounded-xl border-0 bg-canvas px-3 text-sm font-medium outline-none" aria-label="Filter exercises by equipment">
          <option value="">All equipment</option>
          {#each equipmentOptions as equipment}<option value={equipment}>{equipment}</option>{/each}
        </select>
      </div>
      <button class="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-rule text-sm font-medium" on:click={() => { creating = true }}><Plus class="size-4 text-accent" /> Create custom exercise</button>
    {/if}
  </div>

  {#if !creating}
    <div class="max-h-[52dvh] overflow-y-auto px-3 pb-4 sm:max-h-[24rem]">
      {#if filteredExercises.length > 0}
        {#each filteredExercises as exercise (exercise.id)}
          <button class="flex min-h-16 w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-canvas disabled:cursor-default disabled:opacity-45" disabled={selectedExerciseIds.includes(exercise.id)} on:click={() => { onSelect(exercise); closePicker() }}>
            <span class="grid size-10 shrink-0 place-items-center rounded-full bg-canvas"><ExerciseEquipmentIcon equipment={exercise.equipment} muscle={exercise.muscle} className="size-4" /></span>
            <span class="min-w-0 flex-1"><span class="block truncate text-sm font-medium">{exercise.name}</span><span class="mt-1 block text-xs text-muted">{exercise.muscle} · {exercise.equipment}{exercise.custom ? ' · Custom' : ''}</span></span>
            {#if selectedExerciseIds.includes(exercise.id)}<Check class="size-4 shrink-0 text-success" />{:else}<Plus class="size-4 shrink-0 text-accent" />{/if}
          </button>
        {/each}
      {:else}
        <p class="px-3 py-12 text-sm text-muted">No matching exercises.</p>
      {/if}
    </div>
  {/if}
</dialog>
