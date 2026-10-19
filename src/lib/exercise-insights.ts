import type { WorkoutExercise, WorkoutSession, WorkoutSet } from '$lib/types'
import { estimateSetE1rm } from '$lib/training-science'

export type ExerciseMetric = 'heaviest' | 'oneRepMax' | 'bestSetVolume' | 'sessionVolume' | 'totalReps'
export type ExerciseRange = '3m' | '1y' | 'all'

export interface ExerciseHistoryEntry {
  workout: WorkoutSession
  exercise: WorkoutExercise
  sets: WorkoutSet[]
}

export interface ExerciseChartPoint {
  date: Date
  label: string
  value: number
}

export interface ExerciseStats {
  heaviest: number
  oneRepMax: number
  bestSetVolume: number
  bestSessionVolume: number
  totalReps: number
}

export interface WeightRecord {
  weight: number
  reps: number
  date: string
}

export const exerciseMetricLabels: Record<ExerciseMetric, string> = {
  heaviest: 'Heaviest weight',
  oneRepMax: 'RPE-adjusted e1RM',
  bestSetVolume: 'Best set volume',
  sessionVolume: 'Session volume',
  totalReps: 'Total reps',
}

export function getExerciseHistory(workouts: WorkoutSession[], exerciseId: string): ExerciseHistoryEntry[] {
  return workouts
    .filter((workout) => workout.status === 'completed')
    .flatMap((workout) => workout.exercises
      .filter((exercise) => exercise.exerciseId === exerciseId)
      .map((exercise) => ({
        workout,
        exercise,
        sets: exercise.sets.filter((set) => set.completed),
      })))
    .filter((entry) => entry.sets.length > 0)
    .sort((a, b) => b.workout.startedAt.localeCompare(a.workout.startedAt))
}

export function getExerciseStats(history: ExerciseHistoryEntry[]): ExerciseStats {
  let heaviest = 0
  let oneRepMax = 0
  let bestSetVolume = 0
  let bestSessionVolume = 0
  let totalReps = 0

  for (const entry of history) {
    let sessionVolume = 0
    for (const set of entry.sets) {
      const weight = set.weight ?? 0
      const reps = set.reps ?? 0
      heaviest = Math.max(heaviest, weight)
      oneRepMax = Math.max(oneRepMax, estimateSetE1rm(set) ?? 0)
      bestSetVolume = Math.max(bestSetVolume, weight * reps)
      sessionVolume += weight * reps
      totalReps += reps
    }
    bestSessionVolume = Math.max(bestSessionVolume, sessionVolume)
  }

  return { heaviest, oneRepMax, bestSetVolume, bestSessionVolume, totalReps }
}

export function getWeightRecords(history: ExerciseHistoryEntry[]): WeightRecord[] {
  const records = new Map<number, WeightRecord>()
  for (const entry of history) {
    for (const set of entry.sets) {
      if (set.weight === null || set.reps === null) continue
      const existing = records.get(set.weight)
      if (!existing || set.reps > existing.reps) {
        records.set(set.weight, { weight: set.weight, reps: set.reps, date: entry.workout.completedAt ?? entry.workout.startedAt })
      }
    }
  }
  return Array.from(records.values()).sort((a, b) => b.weight - a.weight)
}

export function buildExerciseSeries(
  history: ExerciseHistoryEntry[],
  metric: ExerciseMetric,
  range: ExerciseRange,
  now = Date.now(),
): ExerciseChartPoint[] {
  const rangeStart = range === '3m'
    ? now - 90 * 24 * 60 * 60 * 1_000
    : range === '1y'
      ? now - 365 * 24 * 60 * 60 * 1_000
      : Number.NEGATIVE_INFINITY
  const weekly = new Map<string, { date: Date; values: number[] }>()

  for (const entry of history) {
    const date = new Date(entry.workout.completedAt ?? entry.workout.startedAt)
    if (date.getTime() < rangeStart) continue
    const monday = new Date(date)
    const day = (monday.getDay() + 6) % 7
    monday.setDate(monday.getDate() - day)
    monday.setHours(0, 0, 0, 0)
    const key = monday.toISOString().slice(0, 10)
    const weights = entry.sets.map((set) => set.weight ?? 0)
    const reps = entry.sets.map((set) => set.reps ?? 0)
    const setVolumes = entry.sets.map((set, index) => weights[index] * reps[index])
    const valuesByMetric: Record<ExerciseMetric, number> = {
      heaviest: Math.max(0, ...weights),
      oneRepMax: Math.max(0, ...entry.sets.map((set) => estimateSetE1rm(set) ?? 0)),
      bestSetVolume: Math.max(0, ...setVolumes),
      sessionVolume: setVolumes.reduce((total, value) => total + value, 0),
      totalReps: reps.reduce((total, value) => total + value, 0),
    }
    const bucket = weekly.get(key) ?? { date: monday, values: [] }
    bucket.values.push(valuesByMetric[metric])
    weekly.set(key, bucket)
  }

  return Array.from(weekly.values())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((bucket) => ({
      date: bucket.date,
      label: new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(bucket.date),
      value: metric === 'sessionVolume' || metric === 'totalReps'
        ? bucket.values.reduce((total, value) => total + value, 0)
        : Math.max(...bucket.values),
    }))
}
