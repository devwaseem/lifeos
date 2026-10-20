<script lang="ts">
  import { Plus, X } from '@lucide/svelte'

  export let label: string
  export let value: string[]
  export let placeholder: string
  export let emptyMessage: string
  export let onChange: (value: string[]) => void

  let draft = ''

  function add() {
    const item = draft.trim()
    if (!item || value.some((existing) => existing.toLocaleLowerCase() === item.toLocaleLowerCase())) return
    onChange([...value, item])
    draft = ''
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    add()
  }

  function remove(item: string) {
    onChange(value.filter((existing) => existing !== item))
  }
</script>

<fieldset class="grid gap-3">
  <legend class="text-sm font-medium">{label}</legend>
  <div class="flex gap-2">
    <input class="min-h-12 min-w-0 flex-1 rounded-xl border border-rule bg-canvas px-3 text-base" bind:value={draft} on:keydown={handleKeydown} {placeholder} aria-label={`Add ${label.toLocaleLowerCase()} item`} />
    <button class="grid size-12 shrink-0 place-items-center rounded-xl bg-ink text-paper disabled:bg-panel-deep disabled:text-muted" type="button" on:click={add} disabled={!draft.trim()} aria-label={`Add to ${label.toLocaleLowerCase()}`}><Plus class="size-5" /></button>
  </div>
  {#if value.length > 0}
    <ul class="flex flex-wrap gap-2" aria-label={`${label} list`}>
      {#each value as item (item)}
        <li class="inline-flex min-h-11 items-center gap-1 rounded-full bg-canvas pl-3 text-sm">
          <span>{item}</span>
          <button class="grid size-11 place-items-center rounded-full text-muted hover:text-danger" type="button" on:click={() => remove(item)} aria-label={`Remove ${item} from ${label.toLocaleLowerCase()}`}><X class="size-4" /></button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="text-xs text-muted">{emptyMessage}</p>
  {/if}
</fieldset>
