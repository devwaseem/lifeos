import { getMuscleContributions } from '../muscle-contributions'
import { getExerciseStrengthProfile, getFatigueSignal, getMuscleDose, getSystemicLoad, estimateSetE1rm, type EvidenceConfidence } from '../training-science'
import { getTrainingReadiness } from '../training-readiness'
import type { RoutineTemplate, TrainingCycle, TrainingProfile, WorkoutCheckIn, WorkoutSession } from '../types'

const ANALYTICS_VERSION = '2026-10-20'
const STALE_AFTER_MS = 30 * 60_000

export type EvidenceStatus = 'observed' | 'validated-construct' | 'derived-estimate' | 'pragmatic-heuristic'

export interface AnalysisEvidence {
  metric: string
  status: EvidenceStatus
  confidence: EvidenceConfidence
  implementationVersion: string
}

export interface TrainingDataset {
  workouts: WorkoutSession[]
  routines: RoutineTemplate[]
  trainingCycle: TrainingCycle | null
  profile: TrainingProfile | null
  latestCheckIn: WorkoutCheckIn | null
  freshness: {
    latestDeviceSyncAt: string | null
    latestWorkoutUpdatedAt: string | null
  }
}

export interface AnalysisEnvelope<T> {
  asOf: string
  data: T
  freshness: TrainingDataset['freshness'] & {
    serverTime: string
    possiblyStale: boolean
  }
  evidence: AnalysisEvidence[]
  limitations: string[]
}

function validTimestamp(value: string | null) {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

function envelope<T>(dataset: TrainingDataset, now: number, data: T, evidence: AnalysisEvidence[], limitations: string[]): AnalysisEnvelope<T> {
  const latestSync = validTimestamp(dataset.freshness.latestDeviceSyncAt)
  return {
    asOf: new Date(now).toISOString(),
    data,
    freshness: {
      serverTime: new Date(now).toISOString(),
      ...dataset.freshness,
      possiblyStale: latestSync === null || now - latestSync > STALE_AFTER_MS,
    },
    evidence,
    limitations,
  }
}

export function buildTrainingOverview(dataset: TrainingDataset, now = Date.now()) {
  const systemicLoad = getSystemicLoad(dataset.workouts, now)
  const performanceSignal = getFatigueSignal(dataset.workouts)
  const muscleDose = getMuscleDose(dataset.workouts, now)
  const completed = dataset.workouts.filter((workout) => workout.status === 'completed')
  return envelope(dataset, now, {
    sessionCount: completed.length,
    activeRoutineCount: dataset.routines.filter((routine) => !routine.deletedAt).length,
    activeCycle: dataset.trainingCycle && !dataset.trainingCycle.deletedAt ? {
      id: dataset.trainingCycle.id,
      name: dataset.trainingCycle.name,
      currentIndex: dataset.trainingCycle.currentIndex,
      slotCount: dataset.trainingCycle.slots.length,
    } : null,
    profile: dataset.profile,
    latestCheckIn: dataset.latestCheckIn,
    systemicLoad,
    muscleDose,
    performanceSignal,
  }, [
    { metric: 'completed sessions and check-in fields', status: 'observed', confidence: 'high', implementationVersion: ANALYTICS_VERSION },
    { metric: 'session-RPE load and exercise strength', status: 'derived-estimate', confidence: systemicLoad.confidence, implementationVersion: ANALYTICS_VERSION },
    { metric: 'muscle dose and performance suppression', status: 'pragmatic-heuristic', confidence: performanceSignal.confidence, implementationVersion: ANALYTICS_VERSION },
  ], [
    'Cloud data may omit workouts or edits that have not synchronized from an offline device.',
    'Training logs describe performance and perceived effort; they do not diagnose fatigue, recovery, injury, or illness.',
  ])
}

export function buildExerciseProgress(dataset: TrainingDataset, exerciseId: string, limit = 12, now = Date.now()) {
  const boundedLimit = Math.min(24, Math.max(1, Math.round(limit)))
  const exposures = dataset.workouts
    .filter((workout) => workout.status === 'completed')
    .flatMap((workout) => {
      const exercise = workout.exercises.find((candidate) => candidate.exerciseId === exerciseId)
      if (!exercise) return []
      const sets = exercise.sets.filter((set) => set.completed && !set.warmup)
      if (sets.length === 0) return []
      const representative = sets.reduce((best, candidate) => {
        const bestEstimate = estimateSetE1rm(best) ?? 0
        const candidateEstimate = estimateSetE1rm(candidate) ?? 0
        return candidateEstimate > bestEstimate ? candidate : best
      })
      return [{
        workoutId: workout.id,
        completedAt: workout.completedAt ?? workout.startedAt,
        exerciseName: exercise.name,
        weight: representative.weight,
        repetitions: representative.reps,
        rpe: representative.rpe,
        estimated1Rm: estimateSetE1rm(representative),
        completedWorkingSets: sets.length,
      }]
    })
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    .slice(0, boundedLimit)
  const profile = getExerciseStrengthProfile(exerciseId, dataset.workouts)
  return envelope(dataset, now, { exerciseId, profile, exposures }, [
    { metric: 'logged exercise exposures', status: 'observed', confidence: exposures.length >= 6 ? 'high' : exposures.length >= 3 ? 'moderate' : 'low', implementationVersion: ANALYTICS_VERSION },
    { metric: 'RPE-adjusted estimated 1RM', status: 'derived-estimate', confidence: profile.confidence, implementationVersion: ANALYTICS_VERSION },
  ], [
    'Exercise IDs do not prove that equipment setup, range of motion, tempo, or technique stayed comparable.',
    'Estimated 1RM is an exercise-specific trend and is not clearance for a maximal attempt.',
  ])
}

export function buildRoutineReview(dataset: TrainingDataset, routineId: string, now = Date.now()) {
  const routine = dataset.routines.find((candidate) => candidate.id === routineId && !candidate.deletedAt)
  if (!routine) throw new Error('Routine not found')
  const excluded = new Set((dataset.profile?.excludedExercises ?? []).map((name) => name.trim().toLocaleLowerCase()))
  const excludedExercises = routine.exercises
    .filter((exercise) => excluded.has(exercise.name.trim().toLocaleLowerCase()))
    .map((exercise) => ({ exerciseId: exercise.exerciseId, name: exercise.name }))
  const muscleSets = new Map<string, number>()
  for (const exercise of routine.exercises) {
    for (const contribution of getMuscleContributions(exercise)) {
      muscleSets.set(contribution.muscle, (muscleSets.get(contribution.muscle) ?? 0) + exercise.setCount * contribution.fraction)
    }
  }
  const plannedMovements = routine.exercises.map((exercise) => ({
    exerciseId: exercise.exerciseId,
    name: exercise.name,
    muscle: exercise.muscle,
    equipment: exercise.equipment,
    secondaryMuscles: exercise.secondaryMuscles,
  }))
  const trainingState = getTrainingReadiness(plannedMovements, dataset.workouts, now)
  const latestCheckInBlocksRecommendation = dataset.latestCheckIn?.painPresent === true || dataset.latestCheckIn?.illnessPresent === true
  return envelope(dataset, now, {
    routine: {
      id: routine.id,
      name: routine.name,
      updatedAt: routine.updatedAt,
      exerciseCount: routine.exercises.length,
    },
    workingSetsPerExposure: routine.exercises.reduce((total, exercise) => total + exercise.setCount, 0),
    muscleSetEquivalents: [...muscleSets].map(([muscle, sets]) => ({ muscle, sets: Math.round(sets * 10) / 10 })).sort((left, right) => right.sets - left.sets),
    excludedExercises,
    targetReadiness: trainingState.targetReadiness,
    recoveryConfidence: trainingState.recoveryConfidence,
    requiresUserReview: excludedExercises.length > 0 || latestCheckInBlocksRecommendation,
    changeRecommendationsBlocked: latestCheckInBlocksRecommendation,
  }, [
    { metric: 'routine prescription and explicit profile constraints', status: 'observed', confidence: dataset.profile ? 'high' : 'low', implementationVersion: ANALYTICS_VERSION },
    { metric: 'attributed muscle set equivalents', status: 'pragmatic-heuristic', confidence: routine.exercises.length > 0 ? 'moderate' : 'low', implementationVersion: ANALYTICS_VERSION },
    { metric: 'modeled muscle readiness', status: 'pragmatic-heuristic', confidence: trainingState.recoveryConfidence.level, implementationVersion: ANALYTICS_VERSION },
  ], [
    'Exercise selection and logged performance cannot establish technique quality or medical safety.',
    'Routine set distribution is descriptive and is not a universal prescription for volume or frequency.',
  ])
}

export function buildTrainingState(dataset: TrainingDataset, routineId: string | null, now = Date.now()) {
  const routine = routineId ? dataset.routines.find((candidate) => candidate.id === routineId && !candidate.deletedAt) : null
  const movements = routine?.exercises.map((exercise) => ({
    exerciseId: exercise.exerciseId,
    name: exercise.name,
    muscle: exercise.muscle,
    equipment: exercise.equipment,
    secondaryMuscles: exercise.secondaryMuscles,
  })) ?? []
  const readiness = getTrainingReadiness(movements, dataset.workouts, now)
  const performanceSignal = getFatigueSignal(dataset.workouts)
  const recommendationBlocked = dataset.latestCheckIn?.painPresent === true || dataset.latestCheckIn?.illnessPresent === true
  return envelope(dataset, now, {
    routineId: routine?.id ?? null,
    latestCheckIn: dataset.latestCheckIn,
    readiness,
    performanceSignal,
    recommendationBlocked,
  }, [
    { metric: 'subjective training check-in', status: 'observed', confidence: dataset.latestCheckIn ? 'high' : 'low', implementationVersion: ANALYTICS_VERSION },
    { metric: 'performance suppression', status: 'pragmatic-heuristic', confidence: performanceSignal.confidence, implementationVersion: ANALYTICS_VERSION },
    { metric: 'modeled muscle readiness', status: 'pragmatic-heuristic', confidence: readiness.recoveryConfidence.level, implementationVersion: ANALYTICS_VERSION },
  ], [
    'This result is a training-state summary, not a physiological fatigue measurement or medical assessment.',
    'Pain, illness, or concerning symptoms require user judgment and may warrant qualified care; the model does not provide clearance.',
  ])
}
