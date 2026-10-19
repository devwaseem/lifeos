import { parseSetDistanceMeters, parseSetDurationSeconds } from '$lib/exercise-tracking'
import type { WorkoutExercise, WorkoutSession, WorkoutSet } from '$lib/types'
import { normalizeProgressionRule } from '$lib/progression'
import { resolveSecondaryMuscles } from '$lib/muscle-contributions'

export const DEFAULT_REST_SECONDS = 120

function normalizeSet(set: WorkoutSet): WorkoutSet {
  return {
    ...set,
    rpe: typeof set.rpe === 'number' && set.rpe >= 1 && set.rpe <= 10 ? set.rpe : null,
    durationSeconds: typeof set.durationSeconds === 'number' && set.durationSeconds >= 0
      ? set.durationSeconds
      : parseSetDurationSeconds(typeof set.notes === 'string' ? set.notes : ''),
    distanceMeters: typeof set.distanceMeters === 'number' && set.distanceMeters >= 0
      ? set.distanceMeters
      : parseSetDistanceMeters(typeof set.notes === 'string' ? set.notes : ''),
    completedAt: typeof set.completedAt === 'string' ? set.completedAt : null,
    failure: typeof set.failure === 'boolean' ? set.failure : false,
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
    sessionRpe: typeof workout.sessionRpe === 'number' && workout.sessionRpe >= 1 && workout.sessionRpe <= 10
      ? workout.sessionRpe
      : null,
    exercises: workout.exercises.map(normalizeExercise),
  }
}

export function normalizeWorkouts(workouts: WorkoutSession[]) {
  return workouts.map(normalizeWorkout)
}
