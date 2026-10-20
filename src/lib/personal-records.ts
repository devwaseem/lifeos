import { getExerciseHistory, getExerciseStats } from '$lib/exercise-insights'
import type { WorkoutSession } from '$lib/types'

export type PersonalRecordKind = 'heaviest' | 'oneRepMax' | 'bestSetVolume' | 'sessionVolume' | 'bestReps'

export interface PersonalRecordAchievement {
  id: string
  workoutExerciseId: string
  exerciseId: string
  exerciseName: string
  kind: PersonalRecordKind
  label: string
  value: number
  formattedValue: string
}

const numberFormatter = new Intl.NumberFormat('en', { maximumFractionDigits: 1 })

function kilograms(value: number) {
  return `${numberFormatter.format(value)} kg`
}

export function getWorkoutPersonalRecords(workout: WorkoutSession, workouts: WorkoutSession[]): PersonalRecordAchievement[] {
  const historyWorkouts = workouts.filter((candidate) => candidate.id !== workout.id)

  return workout.exercises.flatMap((exercise) => {
    const completedSets = exercise.sets.filter(
      (set) => !set.warmup && set.completed && set.weight !== null && set.reps !== null,
    )
    if (completedSets.length === 0) return []

    const history = getExerciseHistory(historyWorkouts, exercise.exerciseId)
    const previous = getExerciseStats(history)
    const previousBestReps = Math.max(0, ...history.flatMap((entry) => entry.sets.filter((set) => !set.warmup).map((set) => set.reps ?? 0)))
    const weights = completedSets.map((set) => set.weight ?? 0)
    const reps = completedSets.map((set) => set.reps ?? 0)
    const volumes = completedSets.map((set, index) => weights[index] * reps[index])
    const heaviest = Math.max(0, ...weights)
    const oneRepMax = Math.max(0, ...completedSets.map((set) => (set.weight ?? 0) * (1 + (set.reps ?? 0) / 30)))
    const bestSetVolume = Math.max(0, ...volumes)
    const sessionVolume = volumes.reduce((total, value) => total + value, 0)
    const bestReps = Math.max(0, ...reps)

    const candidates: Array<{
      kind: PersonalRecordKind
      label: string
      value: number
      previousValue: number
      formattedValue: string
    }> = [
      {
        kind: 'heaviest',
        label: 'Heaviest weight',
        value: heaviest,
        previousValue: previous.heaviest,
        formattedValue: kilograms(heaviest),
      },
      {
        kind: 'oneRepMax',
        label: 'Estimated 1RM',
        value: oneRepMax,
        previousValue: previous.oneRepMax,
        formattedValue: kilograms(oneRepMax),
      },
      {
        kind: 'bestSetVolume',
        label: 'Best set volume',
        value: bestSetVolume,
        previousValue: previous.bestSetVolume,
        formattedValue: kilograms(bestSetVolume),
      },
      {
        kind: 'sessionVolume',
        label: 'Best session volume',
        value: sessionVolume,
        previousValue: previous.bestSessionVolume,
        formattedValue: kilograms(sessionVolume),
      },
      {
        kind: 'bestReps',
        label: 'Most reps in a set',
        value: bestReps,
        previousValue: previousBestReps,
        formattedValue: `${numberFormatter.format(bestReps)} reps`,
      },
    ]

    return candidates
      .filter((candidate) => candidate.value > 0 && candidate.value > candidate.previousValue + Number.EPSILON)
      .map((candidate) => ({
        id: `${exercise.id}:${candidate.kind}`,
        workoutExerciseId: exercise.id,
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.name,
        kind: candidate.kind,
        label: candidate.label,
        value: candidate.value,
        formattedValue: candidate.formattedValue,
      }))
  })
}
