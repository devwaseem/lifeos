<script lang="ts">
  import { onMount } from 'svelte'
  import { ArrowRight, BrainCircuit, RefreshCw, Sparkles, X } from '@lucide/svelte'
  import {
    buildAiInsightContext,
    generateAiInsight,
    type AiInsight,
    type AiInsightDataset,
    type AiInsightKind,
    type AiInsightState,
  } from '$lib/ai-insights'
  import type { AiSettings } from '$lib/ai-coach'
  import type { ExerciseDefinition, RoutineTemplate, TrainingProfile, WorkoutSession } from '$lib/types'
  import { getAiInsightResult, saveAiInsightResult } from '$lib/storage'
  import { formatShortDate, formatTime } from '$lib/utils'

  export let kind: AiInsightKind
  export let subjectId = ''
  export let title: string
  export let description: string
  export let actionLabel: string
  export let workouts: WorkoutSession[]
  export let routines: RoutineTemplate[]
  export let exercises: ExerciseDefinition[]
  export let trainingProfile: TrainingProfile | null
  export let aiSettings: AiSettings
  export let online: boolean
  export let collapsible = false
  export let initiallyOpen = true

  const prompts = [
    'What has changed in my training over the last four weeks?',
    'Which exercises look stalled, and how strong is the evidence?',
    'Is my recent workload balanced across muscle groups?',
  ]

  let open = initiallyOpen
  let question = ''
  let state: AiInsightState = 'idle'
  let error: string | null = null
  let persistenceError: string | null = null
  let insight: AiInsight | null = null
  let analysisKey = `${kind}:${subjectId}`
  let mounted = false

  $: currentAnalysisKey = `${kind}:${subjectId}`
  $: if (currentAnalysisKey !== analysisKey) {
    analysisKey = currentAnalysisKey
    state = 'idle'
    error = null
    persistenceError = null
    insight = null
    if (mounted) void restoreSavedResult(analysisKey)
  }

  onMount(() => {
    mounted = true
    void restoreSavedResult(analysisKey)
    return () => { mounted = false }
  })

  async function restoreSavedResult(requestKey: string) {
    try {
      const saved = await getAiInsightResult(kind, subjectId)
      if (!mounted || requestKey !== analysisKey || !saved) return
      insight = saved.insight
      if (saved.question) question = saved.question
      state = 'success'
    } catch {
      if (mounted && requestKey === analysisKey) {
        persistenceError = 'Saved analysis could not be loaded from this device.'
      }
    }
  }

  async function analyze() {
    state = 'loading'
    error = null
    persistenceError = null
    try {
      const dataset: AiInsightDataset = { workouts, routines, exercises, profile: trainingProfile }
      const context = buildAiInsightContext({ kind, subjectId, question }, dataset)
      const generated = await generateAiInsight(aiSettings, context)
      insight = generated
      state = 'success'
      try {
        await saveAiInsightResult(generated, context.question)
      } catch {
        persistenceError = 'Analysis is visible now, but could not be saved on this device.'
      }
    } catch (reason) {
      error = reason instanceof Error ? reason.message : 'LifeOS could not complete this analysis.'
      state = 'error'
    }
  }
</script>

{#if collapsible && !open}
  <button class="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl bg-canvas px-4 text-left text-sm font-medium hover:bg-panel" type="button" on:click={() => { open = true }}>
    <span class="flex items-center gap-2"><BrainCircuit class="size-4 text-accent" />{actionLabel}</span>
    <ArrowRight class="size-4 text-muted" />
  </button>
{:else}
  <section class="overflow-hidden rounded-2xl bg-ink text-paper" aria-live="polite">
    <div class="p-5 sm:p-6">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="font-dot text-xs text-accent">{kind === 'natural-language' ? 'ASK LIFEOS' : 'AI REVIEW'}</p>
          <h2 class="mt-2 text-xl font-medium text-balance">{insight?.headline ?? title}</h2>
          <p class="mt-2 text-sm leading-6 text-paper/65">{insight?.summary ?? description}</p>
        </div>
        {#if collapsible}
          <button class="grid size-10 shrink-0 place-items-center rounded-full bg-paper/10 text-paper/65 hover:text-paper" type="button" on:click={() => { open = false }} aria-label={`Close ${title}`}><X class="size-4" /></button>
        {:else}
          <span class="grid size-10 shrink-0 place-items-center rounded-full bg-paper/10"><BrainCircuit class="size-5 text-accent" /></span>
        {/if}
      </div>

      {#if kind === 'natural-language' && !insight}
        <label class="mt-6 block text-sm font-medium" for="contextual-training-question">Your question</label>
        <textarea
          id="contextual-training-question"
          class="mt-2 min-h-28 w-full resize-y rounded-xl border border-paper/15 bg-paper/10 px-4 py-3 text-base leading-6 text-paper outline-none placeholder:text-paper/35 focus:border-accent"
          bind:value={question}
          maxlength="500"
          placeholder="Why has my bench stalled?"
        ></textarea>
        <div class="mt-3 flex flex-wrap gap-2" aria-label="Suggested training questions">
          {#each prompts as prompt}
            <button class="min-h-10 rounded-full border border-paper/15 px-3 text-left text-xs text-paper/60 hover:border-paper/40 hover:text-paper" type="button" on:click={() => { question = prompt }}>{prompt}</button>
          {/each}
        </div>
      {/if}

      {#if error}<p class="mt-5 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{error}</p>{/if}
      {#if persistenceError}<p class="mt-5 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning" role="status">{persistenceError}</p>{/if}
      {#if !online}<p class="mt-5 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning" role="status">AI analysis requires a connection.</p>{/if}

      {#if insight}
        <div class="mt-6 divide-y divide-paper/15 border-y border-paper/15">
          {#each insight.findings as finding, index}
            <article class="grid gap-2 py-5 sm:grid-cols-[2rem_1fr]">
              <span class="font-dot text-xs text-accent">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3 class="font-medium">{finding.title}</h3>
                <p class="mt-2 text-sm leading-6 text-paper/70">{finding.detail}</p>
                <p class="mt-3 text-xs leading-5 text-paper/45">Evidence: {finding.evidence.map((item) => item.label).join(' · ')}</p>
              </div>
            </article>
          {/each}
        </div>

        {#if insight.actions.length > 0}
          <div class="mt-5">
            <p class="font-dot text-xs text-accent">NEXT MOVES</p>
            <ul class="mt-3 space-y-2">
              {#each insight.actions as action}<li class="flex gap-3 text-sm leading-6"><ArrowRight class="mt-1 size-4 shrink-0 text-accent" /><span>{action}</span></li>{/each}
            </ul>
          </div>
        {/if}

        <details class="mt-5 border-t border-paper/15 pt-4 text-xs text-paper/55">
          <summary class="min-h-10 cursor-pointer font-medium text-paper/75">View cited data</summary>
          <dl class="mt-3 space-y-3">
            {#each insight.evidence as item}<div><dt class="font-medium text-paper/80">{item.label}</dt><dd class="mt-1 leading-5">{item.value}</dd></div>{/each}
          </dl>
        </details>
        <p class="mt-4 border-t border-paper/15 pt-4 text-[0.6875rem] leading-5 text-paper/40">{insight.provider.label} · {insight.provider.model} · {formatShortDate(insight.generatedAt)} at {formatTime(insight.generatedAt)}<br />{insight.caveat}</p>
      {/if}

      <button
        class="mt-6 flex min-h-12 w-full items-center justify-between rounded-xl bg-paper px-4 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:bg-paper/15 disabled:text-paper/35 sm:w-auto sm:min-w-56"
        type="button"
        on:click={analyze}
        disabled={!online || state === 'loading' || (kind === 'natural-language' && question.trim().length < 3) || (kind !== 'natural-language' && !subjectId)}
      >
        <span>{state === 'loading' ? 'Analyzing logged data…' : insight ? 'Refresh analysis' : actionLabel}</span>
        {#if state === 'loading'}<RefreshCw class="size-4 animate-spin" />{:else if insight}<Sparkles class="size-4 text-accent" />{:else}<ArrowRight class="size-4" />{/if}
      </button>
      <p class="mt-4 text-xs leading-5 text-paper/40">Results are saved on this device until you refresh them. Private notes are excluded. Training analysis only—not medical advice.</p>
    </div>
  </section>
{/if}
