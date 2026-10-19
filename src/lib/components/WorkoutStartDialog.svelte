<script lang="ts">
  import { ChevronRight, Dumbbell, Layers3, Plus, X } from '@lucide/svelte'
  import { getRoutineMuscleGroups } from '$lib/routines'
  import type { RoutineTemplate } from '$lib/types'

  export let routines: RoutineTemplate[]
  export let onSelectRoutine: (routine: RoutineTemplate) => void
  export let onCustom: () => void
  export let onManageRoutines: () => void

  let dialog: HTMLDialogElement

  export function open() {
    dialog.showModal()
  }

  function chooseRoutine(routine: RoutineTemplate) {
    dialog.close()
    onSelectRoutine(routine)
  }

  function chooseCustom() {
    dialog.close()
    onCustom()
  }

  function manageRoutines() {
    dialog.close()
    onManageRoutines()
  }
</script>

<dialog bind:this={dialog} class="fixed inset-x-0 bottom-0 top-auto z-40 m-0 max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border-0 bg-paper p-0 text-ink backdrop:bg-ink/35 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[min(36rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
  <div class="px-5 pb-5 pt-6 sm:px-6">
    <div class="flex items-start justify-between gap-4">
      <div><p class="font-dot text-xs text-accent">START SESSION</p><h2 class="mt-2 text-2xl font-medium">Choose your workout</h2><p class="mt-2 text-sm leading-6 text-muted">Use a routine template or begin a one-off session.</p></div>
      <button class="grid size-11 shrink-0 place-items-center rounded-full bg-canvas text-muted" on:click={() => dialog.close()} aria-label="Close workout chooser"><X class="size-5" /></button>
    </div>

    {#if routines.length > 0}
      <div class="mt-6 space-y-2">
        {#each routines as routine (routine.id)}
          <button class="flex min-h-16 w-full items-center gap-3 rounded-xl bg-canvas px-4 text-left" on:click={() => chooseRoutine(routine)}>
            <span class="grid size-10 shrink-0 place-items-center rounded-full bg-paper"><Layers3 class="size-4" /></span>
            <span class="min-w-0 flex-1"><span class="block truncate text-sm font-medium">{routine.name}</span><span class="mt-1 block truncate text-xs text-muted">{routine.exercises.length} {routine.exercises.length === 1 ? 'exercise' : 'exercises'} · {getRoutineMuscleGroups(routine)}</span></span>
            <ChevronRight class="size-4 shrink-0 text-muted" />
          </button>
        {/each}
      </div>
    {:else}
      <button class="mt-6 flex min-h-16 w-full items-center gap-3 rounded-xl bg-canvas px-4 text-left" on:click={manageRoutines}>
        <span class="grid size-10 shrink-0 place-items-center rounded-full bg-paper"><Plus class="size-4 text-accent" /></span>
        <span class="min-w-0 flex-1"><span class="block text-sm font-medium">Create your first routine</span><span class="mt-1 block text-xs text-muted">Build a reusable exercise template.</span></span>
        <ChevronRight class="size-4 shrink-0 text-muted" />
      </button>
    {/if}

    <div class="my-5 flex items-center gap-3 text-[0.6875rem] uppercase text-muted"><span class="h-px flex-1 bg-rule"></span>or<span class="h-px flex-1 bg-rule"></span></div>
    <button class="flex min-h-14 w-full items-center justify-between rounded-xl border border-rule px-4 text-left" on:click={chooseCustom}>
      <span class="flex items-center gap-3"><Dumbbell class="size-5" /><span><span class="block text-sm font-medium">Custom workout</span><span class="mt-1 block text-xs text-muted">A one-off session, not linked to a routine.</span></span></span>
      <ChevronRight class="size-4 text-muted" />
    </button>

    {#if routines.length > 0}<button class="mt-3 min-h-11 w-full text-center text-sm font-medium text-muted" on:click={manageRoutines}>Manage routines</button>{/if}
  </div>
</dialog>
