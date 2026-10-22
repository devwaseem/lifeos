import type { WorkoutSession, WorkoutSet } from './types'
import { getWorkingSetNumber } from './workout-sets'

export interface ActiveRestTimer {
  sourceExerciseId: string
  restUntil: string
  remaining: number
  nextLabel: string
}

function setLabel(sets: WorkoutSet[], setIndex: number) {
  const set = sets[setIndex]
  if (set.warmup) return 'Warm-up'
  return `Set ${getWorkingSetNumber(sets, setIndex) ?? setIndex + 1}`
}

function nextPendingLabel(workout: WorkoutSession, sourceExerciseId: string) {
  const sourceIndex = workout.exercises.findIndex((exercise) => exercise.id === sourceExerciseId)
  if (sourceIndex < 0) return 'Finish workout'

  for (let offset = 0; offset < workout.exercises.length; offset += 1) {
    const exercise = workout.exercises[(sourceIndex + offset) % workout.exercises.length]
    const setIndex = exercise.sets.findIndex((set) => !set.completed)
    if (setIndex >= 0) return `Next · ${exercise.name} · ${setLabel(exercise.sets, setIndex)}`
  }

  return 'Finish workout'
}

export function getActiveRestTimer(workout: WorkoutSession | undefined, now = Date.now()): ActiveRestTimer | null {
  if (!workout) return null
  let sourceExerciseId = ''
  let restUntil = ''
  let restEnd = Number.POSITIVE_INFINITY

  for (const exercise of workout.exercises) {
    if (!exercise.restUntil) continue
    const candidateEnd = new Date(exercise.restUntil).getTime()
    if (!Number.isFinite(candidateEnd) || candidateEnd <= now || candidateEnd >= restEnd) continue
    sourceExerciseId = exercise.id
    restUntil = exercise.restUntil
    restEnd = candidateEnd
  }

  if (!sourceExerciseId) return null
  return {
    sourceExerciseId,
    restUntil,
    remaining: (restEnd - now) / 1_000,
    nextLabel: nextPendingLabel(workout, sourceExerciseId),
  }
}
