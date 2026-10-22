<script lang="ts">
  import { ArrowLeft, Plus, X } from '@lucide/svelte'
  import { equipmentOptions } from '$lib/data/exercise-options'
  import { normalizeEquipmentSettings } from '$lib/equipment-settings'
  import { parseWeightOptionsInput } from '$lib/progression'
  import type { EquipmentSettings } from '$lib/types'
  import ExerciseEquipmentIcon from './ExerciseEquipmentIcon.svelte'

  export let settings: EquipmentSettings | null
  export let onBack: () => void
  export let onSave: (settings: EquipmentSettings) => void

  let inputs: Record<string, string> = Object.fromEntries(equipmentOptions.map((equipment) => [equipment, '']))
  let weightOptionsByEquipment: Record<string, number[]> = structuredClone(settings?.weightOptionsByEquipment ?? {})
  let errors: Record<string, string> = {}
  let saved = false

  $: configuredCount = Object.values(weightOptionsByEquipment).filter((weights) => weights.length > 0).length
  $: hasErrors = Object.keys(errors).length > 0

  function inputId(equipment: string) {
    return `equipment-rack-${equipment.toLowerCase().replaceAll(' ', '-')}`
  }

  function updateInput(equipment: string, value: string) {
    inputs = { ...inputs, [equipment]: value }
    saved = false
    if (!errors[equipment]) return
    const nextErrors = { ...errors }
    delete nextErrors[equipment]
    errors = nextErrors
  }

  function parseRackAddition(equipment: string, value: string, racks = weightOptionsByEquipment) {
    return parseWeightOptionsInput([
      ...(racks[equipment] ?? []).map(String),
      value,
    ].join(', '))
  }

  function addWeights(equipment: string) {
    const value = inputs[equipment].trim()
    if (!value) {
      errors = { ...errors, [equipment]: 'Enter a weight in kilograms.' }
      return
    }
    const result = parseRackAddition(equipment, value)
    if (result.error) {
      errors = { ...errors, [equipment]: result.error }
      return
    }
    const nextErrors = { ...errors }
    delete nextErrors[equipment]
    errors = nextErrors
    weightOptionsByEquipment = { ...weightOptionsByEquipment, [equipment]: result.weightOptions }
    inputs = { ...inputs, [equipment]: '' }
    saved = false
  }

  function removeWeight(equipment: string, weight: number) {
    const remainingWeights = (weightOptionsByEquipment[equipment] ?? []).filter((option) => option !== weight)
    const nextOptions = { ...weightOptionsByEquipment }
    if (remainingWeights.length > 0) nextOptions[equipment] = remainingWeights
    else delete nextOptions[equipment]
    weightOptionsByEquipment = nextOptions
    saved = false
  }

  function submit() {
    const nextOptions = structuredClone(weightOptionsByEquipment)
    const nextErrors: Record<string, string> = {}
    for (const equipment of equipmentOptions) {
      const value = inputs[equipment].trim()
      if (!value) continue
      const result = parseRackAddition(equipment, value, nextOptions)
      if (result.error) nextErrors[equipment] = result.error
      else nextOptions[equipment] = result.weightOptions
    }
    if (Object.keys(nextErrors).length > 0) {
      errors = nextErrors
      return
    }
    const normalizedSettings = normalizeEquipmentSettings({
      id: 'primary-equipment-settings',
      weightOptionsByEquipment: nextOptions,
      updatedAt: new Date().toISOString(),
    })
    weightOptionsByEquipment = normalizedSettings.weightOptionsByEquipment
    inputs = Object.fromEntries(equipmentOptions.map((equipment) => [equipment, '']))
    errors = {}
    onSave(normalizedSettings)
    saved = true
  }
</script>

<div class="mx-auto w-full max-w-5xl px-5 py-6 sm:px-6 lg:px-8 lg:py-7">
  <header class="flex items-start gap-3">
    <button class="grid size-11 shrink-0 place-items-center rounded-full border border-ink" on:click={onBack} aria-label="Back to More"><ArrowLeft class="size-5" /></button>
    <div class="min-w-0">
      <p class="font-dot text-xs text-accent">EQUIPMENT</p>
      <h1 class="mt-2 text-2xl font-medium text-balance">Load racks</h1>
      <p class="mt-3 max-w-2xl text-sm leading-6 text-muted text-pretty">Enter the exact weights available for each equipment type once. New workouts copy the matching rack so progression targets use the next weight you can actually select.</p>
    </div>
  </header>

  <section class="mt-8 grid grid-cols-2 gap-3" aria-label="Equipment rack summary">
    <div class="flex min-h-32 flex-col justify-between rounded-2xl bg-accent p-5 text-accent-ink"><span class="text-xs font-medium uppercase">Configured</span><span class="font-dot text-3xl tabular-nums">{configuredCount}</span></div>
    <div class="flex min-h-32 flex-col justify-between rounded-2xl bg-paper p-5"><span class="text-xs font-medium uppercase text-muted">Equipment types</span><span class="font-dot text-3xl tabular-nums">{equipmentOptions.length}</span></div>
  </section>

  <form class="mt-3 rounded-2xl bg-paper p-5 sm:p-6" on:submit|preventDefault={submit}>
    <div class="max-w-2xl">
      <h2 class="text-xl font-medium text-balance">Available weights</h2>
      <p class="mt-2 text-sm leading-6 text-muted text-pretty">Add one load at a time, or paste a comma-separated list. Values are stored in kilograms, sorted automatically, and may use uneven jumps such as 40 to 47.5.</p>
    </div>

    <div class="mt-6 grid gap-3 sm:grid-cols-2">
      {#each equipmentOptions as equipment}
        {@const id = inputId(equipment)}
        <section class="rounded-xl bg-canvas p-4" aria-labelledby={`${id}-heading`}>
          <div class="flex items-center gap-3">
            <span class="grid size-10 shrink-0 place-items-center rounded-full bg-paper"><ExerciseEquipmentIcon {equipment} className="size-4" /></span>
            <span class="min-w-0"><span id={`${id}-heading`} class="block text-sm font-medium">{equipment}</span><span class="mt-0.5 block text-xs text-muted tabular-nums">{weightOptionsByEquipment[equipment]?.length ?? 0} available loads</span></span>
          </div>

          {#if weightOptionsByEquipment[equipment]?.length}
            <div class="mt-4 flex flex-wrap gap-2" aria-label={`${equipment} rack weights`}>
              {#each weightOptionsByEquipment[equipment] as weight}
                <span class="inline-flex min-h-9 items-center gap-1 rounded-full bg-paper py-1 pl-3 pr-1.5 text-sm font-medium tabular-nums">
                  {weight} kg
                  <button class="grid size-7 place-items-center rounded-full text-muted hover:bg-panel hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink" type="button" on:click={() => removeWeight(equipment, weight)} aria-label={`Remove ${weight} kg from ${equipment}`}>
                    <X class="size-3.5" aria-hidden="true" />
                  </button>
                </span>
              {/each}
            </div>
          {:else}
            <p class="mt-4 text-xs leading-5 text-muted">No loads added yet.</p>
          {/if}

          <label class="mt-4 block text-[0.625rem] font-medium uppercase text-muted" for={id}>Add load (kg)</label>
          <div class="mt-1 flex gap-2">
            <input id={id} class="min-h-11 min-w-0 flex-1 rounded-xl bg-paper px-3 text-base tabular-nums outline-none placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink" type="text" inputmode="decimal" value={inputs[equipment]} on:input={(event) => updateInput(equipment, event.currentTarget.value)} on:keydown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addWeights(equipment) } }} placeholder="7.5 or paste 5, 10, 15" maxlength="1200" autocomplete="off" aria-invalid={errors[equipment] ? 'true' : undefined} aria-describedby={`${id}-hint${errors[equipment] ? ` ${id}-error` : ''}`} />
            <button class="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-ink px-3 text-sm font-medium text-paper hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink" type="button" on:click={() => addWeights(equipment)}>
              <Plus class="size-4" aria-hidden="true" /> Add
            </button>
          </div>
          <p id={`${id}-hint`} class="mt-2 text-xs leading-5 text-muted">Use the Add button for single loads. Pasted lists may use commas or spaces.</p>
          {#if errors[equipment]}<p id={`${id}-error`} class="mt-2 text-xs leading-5 text-danger" role="alert">{errors[equipment]}</p>{/if}
        </section>
      {/each}
    </div>

    {#if saved}<p class="mt-5 text-sm text-success" role="status">Equipment racks saved.</p>{/if}
    <button class="mt-6 min-h-12 w-full rounded-full bg-ink px-5 text-sm font-medium text-paper hover:bg-accent disabled:cursor-not-allowed disabled:bg-panel-deep disabled:text-muted sm:w-auto" type="submit" disabled={hasErrors}>Save equipment racks</button>
  </form>
</div>
