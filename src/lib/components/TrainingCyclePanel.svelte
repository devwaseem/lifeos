<script lang="ts">
  import { ArrowDown, ArrowUp, Moon, Plus, Repeat2, Trash2, X } from '@lucide/svelte'
  import { tick } from 'svelte'
  import { flip } from 'svelte/animate'
  import { addRestCycleSlot, addRoutineCycleSlot, createTrainingCycle, getCurrentCycleSlot } from '$lib/training-cycle'
  import type { RoutineTemplate, TrainingCycle, TrainingCycleSlot } from '$lib/types'
  import ConfirmDialog from './ConfirmDialog.svelte'

  export let trainingCycle: TrainingCycle | null
  export let routines: RoutineTemplate[]
  export let onSave: (cycle: TrainingCycle) => void
  export let onDelete: (cycle: TrainingCycle) => void

  let editor: HTMLDialogElement
  let deleteDialog: ConfirmDialog
  let draft: TrainingCycle | null = null
  let routineToAdd = ''

  $: activeCycle = trainingCycle && !trainingCycle.deletedAt && trainingCycle.slots.length > 0 ? trainingCycle : null
  $: currentSlot = getCurrentCycleSlot(activeCycle)
  $: currentLabel = currentSlot ? slotLabel(currentSlot) : 'Not configured'

  function slotLabel(slot: TrainingCycleSlot) {
    if (slot.type === 'rest') return 'Rest'
    return routines.find((routine) => routine.id === slot.routineId)?.name ?? 'Missing routine'
  }

  function openCreate() {
    draft = createTrainingCycle()
    routineToAdd = routines[0]?.id ?? ''
    editor.showModal()
  }

  function openEdit() {
    if (!activeCycle) return
    draft = structuredClone(activeCycle)
    routineToAdd = routines[0]?.id ?? ''
    editor.showModal()
  }

  function closeEditor() {
    editor.close()
    draft = null
  }

  function addRoutine() {
    if (!draft || !routineToAdd) return
    draft = { ...draft, slots: [...draft.slots, addRoutineCycleSlot(routineToAdd)] }
  }

  function addRest() {
    if (!draft) return
    draft = { ...draft, slots: [...draft.slots, addRestCycleSlot()] }
  }

  function moveSlot(index: number, direction: -1 | 1) {
    if (!draft) return
    const destination = index + direction
    if (destination < 0 || destination >= draft.slots.length) return
    const currentId = draft.slots[draft.currentIndex]?.id
    const slots = [...draft.slots]
    const [slot] = slots.splice(index, 1)
    slots.splice(destination, 0, slot)
    draft = { ...draft, slots, currentIndex: Math.max(0, slots.findIndex((item) => item.id === currentId)) }
  }

  function removeSlot(slotId: string) {
    if (!draft) return
    const currentId = draft.slots[draft.currentIndex]?.id
    const previousIndex = draft.currentIndex
    const slots = draft.slots.filter((slot) => slot.id !== slotId)
    const retainedCurrentIndex = slots.findIndex((slot) => slot.id === currentId)
    const currentIndex = slots.length === 0
      ? 0
      : retainedCurrentIndex >= 0
        ? retainedCurrentIndex
        : Math.min(previousIndex, slots.length - 1)
    draft = { ...draft, slots, currentIndex }
  }

  function saveDraft() {
    if (!draft || !draft.name.trim() || draft.slots.length === 0) return
    const timestamp = new Date().toISOString()
    const validRoutineIds = new Set(routines.map((routine) => routine.id))
    const slots = draft.slots.filter((slot) => slot.type === 'rest' || validRoutineIds.has(slot.routineId))
    if (slots.length === 0) return
    onSave({
      ...draft,
      name: draft.name.trim(),
      slots,
      currentIndex: Math.min(draft.currentIndex, slots.length - 1),
      updatedAt: timestamp,
      deletedAt: null,
    })
    closeEditor()
  }

  async function askToDelete() {
    if (!activeCycle) return
    await tick()
    deleteDialog.open()
  }
</script>

<section class="mt-7 min-w-0 max-w-full overflow-hidden rounded-2xl bg-ink text-paper" aria-labelledby="training-cycle-heading">
  {#if activeCycle}
    <div class="grid gap-6 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
      <div class="min-w-0">
        <div class="flex items-center gap-2 text-accent"><Repeat2 class="size-4" /><p class="font-dot text-xs">TRAINING CYCLE</p></div>
        <h2 id="training-cycle-heading" class="mt-3 truncate text-2xl font-medium">{activeCycle.name}</h2>
        <div class="mt-6 flex min-w-0 items-end gap-4"><span class="font-dot shrink-0 text-5xl leading-none tabular-nums">{String(activeCycle.currentIndex + 1).padStart(2, '0')}</span><span class="min-w-0 truncate pb-1 text-sm text-panel-deep">of {activeCycle.slots.length} · {currentLabel}</span></div>
      </div>
      <button class="min-h-12 rounded-xl border border-paper/20 px-5 text-sm font-medium" on:click={openEdit}>Edit cycle</button>
    </div>
    <div class="flex max-w-full gap-px overflow-x-auto overscroll-x-contain border-t border-paper/15" aria-label="Cycle sequence">
      {#each activeCycle.slots as slot, index (slot.id)}
        <div class:current-cycle-slot={index === activeCycle.currentIndex} class="min-w-24 flex-1 px-4 py-3">
          <span class="font-dot block text-[0.625rem] text-accent">{String(index + 1).padStart(2, '0')}</span>
          <span class="mt-1 block truncate text-xs">{slotLabel(slot)}</span>
        </div>
      {/each}
    </div>
  {:else}
    <div class="grid gap-6 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
      <div><div class="flex items-center gap-2 text-accent"><Repeat2 class="size-4" /><p class="font-dot text-xs">TRAINING CYCLE</p></div><h2 id="training-cycle-heading" class="mt-3 text-2xl font-medium">Decide what comes next</h2><p class="mt-2 max-w-xl text-sm leading-6 text-panel-deep">Arrange routines and recovery days into one completion-driven rotation. Missed calendar days never move it without you.</p></div>
      <button class="min-h-12 rounded-xl bg-accent px-5 text-sm font-medium text-accent-ink" on:click={openCreate}>Build cycle</button>
    </div>
  {/if}
</section>

<dialog bind:this={editor} class="fixed inset-x-0 bottom-0 top-auto z-40 m-0 max-h-[92dvh] w-full max-w-none overflow-x-hidden overflow-y-auto rounded-t-2xl border-0 bg-paper p-0 text-ink backdrop:bg-ink/35 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[min(40rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
  {#if draft}
    <div class="sticky top-0 z-10 flex min-w-0 items-start justify-between gap-4 border-b border-rule bg-paper px-5 py-5 sm:px-6">
      <div class="min-w-0"><p class="font-dot text-xs text-accent">ROTATION EDITOR</p><h2 class="mt-2 truncate text-2xl font-medium">{activeCycle ? 'Edit cycle' : 'Build cycle'}</h2></div>
      <button class="grid size-11 shrink-0 place-items-center rounded-full bg-canvas text-muted" on:click={closeEditor} aria-label="Close cycle editor"><X class="size-5" /></button>
    </div>

    <div class="min-w-0 px-5 py-5 sm:px-6">
      <label class="block"><span class="text-xs font-medium uppercase text-muted">Cycle name</span><input bind:value={draft.name} class="mt-2 min-h-12 w-full rounded-xl border-0 bg-canvas px-4 text-base outline-none" aria-label="Cycle name" /></label>

      <div class="mt-7 flex items-end justify-between gap-4"><div><h3 class="text-sm font-medium">Sequence</h3><p class="mt-1 text-xs text-muted">The highlighted slot is next.</p></div><span class="font-dot text-xl">{draft.slots.length}</span></div>
      {#if draft.slots.length > 0}
        <div class="mt-3 space-y-2">
          {#each draft.slots as slot, index (slot.id)}
            <div animate:flip={{ duration: 180 }} class:active-draft-slot={index === draft.currentIndex} class="grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-xl bg-canvas p-2">
              <button class="font-dot grid size-10 place-items-center rounded-full text-xs" class:current-index={index === draft.currentIndex} on:click={() => { if (draft) draft = { ...draft, currentIndex: index } }} aria-label={`Set ${slotLabel(slot)} as current slot`}>{String(index + 1).padStart(2, '0')}</button>
              <div class="min-w-0"><p class="truncate text-sm font-medium">{slotLabel(slot)}</p><p class="mt-0.5 text-[0.6875rem] uppercase text-muted">{slot.type === 'rest' ? 'Recovery' : index === draft.currentIndex ? 'Current' : 'Routine'}</p></div>
              <div class="flex shrink-0"><button class="grid size-10 place-items-center rounded-full text-muted disabled:opacity-25" disabled={index === 0} on:click={() => moveSlot(index, -1)} aria-label={`Move ${slotLabel(slot)} up`}><ArrowUp class="size-4" /></button><button class="grid size-10 place-items-center rounded-full text-muted disabled:opacity-25" disabled={index === draft.slots.length - 1} on:click={() => moveSlot(index, 1)} aria-label={`Move ${slotLabel(slot)} down`}><ArrowDown class="size-4" /></button><button class="grid size-10 place-items-center rounded-full text-danger" on:click={() => removeSlot(slot.id)} aria-label={`Remove ${slotLabel(slot)}`}><Trash2 class="size-4" /></button></div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="mt-3 rounded-xl bg-canvas px-4 py-6 text-sm leading-6 text-muted">Add a routine or recovery day to begin the rotation.</p>
      {/if}

      <div class="mt-5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div class="grid grid-cols-[minmax(0,1fr)_auto] rounded-xl bg-canvas p-1">
          <label class="min-w-0"><span class="sr-only">Routine to add</span><select bind:value={routineToAdd} class="min-h-11 w-full bg-transparent px-3 text-sm outline-none" aria-label="Routine to add"><option value="" disabled>Select routine</option>{#each routines as routine (routine.id)}<option value={routine.id}>{routine.name}</option>{/each}</select></label>
          <button class="flex min-h-11 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-paper disabled:opacity-40" disabled={!routineToAdd} on:click={addRoutine}><Plus class="size-4" /> Add</button>
        </div>
        <button class="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-panel px-4 text-sm font-medium" on:click={addRest}><Moon class="size-4" /> Add rest</button>
      </div>

      <button class="mt-7 min-h-12 w-full rounded-xl bg-accent px-5 text-sm font-medium text-accent-ink disabled:bg-panel disabled:text-muted" disabled={!draft.name.trim() || draft.slots.length === 0} on:click={saveDraft}>Save training cycle</button>
      {#if activeCycle}<button class="mt-3 min-h-11 w-full text-sm font-medium text-danger" on:click={askToDelete}>Disable training cycle</button>{/if}
    </div>
  {/if}
</dialog>

<ConfirmDialog bind:this={deleteDialog} eyebrow="Training cycle" title="Disable this cycle?" description="Your routines and workout history stay intact. Today returns to manual routine selection." confirmLabel="Disable cycle" onConfirm={() => { if (activeCycle) { onDelete(activeCycle); closeEditor() } }} />

<style>
  .current-cycle-slot { background: var(--color-accent); color: var(--color-accent-ink); }
  .current-cycle-slot .text-accent { color: currentColor; }
  .active-draft-slot { box-shadow: inset 0 0 0 1px var(--color-ink); }
  .current-index { background: var(--color-ink); color: var(--color-paper); }
  @media (prefers-reduced-motion: reduce) { :global(.cycle-slot) { transition: none; } }
</style>
