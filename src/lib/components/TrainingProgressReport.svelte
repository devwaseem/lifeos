<script lang="ts">
  import { onMount } from 'svelte'
  import { Activity, ArrowLeft, ArrowRight, BrainCircuit, CloudOff, Minus, RefreshCw, ShieldAlert, Sparkles, TrendingDown, TrendingUp } from '@lucide/svelte'
  import { buildTrainingReportInsightContext, generateAiInsight, type AiInsight, type AiInsightState } from '$lib/ai-insights'
  import type { AiSettings } from '$lib/ai-coach'
  import type { ExerciseTrendStatus, TrainingProgressReport as TrainingProgressReportData, TrainingReportVerdict } from '$lib/training-progress-report'
  import { getAiInsightResult, saveAiInsightResult } from '$lib/storage'
  import { formatShortDate, formatTime } from '$lib/utils'

  export let report: TrainingProgressReportData
  export let aiSettings: AiSettings
  export let online: boolean
  export let compact = false
  export let onBack: () => void = () => {}
  export let onOpenReport: () => void = () => {}
  export let onOpenExercise: (exerciseId: string, exerciseName: string) => void = () => {}

  let narrative: AiInsight | null = null
  let narrativeState: AiInsightState = 'idle'
  let narrativeError: string | null = null
  let persistenceError: string | null = null
  let reportKey = report.fingerprint
  let mounted = false

  $: if (report.fingerprint !== reportKey) {
    reportKey = report.fingerprint
    narrative = null
    narrativeState = 'idle'
    narrativeError = null
    persistenceError = null
    if (mounted && !compact) void restoreNarrative(reportKey)
  }

  $: verdictLabel = labelForVerdict(report.verdict.status)
  $: progressingCount = report.exerciseTrends.filter((trend) => trend.status === 'progressing').length
  $: decliningCount = report.exerciseTrends.filter((trend) => trend.status === 'declining').length
  $: stableCount = report.exerciseTrends.filter((trend) => trend.status === 'stable').length
  $: recommendationBlocked = report.trainingState.recommendationBlocked

  onMount(() => {
    mounted = true
    if (!compact) void restoreNarrative(reportKey)
    return () => { mounted = false }
  })

  async function restoreNarrative(key: string) {
    try {
      const saved = await getAiInsightResult('training-report', key)
      if (!mounted || key !== reportKey || !saved) return
      narrative = saved.insight
      narrativeState = 'success'
    } catch {
      if (mounted && key === reportKey) persistenceError = 'The saved narrative could not be loaded from this device.'
    }
  }

  async function generateNarrative() {
    narrativeState = 'loading'
    narrativeError = null
    persistenceError = null
    try {
      const context = buildTrainingReportInsightContext(report)
      const generated = await generateAiInsight(aiSettings, context)
      narrative = generated
      narrativeState = 'success'
      try {
        await saveAiInsightResult(generated, null)
      } catch {
        persistenceError = 'The narrative is visible now, but could not be saved on this device.'
      }
    } catch (reason) {
      narrativeError = reason instanceof Error ? reason.message : 'LifeOS could not generate this report narrative.'
      narrativeState = 'error'
    }
  }

  function labelForVerdict(verdict: TrainingReportVerdict) {
    if (verdict === 'progressing') return 'Progressing'
    if (verdict === 'needs-attention') return 'Needs attention'
    if (verdict === 'mixed') return 'Mixed signals'
    if (verdict === 'stable') return 'Holding steady'
    return 'Building evidence'
  }

  function verdictSummary(verdict: TrainingReportVerdict) {
    if (verdict === 'progressing') return 'Your comparable exercise history contains more meaningful upward trends than stalls or declines.'
    if (verdict === 'needs-attention') return 'Repeated declines appear across more than one comparable exercise. Treat this as a training signal, not a diagnosis.'
    if (verdict === 'mixed') return 'Some exercises are moving while others are stable or declining, so one headline would hide important differences.'
    if (verdict === 'stable') return 'Comparable exercises are staying within the app’s normal-variation band.'
    return 'Keep logging the same exercises and RPE. Six comparable exposures are needed before LifeOS calls a trend.'
  }

  function statusLabel(status: ExerciseTrendStatus) {
    if (status === 'progressing') return 'Progressing'
    if (status === 'declining') return 'Declining'
    if (status === 'stable') return 'Stable'
    return 'More data'
  }

  function formatTrend(value: number | null) {
    if (value === null) return '—'
    return `${value > 0 ? '+' : ''}${value}%`
  }

  function formatRatio(value: number | null) {
    return value === null ? '—' : `${value.toFixed(2)}×`
  }

  function formatSet(trend: TrainingProgressReportData['exerciseTrends'][number]) {
    const exposure = trend.latestExposure
    if (!exposure) return 'No comparable set'
    const load = exposure.weight === null ? 'Bodyweight' : `${exposure.weight} kg`
    const reps = exposure.repetitions === null ? 'reps unlogged' : `${exposure.repetitions} reps`
    return `${load} × ${reps}${exposure.rpe === null ? '' : ` · RPE ${exposure.rpe}`}`
  }
</script>

{#if compact}
  <section class="overflow-hidden rounded-2xl bg-paper" aria-labelledby="home-report-heading">
    <div class="grid lg:grid-cols-12">
      <div class="flex flex-col bg-ink p-5 text-paper sm:p-6 lg:col-span-4">
        <div class="flex items-center justify-between gap-4">
          <p class="font-dot text-xs text-accent">DAILY SIGNALS</p>
          <span class="rounded-full bg-paper/10 px-2.5 py-1 text-[0.5625rem] font-medium uppercase text-paper/65">{report.verdict.confidence} confidence</span>
        </div>
        <h2 id="home-report-heading" class="mt-5 text-[clamp(2.5rem,7vw,3.75rem)] font-semibold leading-[0.9] tracking-[-0.055em]">{verdictLabel}</h2>
        <p class="mt-4 text-sm leading-6 text-paper/65">{verdictSummary(report.verdict.status)}</p>
        <p class="mt-5 text-[0.625rem] text-paper/55">{progressingCount} progressing · {stableCount} stable · {decliningCount} declining</p>
        <button class="mt-7 flex min-h-12 items-center justify-between rounded-xl bg-paper px-4 text-left text-sm font-medium text-ink lg:mt-auto" type="button" on:click={onOpenReport}><span>Open full report</span><ArrowRight class="size-4 text-accent" /></button>
      </div>

      <div class="p-5 sm:p-6 lg:col-span-8">
        <dl class="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-rule sm:grid-cols-4">
          <div class="bg-canvas p-4"><dt class="text-[0.5625rem] font-medium uppercase text-muted">Target readiness</dt><dd class="font-dot mt-2 text-2xl tabular-nums">{report.currentRoutine ? `${report.trainingState.readiness.targetReadiness}%` : '—'}</dd></div>
          <div class="bg-canvas p-4"><dt class="text-[0.5625rem] font-medium uppercase text-muted">Load ratio</dt><dd class="font-dot mt-2 text-2xl tabular-nums">{formatRatio(report.workload.ratio)}</dd></div>
          <div class="bg-canvas p-4"><dt class="text-[0.5625rem] font-medium uppercase text-muted">Progressing</dt><dd class="font-dot mt-2 text-2xl tabular-nums">{progressingCount}</dd></div>
          <div class="bg-canvas p-4"><dt class="text-[0.5625rem] font-medium uppercase text-muted">Declining</dt><dd class="font-dot mt-2 text-2xl tabular-nums">{decliningCount}</dd></div>
        </dl>

        <div class="mt-6 flex items-end justify-between gap-4">
          <div><p class="font-dot text-xs text-accent">TOP SIGNALS</p><h3 class="mt-1 text-lg font-medium">Exercise progression</h3></div>
          <button class="min-h-11 px-2 text-xs font-medium text-muted hover:text-ink" type="button" on:click={onOpenReport}>View all</button>
        </div>
        {#if report.exerciseTrends.length > 0}
          <div class="mt-2 divide-y divide-rule border-y border-rule">
            {#each report.exerciseTrends.slice(0, 3) as trend (trend.exerciseId)}
              <button class="flex min-h-16 w-full items-center gap-3 py-3 text-left" type="button" on:click={() => onOpenExercise(trend.exerciseId, trend.name)} aria-label={`Open ${trend.name} progress details`}>
                <span class:trend-positive={trend.status === 'progressing'} class:trend-negative={trend.status === 'declining'} class="trend-icon">
                  {#if trend.status === 'progressing'}<TrendingUp class="size-4" />{:else if trend.status === 'declining'}<TrendingDown class="size-4" />{:else}<Minus class="size-4" />{/if}
                </span>
                <span class="min-w-0 flex-1"><span class="block truncate text-sm font-medium">{trend.name}</span><span class="mt-1 block text-xs text-muted">{trend.profile.comparableSessions} comparable sessions · {trend.profile.confidence}</span></span>
                <span class:trend-positive-text={trend.status === 'progressing'} class:trend-negative-text={trend.status === 'declining'} class="font-dot shrink-0 text-sm">{formatTrend(trend.profile.trendPercent)}</span>
                <ArrowRight class="size-4 shrink-0 text-muted" />
              </button>
            {/each}
          </div>
        {:else}
          <p class="mt-4 text-sm leading-6 text-muted">Complete working sets with load, repetitions, and RPE to build comparable exercise trends.</p>
        {/if}

        {#if report.performanceSignal.status !== 'stable'}
          <div class="mt-5 rounded-xl bg-warning-soft px-4 py-3 text-sm leading-6 text-warning" role="status">
            <p class="font-medium">{report.performanceSignal.title}</p>
            <p class="mt-1 text-xs leading-5">{report.performanceSignal.recommendation}</p>
          </div>
        {/if}
      </div>
    </div>

    {#if report.freshness.hasUnsyncedChanges}
      <p class="flex items-start gap-2 border-t border-rule bg-warning-soft px-5 py-3 text-xs leading-5 text-warning" role="status"><CloudOff class="mt-0.5 size-3.5 shrink-0" />These signals include device-local changes that have not reached the cloud.</p>
    {/if}
    {#if recommendationBlocked}
      <p class="flex items-start gap-2 border-t border-rule bg-danger-soft px-5 py-3 text-xs leading-5 text-danger" role="alert"><ShieldAlert class="mt-0.5 size-3.5 shrink-0" />The latest check-in records pain or illness. Training-change recommendations are blocked.</p>
    {/if}
  </section>
{:else}
<div class="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-7 xl:px-10">
  <header class="px-1 pt-2 sm:px-2 sm:pt-4">
    <button class="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted hover:text-ink" type="button" on:click={onBack}><ArrowLeft class="size-4" />Back</button>
    <div class="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)] lg:items-end">
      <div>
        <p class="font-dot text-xs text-accent">{report.period.days}-DAY TRAINING REPORT</p>
        <h1 class="mt-3 max-w-4xl text-[clamp(2.75rem,8vw,6.75rem)] font-semibold leading-[0.86] tracking-[-0.065em]">{verdictLabel}</h1>
        <p class="mt-6 max-w-3xl text-base leading-7 text-muted sm:text-lg">{narrative?.summary ?? verdictSummary(report.verdict.status)}</p>
      </div>
      <div class="border-t border-rule pt-5 lg:border-l lg:border-t-0 lg:pb-1 lg:pl-7 lg:pt-0">
        <dl class="grid grid-cols-2 gap-x-6 gap-y-5">
          <div><dt class="text-[0.625rem] font-medium uppercase text-muted">Confidence</dt><dd class="font-dot mt-1 text-xl capitalize">{report.verdict.confidence}</dd></div>
          <div><dt class="text-[0.625rem] font-medium uppercase text-muted">Sessions</dt><dd class="font-dot mt-1 text-xl tabular-nums">{report.coverage.completedSessions}</dd></div>
          <div><dt class="text-[0.625rem] font-medium uppercase text-muted">Comparable</dt><dd class="font-dot mt-1 text-xl tabular-nums">{report.coverage.comparableExercises}</dd></div>
          <div><dt class="text-[0.625rem] font-medium uppercase text-muted">As of</dt><dd class="mt-1 text-sm font-medium">{formatShortDate(report.asOf)}</dd></div>
        </dl>
      </div>
    </div>
  </header>

  {#if report.freshness.hasUnsyncedChanges}
    <div class="mt-8 flex items-start gap-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning" role="status"><CloudOff class="mt-0.5 size-4 shrink-0" /><span>This report includes device-local changes that have not reached the cloud yet. Local data is used here.</span></div>
  {/if}
  {#if recommendationBlocked}
    <div class="mt-4 flex items-start gap-3 rounded-xl bg-danger-soft px-4 py-3 text-sm leading-6 text-danger" role="alert"><ShieldAlert class="mt-1 size-4 shrink-0" /><span>The latest check-in records pain or illness. LifeOS will summarize the log but will not recommend training changes or provide clearance.</span></div>
  {/if}

  <div class="mt-10 space-y-5">
    <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Report summary metrics">
      <article class="metric-card"><p class="metric-label">7-day load</p><p class="metric-value">{report.workload.recentLoad ?? '—'}</p><p class="metric-detail">{report.workload.context.replace('-', ' ')}</p></article>
      <article class="metric-card"><p class="metric-label">Prior weekly average</p><p class="metric-value">{report.workload.weeklyAverageLoad ?? '—'}</p><p class="metric-detail">Load units · {report.workload.confidence} confidence</p></article>
      <article class="metric-card"><p class="metric-label">Load ratio</p><p class="metric-value">{formatRatio(report.workload.ratio)}</p><p class="metric-detail">Recent 7 days versus prior 4-week average</p></article>
      <article class="metric-card"><p class="metric-label">Target readiness</p><p class="metric-value">{report.currentRoutine ? `${report.trainingState.readiness.targetReadiness}%` : '—'}</p><p class="metric-detail">{report.currentRoutine?.name ?? 'No current routine'} · modeled estimate</p></article>
    </section>

    <section class="overflow-hidden rounded-2xl bg-paper" aria-labelledby="exercise-progress-heading">
      <div class="flex flex-wrap items-end justify-between gap-4 border-b border-rule px-5 py-5 sm:px-6">
        <div><p class="font-dot text-xs text-accent">WHAT CHANGED</p><h2 id="exercise-progress-heading" class="mt-2 text-2xl font-medium">Exercise progression</h2></div>
        <p class="text-xs text-muted">{progressingCount} progressing · {stableCount} stable · {decliningCount} declining</p>
      </div>
      {#if report.exerciseTrends.length > 0}
        <div class="divide-y divide-rule">
          {#each report.exerciseTrends as trend (trend.exerciseId)}
            <button class="trend-row" type="button" on:click={() => onOpenExercise(trend.exerciseId, trend.name)} aria-label={`Open ${trend.name} progress details`}>
              <span class="flex min-w-0 items-center gap-3">
                <span class:trend-positive={trend.status === 'progressing'} class:trend-negative={trend.status === 'declining'} class="trend-icon">
                  {#if trend.status === 'progressing'}<TrendingUp class="size-4" />{:else if trend.status === 'declining'}<TrendingDown class="size-4" />{:else}<Minus class="size-4" />{/if}
                </span>
                <span class="min-w-0"><span class="block truncate font-medium">{trend.name}</span><span class="mt-1 block truncate text-xs text-muted">{trend.muscle} · {formatSet(trend)}</span></span>
              </span>
              <span class="trend-stat"><span>Trend</span><strong class:trend-positive-text={trend.status === 'progressing'} class:trend-negative-text={trend.status === 'declining'}>{formatTrend(trend.profile.trendPercent)}</strong></span>
              <span class="trend-stat"><span>Current e1RM</span><strong>{trend.profile.currentEstimated1Rm ?? '—'}</strong></span>
              <span class="trend-stat"><span>Evidence</span><strong>{trend.profile.comparableSessions} sessions · {trend.profile.confidence}</strong></span>
              <span class="trend-status">{statusLabel(trend.status)}<ArrowRight class="size-4" /></span>
            </button>
          {/each}
        </div>
      {:else}
        <div class="px-5 py-10 text-center sm:px-6"><Activity class="mx-auto size-7 text-muted" /><p class="mt-3 font-medium">No strength trends yet</p><p class="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">Complete working sets with load, repetitions, and RPE to build exercise-specific comparisons.</p></div>
      {/if}
    </section>

    <div class="grid gap-5 lg:grid-cols-12">
      <section class="rounded-2xl bg-ink p-5 text-paper sm:p-6 lg:col-span-7" aria-labelledby="performance-heading">
        <p class="font-dot text-xs text-accent">LOAD &amp; PERFORMANCE</p>
        <h2 id="performance-heading" class="mt-2 text-2xl font-medium">{report.performanceSignal.title}</h2>
        <p class="mt-3 text-sm leading-6 text-paper/65">{report.performanceSignal.recommendation}</p>
        <dl class="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-paper/15 sm:grid-cols-4">
          <div class="signal-stat"><dt>Signal</dt><dd>{report.performanceSignal.status.replace('-', ' ')}</dd></div>
          <div class="signal-stat"><dt>Performance</dt><dd>{formatTrend(report.performanceSignal.performanceChangePercent)}</dd></div>
          <div class="signal-stat"><dt>RPE change</dt><dd>{report.performanceSignal.rpeChange === null ? '—' : `${report.performanceSignal.rpeChange > 0 ? '+' : ''}${report.performanceSignal.rpeChange}`}</dd></div>
          <div class="signal-stat"><dt>Training days</dt><dd>{report.trainingState.readiness.consecutiveLoadDays}</dd></div>
        </dl>
        {#if report.performanceSignal.affectedExercises.length > 0}<p class="mt-5 text-xs leading-5 text-paper/50">Affected exercises: {report.performanceSignal.affectedExercises.join(' · ')}</p>{/if}
      </section>

      <section class="rounded-2xl bg-paper p-5 sm:p-6 lg:col-span-5" aria-labelledby="check-in-heading">
        <p class="font-dot text-xs text-accent">LATEST CONTEXT</p><h2 id="check-in-heading" class="mt-2 text-2xl font-medium">Pre-workout check-in</h2>
        {#if report.latestCheckIn}
          <dl class="mt-6 grid grid-cols-5 gap-2 text-center">
            {#each [['Sleep', report.latestCheckIn.sleepQuality], ['Energy', report.latestCheckIn.energy], ['Soreness', report.latestCheckIn.soreness], ['Stress', report.latestCheckIn.stress], ['Drive', report.latestCheckIn.motivation]] as item}
              <div class="rounded-xl bg-canvas px-1 py-3"><dt class="text-[0.5625rem] uppercase text-muted">{item[0]}</dt><dd class="font-dot mt-1 text-lg">{item[1]}/5</dd></div>
            {/each}
          </dl>
          <p class="mt-5 text-xs leading-5 text-muted">Recorded {formatShortDate(report.latestCheckIn.recordedAt)}. Subjective context is not a physiological fatigue measurement.</p>
        {:else}
          <p class="mt-6 text-sm leading-6 text-muted">No check-in is available yet. Future workouts save one before the session starts.</p>
        {/if}
      </section>
    </div>

    <section class="rounded-2xl bg-paper p-5 sm:p-6" aria-labelledby="routine-review-heading">
      <div class="flex flex-wrap items-end justify-between gap-4"><div><p class="font-dot text-xs text-accent">PROGRAM VIEW</p><h2 id="routine-review-heading" class="mt-2 text-2xl font-medium">Routine distribution</h2></div><p class="text-xs text-muted">Descriptive volume, not a universal prescription</p></div>
      {#if report.routineReviews.length > 0}
        <div class="mt-6 grid gap-4 lg:grid-cols-2">
          {#each report.routineReviews as review (review.routine.id)}
            <article class="rounded-xl border border-rule p-4">
              <div class="flex items-start justify-between gap-4"><div><h3 class="font-medium">{review.routine.name}</h3><p class="mt-1 text-xs text-muted">{review.routine.exerciseCount} exercises · {review.workingSetsPerExposure} working sets</p></div><span class="font-dot text-sm tabular-nums">{review.targetReadiness}% READY</span></div>
              <div class="mt-4 flex flex-wrap gap-2">{#each review.muscleSetEquivalents.slice(0, 8) as dose}<span class="rounded-full bg-canvas px-2.5 py-1 text-[0.625rem] text-muted">{dose.muscle} {dose.sets}</span>{/each}</div>
              {#if review.excludedExercises.length > 0}<p class="mt-4 text-xs leading-5 text-danger">Profile conflict: {review.excludedExercises.map((exercise) => exercise.name).join(', ')}</p>{/if}
            </article>
          {/each}
        </div>
      {:else}<p class="mt-6 text-sm text-muted">No active routines are available to review.</p>{/if}
    </section>

    <section class="rounded-2xl border border-ink bg-canvas p-5 sm:p-6" aria-labelledby="narrative-heading">
      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div><p class="font-dot text-xs text-accent">AI SYNTHESIS</p><h2 id="narrative-heading" class="mt-2 text-2xl font-medium">{narrative?.headline ?? 'Turn the evidence into next decisions'}</h2><p class="mt-3 max-w-3xl text-sm leading-6 text-muted">{narrative?.summary ?? 'LifeOS can explain the strongest progression signals, separate them from low-confidence variation, and prioritize what to do next. Every finding must cite this report.'}</p></div>
        <button class="flex min-h-12 items-center justify-between gap-4 rounded-xl bg-ink px-4 text-sm font-medium text-paper disabled:cursor-not-allowed disabled:opacity-45" type="button" on:click={generateNarrative} disabled={!online || narrativeState === 'loading'}><span>{narrativeState === 'loading' ? 'Writing report…' : narrative ? 'Refresh narrative' : 'Generate narrative'}</span>{#if narrativeState === 'loading'}<RefreshCw class="size-4 animate-spin" />{:else}<Sparkles class="size-4 text-accent" />{/if}</button>
      </div>
      {#if !online}<p class="mt-5 flex items-center gap-2 text-sm text-warning" role="status"><CloudOff class="size-4" />The deterministic report remains available offline. Connect to generate the editorial narrative.</p>{/if}
      {#if narrativeError}<p class="mt-5 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{narrativeError}</p>{/if}
      {#if persistenceError}<p class="mt-5 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning" role="status">{persistenceError}</p>{/if}
      {#if narrative}
        <div class="mt-7 grid gap-4 sm:grid-cols-2">
          {#each narrative.findings as finding, index}
            <article class="border-t border-rule pt-4"><p class="font-dot text-xs text-accent">{String(index + 1).padStart(2, '0')}</p><h3 class="mt-2 font-medium">{finding.title}</h3><p class="mt-2 text-sm leading-6 text-muted">{finding.detail}</p><p class="mt-3 text-[0.6875rem] leading-5 text-muted">Evidence: {finding.evidence.map((item) => item.label).join(' · ')}</p></article>
          {/each}
        </div>
        {#if narrative.actions.length > 0}<div class="mt-7 border-t border-rule pt-5"><p class="font-dot text-xs text-accent">NEXT MOVES</p><ol class="mt-4 grid gap-3 sm:grid-cols-2">{#each narrative.actions as action, index}<li class="flex gap-3 text-sm leading-6"><span class="font-dot text-xs text-accent">{String(index + 1).padStart(2, '0')}</span><span>{action}</span></li>{/each}</ol></div>{/if}
        <p class="mt-6 text-[0.6875rem] leading-5 text-muted"><BrainCircuit class="mr-1 inline size-3" />{narrative.provider.label} · {narrative.provider.model} · {formatShortDate(narrative.generatedAt)} at {formatTime(narrative.generatedAt)}<br />{narrative.caveat}</p>
      {/if}
    </section>

    <details class="rounded-2xl bg-paper p-5 sm:p-6">
      <summary class="min-h-10 cursor-pointer font-medium">Evidence quality and limitations</summary>
      <div class="mt-5 grid gap-6 lg:grid-cols-2">
        <div><h3 class="text-xs font-medium uppercase text-muted">Evidence</h3><dl class="mt-3 divide-y divide-rule">{#each report.evidence as item}<div class="py-3"><dt class="text-sm font-medium">{item.metric}</dt><dd class="mt-1 text-xs leading-5 text-muted">{item.status.replace('-', ' ')} · {item.confidence} confidence · method {item.implementationVersion}</dd></div>{/each}</dl></div>
        <div><h3 class="text-xs font-medium uppercase text-muted">Limitations</h3><ul class="mt-3 space-y-3">{#each report.limitations as limitation}<li class="flex gap-3 text-xs leading-5 text-muted"><span class="mt-2 size-1 shrink-0 rounded-full bg-accent"></span><span>{limitation}</span></li>{/each}</ul></div>
      </div>
    </details>
  </div>
</div>
{/if}

<style>
  .metric-card { min-height: 10rem; border-radius: 1rem; background: var(--color-paper); padding: 1.25rem; }
  .metric-label { font-size: 0.625rem; font-weight: 500; text-transform: uppercase; color: var(--color-muted); }
  .metric-value { margin-top: 1.25rem; font-family: var(--font-display); font-size: clamp(2rem, 6vw, 3.25rem); line-height: 1; font-variant-numeric: tabular-nums; }
  .metric-detail { margin-top: 0.75rem; font-size: 0.75rem; line-height: 1.25rem; color: var(--color-muted); }
  .trend-row { display: grid; width: 100%; grid-template-columns: minmax(0, 1fr); gap: 0.875rem; padding: 1rem 1.25rem; text-align: left; }
  .trend-row:hover { background: var(--color-canvas); }
  .trend-icon { display: grid; width: 2.25rem; height: 2.25rem; flex: none; place-items: center; border-radius: 9999px; background: var(--color-canvas); color: var(--color-muted); }
  .trend-positive { background: var(--color-success-soft); color: var(--color-success); }
  .trend-negative { background: var(--color-danger-soft); color: var(--color-danger); }
  .trend-stat { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; padding-left: 3rem; font-size: 0.75rem; color: var(--color-muted); }
  .trend-stat strong { color: var(--color-ink); font-weight: 500; }
  .trend-positive-text { color: var(--color-success) !important; }
  .trend-negative-text { color: var(--color-danger) !important; }
  .trend-status { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding-left: 3rem; font-size: 0.75rem; font-weight: 500; }
  .signal-stat { background: color-mix(in srgb, var(--color-ink) 94%, var(--color-paper)); padding: 1rem; }
  .signal-stat dt { font-size: 0.5625rem; text-transform: uppercase; color: color-mix(in srgb, var(--color-paper) 50%, transparent); }
  .signal-stat dd { margin-top: 0.5rem; font-family: var(--font-display); font-size: 0.875rem; text-transform: capitalize; }
  @media (min-width: 768px) {
    .trend-row { grid-template-columns: minmax(15rem, 1.6fr) minmax(5rem, 0.55fr) minmax(6rem, 0.65fr) minmax(9rem, 0.85fr) minmax(7rem, 0.7fr); align-items: center; gap: 1rem; padding-inline: 1.5rem; }
    .trend-stat { display: block; padding-left: 0; }
    .trend-stat span { display: block; font-size: 0.5625rem; text-transform: uppercase; }
    .trend-stat strong { display: block; margin-top: 0.35rem; }
    .trend-status { justify-content: flex-end; padding-left: 0; }
  }
</style>
