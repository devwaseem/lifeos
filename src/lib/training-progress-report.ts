import {
  buildRoutineReview,
  buildTrainingOverview,
  buildTrainingState,
  type AnalysisEvidence,
  type EvidenceStatus,
  type TrainingDataset,
} from '$lib/training-analysis'
import { estimateSetE1rm, getExerciseStrengthProfiles, type EvidenceConfidence, type StrengthProfile } from '$lib/training-science'
import type { RoutineTemplate, WorkoutCheckIn, WorkoutSession } from '$lib/types'

const DAY_MS = 24 * 60 * 60 * 1_000
export const TRAINING_REPORT_VERSION = 1

export type TrainingReportVerdict = 'progressing' | 'mixed' | 'stable' | 'needs-attention' | 'insufficient-data'
export type ExerciseTrendStatus = 'progressing' | 'stable' | 'declining' | 'insufficient-data'

export interface ReportEvidence extends AnalysisEvidence {
  id: string
}

export interface ReportExerciseTrend {
  exerciseId: string
  name: string
  muscle: string
  equipment: string
  lastPerformedAt: string | null
  inActiveRoutine: boolean
  inActiveCycle: boolean
  profile: StrengthProfile
  status: ExerciseTrendStatus
  latestExposure: {
    completedAt: string
    weight: number | null
    repetitions: number | null
    rpe: number | null
    estimated1Rm: number | null
    completedWorkingSets: number
  } | null
  evidenceId: string
}

export interface ReportRoutineReview {
  routine: ReturnType<typeof buildRoutineReview>['data']['routine']
  workingSetsPerExposure: number
  muscleSetEquivalents: Array<{ muscle: string; sets: number }>
  excludedExercises: Array<{ exerciseId: string; name: string }>
  targetReadiness: number
  recoveryConfidence: ReturnType<typeof buildRoutineReview>['data']['recoveryConfidence']
  requiresUserReview: boolean
  changeRecommendationsBlocked: boolean
  evidenceId: string
}

export interface TrainingProgressReport {
  schemaVersion: typeof TRAINING_REPORT_VERSION
  fingerprint: string
  asOf: string
  period: { start: string; end: string; days: number }
  freshness: {
    localDataUpdatedAt: string | null
    cloudSyncedAt: string | null
    hasUnsyncedChanges: boolean
  }
  verdict: {
    status: TrainingReportVerdict
    confidence: EvidenceConfidence
    evidenceRefs: string[]
  }
  coverage: {
    completedSessions: number
    exercisesObserved: number
    comparableExercises: number
    routinesAnalyzed: number
  }
  workload: ReturnType<typeof buildTrainingOverview>['data']['systemicLoad']
  performanceSignal: ReturnType<typeof buildTrainingOverview>['data']['performanceSignal']
  muscleDose: ReturnType<typeof buildTrainingOverview>['data']['muscleDose']
  latestCheckIn: Omit<WorkoutCheckIn, 'notes'> | null
  trainingState: Omit<ReturnType<typeof buildTrainingState>['data'], 'latestCheckIn'> & { latestCheckIn: Omit<WorkoutCheckIn, 'notes'> | null }
  currentRoutine: { id: string; name: string } | null
  exerciseTrends: ReportExerciseTrend[]
  routineReviews: ReportRoutineReview[]
  evidence: ReportEvidence[]
  limitations: string[]
}

interface ExerciseCandidate {
  exerciseId: string
  name: string
  muscle: string
  equipment: string
  lastPerformedAt: string | null
  inActiveRoutine: boolean
  inActiveCycle: boolean
}

function timestamp(workout: WorkoutSession) {
  return workout.completedAt ?? workout.startedAt
}

function latestCheckIn(checkIn: WorkoutCheckIn | null): Omit<WorkoutCheckIn, 'notes'> | null {
  if (!checkIn) return null
  const { notes: _notes, ...publicCheckIn } = checkIn
  return publicCheckIn
}

function currentRoutine(dataset: TrainingDataset, activeRoutines: RoutineTemplate[]) {
  const cycle = dataset.trainingCycle
  if (cycle && !cycle.deletedAt && cycle.slots.length > 0) {
    const slot = cycle.slots[Math.min(Math.max(cycle.currentIndex, 0), cycle.slots.length - 1)]
    const routine = activeRoutines.find((candidate) => candidate.id === slot?.routineId)
    if (routine) return routine
  }
  return [...activeRoutines].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
}

function candidateScore(candidate: ExerciseCandidate, profile: StrengthProfile, now: number) {
  const lastPerformed = candidate.lastPerformedAt ? Date.parse(candidate.lastPerformedAt) : 0
  const recency = lastPerformed > 0 ? Math.max(0, 20 - Math.floor((now - lastPerformed) / (7 * DAY_MS))) : 0
  return (candidate.inActiveCycle ? 100 : 0)
    + (candidate.inActiveRoutine ? 60 : 0)
    + (profile.trendPercent !== null ? 40 : 0)
    + (profile.confidence === 'high' ? 20 : profile.confidence === 'moderate' ? 10 : 0)
    + Math.min(profile.comparableSessions, 12)
    + recency
}

function trendStatus(profile: StrengthProfile): ExerciseTrendStatus {
  if (profile.trendPercent === null) return 'insufficient-data'
  if (profile.trendPercent >= 3) return 'progressing'
  if (profile.trendPercent <= -3) return 'declining'
  return 'stable'
}

function reportVerdict(trends: ReportExerciseTrend[]): TrainingProgressReport['verdict'] {
  const comparable = trends.filter((trend) => trend.status !== 'insufficient-data')
  const highConfidence = comparable.filter((trend) => trend.profile.confidence === 'high').length
  const confidence: EvidenceConfidence = comparable.length >= 4 && highConfidence >= Math.ceil(comparable.length * 0.6)
    ? 'high'
    : comparable.length >= 2
      ? 'moderate'
      : 'low'
  if (comparable.length === 0) return { status: 'insufficient-data', confidence, evidenceRefs: trends.slice(0, 3).map((trend) => trend.evidenceId) }

  const progressing = comparable.filter((trend) => trend.status === 'progressing')
  const declining = comparable.filter((trend) => trend.status === 'declining')
  const stable = comparable.filter((trend) => trend.status === 'stable')
  const evidenceRefs = [...progressing, ...declining, ...stable].slice(0, 6).map((trend) => trend.evidenceId)
  if (declining.length > progressing.length && declining.length >= 2) return { status: 'needs-attention', confidence, evidenceRefs }
  if (progressing.length > 0 && declining.length === 0 && progressing.length >= stable.length) return { status: 'progressing', confidence, evidenceRefs }
  if (progressing.length > 0 || declining.length > 0) return { status: 'mixed', confidence, evidenceRefs }
  return { status: 'stable', confidence, evidenceRefs }
}

function evidenceId(prefix: string, value: string) {
  return `${prefix}:${value.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 72)}`
}

function fingerprint(value: string) {
  let left = 0x811c9dc5
  let right = 0x9e3779b9
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    left = Math.imul(left ^ code, 0x01000193)
    right = Math.imul(right ^ code, 0x85ebca6b)
  }
  return `${(left >>> 0).toString(16).padStart(8, '0')}${(right >>> 0).toString(16).padStart(8, '0')}`
}

function latestExposure(exerciseId: string, workouts: WorkoutSession[]): ReportExerciseTrend['latestExposure'] {
  const workout = workouts
    .filter((candidate) => candidate.status === 'completed' && candidate.exercises.some((exercise) => exercise.exerciseId === exerciseId))
    .sort((left, right) => timestamp(right).localeCompare(timestamp(left)))[0]
  const exercise = workout?.exercises.find((candidate) => candidate.exerciseId === exerciseId)
  if (!workout || !exercise) return null
  const workingSets = exercise.sets.filter((set) => set.completed && !set.warmup)
  if (workingSets.length === 0) return null
  const representative = workingSets.reduce((best, candidate) => (estimateSetE1rm(candidate) ?? 0) > (estimateSetE1rm(best) ?? 0) ? candidate : best)
  return {
    completedAt: timestamp(workout),
    weight: representative.weight,
    repetitions: representative.reps,
    rpe: representative.rpe,
    estimated1Rm: estimateSetE1rm(representative),
    completedWorkingSets: workingSets.length,
  }
}

function localDataUpdatedAt(dataset: TrainingDataset) {
  const timestamps = [
    ...dataset.workouts.filter((workout) => workout.status === 'completed').map((workout) => workout.updatedAt),
    dataset.profile?.updatedAt ?? null,
    dataset.trainingCycle?.updatedAt ?? null,
    ...dataset.routines.map((routine) => routine.updatedAt),
  ].filter((value): value is string => Boolean(value))
  return timestamps.sort((left, right) => right.localeCompare(left))[0] ?? null
}

function uniqueEvidence(groups: AnalysisEvidence[][]): ReportEvidence[] {
  const seen = new Set<string>()
  const result: ReportEvidence[] = []
  for (const item of groups.flat()) {
    const id = evidenceId('metric', item.metric)
    if (seen.has(id)) continue
    seen.add(id)
    result.push({ ...item, id })
  }
  return result
}

function uniqueLimitations(groups: string[][]) {
  return [...new Set(groups.flat())]
}

export function buildTrainingProgressReport(
  dataset: TrainingDataset,
  options: { now?: number; periodDays?: number; exerciseLimit?: number } = {},
): TrainingProgressReport {
  const now = options.now ?? Date.now()
  const periodDays = Math.min(365, Math.max(7, Math.round(options.periodDays ?? 28)))
  const exerciseLimit = Math.min(16, Math.max(3, Math.round(options.exerciseLimit ?? 8)))
  const completedWorkouts = dataset.workouts.filter((workout) => workout.status === 'completed')
  const analysisDataset: TrainingDataset = { ...dataset, workouts: completedWorkouts }
  const activeRoutines = dataset.routines.filter((routine) => !routine.deletedAt)
  const current = currentRoutine(dataset, activeRoutines)
  const cycleRoutineIds = new Set(dataset.trainingCycle && !dataset.trainingCycle.deletedAt ? dataset.trainingCycle.slots.map((slot) => slot.routineId) : [])
  const activeExerciseIds = new Set(activeRoutines.flatMap((routine) => routine.exercises.map((exercise) => exercise.exerciseId)))
  const cycleExerciseIds = new Set(activeRoutines.filter((routine) => cycleRoutineIds.has(routine.id)).flatMap((routine) => routine.exercises.map((exercise) => exercise.exerciseId)))
  const candidates = new Map<string, ExerciseCandidate>()

  for (const routine of activeRoutines) {
    for (const exercise of routine.exercises) {
      candidates.set(exercise.exerciseId, {
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        muscle: exercise.muscle,
        equipment: exercise.equipment,
        lastPerformedAt: candidates.get(exercise.exerciseId)?.lastPerformedAt ?? null,
        inActiveRoutine: true,
        inActiveCycle: cycleExerciseIds.has(exercise.exerciseId),
      })
    }
  }
  for (const workout of completedWorkouts) {
    const completedAt = timestamp(workout)
    for (const exercise of workout.exercises) {
      if (!exercise.sets.some((set) => set.completed && !set.warmup)) continue
      const existing = candidates.get(exercise.exerciseId)
      candidates.set(exercise.exerciseId, {
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        muscle: exercise.muscle,
        equipment: exercise.equipment,
        lastPerformedAt: !existing?.lastPerformedAt || completedAt > existing.lastPerformedAt ? completedAt : existing.lastPerformedAt,
        inActiveRoutine: activeExerciseIds.has(exercise.exerciseId),
        inActiveCycle: cycleExerciseIds.has(exercise.exerciseId),
      })
    }
  }

  const profiles = getExerciseStrengthProfiles(candidates.keys(), completedWorkouts)
  const allTrends = [...candidates.values()]
    .filter((candidate) => profiles.get(candidate.exerciseId)?.currentEstimated1Rm !== null)
    .map((candidate): ReportExerciseTrend => {
      const profile = profiles.get(candidate.exerciseId) as StrengthProfile
      return {
        ...candidate,
        profile,
        status: trendStatus(profile),
        latestExposure: latestExposure(candidate.exerciseId, completedWorkouts),
        evidenceId: evidenceId('exercise', candidate.exerciseId),
      }
    })
    .sort((left, right) => candidateScore(right, right.profile, now) - candidateScore(left, left.profile, now)
      || (right.lastPerformedAt ?? '').localeCompare(left.lastPerformedAt ?? '')
      || left.name.localeCompare(right.name))
  const exerciseTrends = allTrends.slice(0, exerciseLimit)

  const overview = buildTrainingOverview(analysisDataset, now)
  const state = buildTrainingState(analysisDataset, current?.id ?? null, now)
  const routineEnvelopes = activeRoutines.slice(0, 8).map((routine) => buildRoutineReview(analysisDataset, routine.id, now))
  const routineReviews = routineEnvelopes.map((review): ReportRoutineReview => ({
    ...review.data,
    evidenceId: evidenceId('routine', review.data.routine.id),
  }))
  const localUpdatedAt = localDataUpdatedAt(dataset)
  const completedSessions = completedWorkouts.filter((workout) => Date.parse(timestamp(workout)) >= now - periodDays * DAY_MS).length
  const fingerprintMaterial = JSON.stringify({
    version: TRAINING_REPORT_VERSION,
    periodDays,
    workouts: completedWorkouts.map((workout) => [workout.id, workout.updatedAt]).sort(),
    routines: activeRoutines.map((routine) => [routine.id, routine.updatedAt]).sort(),
    cycle: dataset.trainingCycle ? [dataset.trainingCycle.id, dataset.trainingCycle.updatedAt] : null,
    profile: dataset.profile?.updatedAt ?? null,
  })
  const cloudSync = dataset.freshness.latestDeviceSyncAt

  return {
    schemaVersion: TRAINING_REPORT_VERSION,
    fingerprint: fingerprint(fingerprintMaterial),
    asOf: new Date(now).toISOString(),
    period: { start: new Date(now - periodDays * DAY_MS).toISOString(), end: new Date(now).toISOString(), days: periodDays },
    freshness: {
      localDataUpdatedAt: localUpdatedAt,
      cloudSyncedAt: cloudSync,
      hasUnsyncedChanges: Boolean(localUpdatedAt && (!cloudSync || localUpdatedAt > cloudSync)),
    },
    verdict: reportVerdict(allTrends),
    coverage: {
      completedSessions,
      exercisesObserved: allTrends.length,
      comparableExercises: allTrends.filter((trend) => trend.status !== 'insufficient-data').length,
      routinesAnalyzed: routineReviews.length,
    },
    workload: overview.data.systemicLoad,
    performanceSignal: overview.data.performanceSignal,
    muscleDose: overview.data.muscleDose,
    latestCheckIn: latestCheckIn(dataset.latestCheckIn),
    trainingState: { ...state.data, latestCheckIn: latestCheckIn(state.data.latestCheckIn) },
    currentRoutine: current ? { id: current.id, name: current.name } : null,
    exerciseTrends,
    routineReviews,
    evidence: uniqueEvidence([overview.evidence, state.evidence, ...routineEnvelopes.map((review) => review.evidence)]),
    limitations: uniqueLimitations([
      overview.limitations,
      state.limitations,
      ...routineEnvelopes.map((review) => review.limitations),
      ['The overall verdict summarizes logged exercise-specific trends; it does not establish adaptation, technique quality, or medical readiness.'],
    ]),
  }
}

export type { EvidenceStatus, TrainingDataset }
