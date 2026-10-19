<script lang="ts">
  import { ChevronRight, Dumbbell } from '@lucide/svelte'
  import type { WorkoutSession } from '$lib/types'
  import { formatDuration, formatShortDate, formatVolume, getCompletedSetCount, getWorkoutVolume } from '$lib/utils'

  export let workouts: WorkoutSession[]
  export let onStart: () => void
  export let onOpenWorkout: (workoutId: string) => void

  const pageSize = 10
  const monthFormatter = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' })
  const compactVolumeFormatter = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
  let visibleCount = pageSize

  function workoutDate(workout: WorkoutSession) {
    return workout.completedAt ?? workout.startedAt
  }

  function workoutMuscleGroups(workout: WorkoutSession) {
    const trainedMuscles = workout.exercises
      .filter((exercise) => exercise.sets.some((set) => set.completed))
      .map((exercise) => exercise.muscle)
    return Array.from(new Set(trainedMuscles)).join(' · ')
  }


  function groupByMonth(items: WorkoutSession[]) {
    const groups: Array<{ key: string; label: string; workouts: WorkoutSession[] }> = []
    for (const workout of items) {
      const date = new Date(workoutDate(workout))
      const key = `${date.getFullYear()}-${date.getMonth()}`
      const current = groups.at(-1)
      if (current?.key === key) current.workouts.push(workout)
      else groups.push({ key, label: monthFormatter.format(date), workouts: [workout] })
    }
    return groups
  }

  $: completed = workouts
    .filter((workout) => workout.status === 'completed')
    .sort((a, b) => workoutDate(b).localeCompare(workoutDate(a)))
  $: visibleCompleted = completed.slice(0, visibleCount)
  $: monthGroups = groupByMonth(visibleCompleted)
  $: remainingCount = Math.max(0, completed.length - visibleCompleted.length)
  $: totalSets = completed.reduce((total, workout) => total + getCompletedSetCount(workout), 0)
  $: totalVolume = completed.reduce((total, workout) => total + getWorkoutVolume(workout), 0)
</script>

<div class="mx-auto w-full max-w-6xl px-5 py-6 sm:px-6 lg:px-8 lg:py-7">
  <header class="flex items-start justify-between gap-5">
    <div>
      <p class="font-dot text-xs text-accent">ARCHIVE</p>
      <h1 class="mt-2 text-2xl font-medium">Workout history</h1>
      <p class="mt-1 text-sm text-muted">Completed sessions, newest first.</p>
    </div>
    <button class="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-paper" on:click={onStart}>
      <Dumbbell class="size-4" />
      <span class="hidden sm:inline">Start workout</span>
      <span class="sm:hidden">Start</span>
    </button>
  </header>

  <dl class="mt-7 grid grid-cols-3 divide-x divide-rule overflow-hidden rounded-2xl bg-paper">
    <div class="min-w-0 px-3 py-4 sm:px-5">
      <dt class="text-[0.6875rem] font-medium uppercase text-muted">Sessions</dt>
      <dd class="font-dot mt-2 truncate text-2xl tabular-nums sm:text-3xl">{completed.length}</dd>
    </div>
    <div class="min-w-0 px-3 py-4 sm:px-5">
      <dt class="text-[0.6875rem] font-medium uppercase text-muted">Sets</dt>
      <dd class="font-dot mt-2 truncate text-2xl tabular-nums sm:text-3xl">{totalSets}</dd>
    </div>
    <div class="min-w-0 px-3 py-4 sm:px-5">
      <dt class="text-[0.6875rem] font-medium uppercase text-muted">Volume</dt>
      <dd class="font-dot mt-2 whitespace-nowrap text-2xl tabular-nums sm:text-3xl">{compactVolumeFormatter.format(totalVolume)}<span class="font-sans ml-1 text-[0.6875rem] text-muted">kg</span></dd>
    </div>
  </dl>

  {#if completed.length === 0}
    <div class="mt-8 rounded-2xl bg-paper p-6">
      <h2 class="text-xl font-medium">No completed workouts</h2>
      <p class="mt-2 max-w-md text-sm leading-6 text-muted text-pretty">Finish your first session and its sets, volume, and notes will appear here.</p>
      <button class="mt-6 min-h-12 rounded-xl bg-accent px-5 text-sm font-medium text-accent-ink" on:click={onStart}>Start workout</button>
    </div>
  {:else}
    <div class="mt-8 space-y-7">
      {#each monthGroups as month (month.key)}
        <section aria-labelledby={`history-${month.key}`}>
          <h2 id={`history-${month.key}`} class="font-dot mb-3 text-sm text-ink">{month.label.toUpperCase()}</h2>

          <div class="divide-y divide-rule overflow-hidden rounded-2xl bg-paper">
            {#each month.workouts as workout (workout.id)}
              <button class="flex min-h-20 w-full items-center justify-between gap-4 px-4 py-4 text-left sm:px-5" on:click={() => onOpenWorkout(workout.id)} aria-label={`Open ${workout.title} from ${formatShortDate(workoutDate(workout))}`}>
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <p class="font-dot text-xs text-accent">{formatShortDate(workoutDate(workout))}</p>
                    <span aria-hidden="true" class="text-rule">/</span>
                    <p class="text-xs text-muted">{getCompletedSetCount(workout)} sets</p>
                  </div>
                  <h3 class="mt-1.5 truncate text-lg font-medium">{workout.title}</h3>
                  <p class="mt-1 truncate text-sm text-muted">{workoutMuscleGroups(workout)}</p>
                </div>
                <div class="flex shrink-0 items-center gap-3">
                  <div class="hidden text-right sm:block">
                    <p class="font-dot text-lg tabular-nums">{formatVolume(getWorkoutVolume(workout))}<span class="font-sans ml-1 text-[0.6875rem] text-muted">kg</span></p>
                    <p class="mt-1 text-xs text-muted">{formatDuration(workout.startedAt, workout.completedAt)}</p>
                  </div>
                  <span class="grid size-10 place-items-center rounded-xl bg-canvas"><ChevronRight class="size-4 text-muted" /></span>
                </div>
              </button>
            {/each}
          </div>
        </section>
      {/each}
    </div>

    {#if remainingCount > 0}
      <button class="mt-7 min-h-12 w-full rounded-xl border border-rule bg-paper px-5 text-sm font-medium hover:border-ink" on:click={() => { visibleCount += pageSize }}>
        Show {Math.min(pageSize, remainingCount)} older {Math.min(pageSize, remainingCount) === 1 ? 'workout' : 'workouts'}
      </button>
    {/if}
  {/if}
</div>

