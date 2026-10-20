import { parseSetDistanceMeters, parseSetDurationSeconds } from '$lib/exercise-tracking'
import { isValidRpe } from '$lib/rpe'
import type { WorkoutCheckIn, WorkoutExercise, WorkoutSession, WorkoutSet } from '$lib/types'
import { normalizeProgressionRule } from '$lib/progression'
import { resolveSecondaryMuscles } from '$lib/muscle-contributions'

export const DEFAULT_REST_SECONDS = 120

function normalizeCheckIn(value: unknown): WorkoutCheckIn | null {
  if (!value || typeof value !== 'object') return null
  const checkIn = value as Partial<WorkoutCheckIn>
  const ratings = [checkIn.sleepQuality, checkIn.energy, checkIn.soreness, checkIn.stress, checkIn.motivation]
  if (typeof checkIn.recordedAt !== 'string'
    || !ratings.every((rating) => Number.isInteger(rating) && (rating ?? 0) >= 1 && (rating ?? 0) <= 5)
    || typeof checkIn.painPresent !== 'boolean'
    || typeof checkIn.illnessPresent !== 'boolean') return null
  return {
    recordedAt: checkIn.recordedAt,
    sleepQuality: checkIn.sleepQuality!,
    energy: checkIn.energy!,
    soreness: checkIn.soreness!,
    stress: checkIn.stress!,
    motivation: checkIn.motivation!,
    painPresent: checkIn.painPresent,
    illnessPresent: checkIn.illnessPresent,
    notes: typeof checkIn.notes === 'string' ? checkIn.notes : '',
  }
}

function normalizeSet(set: WorkoutSet & { failure?: unknown }): WorkoutSet {
  const { failure: legacyFailure, ...current } = set
  const warmup = set.warmup === true
  return {
    ...current,
    rpe: warmup ? null : legacyFailure === true ? 10 : isValidRpe(set.rpe) ? set.rpe : null,
    durationSeconds: typeof set.durationSeconds === 'number' && set.durationSeconds >= 0
      ? set.durationSeconds
      : parseSetDurationSeconds(typeof set.notes === 'string' ? set.notes : ''),
    distanceMeters: typeof set.distanceMeters === 'number' && set.distanceMeters >= 0
      ? set.distanceMeters
      : parseSetDistanceMeters(typeof set.notes === 'string' ? set.notes : ''),
    completedAt: typeof set.completedAt === 'string' ? set.completedAt : null,
    warmup,
    notes: typeof set.notes === 'string' ? set.notes : '',
  }
}

function normalizeExercise(exercise: WorkoutExercise): WorkoutExercise {
  return {
    ...exercise,
    secondaryMuscles: resolveSecondaryMuscles(exercise),
    notes: typeof exercise.notes === 'string' ? exercise.notes : '',
    restSeconds: typeof exercise.restSeconds === 'number' && exercise.restSeconds >= 0
      ? exercise.restSeconds
      : DEFAULT_REST_SECONDS,
    progression: normalizeProgressionRule(exercise.progression, exercise.equipment),
    restUntil: typeof exercise.restUntil === 'string' ? exercise.restUntil : null,
    sets: exercise.sets.map(normalizeSet),
  }
}

export function normalizeWorkout(workout: WorkoutSession): WorkoutSession {
  return {
    ...workout,
    routineId: typeof workout.routineId === 'string' ? workout.routineId : null,
    cycleSlotId: typeof workout.cycleSlotId === 'string' ? workout.cycleSlotId : null,
    notes: typeof workout.notes === 'string' ? workout.notes : '',
    sessionRpe: isValidRpe(workout.sessionRpe) ? workout.sessionRpe : null,
    checkIn: normalizeCheckIn(workout.checkIn),
    exercises: workout.exercises.map(normalizeExercise),
  }
}

export function normalizeWorkouts(workouts: WorkoutSession[]) {
  return workouts.map(normalizeWorkout)
}
