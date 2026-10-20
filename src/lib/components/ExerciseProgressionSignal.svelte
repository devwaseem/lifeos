<script lang="ts">
  import { ArrowRight, CircleDot, Minus, TrendingDown, TrendingUp } from '@lucide/svelte'
  import type { ExerciseProgressionResult, ExerciseProgressionStatus } from '$lib/progression'

  export let result: ExerciseProgressionResult
  export let compact = false

  function formatPerformance(weight: number | null, reps: number | null) {
    if (reps === null) return '—'
    return `${weight === null || weight === 0 ? 'BW' : `${weight} kg`} × ${reps}`
  }

  function statusLabel(status: ExerciseProgressionStatus) {
    if (status === 'progressed') return 'Progressed'
    if (status === 'maintained') return 'Maintained'
    if (status === 'declined') return 'Declined'
    if (status === 'baseline') return 'Baseline logged'
    if (status === 'not-comparable') return 'No comparison'
    return 'First-set target'
  }

  function deltaLabel(repDelta: number | null) {
    if (repDelta === null || repDelta === 0) return null
    const magnitude = Math.abs(repDelta)
    return `${repDelta > 0 ? '+' : '−'}${magnitude} ${magnitude === 1 ? 'rep' : 'reps'}`
  }

  function effortLabel(effortTrend: ExerciseProgressionResult['effortTrend']) {
    if (effortTrend === 'lower') return 'Lower effort'
    if (effortTrend === 'higher') return 'Higher effort'
    if (effortTrend === 'same') return 'Same effort'
    return null
  }

  $: pendingTarget = result.status === 'pending' ? result.target : null
  $: label = statusLabel(result.status)
  $: delta = deltaLabel(result.repDelta)
  $: effort = effortLabel(result.effortTrend)
  $: previousPerformance = formatPerformance(result.previousSet?.weight ?? null, result.previousSet?.reps ?? null)
  $: currentPerformance = formatPerformance(result.currentSet?.weight ?? null, result.currentSet?.reps ?? null)
  $: targetPerformance = formatPerformance(pendingTarget?.targetWeight ?? null, pendingTarget?.targetReps ?? null)
  $: rpeComparison = result.previousSet?.rpe !== null && result.previousSet?.rpe !== undefined
    && result.currentSet?.rpe !== null && result.currentSet?.rpe !== undefined
    ? `RPE ${result.previousSet.rpe} → ${result.currentSet.rpe}`
    : null
</script>

{#if compact}
  <span class={`progression-badge ${result.status}`} aria-label={`First-set progression: ${label}${delta ? `, ${delta}` : ''}${effort ? `, ${effort}` : ''}`}>
    {#if result.status === 'progressed'}<TrendingUp class="size-3.5" />
    {:else if result.status === 'declined'}<TrendingDown class="size-3.5" />
    {:else if result.status === 'maintained'}<Minus class="size-3.5" />
    {:else}<CircleDot class="size-3.5" />{/if}
    <span>{label}{#if delta} · {delta}{/if}{#if effort} · {effort}{/if}</span>
  </span>
{:else}
  <section class={`progression-signal ${result.status}`} aria-label={`First-set progression: ${label}`} aria-live="polite">
    <div class="flex min-w-0 items-center gap-2">
      {#if result.status === 'progressed'}<TrendingUp class="size-4 shrink-0" />
      {:else if result.status === 'declined'}<TrendingDown class="size-4 shrink-0" />
      {:else if result.status === 'maintained'}<Minus class="size-4 shrink-0" />
      {:else}<CircleDot class="size-4 shrink-0" />{/if}
      <p class="text-[0.625rem] font-semibold uppercase tracking-[0.04em]">{label}</p>
      {#if delta}<span class="font-dot ml-auto shrink-0 text-base">{delta}</span>{/if}
    </div>

    {#if result.status === 'pending'}
      {#if pendingTarget && pendingTarget.previousReps !== null && pendingTarget.targetReps !== null}
        <div class="mt-2 flex items-center gap-2 text-sm tabular-nums">
          <span><span class="comparison-label">Last</span>{previousPerformance}</span>
          <ArrowRight class="size-4 shrink-0 text-muted" />
          <span class="font-medium text-accent-strong"><span class="comparison-label">Target</span>{targetPerformance}</span>
        </div>
      {:else}
        <p class="mt-2 text-sm text-muted">Complete the first working set to establish a baseline.</p>
      {/if}
    {:else if result.status === 'baseline'}
      <p class="mt-2 text-sm text-muted">This first working set starts the comparison history.</p>
    {:else if result.status === 'not-comparable'}
      <p class="mt-2 text-sm text-muted">The load changed outside the planned target.</p>
    {:else}
      <div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm tabular-nums">
        <span>{previousPerformance}</span><ArrowRight class="size-4 shrink-0 text-muted" /><span class="font-medium">{currentPerformance}</span>
        {#if effort || rpeComparison}<span class="text-xs text-muted">· {[effort, rpeComparison].filter(Boolean).join(' · ')}</span>{/if}
      </div>
    {/if}
  </section>
{/if}

<style>
  .progression-signal { border-radius: 0.75rem; background: var(--color-canvas); padding: 0.75rem; color: var(--color-ink); }
  .progression-signal.progressed { background: var(--color-success-soft); color: var(--color-success); }
  .progression-signal.declined { background: var(--color-danger-soft); color: var(--color-danger); }
  .progression-signal.pending { color: var(--color-ink); }
  .comparison-label { margin-right: 0.3rem; color: var(--color-muted); font-size: 0.5625rem; font-weight: 600; text-transform: uppercase; }
  .progression-badge { display: inline-flex; min-height: 1.75rem; align-items: center; gap: 0.35rem; border-radius: 9999px; background: var(--color-canvas); padding: 0.3rem 0.6rem; color: var(--color-muted); font-size: 0.625rem; font-weight: 600; text-transform: uppercase; white-space: nowrap; }
  .progression-badge.progressed { background: var(--color-success-soft); color: var(--color-success); }
  .progression-badge.declined { background: var(--color-danger-soft); color: var(--color-danger); }
  .progression-badge.maintained { color: var(--color-ink); }
</style>
