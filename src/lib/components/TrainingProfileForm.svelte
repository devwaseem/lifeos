<script lang="ts">
  import EditableStringList from './EditableStringList.svelte'
  import type { ExperienceLevel, TrainingGoal, TrainingProfile } from '$lib/types'

  export let profile: TrainingProfile | null
  export let onSave: (profile: TrainingProfile) => void

  let primaryGoal: TrainingGoal = profile?.primaryGoal ?? 'strength'
  let experienceLevel: ExperienceLevel = profile?.experienceLevel ?? 'intermediate'
  let daysPerWeek = profile?.daysPerWeek ?? 4
  let sessionMinutes = profile?.sessionMinutes ?? 60
  let availableEquipment = profile?.availableEquipment ?? []
  let excludedExercises = profile?.excludedExercises ?? []
  let movementConstraints = profile?.movementConstraints ?? ''
  let saved = false


  function submit() {
    onSave({
      id: 'primary-training-profile',
      primaryGoal,
      experienceLevel,
      daysPerWeek: Math.min(7, Math.max(1, Math.round(daysPerWeek))),
      sessionMinutes: Math.min(300, Math.max(10, Math.round(sessionMinutes))),
      availableEquipment,
      excludedExercises,
      movementConstraints: movementConstraints.trim(),
      updatedAt: new Date().toISOString(),
    })
    saved = true
  }
</script>

<form class="rounded-2xl bg-paper p-5 sm:p-6" on:submit|preventDefault={submit}>
  <div class="max-w-2xl">
    <p class="font-dot text-xs text-accent">COACHING CONTEXT</p>
    <h2 class="mt-2 text-xl font-medium text-balance">Training profile</h2>
    <p class="mt-2 text-sm leading-6 text-muted text-pretty">These explicit goals and constraints keep routine reviews grounded in your plan instead of generic assumptions.</p>
  </div>

  <div class="mt-6 grid gap-4 sm:grid-cols-2">
    <label class="grid gap-2 text-sm font-medium">Primary goal
      <select class="min-h-12 rounded-xl border border-rule bg-canvas px-3 text-base" bind:value={primaryGoal}>
        <option value="strength">Strength</option>
        <option value="hypertrophy">Hypertrophy</option>
        <option value="general-fitness">General fitness</option>
        <option value="conditioning">Conditioning</option>
      </select>
    </label>
    <label class="grid gap-2 text-sm font-medium">Experience
      <select class="min-h-12 rounded-xl border border-rule bg-canvas px-3 text-base" bind:value={experienceLevel}>
        <option value="beginner">Beginner</option>
        <option value="intermediate">Intermediate</option>
        <option value="advanced">Advanced</option>
      </select>
    </label>
    <label class="grid gap-2 text-sm font-medium">Training days each week
      <input class="min-h-12 rounded-xl border border-rule bg-canvas px-3 text-base tabular-nums" type="number" min="1" max="7" bind:value={daysPerWeek} />
    </label>
    <label class="grid gap-2 text-sm font-medium">Usual session minutes
      <input class="min-h-12 rounded-xl border border-rule bg-canvas px-3 text-base tabular-nums" type="number" min="10" max="300" bind:value={sessionMinutes} />
    </label>
  </div>

  <div class="mt-5 grid gap-6 sm:grid-cols-2">
    <EditableStringList
      label="Available equipment"
      value={availableEquipment}
      placeholder="e.g. Barbell"
      emptyMessage="Add the equipment you can train with."
      onChange={(items) => { availableEquipment = items }}
    />
    <EditableStringList
      label="Excluded exercises"
      value={excludedExercises}
      placeholder="e.g. Behind-neck press"
      emptyMessage="Add any exercise names you do not want suggested."
      onChange={(items) => { excludedExercises = items }}
    />
  </div>
  <div class="mt-5 grid gap-4">
    <label class="grid gap-2 text-sm font-medium">Movement constraints
      <textarea class="min-h-28 resize-y rounded-xl border border-rule bg-canvas px-3 py-3 text-base leading-6" bind:value={movementConstraints} maxlength="2000" placeholder="Preferences or movement limits the review should respect"></textarea>
    </label>
  </div>

  {#if saved}<p class="mt-4 text-sm text-success" role="status">Training profile saved.</p>{/if}
  <button class="mt-6 min-h-12 w-full rounded-full bg-ink px-5 text-sm font-medium text-paper hover:bg-accent sm:w-auto" type="submit">Save training profile</button>
</form>
