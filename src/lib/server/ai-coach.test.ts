import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CoachBriefContext } from '../ai-coach'
import { handleAiCoachRequest, handleAiInsightsRequest, type AiCoachEnvironment } from './ai-coach'

const generated = {
  outcome: 'proceed',
  headline: 'Keep the plan steady',
  summary: 'Your recorded signals support keeping the selected routine unchanged today.',
  actions: ['Use the saved first-set targets'],
  evidenceRefs: ['target-readiness', 'systemic-load'],
}

function context(overrides: Partial<CoachBriefContext> = {}): CoachBriefContext {
  return {
    asOf: '2026-10-22T12:00:00.000Z',
    localDate: '2026-10-22',
    plan: {
      routineId: 'push-a',
      name: 'Push A',
      restDay: false,
      exercises: [{
        exerciseId: 'bench-press',
        name: 'Barbell Bench Press',
        muscle: 'Chest',
        equipment: 'Barbell',
        workingSets: 3,
        repRange: { min: 6, max: 10 },
        latestExposure: { completedAt: '2026-10-20T09:00:00.000Z', weight: 80, repetitions: 8, rpe: 8 },
        strengthTrend: { trendPercent: 2, comparableSessions: 6, confidence: 'high' },
      }],
    },
    profile: null,
    latestCheckIn: null,
    readiness: {
      targetReadiness: 86,
      targetMuscles: ['Chest'],
      confidence: 'high',
      consecutiveTrainingDays: 1,
      systemicFatigueWarning: false,
      limitingMuscles: [],
    },
    systemicLoad: {
      context: 'near-recent',
      ratio: 1,
      recentSessionCount: 4,
      recentSessionsWithEffort: 4,
      confidence: 'high',
    },
    performance: {
      status: 'stable',
      title: 'Performance holding steady',
      affectedExercises: [],
      performanceChangePercent: null,
      rpeChange: null,
      confidence: 'moderate',
    },
    evidence: [
      { id: 'target-readiness', label: 'Target readiness: 86%' },
      { id: 'systemic-load', label: 'Seven-day internal load is near the prior average' },
    ],
    ...overrides,
  }
}

function request(
  provider = 'auto',
  coachContext = context(),
  models: Record<string, string> = {},
  credentials: Record<string, { apiKey?: string; accountId?: string }> = {},
) {
  return new Request('http://localhost/api/coach', {
    method: 'POST',
    headers: { Authorization: 'Bearer local-test', 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, models, credentials, context: coachContext }),
  })
}

function environment(overrides: Partial<AiCoachEnvironment> = {}): AiCoachEnvironment {
  return { LOCAL_SYNC_TOKEN: 'local-test', ...overrides }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('AI coach providers', () => {
  it('lists every available provider without exposing credentials', async () => {
    const response = await handleAiCoachRequest(
      new Request('http://localhost/api/coach', { headers: { Authorization: 'Bearer local-test' } }),
      environment({
        AI: { run: vi.fn() } as unknown as Ai,
        GEMINI_API_KEY: 'gemini-secret',
        GEMINI_MODEL: 'gemini-test-model',
        ANTHROPIC_API_KEY: 'anthropic-secret',
        ANTHROPIC_MODEL: 'claude-model',
      }),
    )
    const body = await response.json() as { providers: Array<{ id: string }> }

    expect(response.status).toBe(200)
    expect(body.providers.map((provider: { id: string }) => provider.id)).toEqual(['gemini', 'workers-ai', 'anthropic'])
    expect(JSON.stringify(body)).not.toContain('secret')
  })

  it('generates a schema-constrained brief with Cloudflare Workers AI', async () => {
    const run = vi.fn(async () => ({ response: generated }))
    const response = await handleAiCoachRequest(request('workers-ai'), environment({ AI: { run } as unknown as Ai }))
    const body = await response.json() as { headline: string; evidence: Array<{ id: string }>; provider: { id: string } }

    expect(response.status).toBe(200)
    expect(run).toHaveBeenCalledWith(
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      expect.objectContaining({ response_format: expect.objectContaining({ type: 'json_schema' }) }),
    )
    expect(body).toMatchObject({
      headline: generated.headline,
      evidence: [{ id: 'target-readiness' }, { id: 'systemic-load' }],
      provider: { id: 'workers-ai' },
    })
  })

  it('uses a browser-saved token and account ID with the Cloudflare Workers AI REST API', async () => {
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) => Response.json({ result: { response: generated } }))
    vi.stubGlobal('fetch', fetch)

    const response = await handleAiCoachRequest(
      request(
        'workers-ai',
        context(),
        { 'workers-ai': '@cf/meta/custom-model' },
        { 'workers-ai': { apiKey: 'workers-token', accountId: 'account123' } },
      ),
      environment(),
    )
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
    const body = await response.json() as { provider: { id: string; model: string } }

    expect(response.status).toBe(200)
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/account123/ai/run/%40cf/meta/custom-model')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer workers-token')
    expect(body.provider).toEqual({ id: 'workers-ai', label: 'Cloudflare Workers AI', model: '@cf/meta/custom-model' })
  })

  it('uses the current Gemini REST structured-output shape with a browser-saved key', async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body))
      if (!payload.generationConfig.responseFormat?.text?.schema) {
        return Response.json({ error: { message: 'Request contains an invalid argument.' } }, { status: 400 })
      }
      return Response.json({
        candidates: [{ content: { parts: [{ text: JSON.stringify(generated) }] } }],
      })
    })
    vi.stubGlobal('fetch', fetch)

    const response = await handleAiCoachRequest(
      request(
        'gemini',
        context(),
        { gemini: 'gemini-settings-model' },
        { gemini: { apiKey: 'gemini-browser-secret' } },
      ),
      environment({
        GEMINI_MODEL: 'gemini-server-default',
        GEMINI_BASE_URL: 'https://gemini.example/v1beta',
      }),
    )
    const body = await response.json() as { provider: { id: string; model: string } }
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
    const payload = JSON.parse(String(init.body))

    expect(response.status).toBe(200)
    expect(url).toBe('https://gemini.example/v1beta/models/gemini-settings-model:generateContent')
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('gemini-browser-secret')
    expect(payload).toMatchObject({
      systemInstruction: { parts: [{ text: expect.any(String) }] },
      contents: [{ role: 'user', parts: [{ text: expect.any(String) }] }],
      generationConfig: {
        responseFormat: {
          text: {
            mimeType: 'APPLICATION_JSON',
            schema: { type: 'object' },
          },
        },
      },
    })
    expect(body.provider).toMatchObject({ id: 'gemini', model: 'gemini-settings-model' })
  })

  it('supports Anthropic structured outputs', async () => {
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) => Response.json({ content: [{ type: 'text', text: JSON.stringify(generated) }] }))
    vi.stubGlobal('fetch', fetch)

    const response = await handleAiCoachRequest(request('anthropic'), environment({
      ANTHROPIC_API_KEY: 'anthropic-secret',
      ANTHROPIC_MODEL: 'claude-model',
    }))
    const body = await response.json() as { provider: { id: string; model: string } }
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
    const payload = JSON.parse(String(init?.body))

    expect(response.status).toBe(200)
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(payload).toMatchObject({
      model: 'claude-model',
      output_config: { format: { type: 'json_schema' } },
    })
    expect(body.provider).toMatchObject({ id: 'anthropic', model: 'claude-model' })
  })

  it('uses deterministic safety rules instead of asking a model for clearance', async () => {
    const run = vi.fn()
    const unsafeContext = context({
      latestCheckIn: {
        recordedAt: '2026-10-22T10:00:00.000Z',
        sleepQuality: 3,
        energy: 2,
        soreness: 4,
        stress: 3,
        motivation: 2,
        painPresent: true,
        illnessPresent: false,
        ageHours: 2,
      },
      evidence: [{ id: 'latest-check-in', label: 'Latest check-in: 2 hours ago' }],
    })
    const response = await handleAiCoachRequest(request('workers-ai', unsafeContext), environment({ AI: { run } as unknown as Ai }))
    const body = await response.json() as { outcome: string; provider: null; summary: string }

    expect(response.status).toBe(200)
    expect(run).not.toHaveBeenCalled()
    expect(body).toMatchObject({ outcome: 'user-review', provider: null })
    expect(body.summary).toContain('will not use a model')
  })
})

describe('AI insights', () => {
  const insightContext = {
    kind: 'natural-language',
    asOf: '2026-10-22T12:00:00.000Z',
    question: 'Why has my bench stalled?',
    subject: null,
    facts: [
      { id: 'dataset-summary', label: 'Available training data', value: 'Eight completed workouts.' },
      { id: 'bench-trend', label: 'Bench trend', value: 'Estimated 1RM trend is -2% with moderate confidence.' },
    ],
  }

  function insightRequest(context: unknown = insightContext) {
    return new Request('http://localhost/api/insights', {
      method: 'POST',
      headers: { Authorization: 'Bearer local-test', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'gemini',
        models: { gemini: 'gemini-insights-model' },
        credentials: { gemini: { apiKey: 'browser-key' } },
        context,
      }),
    })
  }

  it('returns structured findings with only cited supplied evidence', async () => {
    const generatedInsight = {
      headline: 'Hold the bench plan steady',
      summary: 'A two-percent dip with moderate confidence is not enough to justify changing the program; one more comparable exposure can distinguish normal variation from a persistent plateau.',
      findings: [{
        title: 'The signal is too weak for a program change',
        detail: 'The small negative estimate and limited workout history support repeating the same setup before attributing the result to a plateau.',
        evidenceRefs: ['bench-trend', 'dataset-summary'],
      }],
      actions: ['Repeat the same bench rep range and record RPE next session; change progression only if another comparable exposure declines'],
    }
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) => Response.json({
      candidates: [{ content: { parts: [{ text: JSON.stringify(generatedInsight) }] } }],
    }))
    vi.stubGlobal('fetch', fetch)

    const response = await handleAiInsightsRequest(insightRequest(), environment())
    const body = await response.json() as {
      headline: string
      findings: Array<{ evidence: Array<{ id: string }> }>
      evidence: Array<{ id: string }>
      provider: { id: string; model: string }
    }
    const [, init] = fetch.mock.calls[0] as [string, RequestInit]
    const payload = JSON.parse(String(init.body))

    expect(response.status).toBe(200)
    expect(payload.generationConfig.responseFormat.text.schema.properties.findings).toBeDefined()
    expect(body).toMatchObject({
      headline: generatedInsight.headline,
      findings: [{ evidence: [{ id: 'bench-trend' }, { id: 'dataset-summary' }] }],
      evidence: [{ id: 'bench-trend' }, { id: 'dataset-summary' }],
      provider: { id: 'gemini', model: 'gemini-insights-model' },
    })
  })

  it('surfaces the bounded Gemini error instead of a generic brief failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      error: { message: 'API key not valid. Please pass a valid API key.' },
    }, { status: 400 })))

    const response = await handleAiInsightsRequest(insightRequest(), environment())

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      error: 'Gemini request failed. API key not valid. Please pass a valid API key.',
    })
  })

  it('keeps large evidence catalogs out of Gemini constrained-decoding schemas', async () => {
    const facts = Array.from({ length: 48 }, (_, index) => ({
      id: `fact-${index}`,
      label: `Evidence ${index}`,
      value: `Observed value ${index}.`,
    }))
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body))
      const evidenceItems = payload.generationConfig.responseFormat.text.schema
        .properties.findings.items.properties.evidenceRefs.items
      if (Array.isArray(evidenceItems.enum) && evidenceItems.enum.length > 20) {
        return Response.json({ error: { message: 'Request contains an invalid argument.' } }, { status: 400 })
      }
      return Response.json({
        candidates: [{ content: { parts: [{ text: JSON.stringify({
          headline: 'Keep the current plan',
          summary: 'The supplied evidence does not support a change.',
          findings: [{ title: 'Stable decision', detail: 'The first fact supports holding steady.', evidenceRefs: ['fact-0'] }],
          actions: ['Repeat the current plan'],
        }) }] } }],
      })
    })
    vi.stubGlobal('fetch', fetch)

    const response = await handleAiInsightsRequest(insightRequest({ ...insightContext, facts }), environment())
    const [, init] = fetch.mock.calls[0] as [string, RequestInit]
    const payload = JSON.parse(String(init.body))
    const evidenceItems = payload.generationConfig.responseFormat.text.schema
      .properties.findings.items.properties.evidenceRefs.items

    expect(response.status).toBe(200)
    expect(evidenceItems).toEqual({ type: 'string' })
  })

  it('rejects model findings that cite evidence outside the supplied context', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      candidates: [{ content: { parts: [{ text: JSON.stringify({
        headline: 'Unsupported claim',
        summary: 'This should be rejected.',
        findings: [{ title: 'Invented', detail: 'Not grounded.', evidenceRefs: ['invented-fact'] }],
        actions: ['Ignore the supplied evidence'],
      }) }] } }],
    })))

    const response = await handleAiInsightsRequest(insightRequest(), environment())

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({ error: 'The selected model returned an invalid analysis.' })
  })

  it('rejects summary-only model output without a next action', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      candidates: [{ content: { parts: [{ text: JSON.stringify({
        headline: 'Bench is down',
        summary: 'The recorded estimate is two percent lower.',
        findings: [{ title: 'Negative trend', detail: 'Bench is down two percent.', evidenceRefs: ['bench-trend'] }],
        actions: [],
      }) }] } }],
    })))

    const response = await handleAiInsightsRequest(insightRequest(), environment())

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({ error: 'The selected model returned an invalid analysis.' })
  })
  it('accepts typed report context and deterministically blocks training changes after a pain check-in', async () => {
    const reportContext = {
      kind: 'training-report',
      asOf: '2026-10-22T12:00:00.000Z',
      question: null,
      subject: { id: 'report-fingerprint', label: '28-day training report' },
      facts: [{ id: 'report-summary', label: 'Report coverage', value: 'Six completed sessions with one comparable exercise.' }],
      report: {
        schemaVersion: 1,
        period: { start: '2026-09-24T12:00:00.000Z', end: '2026-10-22T12:00:00.000Z', days: 28 },
        freshness: { localDataUpdatedAt: '2026-10-21T12:00:00.000Z', cloudSyncedAt: null, hasUnsyncedChanges: true },
        verdict: { status: 'progressing', confidence: 'moderate', evidenceRefs: [] },
        coverage: { completedSessions: 6, exercisesObserved: 1, comparableExercises: 1, routinesAnalyzed: 0 },
        workload: { recentLoad: 500, weeklyAverageLoad: 450, ratio: 1.11, context: 'near-recent', confidence: 'moderate' },
        performanceSignal: { status: 'stable', affectedExercises: [], performanceChangePercent: null, rpeChange: null, confidence: 'moderate', title: 'Performance stable', recommendation: 'No repeated suppression detected.' },
        latestCheckIn: { recordedAt: '2026-10-21T11:55:00.000Z', sleepQuality: 4, energy: 3, soreness: 2, stress: 2, motivation: 4, painPresent: true, illnessPresent: false },
        exerciseTrends: [],
        routineReviews: [],
        muscleDose: [],
        limitations: ['Training logs are not medical clearance.'],
      },
    }
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      candidates: [{ content: { parts: [{ text: JSON.stringify({
        headline: 'Progress is visible',
        summary: 'The logged trend is positive, but the latest check-in requires user judgment.',
        findings: [{ title: 'Positive history', detail: 'The report verdict is progressing.', evidenceRefs: ['report-summary'] }],
        actions: ['Increase every working set immediately'],
      }) }] } }],
    })))

    const response = await handleAiInsightsRequest(insightRequest(reportContext), environment())
    const body = await response.json() as { actions: string[] }

    expect(response.status).toBe(200)
    expect(body.actions).toEqual(['Review the recorded pain or illness before making a training decision; LifeOS cannot provide clearance.'])
  })

})
