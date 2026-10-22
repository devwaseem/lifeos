import { getExerciseStrengthProfile, getFatigueSignal, getSystemicLoad } from '$lib/training-science'
import { getTrainingReadiness } from '$lib/training-readiness'
import type { RoutineTemplate, TrainingProfile, WorkoutCheckIn, WorkoutSession } from '$lib/types'

const CHECK_IN_CONTEXT_HOURS = 36

export type AiProviderId = 'workers-ai' | 'gemini' | 'anthropic'
export type AiProviderPreference = 'auto' | AiProviderId
export type CoachBriefOutcome = 'proceed' | 'adjust' | 'rest' | 'user-review' | 'insufficient-data'
export type CoachEvidenceId =
  | 'target-readiness'
  | 'readiness-confidence'
  | 'consecutive-days'
  | 'systemic-load'
  | 'performance-trend'
  | 'latest-check-in'
  | 'training-profile'
  | 'exercise-history'

export interface AiSettings {
  provider: AiProviderPreference
  models: Partial<Record<AiProviderId, string>>
  apiKeys: Partial<Record<AiProviderId, string>>
  cloudflareAccountId: string
}

export interface AiProviderOption {
  id: AiProviderId
  label: string
  model: string
}

export interface AiProviderCatalog {
  providers: AiProviderOption[]
  defaultProvider: AiProviderOption['id'] | null
}

export interface CoachEvidence {
  id: CoachEvidenceId
  label: string
}

export interface CoachBriefContext {
  asOf: string
  localDate: string
  plan: {
    routineId: string | null
    name: string
    restDay: boolean
    exercises: Array<{
      exerciseId: string
      name: string
      muscle: string
      equipment: string
      workingSets: number
      repRange: { min: number; max: number }
      latestExposure: {
        completedAt: string
        weight: number | null
        repetitions: number | null
        rpe: number | null
      } | null
      strengthTrend: {
        trendPercent: number | null
        comparableSessions: number
        confidence: 'low' | 'moderate' | 'high'
      }
    }>
  }
  profile: {
    primaryGoal: TrainingProfile['primaryGoal']
    experienceLevel: TrainingProfile['experienceLevel']
    daysPerWeek: number
    sessionMinutes: number
    availableEquipment: string[]
    excludedExercises: string[]
    movementConstraints: string
  } | null
  latestCheckIn: (Omit<WorkoutCheckIn, 'notes'> & { ageHours: number }) | null
  readiness: {
    targetReadiness: number
    targetMuscles: string[]
    confidence: 'low' | 'moderate' | 'high'
    consecutiveTrainingDays: number
    systemicFatigueWarning: boolean
    limitingMuscles: Array<{ muscle: string; readiness: number }>
  }
  systemicLoad: {
    context: 'below-recent' | 'near-recent' | 'above-recent' | 'building-baseline'
    ratio: number | null
    recentSessionCount: number
    recentSessionsWithEffort: number
    confidence: 'low' | 'moderate' | 'high'
  }
  performance: {
    status: 'stable' | 'watch' | 'consider-easier'
    title: string
    affectedExercises: string[]
    performanceChangePercent: number | null
    rpeChange: number | null
    confidence: 'low' | 'moderate' | 'high'
  }
  evidence: CoachEvidence[]
}

export interface CoachBrief {
  outcome: CoachBriefOutcome
  headline: string
  summary: string
  actions: string[]
  evidence: CoachEvidence[]
  caveat: string
  generatedAt: string
  contextAsOf: string
  localDate: string
  routineId: string | null
  provider: AiProviderOption | null
}


function workoutTimestamp(workout: WorkoutSession) {
  return workout.completedAt ?? workout.startedAt
}

function latestCompletedWorkout(workouts: WorkoutSession[]) {
  return workouts
    .filter((workout) => workout.status === 'completed')
    .sort((left, right) => workoutTimestamp(right).localeCompare(workoutTimestamp(left)))[0] ?? null
}

function latestExerciseExposure(workouts: WorkoutSession[], exerciseId: string) {
  for (const workout of workouts
    .filter((candidate) => candidate.status === 'completed')
    .sort((left, right) => workoutTimestamp(right).localeCompare(workoutTimestamp(left)))) {
    const exercise = workout.exercises.find((candidate) => candidate.exerciseId === exerciseId)
    const set = exercise?.sets.find((candidate) => candidate.completed && !candidate.warmup)
    if (!set) continue
    return {
      completedAt: workoutTimestamp(workout),
      weight: set.weight,
      repetitions: set.reps,
      rpe: set.rpe,
    }
  }
  return null
}

function localDateKey(now: number) {
  const date = new Date(now)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function recentCheckIn(workouts: WorkoutSession[], now: number) {
  const latest = latestCompletedWorkout(workouts)
  if (!latest?.checkIn) return null
  const recordedAt = Date.parse(latest.checkIn.recordedAt)
  if (!Number.isFinite(recordedAt)) return null
  const ageHours = Math.max(0, Math.round(((now - recordedAt) / (60 * 60 * 1_000)) * 10) / 10)
  if (ageHours > CHECK_IN_CONTEXT_HOURS) return null
  const { notes: _notes, ...checkIn } = latest.checkIn
  return { ...checkIn, ageHours }
}

function formatLoadContext(context: CoachBriefContext['systemicLoad']['context']) {
  if (context === 'above-recent') return 'above the prior four-week weekly average'
  if (context === 'below-recent') return 'below the prior four-week weekly average'
  if (context === 'near-recent') return 'near the prior four-week weekly average'
  return 'still building a comparison baseline'
}

export function buildCoachBriefContext(
  routine: RoutineTemplate | null,
  restDay: boolean,
  workouts: WorkoutSession[],
  profile: TrainingProfile | null,
  now = Date.now(),
): CoachBriefContext {
  const movements = restDay ? [] : routine?.exercises ?? []
  const readiness = getTrainingReadiness(movements, workouts, now)
  const systemicLoad = getSystemicLoad(workouts, now)
  const performance = getFatigueSignal(workouts)
  const latestCheckIn = recentCheckIn(workouts, now)
  const exercises = movements.slice(0, 40).map((exercise) => {
    const strength = getExerciseStrengthProfile(exercise.exerciseId, workouts)
    return {
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      muscle: exercise.muscle,
      equipment: exercise.equipment,
      workingSets: exercise.setCount,
      repRange: { min: exercise.progression.minReps, max: exercise.progression.maxReps },
      latestExposure: latestExerciseExposure(workouts, exercise.exerciseId),
      strengthTrend: {
        trendPercent: strength.trendPercent,
        comparableSessions: strength.comparableSessions,
        confidence: strength.confidence,
      },
    }
  })
  const evidence: CoachEvidence[] = [
    { id: 'target-readiness', label: `Target readiness: ${readiness.targetReadiness}%` },
    { id: 'readiness-confidence', label: `Readiness history: ${readiness.recoveryConfidence.label.toLowerCase()}` },
    { id: 'consecutive-days', label: `Training streak: ${readiness.consecutiveLoadDays} consecutive day${readiness.consecutiveLoadDays === 1 ? '' : 's'}` },
    { id: 'systemic-load', label: `Seven-day internal load is ${formatLoadContext(systemicLoad.context)}` },
    { id: 'performance-trend', label: `${performance.title} · ${performance.confidence} confidence` },
  ]
  if (latestCheckIn) evidence.push({ id: 'latest-check-in', label: `Latest check-in: ${latestCheckIn.ageHours} hours ago` })
  if (profile) evidence.push({ id: 'training-profile', label: `Training goal: ${profile.primaryGoal.replace('-', ' ')}` })
  if (exercises.some((exercise) => exercise.strengthTrend.comparableSessions > 0)) {
    evidence.push({ id: 'exercise-history', label: 'Same-exercise performance history is available' })
  }

  return {
    asOf: new Date(now).toISOString(),
    localDate: localDateKey(now),
    plan: {
      routineId: routine?.id ?? null,
      name: restDay ? 'Recovery day' : routine?.name ?? 'No routine selected',
      restDay,
      exercises,
    },
    profile: profile ? {
      primaryGoal: profile.primaryGoal,
      experienceLevel: profile.experienceLevel,
      daysPerWeek: profile.daysPerWeek,
      sessionMinutes: profile.sessionMinutes,
      availableEquipment: profile.availableEquipment.slice(0, 100),
      excludedExercises: profile.excludedExercises.slice(0, 200),
      movementConstraints: profile.movementConstraints.slice(0, 2_000),
    } : null,
    latestCheckIn,
    readiness: {
      targetReadiness: readiness.targetReadiness,
      targetMuscles: readiness.targetMuscles,
      confidence: readiness.recoveryConfidence.level,
      consecutiveTrainingDays: readiness.consecutiveLoadDays,
      systemicFatigueWarning: readiness.systemicFatigueWarning,
      limitingMuscles: readiness.targetRecovery
        .filter((item) => item.readiness < 80)
        .slice(0, 5)
        .map((item) => ({ muscle: item.muscle, readiness: item.readiness })),
    },
    systemicLoad: {
      context: systemicLoad.context,
      ratio: systemicLoad.ratio,
      recentSessionCount: systemicLoad.recentSessionCount,
      recentSessionsWithEffort: systemicLoad.recentSessionsWithEffort,
      confidence: systemicLoad.confidence,
    },
    performance: {
      status: performance.status,
      title: performance.title,
      affectedExercises: performance.affectedExercises.slice(0, 10),
      performanceChangePercent: performance.performanceChangePercent,
      rpeChange: performance.rpeChange,
      confidence: performance.confidence,
    },
    evidence,
  }
}

function developmentHeaders() {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (import.meta.env.DEV) headers.set('Authorization', 'Bearer lifeos-local-dev')
  return headers
}

async function responseError(response: Response) {
  if (response.status === 401) return 'Your Cloudflare Access session has expired. Reload to sign in again.'
  if (response.status === 429) return 'The selected model is busy or rate-limited. Try again shortly.'
  if (response.headers.get('Content-Type')?.includes('application/json')) {
    const body = await response.json().catch(() => null) as { error?: unknown } | null
    if (typeof body?.error === 'string') return body.error
  }
  return 'LifeOS could not complete the AI request.'
}

export async function getAiProviderCatalog(): Promise<AiProviderCatalog> {
  if (!navigator.onLine) throw new Error('Connect to load AI provider availability.')
  const response = await fetch('/api/coach', { headers: developmentHeaders() })
  if (!response.ok) throw new Error(await responseError(response))
  return response.json() as Promise<AiProviderCatalog>
}


export const coachBriefCaveat = 'Training guidance only. LifeOS does not diagnose recovery, injury, illness, or provide medical clearance.'

