<script lang="ts">
  import { ArrowLeft } from '@lucide/svelte'
  import { equipmentOptions } from '$lib/data/exercise-options'
  import { normalizeEquipmentSettings } from '$lib/equipment-settings'
  import { parseWeightOptionsInput } from '$lib/progression'
  import type { EquipmentSettings } from '$lib/types'
  import ExerciseEquipmentIcon from './ExerciseEquipmentIcon.svelte'

  export let settings: EquipmentSettings | null
  export let onBack: () => void
  export let onSave: (settings: EquipmentSettings) => void

  let inputs: Record<string, string> = Object.fromEntries(equipmentOptions.map((equipment) => [
    equipment,
    settings?.weightOptionsByEquipment[equipment]?.join(', ') ?? '',
  ]))
  let weightOptionsByEquipment: Record<string, number[]> = structuredClone(settings?.weightOptionsByEquipment ?? {})
  let errors: Record<string, string> = {}
  let saved = false

  $: configuredCount = Object.values(weightOptionsByEquipment).filter((weights) => weights.length > 0).length
  $: hasErrors = Object.keys(errors).length > 0

  function updateRack(equipment: string, value: string) {
    inputs = { ...inputs, [equipment]: value }
    saved = false
    const result = parseWeightOptionsInput(value)
    if (result.error) {
      errors = { ...errors, [equipment]: result.error }
      return
    }
    const nextErrors = { ...errors }
    const nextOptions = { ...weightOptionsByEquipment }
    delete nextErrors[equipment]
    if (result.weightOptions.length > 0) nextOptions[equipment] = result.weightOptions
    else delete nextOptions[equipment]
    errors = nextErrors
    weightOptionsByEquipment = nextOptions
  }

  function submit() {
    if (hasErrors) return
    onSave(normalizeEquipmentSettings({
      id: 'primary-equipment-settings',
      weightOptionsByEquipment,
      updatedAt: new Date().toISOString(),
    }))
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
      <p class="mt-2 text-sm leading-6 text-muted text-pretty">Separate values with commas. Values are stored in kilograms, sorted automatically, and may use uneven jumps such as 40 to 47.5.</p>
    </div>

    <div class="mt-6 grid gap-3 sm:grid-cols-2">
      {#each equipmentOptions as equipment}
        <label class="rounded-xl bg-canvas p-4">
          <span class="flex items-center gap-3">
            <span class="grid size-10 shrink-0 place-items-center rounded-full bg-paper"><ExerciseEquipmentIcon {equipment} className="size-4" /></span>
            <span class="min-w-0"><span class="block text-sm font-medium">{equipment}</span><span class="mt-0.5 block text-xs text-muted tabular-nums">{weightOptionsByEquipment[equipment]?.length ?? 0} available loads</span></span>
          </span>
          <span class="mt-4 block text-[0.625rem] font-medium uppercase text-muted">Rack weights (kg)</span>
          <input class="mt-1 min-h-11 w-full rounded-xl bg-paper px-3 text-sm tabular-nums outline-none placeholder:text-muted" type="text" inputmode="decimal" value={inputs[equipment]} on:input={(event) => updateRack(equipment, event.currentTarget.value)} placeholder="5, 10, 15, 20, 25, 30, 35, 40, 47.5" maxlength="1200" aria-invalid={errors[equipment] ? 'true' : undefined} aria-describedby={errors[equipment] ? `equipment-rack-error-${equipment.toLowerCase().replaceAll(' ', '-')}` : undefined} />
          {#if errors[equipment]}<span id={`equipment-rack-error-${equipment.toLowerCase().replaceAll(' ', '-')}`} class="mt-2 block text-xs leading-5 text-danger" role="alert">{errors[equipment]}</span>{/if}
        </label>
      {/each}
    </div>

    {#if saved}<p class="mt-5 text-sm text-success" role="status">Equipment racks saved.</p>{/if}
    <button class="mt-6 min-h-12 w-full rounded-full bg-ink px-5 text-sm font-medium text-paper hover:bg-accent disabled:cursor-not-allowed disabled:bg-panel-deep disabled:text-muted sm:w-auto" type="submit" disabled={hasErrors}>Save equipment racks</button>
  </form>
</div>
