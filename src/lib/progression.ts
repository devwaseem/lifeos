import { getExerciseTrackingMode } from '$lib/exercise-tracking'
import type { ExerciseDefinition, ProgressionRule, WorkoutExercise, WorkoutSession, WorkoutSet } from '$lib/types'
import { getNextSetAutoregulation, type AutoregulationRecommendation } from '$lib/training-science'

export type ProgressionAction = 'add-rep' | 'increase-load' | 'repeat' | 'baseline'

export interface SetProgressionTarget {
  setId: string
  setIndex: number
  previousWeight: number | null
  previousReps: number | null
  previousRpe: number | null
  previousFailure: boolean
  targetWeight: number | null
  targetReps: number | null
  action: ProgressionAction
  rule: ProgressionRule
  autoregulation?: AutoregulationRecommendation
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
      previousFailure: false,
      targetWeight: null,
      targetReps: null,
      action: 'baseline',
      rule,
    }
  }

  const previousWeight = previous.weight
  const reachedCeiling = previous.reps >= rule.maxReps
  const effortAllowsProgression = !previous.failure && (previous.rpe === null || previous.rpe <= rule.maxRpe)
  const canIncreaseLoad = reachedCeiling && effortAllowsProgression && previousWeight !== null && rule.weightIncrement !== null

  if (canIncreaseLoad) {
    return {
      setId,
      setIndex,
      previousWeight,
      previousReps: previous.reps,
      previousRpe: previous.rpe,
      previousFailure: previous.failure,
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
    previousFailure: previous.failure,
    targetWeight: previousWeight,
    targetReps: canAddRep ? Math.min(rule.maxReps, previous.reps + 1) : previous.reps,
    action: canAddRep ? 'add-rep' : 'repeat',
    rule,
  }
}

export function buildSetProgressionTargets(currentWorkout: WorkoutSession, workouts: WorkoutSession[]) {
  const history = workouts
    .filter((workout) => workout.status === 'completed' && workout.id !== currentWorkout.id)
    .sort((a, b) => (b.completedAt ?? b.startedAt).localeCompare(a.completedAt ?? a.startedAt))
  const targets = new Map<string, SetProgressionTarget>()

  for (const exercise of currentWorkout.exercises) {
    if (!supportsProgression(exercise)) continue
    const previousExercise = history
      .map((workout) => workout.exercises.find((candidate) => candidate.exerciseId === exercise.exerciseId))
      .find((candidate) => candidate?.sets.some((set) => set.completed && set.reps !== null))

    exercise.sets.forEach((set, index) => {
      const historical = targetFromPrevious(set.id, index, previousExercise?.sets[index], exercise)
      const autoregulation = getNextSetAutoregulation(exercise, index, workouts, {
        weight: historical.targetWeight,
        reps: historical.targetReps,
      })
      const livePrevious = exercise.sets.slice(0, index).filter((candidate) => candidate.completed).at(-1)
      targets.set(set.id, {
        ...historical,
        previousWeight: autoregulation.source === 'live' ? livePrevious?.weight ?? null : historical.previousWeight,
        previousReps: autoregulation.source === 'live' ? livePrevious?.reps ?? null : historical.previousReps,
        previousRpe: autoregulation.source === 'live' ? livePrevious?.rpe ?? null : historical.previousRpe,
        previousFailure: autoregulation.source === 'live' ? livePrevious?.failure ?? false : historical.previousFailure,
        targetWeight: autoregulation.weight,
        targetReps: autoregulation.reps,
        autoregulation,
      })
    })
  }

  return targets
}
