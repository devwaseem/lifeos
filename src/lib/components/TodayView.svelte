<script lang="ts">
  import { ArrowRight, CalendarDays, CheckCircle2, Dumbbell, Layers3, Moon, Repeat2, ShieldAlert } from '@lucide/svelte'
  import type { AiSettings } from '$lib/ai-coach'
  import { getCurrentCycleSlot, getCycleRoutine, getTrainingCycleState } from '$lib/training-cycle'
  import { getTrainingReadiness, type MuscleRecovery } from '$lib/training-readiness'
  import type { TrainingProgressReport as TrainingProgressReportData } from '$lib/training-progress-report'
  import type { RoutineTemplate, TrainingCycle, WorkoutSession } from '$lib/types'
  import { formatVolume, getCompletedSetCount, getWorkoutVolume } from '$lib/utils'
  import SegmentedProgressBar from './SegmentedProgressBar.svelte'
  import TrainingProgressReport from './TrainingProgressReport.svelte'
  import WorkoutCalendar from './WorkoutCalendar.svelte'
  export let workouts: WorkoutSession[]
  export let routines: RoutineTemplate[]
  export let activeWorkout: WorkoutSession | undefined
  export let trainingCycle: TrainingCycle | null
  export let selectedRoutineId: string
  export let now: number
  export let onSelectRoutine: (routineId: string) => void
  export let onStartRoutine: (routine: RoutineTemplate) => void
  export let onStart: () => void
  export let onResume: () => void
  export let onManageRoutines: () => void
  export let onViewReport: () => void
  export let onOpenExercise: (exerciseId: string, exerciseName: string) => void
  export let progressReport: TrainingProgressReportData
  export let aiSettings: AiSettings
  export let online: boolean

  let forceOverrideOpen = false
  let headerDateKey = ''
  let weekdayShortLabel = ''
  let monthDayLabel = ''
  let yearLabel = ''

  const monthDayFormatter = new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric' })
  const shortWeekdayFormatter = new Intl.DateTimeFormat('en', { weekday: 'short' })

  $: selectedRoutine = routines.find((routine) => routine.id === selectedRoutineId)
  $: cycleSlot = getCurrentCycleSlot(trainingCycle)
  $: cycleRoutine = getCycleRoutine(trainingCycle, routines)
  $: cycleState = getTrainingCycleState(trainingCycle, workouts, now)
  $: cycleActive = Boolean(trainingCycle && !trainingCycle.deletedAt && trainingCycle.slots.length > 0)
  $: todayCompleted = !activeWorkout && cycleState.trainedToday
  $: latestTodayWorkout = todayCompleted ? getLatestWorkoutToday(workouts, now) : undefined
  $: restDay = !activeWorkout && !todayCompleted && cycleState.restDue
  $: cycleNeedsAttention = Boolean(cycleSlot && !cycleRoutine)
  $: plannedRoutine = cycleActive ? cycleRoutine : selectedRoutine
  $: planMovements = activeWorkout?.exercises ?? (todayCompleted ? latestTodayWorkout?.exercises ?? [] : restDay ? [] : plannedRoutine?.exercises ?? [])
  $: planName = activeWorkout?.title ?? (todayCompleted ? latestTodayWorkout?.title ?? 'Training complete' : restDay ? 'Recovery day' : plannedRoutine?.name ?? (cycleNeedsAttention ? 'Cycle needs attention' : 'Choose today’s workout'))
  $: insights = getTrainingReadiness(planMovements, workouts, now)
  $: fatigueOverrideRequired = !todayCompleted && !cycleActive && insights.systemicFatigueWarning
  $: restrictedMuscleCount = insights.recovery.filter((recovery) => recovery.readiness < 80).length
  $: cyclePosition = cycleActive && trainingCycle ? `Cycle ${trainingCycle.currentIndex + 1} / ${trainingCycle.slots.length}` : ''
  $: primaryEyebrow = activeWorkout
    ? 'Session active'
    : todayCompleted
      ? 'Session complete'
      : restDay
        ? `${cycleState.consecutiveTrainingDays} of ${cycleState.trainingDaysBeforeRest} training days`
        : cycleNeedsAttention
          ? 'Routine unavailable'
          : fatigueOverrideRequired
            ? 'Override required'
            : cyclePosition || (plannedRoutine ? 'Ready when you are' : 'No plan selected')
  $: primaryLabel = activeWorkout
    ? `Resume ${activeWorkout.title}`
    : todayCompleted
      ? 'Today’s training is complete'
      : restDay
        ? 'Rest today'
        : cycleNeedsAttention
          ? 'Repair training cycle'
          : plannedRoutine
            ? `Start ${plannedRoutine.name}`
            : 'Choose workout'

  $: currentDate = new Date(now)
  $: currentDateKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDate()}`
  $: if (currentDateKey !== headerDateKey) updateDateHeader(currentDate, currentDateKey)
  $: greeting = currentDate.getHours() < 12 ? 'Good morning,' : currentDate.getHours() < 18 ? 'Good afternoon,' : 'Good evening,'
  $: activeSetCount = activeWorkout ? getCompletedSetCount(activeWorkout) : 0
  $: activeSetLabel = `${activeSetCount} ${activeSetCount === 1 ? 'set' : 'sets'}`
  $: completedSetCount = latestTodayWorkout ? getCompletedSetCount(latestTodayWorkout) : 0

  function dateKey(timestamp: string | number) {
    const date = new Date(timestamp)
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
  }

  function getLatestWorkoutToday(items: WorkoutSession[], timestamp: number) {
    const today = dateKey(timestamp)
    let latest: WorkoutSession | undefined
    for (const workout of items) {
      if (workout.status !== 'completed' || dateKey(workout.completedAt ?? workout.startedAt) !== today) continue
      if (!latest || (workout.completedAt ?? workout.startedAt) > (latest.completedAt ?? latest.startedAt)) latest = workout
    }
    return latest
  }

  function recoveryStatusLabel(recovery: MuscleRecovery) {
    if (recovery.status === 'fully-recovered') return 'No residual estimate'
    if (recovery.status === 'ready') return 'Ready estimate'
    if (recovery.status === 'partial') return 'Partial estimate'
    return 'Recent load'
  }

  function recoveryTiming(recovery: MuscleRecovery) {
    if (recovery.elapsedHours === null) return 'No prior load'
    if (recovery.hoursUntilReady === 0) return 'At readiness threshold'
    return `~${recovery.hoursUntilReady}h to ready`
  }

  function formatStimulusUnits(value: number) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1)
  }

  function updateDateHeader(date: Date, dateKey: string) {
    headerDateKey = dateKey
    weekdayShortLabel = shortWeekdayFormatter.format(date)
    monthDayLabel = monthDayFormatter.format(date)
    yearLabel = String(date.getFullYear())
  }

  function changeRoutine(routineId: string) {
    forceOverrideOpen = false
    onSelectRoutine(routineId)
  }

  function primaryAction() {
    if (activeWorkout) {
      onResume()
      return
    }
    if (cycleNeedsAttention) {
      onManageRoutines()
      return
    }
    if (!plannedRoutine) {
      onStart()
      return
    }
    if (fatigueOverrideRequired) {
      forceOverrideOpen = true
      return
    }
    onStartRoutine(plannedRoutine)
  }

  function trainOnRestDay() {
    if (cycleSlot && cycleRoutine) onStartRoutine(cycleRoutine)
  }

  function forceOverride() {
    if (!plannedRoutine) return
    forceOverrideOpen = false
    onStartRoutine(plannedRoutine)
  }

</script>

<div class="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-7 xl:px-10">
  <header class="home-header px-1 pt-2 sm:px-2 sm:pt-4" aria-labelledby="home-summary-heading">
    <div class="flex items-start justify-between gap-5">
      <div class="flex items-center gap-3" aria-label={`${weekdayShortLabel}, ${monthDayLabel}, ${yearLabel}`}>
        <span class="text-[4.25rem] font-semibold leading-[0.85] tracking-[-0.07em] sm:text-[5.25rem]">{weekdayShortLabel}</span>
        <span class:bg-success={Boolean(activeWorkout)} class:bg-accent={!activeWorkout} class="mt-1 size-3 rounded-full ring-4 ring-accent-soft" aria-hidden="true"></span>
      </div>
      <p class="pt-1 text-right text-sm font-medium leading-5 text-muted sm:text-base sm:leading-6">
        <span class="block">{monthDayLabel}</span>
        <span class="block">{yearLabel}</span>
      </p>
    </div>


    <div class="mt-10 max-w-5xl sm:mt-12">
      <h1 id="home-summary-heading" class="home-summary text-[clamp(1.5rem,3.1vw,2.5rem)] font-normal tracking-[-0.02em] text-muted">
        <span>{greeting}</span>{' '}<span class="font-medium text-ink">Waseem Akram.</span>
        {#if activeWorkout}
          {' '}Your{' '}<Dumbbell class="mr-[0.22em] inline size-[0.72em] align-[-0.08em] text-ink" strokeWidth={2.3} aria-hidden="true" /><span class="font-medium text-ink">{activeWorkout.title}</span>{' '}workout is underway with{' '}<span class="font-semibold text-ink">{activeSetLabel}</span>{' '}logged.
        {:else if todayCompleted}
          {' '}Today’s training is complete.{' '}<CheckCircle2 class="mr-[0.22em] inline size-[0.72em] align-[-0.08em] text-success" strokeWidth={2.3} aria-hidden="true" /><span class="font-medium text-ink">{latestTodayWorkout?.title ?? 'Your workout'}</span>{' '}is safely logged with{' '}<span class="font-semibold text-ink">{completedSetCount} completed {completedSetCount === 1 ? 'set' : 'sets'}.</span>{#if plannedRoutine}{' '}<span class="font-medium text-ink">{plannedRoutine.name}</span>{' '}stays queued for next time.{/if}
        {:else if restDay}
          {' '}You’ve completed{' '}<CalendarDays class="mr-[0.22em] inline size-[0.72em] align-[-0.08em] text-ink" strokeWidth={2.3} aria-hidden="true" /><span class="font-semibold text-ink">{cycleState.consecutiveTrainingDays} consecutive training days.</span>{' '}Rest today; the queue keeps{' '}<Dumbbell class="mr-[0.22em] inline size-[0.72em] align-[-0.08em] text-ink" strokeWidth={2.3} aria-hidden="true" /><span class="font-medium text-ink">{plannedRoutine?.name ?? 'your next routine'}</span>{' '}next.
        {:else if cycleNeedsAttention}
          {' '}Your{' '}<Repeat2 class="mr-[0.22em] inline size-[0.72em] align-[-0.08em] text-ink" strokeWidth={2.3} aria-hidden="true" /><span class="font-medium text-ink">training cycle needs attention.</span>{' '}Replace the unavailable routine to keep the completion-driven cycle moving.
        {:else if plannedRoutine}
          {' '}Your{' '}<Dumbbell class="mr-[0.22em] inline size-[0.72em] align-[-0.08em] text-ink" strokeWidth={2.3} aria-hidden="true" /><span class="font-medium text-ink">{plannedRoutine.name}</span>{' '}workout is ready.{#if cycleActive && trainingCycle}{' '}You’re on{' '}<span class="font-semibold text-ink">cycle {trainingCycle.currentIndex + 1} of {trainingCycle.slots.length}.</span>{/if}
        {:else}
          {' '}You don’t have a workout selected yet.{' '}<span class="font-medium text-ink">Choose a routine</span>{' '}to see its target-muscle readiness and start training.
        {/if}
      </h1>
    </div>
  </header>

  <div class="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-12">
    <section class="col-span-2 flex flex-col rounded-2xl bg-paper p-5 sm:p-6 lg:col-span-5" aria-labelledby="today-plan-heading">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0"><p class="font-dot text-xs text-accent">TODAY</p><h1 id="today-plan-heading" class="mt-2 truncate text-3xl font-medium leading-none sm:text-4xl">{planName}</h1></div>
        {#if activeWorkout}
          <span class="shrink-0 rounded-full bg-ink px-3 py-1.5 text-[0.625rem] font-medium uppercase text-paper">In progress</span>
        {:else if todayCompleted}
          <span class="shrink-0 rounded-full bg-success-soft px-3 py-1.5 text-[0.625rem] font-medium uppercase text-success">Completed</span>
        {:else if cycleActive && trainingCycle}
          <span class="shrink-0 rounded-full bg-canvas px-3 py-1.5 text-[0.625rem] font-medium uppercase text-muted">{cyclePosition}</span>
        {:else if routines.length > 0}
          <label class="shrink-0 text-right"><span class="block text-[0.625rem] font-medium uppercase text-muted">Routine</span><select class="mt-1 max-w-36 bg-transparent text-right text-sm font-medium outline-none" value={selectedRoutineId} on:change={(event) => changeRoutine(event.currentTarget.value)} aria-label="Today's routine"><option value="">Choose</option>{#each routines as routine (routine.id)}<option value={routine.id}>{routine.name}</option>{/each}</select></label>
        {/if}
      </div>

      {#if todayCompleted}
        <div class="mt-8 grid grid-cols-2 divide-x divide-rule border-b border-rule pb-5">
          <div class="pr-4"><span class="font-dot block text-5xl leading-none tabular-nums">{completedSetCount}</span><span class="mt-2 block text-xs uppercase text-muted">Completed sets</span></div>
          <div class="pl-4"><span class="font-dot block text-5xl leading-none tabular-nums">{formatVolume(latestTodayWorkout ? getWorkoutVolume(latestTodayWorkout) : 0)}</span><span class="mt-2 block text-xs uppercase text-muted">Volume · kg</span></div>
        </div>
      {:else if restDay}
        <div class="mt-8 flex items-end justify-between gap-5 border-b border-rule pb-6">
          <div><span class="font-dot block text-6xl leading-none">REST</span><span class="mt-2 block text-xs uppercase text-muted">Inferred from your training streak</span></div>
          <span class="grid size-14 shrink-0 place-items-center rounded-full bg-canvas"><Moon class="size-6" /></span>
        </div>
        <p class="mt-5 text-sm leading-6 text-muted">You trained on the previous {cycleState.trainingDaysBeforeRest} consecutive days. Resting today resets the count automatically without moving {plannedRoutine?.name ?? 'the next routine'} out of the queue.</p>
      {:else if planMovements.length > 0}
        <div class="mt-8 flex items-end justify-between gap-4 border-b border-rule pb-5">
          <div><span class="font-dot block text-6xl leading-none tabular-nums">{insights.targetReadiness}%</span><span class="mt-2 block text-xs uppercase text-muted">Estimated target readiness</span></div>
          <div class="min-w-0 max-w-40 text-right text-xs leading-5 text-muted">{insights.targetMuscles.join(' · ')}</div>
        </div>
      {:else if cycleNeedsAttention}
        <button class="mt-8 flex min-h-12 items-center gap-2 rounded-xl bg-danger-soft px-4 text-left text-sm font-medium text-danger" on:click={onManageRoutines}><Repeat2 class="size-4" /> Replace the missing routine <ArrowRight class="ml-auto size-4" /></button>
      {:else if routines.length === 0}
        <button class="mt-8 flex min-h-12 items-center gap-2 rounded-xl bg-canvas px-4 text-left text-sm font-medium" on:click={onManageRoutines}><Layers3 class="size-4 text-accent" /> Build your first routine <ArrowRight class="ml-auto size-4" /></button>
      {:else}
        <p class="mt-8 text-sm leading-6 text-muted">Select a routine to see the readiness of its target muscles.</p>
      {/if}

      {#if !restDay && fatigueOverrideRequired}
        <div class="mt-5 flex items-start gap-3 rounded-xl bg-danger-soft px-4 py-3 text-danger" role="alert">
          <ShieldAlert class="mt-0.5 size-4 shrink-0" />
          <span class="min-w-0"><span class="block text-xs font-medium uppercase">Consecutive load warning</span><span class="mt-1 block text-xs opacity-80">{insights.consecutiveLoadDays} consecutive training days. This is a scheduling heuristic, not a recovery or injury prediction.</span></span>
        </div>
      {/if}

      <div class="mt-auto pt-6">
        {#if todayCompleted}
          <div class="flex min-h-16 w-full items-center justify-between gap-4 rounded-xl bg-success-soft px-5 text-left text-success" role="status">
            <span><span class="block text-[0.625rem] font-medium uppercase opacity-70">{primaryEyebrow}</span><span class="mt-1 block text-lg font-medium">{primaryLabel}</span></span><CheckCircle2 class="size-5 shrink-0" />
          </div>
        {:else if restDay}
          <div class="flex min-h-16 w-full items-center justify-between gap-4 rounded-xl bg-ink px-5 text-left text-paper" role="status">
            <span><span class="block text-[0.625rem] font-medium uppercase opacity-70">{primaryEyebrow}</span><span class="mt-1 block text-lg font-medium">{primaryLabel}</span></span><Moon class="size-5 shrink-0" />
          </div>
          <div class="mt-2 grid grid-cols-2 gap-2"><button class="min-h-11 rounded-xl bg-canvas px-3 text-sm font-medium disabled:opacity-40" disabled={!cycleRoutine} on:click={trainOnRestDay}>Train {cycleRoutine?.name ?? 'anyway'}</button><button class="min-h-11 rounded-xl bg-canvas px-3 text-sm font-medium" on:click={onManageRoutines}>Edit cycle</button></div>
        {:else}
          <button class:fatigue-action={!activeWorkout && fatigueOverrideRequired} class="flex min-h-16 w-full items-center justify-between gap-4 rounded-xl bg-ink px-5 text-left text-paper" on:click={primaryAction}>
            <span><span class="block text-[0.625rem] font-medium uppercase opacity-70">{primaryEyebrow}</span><span class="mt-1 block text-lg font-medium">{primaryLabel}</span></span><ArrowRight class="size-5 shrink-0" />
          </button>
        {/if}
        <div class:open={forceOverrideOpen} class="override-reveal" aria-hidden={!forceOverrideOpen} inert={!forceOverrideOpen}>
          <div><div class="pt-3"><div class="rounded-xl bg-danger-soft p-4 text-danger"><p class="text-sm font-medium">Three or more consecutive training days detected.</p><p class="mt-1 text-xs leading-5">Continue only if this additional load is intentional and recovery is adequate.</p><div class="mt-4 grid grid-cols-2 gap-2"><button class="min-h-12 rounded-xl bg-paper px-3 text-sm font-medium" on:click={() => { forceOverrideOpen = false }}>Not today</button><button class="min-h-12 rounded-xl bg-danger px-3 text-sm font-medium text-danger-ink" on:click={forceOverride}>Force override</button></div></div></div></div>
        </div>
      </div>
    </section>

    <WorkoutCalendar {workouts} {routines} {now} />

    <section class="col-span-2 rounded-2xl bg-paper p-5 sm:p-6 lg:col-span-12" aria-labelledby="recovery-heading">
      <div class="flex items-start justify-between gap-4">
        <div><p class="font-dot text-xs text-accent">RECOVERY</p><h2 id="recovery-heading" class="mt-1 text-xl font-medium">Muscle readiness</h2></div>
        <div class="shrink-0 text-right">
          {#if restrictedMuscleCount > 0}
            <p><span class="font-dot text-2xl tabular-nums">{restrictedMuscleCount}</span><span class="ml-1 text-[0.625rem] font-medium uppercase text-muted">below threshold</span></p>
          {:else}
            <p class="font-dot text-sm text-success">ESTIMATED READY</p>
          {/if}
          <span class:confidence-high={insights.recoveryConfidence.level === 'high'} class="mt-1 inline-block rounded-full bg-canvas px-2.5 py-1 text-[0.5625rem] font-medium uppercase text-muted">{insights.recoveryConfidence.label}</span>
        </div>
      </div>

      {#if insights.recovery.length > 0}
        <div class="mt-5 grid grid-cols-2 overflow-hidden border-t border-rule lg:grid-cols-3">
          {#each insights.recovery as recovery (recovery.muscle)}
            <article class="recovery-cell min-w-0 bg-paper p-4">
              <h3 class="text-sm font-medium">{recovery.muscle}</h3>
              <div class="mt-2 flex items-end justify-between gap-2">
                <p class:recovery-low={recovery.status === 'recover'} class="text-[0.5625rem] font-medium uppercase text-muted">{recoveryStatusLabel(recovery)}</p>
                <span class="font-dot shrink-0 text-2xl leading-none tabular-nums">{recovery.readiness}%</span>
              </div>
              <div class="mt-4">
                <SegmentedProgressBar
                  value={recovery.readiness}
                  tone={recovery.status === 'recover' ? 'danger' : 'default'}
                  ariaLabel={`${recovery.muscle} estimated readiness is ${recovery.readiness}% across a ${recovery.recoveryWindowHours}-hour heuristic window`}
                />
              </div>
              <div class="mt-2 flex items-start justify-between gap-2 text-[0.625rem] leading-4 text-muted">
                <span>{recovery.elapsedHours === null ? 'No prior load' : `${recovery.elapsedHours}h elapsed`}</span>
                <span class="shrink-0 text-right">{recoveryTiming(recovery)}</span>
              </div>
              {#if recovery.lastStimulusUnits !== null}
                <p class="mt-2 text-[0.625rem] leading-4 text-muted">Last session: {formatStimulusUnits(recovery.lastStimulusUnits)} modeled set units · {recovery.recoveryWindowHours}h decay</p>
              {/if}
            </article>
          {/each}
        </div>
        <p class="mt-3 text-xs leading-5 text-muted">{insights.recoveryConfidence.reason} Readiness is a modeled estimate from completed-set effort, muscle contribution, and fixed decay windows.</p>
      {:else}
        <div class="mt-6 border-t border-rule py-8 text-sm leading-6 text-muted">Complete a set to begin estimating muscle readiness.</div>
      {/if}
    </section>
    <div class="col-span-2 lg:col-span-12">
      <TrainingProgressReport
        compact
        report={progressReport}
        {aiSettings}
        {online}
        onOpenReport={onViewReport}
        {onOpenExercise}
      />
    </div>
  </div>
</div>

<style>
  .home-summary {
    line-height: 1.3;
    text-wrap: balance;
  }

  .fatigue-action { background: var(--color-danger); color: var(--color-danger-ink); }
  .confidence-high { background: var(--color-success-soft); color: var(--color-success); }
  .recovery-low { color: var(--color-danger); }
  .recovery-cell { border-right: 1px solid var(--color-rule); border-bottom: 1px solid var(--color-rule); }
  .recovery-cell:nth-child(2n) { border-right: 0; }
  @media (min-width: 64rem) {
    .recovery-cell:nth-child(2n) { border-right: 1px solid var(--color-rule); }
    .recovery-cell:nth-child(3n) { border-right: 0; }
  }
  .override-reveal { display: grid; grid-template-rows: 0fr; opacity: 0; visibility: hidden; pointer-events: none; transition: grid-template-rows 220ms cubic-bezier(0.25, 1, 0.5, 1), opacity 160ms ease-out, visibility 0s 220ms; }
  .override-reveal > div { min-height: 0; overflow: hidden; }
  .override-reveal.open { grid-template-rows: 1fr; opacity: 1; visibility: visible; pointer-events: auto; transition-delay: 0s; }
</style>
