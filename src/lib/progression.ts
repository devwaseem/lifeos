import { getExerciseTrackingMode } from '$lib/exercise-tracking'
import type { ExerciseDefinition, ProgressionRule, WorkoutExercise, WorkoutSession, WorkoutSet } from '$lib/types'
import { getMatchingPreviousSet, getPreviousWorkoutExercise } from '$lib/workout-sets'

export type ProgressionAction = 'add-rep' | 'increase-load' | 'repeat' | 'baseline'

export interface SetProgressionTarget {
  setId: string
  setIndex: number
  previousWeight: number | null
  previousReps: number | null
  previousRpe: number | null
  targetWeight: number | null
  targetReps: number | null
  action: ProgressionAction
  rule: ProgressionRule
}


export type ExerciseProgressionStatus = 'pending' | 'progressed' | 'maintained' | 'declined' | 'baseline' | 'not-comparable'
export type ProgressionEffortTrend = 'lower' | 'same' | 'higher'

export interface ExerciseProgressionResult {
  workoutExerciseId: string
  status: ExerciseProgressionStatus
  previousSet: WorkoutSet | null
  currentSet: WorkoutSet | null
  target: SetProgressionTarget | null
  repDelta: number | null
  effortTrend: ProgressionEffortTrend | null
}


const MAX_WEIGHT_OPTIONS = 200
const MAX_WEIGHT_KG = 1_000

export function normalizeWeightOptions(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value
    .filter((weight): weight is number => typeof weight === 'number' && Number.isFinite(weight) && weight > 0 && weight <= MAX_WEIGHT_KG)
    .map((weight) => Math.round(weight * 100) / 100)))
    .sort((left, right) => left - right)
    .slice(0, MAX_WEIGHT_OPTIONS)
}

export function parseWeightOptionsInput(value: string) {
  const tokens = value.trim() ? value.trim().split(/[\s,]+/) : []
  if (tokens.length > MAX_WEIGHT_OPTIONS) {
    return { weightOptions: [] as number[], error: `Enter no more than ${MAX_WEIGHT_OPTIONS} loads.` }
  }
  const weights = tokens.map(Number)
  if (weights.some((weight) => !Number.isFinite(weight) || weight <= 0 || weight > MAX_WEIGHT_KG)) {
    return { weightOptions: [] as number[], error: `Use positive loads up to ${MAX_WEIGHT_KG} kg, separated by commas.` }
  }
  return { weightOptions: normalizeWeightOptions(weights), error: null }
}

export function getEquipmentWeightIncrement(equipment: string) {
  if (equipment === 'Dumbbells' || equipment === 'Kettlebell') return 2
  if (equipment === 'Bodyweight' || equipment === 'Resistance Band' || equipment === 'Suspension Trainer') return null
  return 2.5
}

export function supportsProgression(exercise: Pick<ExerciseDefinition, 'name' | 'muscle'>) {
  return getExerciseTrackingMode(exercise) === 'strength'
}

export function defaultProgressionRule(equipment: string): ProgressionRule {
  return {
    minReps: 8,
    maxReps: 12,
    weightIncrement: getEquipmentWeightIncrement(equipment),
    weightOptions: [],
  }
}

export function normalizeProgressionRule(
  rule: Partial<ProgressionRule> | undefined,
  equipment: string,
  weightOptions: unknown = rule?.weightOptions,
): ProgressionRule {
  const defaults = defaultProgressionRule(equipment)
  const minReps = Number.isFinite(rule?.minReps) ? Math.min(30, Math.max(1, Math.round(rule?.minReps ?? defaults.minReps))) : defaults.minReps
  const maxReps = Number.isFinite(rule?.maxReps) ? Math.min(50, Math.max(minReps, Math.round(rule?.maxReps ?? defaults.maxReps))) : defaults.maxReps
  const increment = rule?.weightIncrement
  const weightIncrement = increment === null
    ? null
    : typeof increment === 'number' && Number.isFinite(increment) && increment > 0
      ? Math.min(100, Math.round(increment * 100) / 100)
      : defaults.weightIncrement
  return {
    minReps,
    maxReps,
    weightIncrement,
    weightOptions: normalizeWeightOptions(weightOptions),
  }
}

function targetFromPrevious(setId: string, setIndex: number, previous: WorkoutSet | undefined, exercise: WorkoutExercise): SetProgressionTarget {
  const rule = normalizeProgressionRule(exercise.progression, exercise.equipment)
  if (!previous?.completed || previous.reps === null) {
    return {
      setId,
      setIndex,
      previousWeight: null,
      previousReps: null,
      previousRpe: null,
      targetWeight: null,
      targetReps: null,
      action: 'baseline',
      rule,
    }
  }

  const previousWeight = previous.weight
  const reachedCeiling = previous.reps >= rule.maxReps
  const nextRackWeight = previousWeight === null
    ? undefined
    : rule.weightOptions.find((weight) => weight > previousWeight + 0.001)
  const nextWeight = rule.weightOptions.length > 0
    ? nextRackWeight
    : previousWeight !== null && rule.weightIncrement !== null
      ? Math.round((previousWeight + rule.weightIncrement) * 100) / 100
      : undefined
  const canIncreaseLoad = reachedCeiling && nextWeight !== undefined

  if (canIncreaseLoad) {
    return {
      setId,
      setIndex,
      previousWeight,
      previousReps: previous.reps,
      previousRpe: previous.rpe,
      targetWeight: nextWeight,
      targetReps: rule.minReps,
      action: 'increase-load',
      rule,
    }
  }

  const canAddRep = previous.reps < rule.maxReps
  return {
    setId,
    setIndex,
    previousWeight,
    previousReps: previous.reps,
    previousRpe: previous.rpe,
    targetWeight: previousWeight,
    targetReps: canAddRep ? Math.min(rule.maxReps, previous.reps + 1) : previous.reps,
    action: canAddRep ? 'add-rep' : 'repeat',
    rule,
  }
}

export function buildSetProgressionTargets(currentWorkout: WorkoutSession, workouts: WorkoutSession[]) {
  const targets = new Map<string, SetProgressionTarget>()

  for (const exercise of currentWorkout.exercises) {
    if (!supportsProgression(exercise)) continue
    const previousExercise = getPreviousWorkoutExercise(workouts, exercise.exerciseId)
    let workingSetIndex = 0

    for (const set of exercise.sets) {
      if (set.warmup) continue
      targets.set(
        set.id,
        targetFromPrevious(
          set.id,
          workingSetIndex,
          getMatchingPreviousSet(previousExercise, false, workingSetIndex),
          exercise,
        ),
      )
      workingSetIndex += 1
    }
  }

  return targets
}

function getFirstWorkingSet(exercise: WorkoutExercise | undefined) {
  return exercise?.sets.find((set) => !set.warmup)
}

function workoutTime(workout: WorkoutSession) {
  return workout.completedAt ?? workout.startedAt
}

function getPreviousExerciseBefore(
  workouts: WorkoutSession[],
  currentWorkout: WorkoutSession,
  exerciseId: string,
) {
  const currentTime = workoutTime(currentWorkout)
  let previousWorkout: WorkoutSession | undefined
  let previousExercise: WorkoutExercise | undefined

  for (const workout of workouts) {
    if (workout.id === currentWorkout.id || workout.status !== 'completed') continue
    if (workoutTime(workout) >= currentTime) continue
    const exercise = workout.exercises.find((candidate) => candidate.exerciseId === exerciseId)
    const firstSet = getFirstWorkingSet(exercise)
    if (!firstSet?.completed || firstSet.reps === null) continue
    if (!previousWorkout || workoutTime(workout) > workoutTime(previousWorkout)) {
      previousWorkout = workout
      previousExercise = exercise
    }
  }

  return previousExercise
}

function getEffortTrend(current: WorkoutSet | undefined, previous: WorkoutSet | undefined): ProgressionEffortTrend | null {
  if (current?.rpe === null || current?.rpe === undefined || previous?.rpe === null || previous?.rpe === undefined) return null
  const difference = current.rpe - previous.rpe
  if (difference === 0) return 'same'
  if (difference <= -1) return 'lower'
  if (difference >= 1) return 'higher'
  return null
}

function sameLoad(current: WorkoutSet, previous: WorkoutSet) {
  return Math.abs((current.weight ?? 0) - (previous.weight ?? 0)) < 0.01
}

function getExerciseProgressionResult(
  currentWorkout: WorkoutSession,
  exercise: WorkoutExercise,
  workouts: WorkoutSession[],
): ExerciseProgressionResult {
  const currentSet = getFirstWorkingSet(exercise)
  const previousExercise = getPreviousExerciseBefore(workouts, currentWorkout, exercise.exerciseId)
  const previousSet = getFirstWorkingSet(previousExercise)
  const target = currentSet
    ? targetFromPrevious(currentSet.id, 0, previousSet, exercise)
    : null
  const base = {
    workoutExerciseId: exercise.id,
    previousSet: previousSet ?? null,
    currentSet: currentSet ?? null,
    target,
    effortTrend: getEffortTrend(currentSet, previousSet),
  }

  if (!currentSet?.completed || currentSet.reps === null) {
    return { ...base, status: 'pending', repDelta: null }
  }
  if (!previousSet?.completed || previousSet.reps === null) {
    return { ...base, status: 'baseline', repDelta: null }
  }
  if (sameLoad(currentSet, previousSet)) {
    const repDelta = currentSet.reps - previousSet.reps
    return {
      ...base,
      status: repDelta > 0 ? 'progressed' : repDelta < 0 ? 'declined' : 'maintained',
      repDelta,
    }
  }
  const increasedLoad = currentSet.weight !== null
    && (previousSet.weight === null || currentSet.weight > previousSet.weight + 0.01)
  return {
    ...base,
    status: increasedLoad ? 'progressed' : 'not-comparable',
    repDelta: null,
  }
}

export function buildExerciseProgressionResults(currentWorkout: WorkoutSession, workouts: WorkoutSession[]) {
  const results = new Map<string, ExerciseProgressionResult>()
  for (const exercise of currentWorkout.exercises) {
    if (!supportsProgression(exercise)) continue
    results.set(exercise.id, getExerciseProgressionResult(currentWorkout, exercise, workouts))
  }
  return results
}
