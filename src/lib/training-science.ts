import { getMuscleContributions } from '$lib/muscle-contributions'
import type { WorkoutExercise, WorkoutSession, WorkoutSet } from '$lib/types'

const DAY_MS = 24 * 60 * 60 * 1_000

export type EvidenceConfidence = 'low' | 'moderate' | 'high'

export interface StrengthProfile {
  currentEstimated1Rm: number | null
  bestEstimated1Rm: number | null
  trendPercent: number | null
  comparableSessions: number
  rpeCoverage: number
  confidence: EvidenceConfidence
}


export interface MuscleDose {
  muscle: string
  hardSetEquivalents: number
  baselineWeeklySets: number | null
  ratio: number | null
  status: 'below-recent' | 'near-recent' | 'above-recent' | 'building-baseline'
  confidence: EvidenceConfidence
}

export interface SystemicLoad {
  recentLoad: number | null
  weeklyAverageLoad: number | null
  ratio: number | null
  recentSessionCount: number
  recentSessionsWithEffort: number
  recentEstimatedSessions: number
  baselineSessionCount: number
  baselineSessionsWithEffort: number
  baselineEstimatedSessions: number
  sessionsWithEffort: number
  estimatedSessions: number
  sessionCount: number
  confidence: EvidenceConfidence
  context: 'below-recent' | 'near-recent' | 'above-recent' | 'building-baseline'
}

export interface FatigueSignal {
  status: 'stable' | 'watch' | 'consider-easier'
  affectedExercises: string[]
  performanceChangePercent: number | null
  rpeChange: number | null
  confidence: EvidenceConfidence
  title: string
  recommendation: string
}

export interface WorkoutStrengthHighlight {
  exerciseId: string
  exerciseName: string
  estimated1Rm: number
  changeFromPreviousBest: number | null
  confidence: EvidenceConfidence
}

interface ExerciseExposure {
  name: string
  timestamp: number
  estimated1Rm: number
  averageRpe: number | null
  maxEffortRate: number
}

function round(value: number, precision = 1) {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function median(values: number[]) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

function mean(values: number[]) {
  return values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : 0
}

function confidenceFor(sampleCount: number, coverage: number): EvidenceConfidence {
  if (sampleCount >= 6 && coverage >= 0.75) return 'high'
  if (sampleCount >= 3 && coverage >= 0.5) return 'moderate'
  return 'low'
}

export function estimateSetE1rm(set: WorkoutSet): number | null {
  if (set.warmup || !set.completed || set.weight === null || set.weight <= 0 || set.reps === null || set.reps < 1 || set.reps > 15) return null
  const observedRpe = set.rpe
  if (observedRpe === null) return null
  const reserveReps = Math.min(5, Math.max(0, 10 - observedRpe))
  const repsAtFailure = Math.min(20, set.reps + reserveReps)
  return round(set.weight * (1 + repsAtFailure / 30), 1)
}

function exerciseExposure(exercise: WorkoutExercise, workout: WorkoutSession): ExerciseExposure | null {
  const completed = exercise.sets.filter((set) => set.completed && !set.warmup)
  const estimates = completed.map(estimateSetE1rm).filter((value): value is number => value !== null)
  if (estimates.length === 0) return null
  const rpes = completed.map((set) => set.rpe).filter((value): value is number => value !== null)
  const timestamp = new Date(workout.completedAt ?? workout.startedAt).getTime()
  if (!Number.isFinite(timestamp)) return null
  return {
    name: exercise.name,
    timestamp,
    estimated1Rm: Math.max(...estimates),
    averageRpe: rpes.length > 0 ? mean(rpes) : null,
    maxEffortRate: completed.length > 0 ? completed.filter((set) => set.rpe === 10).length / completed.length : 0,
  }
}

function collectExerciseExposuresById(exerciseIds: Iterable<string>, workouts: WorkoutSession[]) {
  const requested = new Set(exerciseIds)
  const exposures = new Map<string, ExerciseExposure[]>([...requested].map((id) => [id, []]))
  for (const workout of workouts) {
    if (workout.status === 'cancelled') continue
    for (const exercise of workout.exercises) {
      if (!requested.has(exercise.exerciseId)) continue
      const exposure = exerciseExposure(exercise, workout)
      if (exposure) exposures.get(exercise.exerciseId)?.push(exposure)
    }
  }
  for (const entries of exposures.values()) entries.sort((a, b) => b.timestamp - a.timestamp)
  return exposures
}

function strengthProfile(exposures: ExerciseExposure[]): StrengthProfile {
  const withRpe = exposures.filter((exposure) => exposure.averageRpe !== null).length
  const rpeCoverage = exposures.length > 0 ? withRpe / exposures.length : 0
  const recent = exposures.slice(0, 3)
  const previous = exposures.slice(3, 6)
  const currentEstimated1Rm = recent.length > 0 ? round(median(recent.map((exposure) => exposure.estimated1Rm)), 1) : null
  const previousEstimate = previous.length > 0 ? median(previous.map((exposure) => exposure.estimated1Rm)) : null
  const trendPercent = currentEstimated1Rm !== null && previousEstimate !== null && previousEstimate > 0
    ? round(((currentEstimated1Rm - previousEstimate) / previousEstimate) * 100, 1)
    : null
  return {
    currentEstimated1Rm,
    bestEstimated1Rm: exposures.length > 0 ? Math.max(...exposures.map((exposure) => exposure.estimated1Rm)) : null,
    trendPercent,
    comparableSessions: exposures.length,
    rpeCoverage,
    confidence: confidenceFor(exposures.length, rpeCoverage),
  }
}

export function getExerciseStrengthProfiles(exerciseIds: Iterable<string>, workouts: WorkoutSession[]) {
  const exposures = collectExerciseExposuresById(exerciseIds, workouts)
  return new Map([...exposures].map(([id, entries]) => [id, strengthProfile(entries)]))
}

function collectExerciseExposures(exerciseId: string, workouts: WorkoutSession[]) {
  return collectExerciseExposuresById([exerciseId], workouts).get(exerciseId) ?? []
}

export function getExerciseStrengthProfile(exerciseId: string, workouts: WorkoutSession[]): StrengthProfile {
  return getExerciseStrengthProfiles([exerciseId], workouts).get(exerciseId) ?? strengthProfile([])
}


function hardSetCredit(set: WorkoutSet) {
  if (set.warmup || !set.completed) return 0
  return set.rpe !== null && set.rpe >= 7 ? 1 : 0
}

function doseInRange(workouts: WorkoutSession[], start: number, end: number) {
  const dose = new Map<string, number>()
  const rpeCoverage = new Map<string, { known: number; total: number }>()
  for (const workout of workouts) {
    if (workout.status !== 'completed') continue
    const fallback = new Date(workout.completedAt ?? workout.startedAt).getTime()
    for (const exercise of workout.exercises) {
      for (const set of exercise.sets) {
        if (set.warmup || !set.completed) continue
        const timestamp = new Date(set.completedAt ?? fallback).getTime()
        if (!Number.isFinite(timestamp) || timestamp < start || timestamp > end) continue
        const credit = hardSetCredit(set)
        for (const muscle of getMuscleContributions(exercise)) {
          dose.set(muscle.muscle, (dose.get(muscle.muscle) ?? 0) + credit * muscle.fraction)
          const coverage = rpeCoverage.get(muscle.muscle) ?? { known: 0, total: 0 }
          coverage.total += muscle.fraction
          if (set.rpe !== null) coverage.known += muscle.fraction
          rpeCoverage.set(muscle.muscle, coverage)
        }
      }
    }
  }
  return { dose, rpeCoverage }
}

export function getMuscleDose(workouts: WorkoutSession[], now = Date.now()): MuscleDose[] {
  const recent = doseInRange(workouts, now - 7 * DAY_MS, now)
  const baseline = doseInRange(workouts, now - 35 * DAY_MS, now - 7 * DAY_MS)
  const muscles = new Set([...recent.dose.keys(), ...baseline.dose.keys()])
  return [...muscles].map((muscle) => {
    const hardSetEquivalents = round(recent.dose.get(muscle) ?? 0, 1)
    const baselineTotal = baseline.dose.get(muscle) ?? 0
    const baselineWeeklySets = baselineTotal > 0 ? round(baselineTotal / 4, 1) : null
    const ratio = baselineWeeklySets && baselineWeeklySets > 0 ? round(hardSetEquivalents / baselineWeeklySets, 2) : null
    const coverage = recent.rpeCoverage.get(muscle) ?? baseline.rpeCoverage.get(muscle) ?? { known: 0, total: 0 }
    const status: MuscleDose['status'] = ratio === null
      ? 'building-baseline'
      : ratio > 1.3
        ? 'above-recent'
        : ratio < 0.7
          ? 'below-recent'
          : 'near-recent'
    return {
      muscle,
      hardSetEquivalents,
      baselineWeeklySets,
      ratio,
      status,
      confidence: confidenceFor(Math.round(coverage.total), coverage.total > 0 ? coverage.known / coverage.total : 0),
    }
  }).filter((item) => item.hardSetEquivalents > 0 || (item.baselineWeeklySets ?? 0) > 0)
    .sort((a, b) => b.hardSetEquivalents - a.hardSetEquivalents || a.muscle.localeCompare(b.muscle))
}

function sessionLoad(workout: WorkoutSession) {
  if (workout.status !== 'completed' || !workout.completedAt) return null
  const durationMinutes = Math.max(0, (new Date(workout.completedAt).getTime() - new Date(workout.startedAt).getTime()) / 60_000)
  if (!Number.isFinite(durationMinutes)) return null

  const setRpes = workout.exercises
    .flatMap((exercise) => exercise.sets)
    .filter((set) => set.completed)
    .map((set) => set.rpe)
    .filter((rpe): rpe is number => typeof rpe === 'number' && Number.isFinite(rpe) && rpe > 0)
  const estimated = workout.sessionRpe === null
  const effort = workout.sessionRpe ?? (setRpes.length > 0 ? setRpes.reduce((total, rpe) => total + rpe, 0) / setRpes.length : null)
  if (effort === null) return null

  return { load: durationMinutes * effort, estimated }
}

export function getSystemicLoad(workouts: WorkoutSession[], now = Date.now()): SystemicLoad {
  let recentLoad = 0
  let baselineTotal = 0
  let recentSessionCount = 0
  let recentSessionsWithEffort = 0
  let recentEstimatedSessions = 0
  let baselineSessionCount = 0
  let baselineSessionsWithEffort = 0
  let baselineEstimatedSessions = 0
  for (const workout of workouts) {
    if (workout.status !== 'completed') continue
    const timestamp = new Date(workout.completedAt ?? workout.startedAt).getTime()
    if (!Number.isFinite(timestamp) || timestamp < now - 35 * DAY_MS || timestamp > now) continue
    const recent = timestamp >= now - 7 * DAY_MS
    if (recent) recentSessionCount += 1
    else baselineSessionCount += 1
    const result = sessionLoad(workout)
    if (result === null) continue
    if (recent) {
      recentSessionsWithEffort += 1
      if (result.estimated) recentEstimatedSessions += 1
      recentLoad += result.load
    } else {
      baselineSessionsWithEffort += 1
      if (result.estimated) baselineEstimatedSessions += 1
      baselineTotal += result.load
    }
  }
  const sessionCount = recentSessionCount + baselineSessionCount
  const sessionsWithEffort = recentSessionsWithEffort + baselineSessionsWithEffort
  const estimatedSessions = recentEstimatedSessions + baselineEstimatedSessions
  const weeklyAverageLoad = baselineTotal / 4
  const ratio = recentSessionsWithEffort > 0 && baselineSessionsWithEffort > 0 && weeklyAverageLoad > 0
    ? recentLoad / weeklyAverageLoad
    : null
  const context: SystemicLoad['context'] = ratio === null
    ? 'building-baseline'
    : ratio > 1.3
      ? 'above-recent'
      : ratio < 0.7
        ? 'below-recent'
        : 'near-recent'
  return {
    recentLoad: recentSessionCount > 0 && recentSessionsWithEffort === 0 ? null : Math.round(recentLoad),
    weeklyAverageLoad: baselineSessionsWithEffort === 0 ? null : Math.round(weeklyAverageLoad),
    ratio: ratio === null ? null : round(ratio, 2),
    recentSessionCount,
    recentSessionsWithEffort,
    recentEstimatedSessions,
    baselineSessionCount,
    baselineSessionsWithEffort,
    baselineEstimatedSessions,
    sessionsWithEffort,
    estimatedSessions,
    sessionCount,
    confidence: confidenceFor(sessionCount, sessionCount > 0 ? sessionsWithEffort / sessionCount : 0),
    context,
  }
}

export function getFatigueSignal(workouts: WorkoutSession[]): FatigueSignal {
  const exerciseIds = new Set(workouts.flatMap((workout) => workout.exercises.map((exercise) => exercise.exerciseId)))
  const suppressed: Array<{ name: string; performance: number; rpe: number }> = []
  for (const exerciseId of exerciseIds) {
    const exposures = collectExerciseExposures(exerciseId, workouts)
    if (exposures.length < 6) continue
    const recent = exposures.slice(0, 3)
    const baseline = exposures.slice(3, 6)
    const recentPerformance = median(recent.map((exposure) => exposure.estimated1Rm))
    const baselinePerformance = median(baseline.map((exposure) => exposure.estimated1Rm))
    if (baselinePerformance <= 0) continue
    const performance = ((recentPerformance - baselinePerformance) / baselinePerformance) * 100
    const recentRpes = recent.map((exposure) => exposure.averageRpe).filter((value): value is number => value !== null)
    const baselineRpes = baseline.map((exposure) => exposure.averageRpe).filter((value): value is number => value !== null)
    const rpe = recentRpes.length > 0 && baselineRpes.length > 0 ? mean(recentRpes) - mean(baselineRpes) : 0
    const maxEffortIncrease = mean(recent.map((exposure) => exposure.maxEffortRate)) - mean(baseline.map((exposure) => exposure.maxEffortRate))
    if (performance <= -3 && (rpe >= 0.5 || maxEffortIncrease >= 0.15)) {
      suppressed.push({ name: recent[0].name, performance, rpe })
    }
  }

  if (suppressed.length === 0) {
    const hasSameExerciseHistory = [...exerciseIds].some((id) => collectExerciseExposures(id, workouts).length >= 6)
    return {
      status: 'stable',
      affectedExercises: [],
      performanceChangePercent: null,
      rpeChange: null,
      confidence: hasSameExerciseHistory ? 'moderate' : 'low',
      title: hasSameExerciseHistory ? 'Performance stable' : 'Building a fatigue baseline',
      recommendation: hasSameExerciseHistory ? 'No repeated performance suppression detected.' : 'Keep logging RPE; six same-exercise exposures are needed per movement.',
    }
  }

  const performanceChangePercent = round(mean(suppressed.map((item) => item.performance)), 1)
  const rpeChange = round(mean(suppressed.map((item) => item.rpe)), 1)
  const status: FatigueSignal['status'] = performanceChangePercent <= -5 || suppressed.length >= 2 ? 'consider-easier' : 'watch'
  return {
    status,
    affectedExercises: suppressed.map((item) => item.name),
    performanceChangePercent,
    rpeChange,
    confidence: suppressed.length >= 2 ? 'high' : 'moderate',
    title: status === 'consider-easier' ? 'Consider an easier session' : 'Performance watch',
    recommendation: status === 'consider-easier'
      ? 'Repeated same-exercise results are below your baseline at higher effort. Consider reducing load or hard sets if that matches how you feel.'
      : 'Hold progression for the next same-exercise exposure and reassess from fresh logged data.',
  }
}

export function getWorkoutStrengthHighlights(workout: WorkoutSession, workouts: WorkoutSession[]): WorkoutStrengthHighlight[] {
  return workout.exercises.flatMap((exercise) => {
    const estimates = exercise.sets.map(estimateSetE1rm).filter((value): value is number => value !== null)
    if (estimates.length === 0) return []
    const estimated1Rm = Math.max(...estimates)
    const history = workouts.filter((candidate) => candidate.id !== workout.id)
    const previous = getExerciseStrengthProfile(exercise.exerciseId, history)
    return [{
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.name,
      estimated1Rm,
      changeFromPreviousBest: previous.bestEstimated1Rm && previous.bestEstimated1Rm > 0
        ? round(((estimated1Rm - previous.bestEstimated1Rm) / previous.bestEstimated1Rm) * 100, 1)
        : null,
      confidence: getExerciseStrengthProfile(exercise.exerciseId, [...history, workout]).confidence,
    }]
  })
}
