import type { WorkoutExercise, WorkoutSession, WorkoutSet } from '$lib/types'
import { newId } from '$lib/utils'

function workoutTime(workout: WorkoutSession) {
  return workout.completedAt ?? workout.startedAt
}

export function getPreviousWorkoutExercise(
  workouts: WorkoutSession[],
  exerciseId: string,
): WorkoutExercise | undefined {
  let previousWorkout: WorkoutSession | undefined
  let previousExercise: WorkoutExercise | undefined

  for (const workout of workouts) {
    if (workout.status !== 'completed') continue
    const exercise = workout.exercises.find((candidate) => candidate.exerciseId === exerciseId)
    if (!exercise?.sets.some((set) => set.completed && !set.warmup)) continue
    if (!previousWorkout || workoutTime(workout) > workoutTime(previousWorkout)) {
      previousWorkout = workout
      previousExercise = exercise
    }
  }

  return previousExercise
}

export function getMatchingPreviousSet(
  exercise: WorkoutExercise | undefined,
  warmup: boolean,
  setIndex: number,
): WorkoutSet | undefined {
  let fallback: WorkoutSet | undefined
  let matchingIndex = 0
  for (const set of exercise?.sets ?? []) {
    if (!set.completed || set.warmup !== warmup) continue
    fallback = set
    if (matchingIndex === setIndex) return set
    matchingIndex += 1
  }
  return fallback
}

export function countWorkingSets(sets: WorkoutSet[]) {
  let count = 0
  for (const set of sets) {
    if (!set.warmup) count += 1
  }
  return count
}

export function getLastWorkingSet(sets: WorkoutSet[]) {
  for (let index = sets.length - 1; index >= 0; index -= 1) {
    if (!sets[index].warmup) return sets[index]
  }
  return undefined
}

export function createWorkoutSet(warmup = false, previous?: WorkoutSet): WorkoutSet {
  return {
    id: newId(),
    weight: previous?.weight ?? null,
    reps: previous?.reps ?? null,
    rpe: warmup ? null : previous?.rpe ?? null,
    durationSeconds: previous?.durationSeconds ?? null,
    distanceMeters: previous?.distanceMeters ?? null,
    completed: false,
    completedAt: null,
    warmup,
    notes: '',
  }
}

export function getWorkingSetNumber(sets: WorkoutSet[], setIndex: number) {
  if (sets[setIndex]?.warmup) return null
  let number = 0
  for (let index = 0; index <= setIndex; index += 1) {
    if (!sets[index]?.warmup) number += 1
  }
  return number
}
