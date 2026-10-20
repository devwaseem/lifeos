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

export type SetProgressionOutcome = 'progressed' | 'maintained' | 'below-previous' | 'baseline'

export function getSetProgressionOutcome(set: WorkoutSet, target: SetProgressionTarget): SetProgressionOutcome | null {
  if (!set.completed || set.warmup) return null
  if (set.reps === null || target.previousReps === null) return 'baseline'

  const currentWeight = set.weight ?? 0
  const previousWeight = target.previousWeight ?? 0
  const currentIsWeighted = currentWeight > 0
  const previousIsWeighted = previousWeight > 0
  if (currentIsWeighted !== previousIsWeighted) return 'baseline'

  const currentPerformance = currentIsWeighted
    ? currentWeight * (1 + set.reps / 30)
    : set.reps
  const previousPerformance = previousIsWeighted
    ? previousWeight * (1 + target.previousReps / 30)
    : target.previousReps

  if (currentPerformance > previousPerformance) return 'progressed'
  if (currentPerformance < previousPerformance) return 'below-previous'
  if (set.rpe !== null && target.previousRpe !== null) {
    if (set.rpe < target.previousRpe) return 'progressed'
    if (set.rpe > target.previousRpe) return 'below-previous'
  }
  return 'maintained'
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
    maxRpe: 10,
  }
}

export function normalizeProgressionRule(rule: Partial<ProgressionRule> | undefined, equipment: string): ProgressionRule {
  const defaults = defaultProgressionRule(equipment)
  const minReps = Number.isFinite(rule?.minReps) ? Math.min(30, Math.max(1, Math.round(rule?.minReps ?? defaults.minReps))) : defaults.minReps
  const maxReps = Number.isFinite(rule?.maxReps) ? Math.min(50, Math.max(minReps, Math.round(rule?.maxReps ?? defaults.maxReps))) : defaults.maxReps
  const increment = rule?.weightIncrement
  const weightIncrement = increment === null
    ? null
    : typeof increment === 'number' && Number.isFinite(increment) && increment > 0
      ? Math.min(100, Math.round(increment * 100) / 100)
      : defaults.weightIncrement
  const maxRpe = Number.isFinite(rule?.maxRpe) ? Math.min(10, Math.max(1, Math.round(rule?.maxRpe ?? defaults.maxRpe))) : defaults.maxRpe
  return { minReps, maxReps, weightIncrement, maxRpe }
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
  const effortAllowsProgression = previous.rpe === null
    || (previous.rpe < 10 && previous.rpe <= rule.maxRpe)
  const canIncreaseLoad = reachedCeiling
    && effortAllowsProgression
    && previousWeight !== null
    && rule.weightIncrement !== null

  if (canIncreaseLoad) {
    return {
      setId,
      setIndex,
      previousWeight,
      previousReps: previous.reps,
      previousRpe: previous.rpe,
      targetWeight: Math.round((previousWeight + (rule.weightIncrement ?? 0)) * 100) / 100,
      targetReps: rule.minReps,
      action: 'increase-load',
      rule,
    }
  }

  const canAddRep = effortAllowsProgression && previous.reps < rule.maxReps
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
