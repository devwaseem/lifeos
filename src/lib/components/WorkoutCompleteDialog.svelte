<script lang="ts">
  import { Check, HeartPulse, X } from '@lucide/svelte'
  import type { WorkoutSession } from '$lib/types'
  import { formatDuration } from '$lib/utils'

  export let workout: WorkoutSession | null = null
  export let canExport = false
  export let error: string | null = null
  export let onExport: (workout: WorkoutSession) => Promise<boolean>

  let dialog: HTMLDialogElement
  let exporting = false

  export function open() {
    exporting = false
    if (!dialog.open) dialog.showModal()
  }

  function close() {
    dialog.close()
  }

  async function exportWorkout() {
    if (!workout || exporting) return
    exporting = true
    const launched = await onExport(workout)
    exporting = false
    if (launched) close()
  }
</script>

<dialog bind:this={dialog} class="fixed inset-x-0 bottom-0 top-auto z-40 m-0 w-full max-w-none rounded-t-2xl border-0 bg-paper p-0 text-ink backdrop:bg-ink/35 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[min(28rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
  <div class="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:pb-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="font-dot text-xs text-accent">WORKOUT SAVED</p>
        <h2 class="mt-2 text-2xl font-medium text-balance">Add it to Apple Health?</h2>
      </div>
      <button class="grid size-11 shrink-0 place-items-center rounded-full bg-canvas text-muted" on:click={close} aria-label="Export later"><X class="size-5" /></button>
    </div>

    {#if workout}
      <div class="mt-5 flex items-center gap-3 rounded-xl bg-canvas p-4">
        <span class="grid size-10 shrink-0 place-items-center rounded-full bg-success-soft text-success"><Check class="size-5" /></span>
        <span class="min-w-0"><span class="block truncate text-sm font-medium">{workout.title}</span><span class="mt-0.5 block text-xs text-muted">{formatDuration(workout.startedAt, workout.completedAt)} · safely stored in LifeOS</span></span>
      </div>
    {/if}

    <p class="mt-5 text-sm leading-6 text-muted text-pretty">Your shortcut will add this session as a Traditional Strength Training workout. Sets, load, and RPE stay in LifeOS.</p>
    {#if error}<p class="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{error}</p>{/if}

    {#if canExport}
      <button class="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-medium text-accent-ink disabled:bg-panel-deep disabled:text-muted" disabled={exporting} on:click={exportWorkout}><HeartPulse class="size-4" />{exporting ? 'Opening Shortcuts…' : 'Add to Apple Health'}</button>
      <button class="mt-2 min-h-11 w-full text-sm font-medium text-muted disabled:text-rule" disabled={exporting} on:click={close}>Not now</button>
    {:else}
      <p class="mt-5 rounded-xl bg-accent-soft px-4 py-3 text-sm leading-6 text-accent">Open this workout on your iPhone or iPad to export it to Apple Health.</p>
      <button class="mt-4 min-h-12 w-full rounded-xl bg-ink px-5 text-sm font-medium text-paper" on:click={close}>Done</button>
    {/if}
  </div>
</dialog>
