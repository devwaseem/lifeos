<script lang="ts">
  import { Plus, X } from '@lucide/svelte'
  import { equipmentOptions, muscleOptions } from '$lib/data/exercise-options'
  import { normalizeSecondaryMuscles } from '$lib/muscle-contributions'
  import type { ExerciseDefinition, MuscleContribution } from '$lib/types'

  export let onSubmit: (exercise: ExerciseDefinition) => void
  export let submitLabel = 'Create exercise'

  const contributionOptions = [
    { value: 0.25, label: '25% · minor' },
    { value: 0.5, label: '50% · supporting' },
    { value: 0.75, label: '75% · major' },
    { value: 1, label: '100% · equal' },
  ]
  let name = ''
  let muscle: string = muscleOptions[0]
  let equipment: string = equipmentOptions[0]
  let secondaryMuscles: MuscleContribution[] = []

  $: availableSecondaryMuscles = muscleOptions.filter((option) => option !== muscle && !secondaryMuscles.some((item) => item.muscle === option))

  function addSecondaryMuscle() {
    const nextMuscle = availableSecondaryMuscles[0]
    if (!nextMuscle) return
    secondaryMuscles = [...secondaryMuscles, { muscle: nextMuscle, fraction: 0.5 }]
  }

  function updateSecondaryMuscle(index: number, changes: Partial<MuscleContribution>) {
    secondaryMuscles = secondaryMuscles.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item)
  }

  function changePrimaryMuscle(nextMuscle: string) {
    muscle = nextMuscle
    secondaryMuscles = secondaryMuscles.filter((item) => item.muscle !== nextMuscle)
  }

  function submit() {
    const normalizedName = name.trim()
    if (!normalizedName) return
    onSubmit({
      id: `custom-${crypto.randomUUID()}`,
      name: normalizedName,
      muscle,
      equipment,
      secondaryMuscles: normalizeSecondaryMuscles(secondaryMuscles, muscle),
      custom: true,
    })
    name = ''
    muscle = muscleOptions[0]
    equipment = equipmentOptions[0]
    secondaryMuscles = []
  }
</script>

<form class="space-y-4" on:submit|preventDefault={submit}>
  <label class="block"><span class="text-xs font-medium uppercase">Exercise name</span><input bind:value={name} class="mt-2 min-h-12 w-full rounded-xl border-0 bg-canvas px-4 outline-none" placeholder="e.g. Single-arm cable row" maxlength="100" required /></label>
  <label class="block"><span class="text-xs font-medium uppercase">Primary muscle</span><select value={muscle} on:change={(event) => changePrimaryMuscle(event.currentTarget.value)} class="mt-2 min-h-12 w-full rounded-xl border-0 bg-canvas px-4 outline-none">{#each muscleOptions as option}<option value={option}>{option}</option>{/each}</select></label>
  <label class="block"><span class="text-xs font-medium uppercase">Equipment</span><select bind:value={equipment} class="mt-2 min-h-12 w-full rounded-xl border-0 bg-canvas px-4 outline-none">{#each equipmentOptions as option}<option value={option}>{option}</option>{/each}</select></label>

  <section aria-labelledby="secondary-muscles-heading">
    <div class="flex items-center justify-between gap-3">
      <div><p id="secondary-muscles-heading" class="text-xs font-medium uppercase">Secondary muscles</p><p class="mt-1 text-xs text-muted">Fractional credit toward recovery and weekly dose.</p></div>
      <button type="button" class="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-canvas px-3 text-xs font-medium disabled:opacity-40" on:click={addSecondaryMuscle} disabled={availableSecondaryMuscles.length === 0}><Plus class="size-3.5" /> Add</button>
    </div>
    {#if secondaryMuscles.length > 0}
      <div class="mt-3 space-y-2">
        {#each secondaryMuscles as secondary, index (`${index}-${secondary.muscle}`)}
          <div class="grid grid-cols-[minmax(0,1fr)_8rem_2.75rem] gap-2">
            <select value={secondary.muscle} on:change={(event) => updateSecondaryMuscle(index, { muscle: event.currentTarget.value })} class="min-h-11 min-w-0 rounded-xl border-0 bg-canvas px-3 text-sm outline-none" aria-label={`Secondary muscle ${index + 1}`}>
              {#each muscleOptions.filter((option) => option !== muscle && (option === secondary.muscle || !secondaryMuscles.some((item) => item.muscle === option))) as option}<option value={option}>{option}</option>{/each}
            </select>
            <select value={secondary.fraction} on:change={(event) => updateSecondaryMuscle(index, { fraction: Number(event.currentTarget.value) })} class="min-h-11 rounded-xl border-0 bg-canvas px-2 text-xs outline-none" aria-label={`Contribution for ${secondary.muscle}`}>
              {#each contributionOptions as option}<option value={option.value}>{option.label}</option>{/each}
            </select>
            <button type="button" class="grid size-11 place-items-center rounded-xl bg-danger-soft text-danger" on:click={() => { secondaryMuscles = secondaryMuscles.filter((_, itemIndex) => itemIndex !== index) }} aria-label={`Remove ${secondary.muscle}`}><X class="size-4" /></button>
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <button class="min-h-12 w-full rounded-full bg-accent px-5 text-sm font-medium text-accent-ink" type="submit">{submitLabel}</button>
</form>
