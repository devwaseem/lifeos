<script lang="ts">
  import { X } from '@lucide/svelte'
  import type { WorkoutCheckIn } from '$lib/types'

  export let onSubmit: (checkIn: WorkoutCheckIn) => void
  export let onCancel: () => void

  let dialog: HTMLDialogElement
  let sleepQuality = 3
  let energy = 3
  let soreness = 3
  let stress = 3
  let motivation = 3
  let painPresent = false
  let illnessPresent = false
  let notes = ''

  const ratings = [1, 2, 3, 4, 5]

  export function open() {
    sleepQuality = 3
    energy = 3
    soreness = 3
    stress = 3
    motivation = 3
    painPresent = false
    illnessPresent = false
    notes = ''
    dialog.showModal()
  }

  function cancel() {
    dialog.close()
    onCancel()
  }

  function submit() {
    const checkIn: WorkoutCheckIn = {
      recordedAt: new Date().toISOString(),
      sleepQuality,
      energy,
      soreness,
      stress,
      motivation,
      painPresent,
      illnessPresent,
      notes: notes.trim(),
    }
    dialog.close()
    onSubmit(checkIn)
  }
</script>

<dialog bind:this={dialog} on:cancel={onCancel} class="fixed inset-x-0 bottom-0 top-auto z-40 m-0 max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border-0 bg-paper p-0 text-ink backdrop:bg-ink/35 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[min(42rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
  <form class="p-5 sm:p-6" on:submit|preventDefault={submit}>
    <header class="flex items-start justify-between gap-4">
      <div class="max-w-xl">
        <p class="font-dot text-xs text-accent">BEFORE YOU TRAIN</p>
        <h2 class="mt-2 text-2xl font-medium text-balance">How are you arriving?</h2>
        <p class="mt-2 text-sm leading-6 text-muted text-pretty">This check-in is stored with the workout so later analysis can separate how you felt from modeled training signals.</p>
      </div>
      <button class="grid size-11 shrink-0 place-items-center rounded-full bg-canvas text-muted" type="button" on:click={cancel} aria-label="Cancel workout check-in"><X class="size-5" /></button>
    </header>

    <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <label class="grid gap-2 text-sm font-medium">Sleep quality
        <select class="min-h-12 rounded-xl border border-rule bg-canvas px-3 text-base tabular-nums" bind:value={sleepQuality}>{#each ratings as rating}<option value={rating}>{rating} / 5</option>{/each}</select>
      </label>
      <label class="grid gap-2 text-sm font-medium">Energy
        <select class="min-h-12 rounded-xl border border-rule bg-canvas px-3 text-base tabular-nums" bind:value={energy}>{#each ratings as rating}<option value={rating}>{rating} / 5</option>{/each}</select>
      </label>
      <label class="grid gap-2 text-sm font-medium">Soreness
        <select class="min-h-12 rounded-xl border border-rule bg-canvas px-3 text-base tabular-nums" bind:value={soreness}>{#each ratings as rating}<option value={rating}>{rating} / 5</option>{/each}</select>
      </label>
      <label class="grid gap-2 text-sm font-medium">Stress
        <select class="min-h-12 rounded-xl border border-rule bg-canvas px-3 text-base tabular-nums" bind:value={stress}>{#each ratings as rating}<option value={rating}>{rating} / 5</option>{/each}</select>
      </label>
      <label class="grid gap-2 text-sm font-medium">Motivation
        <select class="min-h-12 rounded-xl border border-rule bg-canvas px-3 text-base tabular-nums" bind:value={motivation}>{#each ratings as rating}<option value={rating}>{rating} / 5</option>{/each}</select>
      </label>
    </div>

    <fieldset class="mt-5 grid gap-3 sm:grid-cols-2">
      <legend class="sr-only">Current health context</legend>
      <label class="flex min-h-12 items-center gap-3 rounded-xl bg-canvas px-4 text-sm font-medium"><input class="size-5 accent-current" type="checkbox" bind:checked={painPresent} />Pain is present</label>
      <label class="flex min-h-12 items-center gap-3 rounded-xl bg-canvas px-4 text-sm font-medium"><input class="size-5 accent-current" type="checkbox" bind:checked={illnessPresent} />Illness is present</label>
    </fieldset>
    {#if painPresent || illnessPresent}
      <p class="mt-3 rounded-xl bg-danger-soft px-4 py-3 text-sm leading-6 text-danger">Record this context accurately and use your judgment about training. LifeOS does not provide medical clearance.</p>
    {/if}

    <label class="mt-5 grid gap-2 text-sm font-medium">Optional context
      <textarea class="min-h-24 resize-y rounded-xl border border-rule bg-canvas px-3 py-3 text-base leading-6" bind:value={notes} maxlength="2000" placeholder="Anything affecting this workout"></textarea>
    </label>

    <div class="mt-7 grid grid-cols-2 gap-2">
      <button class="min-h-12 rounded-full bg-canvas px-4 text-sm font-medium" type="button" on:click={cancel}>Cancel</button>
      <button class="min-h-12 rounded-full bg-accent px-4 text-sm font-medium text-accent-ink" type="submit">Start workout</button>
    </div>
  </form>
</dialog>
