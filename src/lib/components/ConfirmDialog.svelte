<script lang="ts">
  import { Medal } from '@lucide/svelte'

  export let eyebrow = ''
  export let title: string
  export let description: string
  export let confirmLabel = 'Remove'
  export let tone: 'danger' | 'accent' = 'danger'
  export let notesLabel = ''
  export let notesPlaceholder = ''
  export let initialNotes = ''
  export let highlightsLabel = ''
  export let highlights: Array<{ id: string; title: string; description: string }> = []
  export let onConfirm: (notes: string) => void

  let notes = ''
  let dialog: HTMLDialogElement
  export function open() {
    notes = initialNotes
    dialog.showModal()
  }
</script>

<dialog bind:this={dialog} class="fixed inset-x-0 bottom-0 top-auto z-40 m-0 max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border-0 bg-paper p-6 text-ink backdrop:bg-ink/35 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[min(28rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
  {#if eyebrow}<p class="font-dot text-xs text-accent">{eyebrow}</p>{/if}
  <h2 class="mt-2 text-2xl font-medium text-balance">{title}</h2>
  <p class="mt-3 text-sm leading-6 text-muted text-pretty">{description}</p>
  {#if highlights.length > 0}
    <section class="mt-5 rounded-xl bg-canvas p-3" aria-label={highlightsLabel || 'Highlights'}>
      <p class="flex items-center gap-2 text-xs font-medium uppercase"><Medal class="size-4 text-accent" />{highlightsLabel || 'Highlights'}</p>
      <ul class="mt-2 divide-y divide-rule">
        {#each highlights as highlight (highlight.id)}
          <li class="flex items-start gap-3 py-2.5">
            <span class="font-dot grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-xs text-accent">PR</span>
            <span class="min-w-0"><span class="block truncate text-sm font-medium">{highlight.title}</span><span class="mt-0.5 block text-xs text-muted">{highlight.description}</span></span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
  {#if notesLabel}
    <label class="mt-5 block">
      <span class="text-xs font-medium uppercase">{notesLabel}</span>
      <textarea bind:value={notes} class="mt-2 min-h-28 w-full resize-y rounded-xl border-0 bg-canvas p-4 text-base leading-6 outline-none placeholder:text-muted" placeholder={notesPlaceholder} aria-label={notesLabel}></textarea>
    </label>
  {/if}
  <div class="mt-7 grid grid-cols-2 gap-2">
    <button class="min-h-12 rounded-full bg-canvas px-4 text-sm font-medium" on:click={() => dialog.close()}>Cancel</button>
    <button class:bg-danger={tone === 'danger'} class:bg-accent={tone === 'accent'} class="min-h-12 rounded-full px-4 text-sm font-medium text-danger-ink" on:click={() => { onConfirm(notes.trim()); dialog.close() }}>{confirmLabel}</button>
  </div>
</dialog>
