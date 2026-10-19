import type { ExerciseDefinition, RoutineExercise, RoutineTemplate, WorkoutExercise, WorkoutSession, WorkoutSet } from '$lib/types'
import { defaultProgressionRule, normalizeProgressionRule } from '$lib/progression'
import { resolveSecondaryMuscles } from '$lib/muscle-contributions'
import { newId } from '$lib/utils'
import { DEFAULT_REST_SECONDS } from '$lib/workouts'

const DEFAULT_SET_COUNT = 3
const MAX_SET_COUNT = 20

function normalizeSetCount(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_SET_COUNT
  return Math.min(MAX_SET_COUNT, Math.max(1, Math.round(value)))
}

export function createRoutineExercise(exercise: ExerciseDefinition): RoutineExercise {
  return {
    id: newId(),
    exerciseId: exercise.id,
    name: exercise.name,
    muscle: exercise.muscle,
    secondaryMuscles: resolveSecondaryMuscles(exercise),
    equipment: exercise.equipment,
    notes: '',
    restSeconds: DEFAULT_REST_SECONDS,
    setCount: DEFAULT_SET_COUNT,
    progression: defaultProgressionRule(exercise.equipment),
  }
}

export function getRoutineMuscleGroups(routine: RoutineTemplate) {
  return Array.from(new Set(routine.exercises.map((exercise) => exercise.muscle))).join(' · ')
}

export function normalizeRoutine(routine: RoutineTemplate): RoutineTemplate {
  return {
    ...routine,
    name: typeof routine.name === 'string' && routine.name.trim() ? routine.name.trim() : 'Untitled routine',
    deletedAt: typeof routine.deletedAt === 'string' ? routine.deletedAt : null,
    exercises: Array.isArray(routine.exercises)
      ? routine.exercises.map((exercise) => ({
        ...exercise,
        secondaryMuscles: resolveSecondaryMuscles(exercise),
        notes: typeof exercise.notes === 'string' ? exercise.notes : '',
        restSeconds: typeof exercise.restSeconds === 'number' && exercise.restSeconds >= 0
          ? exercise.restSeconds
          : DEFAULT_REST_SECONDS,
        setCount: normalizeSetCount(exercise.setCount),
        progression: normalizeProgressionRule(exercise.progression, exercise.equipment),
      }))
      : [],
  }
}

export function normalizeRoutines(routines: RoutineTemplate[]) {
  return routines.map(normalizeRoutine).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function emptySet(): WorkoutSet {
  return {
    id: newId(),
    weight: null,
    reps: null,
    rpe: null,
    durationSeconds: null,
    distanceMeters: null,
    completed: false,
    completedAt: null,
    failure: false,
    notes: '',
  }
}

function workoutExerciseFromRoutine(exercise: RoutineExercise): WorkoutExercise {
  return {
    id: newId(),
    exerciseId: exercise.exerciseId,
    name: exercise.name,
    muscle: exercise.muscle,
    secondaryMuscles: resolveSecondaryMuscles(exercise),
    equipment: exercise.equipment,
    notes: exercise.notes,
    restSeconds: exercise.restSeconds,
    restUntil: null,
    progression: normalizeProgressionRule(exercise.progression, exercise.equipment),
    sets: Array.from({ length: normalizeSetCount(exercise.setCount) }, emptySet),
  }
}

export function createWorkoutFromRoutine(
  routine: RoutineTemplate,
  timestamp = new Date().toISOString(),
  cycleSlotId: string | null = null,
): WorkoutSession {
  return {
    id: newId(),
    title: routine.name,
    routineId: routine.id,
    cycleSlotId,
    status: 'active',
    startedAt: timestamp,
    completedAt: null,
    updatedAt: timestamp,
    notes: '',
    sessionRpe: null,
    exercises: routine.exercises.map(workoutExerciseFromRoutine),
  }
}

export function createOneOffWorkout(title: string, timestamp = new Date().toISOString()): WorkoutSession {
  return {
    id: newId(),
    title,
    routineId: null,
    cycleSlotId: null,
    status: 'active',
    startedAt: timestamp,
    completedAt: null,
    updatedAt: timestamp,
    notes: '',
    sessionRpe: null,
    exercises: [],
  }
}

export function routineMatchesWorkout(routine: RoutineTemplate, workout: WorkoutSession) {
  if (routine.exercises.length !== workout.exercises.length) return false
  return routine.exercises.every((template, index) => {
    const exercise = workout.exercises[index]
    return exercise
      && template.exerciseId === exercise.exerciseId
      && template.notes === exercise.notes
      && template.restSeconds === exercise.restSeconds
      && JSON.stringify(resolveSecondaryMuscles(template)) === JSON.stringify(resolveSecondaryMuscles(exercise))
      && template.progression.minReps === exercise.progression.minReps
      && template.progression.maxReps === exercise.progression.maxReps
      && template.progression.weightIncrement === exercise.progression.weightIncrement
      && template.progression.maxRpe === exercise.progression.maxRpe
      && normalizeSetCount(template.setCount) === exercise.sets.length
  })
}

export function routineFromWorkout(
  workout: WorkoutSession,
  name: string,
  existing?: RoutineTemplate,
  timestamp = new Date().toISOString(),
): RoutineTemplate {
  const previousExercises = existing?.exercises ?? []
  return {
    id: existing?.id ?? newId(),
    name: name.trim() || existing?.name || workout.title || 'Untitled routine',
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    exercises: workout.exercises.map((exercise, index) => {
      const previous = previousExercises[index]
      return {
        id: previous?.exerciseId === exercise.exerciseId ? previous.id : newId(),
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        muscle: exercise.muscle,
        equipment: exercise.equipment,
        secondaryMuscles: resolveSecondaryMuscles(exercise),
        notes: exercise.notes,
        restSeconds: exercise.restSeconds,
        setCount: Math.max(1, exercise.sets.length),
        progression: normalizeProgressionRule(exercise.progression, exercise.equipment),
      }
    }),
  }
}
