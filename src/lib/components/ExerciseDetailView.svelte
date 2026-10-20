<script lang="ts">
  import { ArrowLeft, Trophy } from '@lucide/svelte'
  import { formatSetDistance, formatSetDuration, getExerciseTrackingMode } from '$lib/exercise-tracking'
  import {
    buildExerciseSeries,
    exerciseMetricLabels,
    getExerciseHistory,
    getExerciseStats,
    getWeightRecords,
    type ExerciseMetric,
    type ExerciseRange,
  } from '$lib/exercise-insights'
  import { getExerciseStrengthProfile, getFatigueSignal } from '$lib/training-science'
  import type { ExerciseVideo, WorkoutSession } from '$lib/types'
  import { formatShortDate, formatVolume } from '$lib/utils'
  import { getWorkingSetNumber } from '$lib/workout-sets'
  import DottedAreaChart from './DottedAreaChart.svelte'
  import ExerciseVideos from './ExerciseVideos.svelte'
  import ReadOnlyWorkoutSetHeader from './ReadOnlyWorkoutSetHeader.svelte'
  import ReadOnlyWorkoutSetRow from './ReadOnlyWorkoutSetRow.svelte'

  export let exerciseId: string
  export let exerciseName: string
  export let workouts: WorkoutSession[]
  export let onBack: () => void
  export let videos: ExerciseVideo[]
  export let onSaveVideo: (video: ExerciseVideo) => void
  export let onDeleteVideo: (videoId: string) => void

  const historyPageSize = 8
  let tab: 'summary' | 'history' | 'videos' = 'summary'
  let metric: ExerciseMetric = 'heaviest'
  let range: ExerciseRange = '3m'
  let visibleHistoryCount = historyPageSize
  let historyExerciseId = exerciseId

  $: if (exerciseId !== historyExerciseId) {
    historyExerciseId = exerciseId
    visibleHistoryCount = historyPageSize
  }
  $: history = getExerciseHistory(workouts, exerciseId)
  $: visibleHistory = history.slice(0, visibleHistoryCount)
  $: remainingHistoryCount = Math.max(0, history.length - visibleHistory.length)
  $: completedHistorySets = history.reduce((total, entry) => total + entry.sets.filter((set) => !set.warmup).length, 0)
  $: trackingMode = getExerciseTrackingMode(history[0]?.exercise ?? { name: exerciseName, muscle: '' })
  $: timedSets = history.flatMap((entry) => entry.sets.filter((set) => !set.warmup))
  $: totalTrackedDuration = timedSets.reduce((total, set) => total + (set.durationSeconds ?? 0), 0)
  $: longestTrackedDuration = timedSets.reduce((longest, set) => Math.max(longest, set.durationSeconds ?? 0), 0)
  $: totalTrackedDistance = timedSets.reduce((total, set) => total + (set.distanceMeters ?? 0), 0)
  $: longestTrackedDistance = timedSets.reduce((longest, set) => Math.max(longest, set.distanceMeters ?? 0), 0)
  $: stats = getExerciseStats(history)
  $: records = getWeightRecords(history)
  $: strengthProfile = getExerciseStrengthProfile(exerciseId, workouts)
  $: fatigueSignal = getFatigueSignal(workouts)
  $: exerciseUnderWatch = fatigueSignal.affectedExercises.includes(exerciseName)
  $: series = buildExerciseSeries(history, metric, range)
  $: chartUnit = metric === 'totalReps' ? 'reps' : 'kg'
</script>

<div class="mx-auto w-full max-w-6xl px-5 py-5 sm:px-6 lg:px-8 lg:py-7">
  <header class="flex items-start gap-3">
    <button class="grid size-11 shrink-0 place-items-center rounded-full border border-ink" on:click={onBack} aria-label="Back"><ArrowLeft class="size-5" /></button>
    <div class="min-w-0"><p class="font-dot text-xs text-accent">EXERCISE</p><h1 class="mt-1 truncate text-2xl font-medium">{exerciseName}</h1><p class="mt-1 text-sm text-muted">{history.length} recorded {history.length === 1 ? 'session' : 'sessions'}</p></div>
  </header>

  <div class="mt-7 grid grid-cols-3 rounded-full bg-paper p-1" role="tablist" aria-label="Exercise details">
    <button class:active-tab={tab === 'summary'} class="detail-tab" role="tab" aria-selected={tab === 'summary'} on:click={() => { tab = 'summary' }}>Summary</button>
    <button class:active-tab={tab === 'history'} class="detail-tab" role="tab" aria-selected={tab === 'history'} on:click={() => { tab = 'history' }}>History</button>
    <button class:active-tab={tab === 'videos'} class="detail-tab" role="tab" aria-selected={tab === 'videos'} on:click={() => { tab = 'videos' }}>Videos</button>
  </div>

  {#if tab === 'summary'}
    {#if trackingMode !== 'strength'}
      <section class="mt-5 rounded-2xl bg-paper p-4 sm:p-5" aria-labelledby="timed-progress-heading">
        <p class="font-dot text-xs text-accent">TIME TRACKING</p>
        <h2 id="timed-progress-heading" class="mt-1 text-xl font-medium">{trackingMode === 'distance-duration' ? 'Duration and distance' : 'Duration history'}</h2>
        <p class="mt-2 text-sm leading-6 text-muted">Completed values from {history.length} recorded {history.length === 1 ? 'session' : 'sessions'}.</p>
      </section>
      <dl class="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div class="rounded-2xl bg-accent p-4 text-accent-ink"><dt class="text-xs uppercase text-accent-ink/75">Total time</dt><dd class="font-dot mt-6 text-2xl">{formatSetDuration(totalTrackedDuration)}</dd></div>
        <div class="rounded-2xl bg-paper p-4"><dt class="text-xs uppercase text-muted">Longest set</dt><dd class="font-dot mt-6 text-2xl">{formatSetDuration(longestTrackedDuration)}</dd></div>
        {#if trackingMode === 'distance-duration'}
          <div class="rounded-2xl bg-panel p-4"><dt class="text-xs uppercase text-muted">Total distance</dt><dd class="font-dot mt-6 text-2xl">{formatSetDistance(totalTrackedDistance)}</dd></div>
          <div class="rounded-2xl bg-paper p-4"><dt class="text-xs uppercase text-muted">Farthest set</dt><dd class="font-dot mt-6 text-2xl">{formatSetDistance(longestTrackedDistance)}</dd></div>
        {:else}
          <div class="rounded-2xl bg-panel p-4"><dt class="text-xs uppercase text-muted">Sessions</dt><dd class="font-dot mt-6 text-2xl">{history.length}</dd></div>
          <div class="rounded-2xl bg-paper p-4"><dt class="text-xs uppercase text-muted">Completed sets</dt><dd class="font-dot mt-6 text-2xl">{completedHistorySets}</dd></div>
        {/if}
      </dl>
    {:else}
    <section class="mt-5 rounded-2xl bg-paper p-4 sm:p-5" aria-labelledby="progress-heading">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p class="font-dot text-xs text-accent">PROGRESS</p><h2 id="progress-heading" class="mt-1 text-xl font-medium">{exerciseMetricLabels[metric]}</h2></div>
        <div class="grid grid-cols-3 gap-1 rounded-xl bg-canvas p-1">
          <button class:active-filter={range === '3m'} class="filter-button" on:click={() => { range = '3m' }}>3 months</button>
          <button class:active-filter={range === '1y'} class="filter-button" on:click={() => { range = '1y' }}>1 year</button>
          <button class:active-filter={range === 'all'} class="filter-button" on:click={() => { range = 'all' }}>All time</button>
        </div>
      </div>

      <label class="mt-4 block"><span class="sr-only">Chart metric</span><select bind:value={metric} class="min-h-11 w-full rounded-xl border-0 bg-canvas px-3 text-sm font-medium outline-none sm:w-auto">{#each Object.entries(exerciseMetricLabels) as [value, label]}<option value={value}>{label}</option>{/each}</select></label>

      <div class="mt-4 border-t border-rule pt-2">
        <DottedAreaChart points={series} ariaLabel={`${exerciseMetricLabels[metric]} progress chart`} unit={chartUnit} />
      </div>
    </section>

    <dl class="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div class="rounded-2xl bg-accent p-4 text-accent-ink"><dt class="text-xs uppercase text-accent-ink/75">Heaviest</dt><dd class="font-dot mt-6 text-2xl">{stats.heaviest || '—'}<span class="font-sans ml-1 text-xs">kg</span></dd></div>
      <div class="rounded-2xl bg-paper p-4"><dt class="text-xs uppercase text-muted">RPE-adjusted e1RM</dt><dd class="font-dot mt-6 text-2xl">{stats.oneRepMax ? Math.round(stats.oneRepMax) : '—'}<span class="font-sans ml-1 text-xs text-muted">kg</span></dd></div>
      <div class="rounded-2xl bg-panel p-4"><dt class="text-xs uppercase text-muted">Best set volume</dt><dd class="font-dot mt-6 text-2xl">{stats.bestSetVolume ? formatVolume(stats.bestSetVolume) : '—'}<span class="font-sans ml-1 text-xs text-muted">kg</span></dd></div>
      <div class="rounded-2xl bg-paper p-4"><dt class="text-xs uppercase text-muted">Best session</dt><dd class="font-dot mt-6 text-2xl">{stats.bestSessionVolume ? formatVolume(stats.bestSessionVolume) : '—'}<span class="font-sans ml-1 text-xs text-muted">kg</span></dd></div>
    </dl>

    <section class="mt-3 grid gap-4 rounded-2xl bg-paper p-4 sm:grid-cols-[1fr_auto] sm:items-end sm:p-5" aria-labelledby="strength-signal-heading">
      <div>
        <div class="flex flex-wrap items-center gap-2"><p class="font-dot text-xs text-accent">STRENGTH SIGNAL</p><span class="rounded-full bg-canvas px-2 py-1 text-[0.5625rem] font-medium uppercase text-muted">{strengthProfile.confidence} confidence</span></div>
        <h2 id="strength-signal-heading" class="mt-2 text-lg font-medium">{exerciseUnderWatch ? fatigueSignal.title : 'Exercise-specific e1RM trend'}</h2>
        <p class="mt-2 max-w-2xl text-xs leading-5 text-muted">
          {#if exerciseUnderWatch}
            {fatigueSignal.recommendation}
          {:else if strengthProfile.trendPercent !== null}
            Recent median is {strengthProfile.trendPercent > 0 ? '+' : ''}{strengthProfile.trendPercent}% versus the prior three comparable sessions.
          {:else}
            Complete six comparable sessions with set RPE to establish a recent-versus-prior trend.
          {/if}
        </p>
      </div>
      <div class="sm:text-right"><span class="font-dot text-3xl tabular-nums">{strengthProfile.currentEstimated1Rm ?? '—'}</span><span class="ml-1 text-xs text-muted">kg estimated</span><p class="mt-1 text-[0.625rem] uppercase text-muted">Epley + logged RIR</p></div>
    </section>

    <section class="mt-3 rounded-2xl bg-paper p-4 sm:p-5">
      <div class="flex items-center gap-2"><Trophy class="size-5 text-accent" /><h2 class="text-lg font-medium">Personal records by weight</h2></div>
      {#if records.length > 0}
        <div class="mt-4 divide-y divide-rule">
          {#each records as record}
            <div class="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3"><span class="font-medium tabular-nums">{record.weight} kg</span><span class="font-medium tabular-nums">{record.reps} reps</span><span class="text-xs text-muted">{formatShortDate(record.date)}</span></div>
          {/each}
        </div>
      {:else}<p class="mt-4 text-sm text-muted">Complete a weighted set to establish a record.</p>{/if}
    </section>
    {/if}
  {:else if tab === 'history'}
    <section class="mt-5" aria-labelledby="exercise-history-heading">
      <div class="mb-3 flex items-end justify-between gap-4">
        <div>
          <p class="font-dot text-xs text-accent">TRAINING LOG</p>
          <h2 id="exercise-history-heading" class="mt-1 text-lg font-medium">Session history</h2>
        </div>
        <p class="text-xs text-muted">{completedHistorySets} completed sets</p>
      </div>

      {#if history.length > 0}
        <div class="divide-y divide-rule overflow-hidden rounded-2xl bg-paper">
          {#each visibleHistory as entry}
            {@const workingSetCount = entry.sets.filter((set) => !set.warmup).length}
            <article class="px-4 py-5 sm:px-5" aria-label={`${entry.workout.title}, ${workingSetCount} completed working ${workingSetCount === 1 ? 'set' : 'sets'}`}>
              <header class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <p class="font-dot text-xs text-accent">{formatShortDate(entry.workout.completedAt ?? entry.workout.startedAt)}</p>
                  <h3 class="mt-1 truncate text-lg font-medium">{entry.workout.title}</h3>
                </div>
                <span class="shrink-0 rounded-full bg-canvas px-2.5 py-1 text-[0.625rem] font-medium uppercase text-muted">{workingSetCount} working {workingSetCount === 1 ? 'set' : 'sets'}</span>
              </header>

              {#if entry.exercise.notes}
                <div class="mt-4 rounded-xl bg-canvas px-3 py-2"><span class="text-[0.6875rem] font-medium uppercase text-muted">Exercise note</span><p class="mt-1 text-sm leading-5">{entry.exercise.notes}</p></div>
              {/if}

              <div class="mt-4">
                <ReadOnlyWorkoutSetHeader {trackingMode} />
                <div class="space-y-1">
                  {#each entry.sets as set, setIndex (set.id)}
                    {@const setNumber = getWorkingSetNumber(entry.sets, setIndex)}
                    <ReadOnlyWorkoutSetRow {set} {setIndex} {setNumber} {exerciseName} {trackingMode} />
                  {/each}
                </div>
              </div>

              {#if entry.workout.notes}
                <p class="mt-4 border-t border-rule pt-4 text-sm leading-6 text-muted text-pretty">{entry.workout.notes}</p>
              {/if}
            </article>
          {/each}
        </div>

        {#if remainingHistoryCount > 0}
          <button class="mt-4 min-h-12 w-full rounded-xl border border-rule bg-paper px-5 text-sm font-medium hover:border-ink" on:click={() => { visibleHistoryCount += historyPageSize }}>
            Show {Math.min(historyPageSize, remainingHistoryCount)} older {Math.min(historyPageSize, remainingHistoryCount) === 1 ? 'session' : 'sessions'}
          </button>
        {/if}
      {:else}
        <div class="rounded-2xl bg-paper p-6 text-sm text-muted">No completed history for this exercise yet.</div>
      {/if}
    </section>
  {:else}
    <ExerciseVideos {exerciseId} {exerciseName} {videos} onSave={onSaveVideo} onDelete={onDeleteVideo} />
  {/if}
</div>

<style>
  .detail-tab { min-height: 2.75rem; border-radius: 9999px; color: var(--color-muted); font-size: 0.875rem; font-weight: 500; }
  .detail-tab.active-tab { background: var(--color-ink); color: var(--color-paper); }
  .filter-button { min-height: 2.25rem; border-radius: 0.625rem; padding-inline: 0.625rem; color: var(--color-muted); font-size: 0.6875rem; font-weight: 500; }
  .filter-button.active-filter { background: var(--color-paper); color: var(--color-ink); }
</style>
