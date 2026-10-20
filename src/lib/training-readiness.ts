import type { MuscleContribution, RoutineTemplate, WorkoutSession, WorkoutSet } from '$lib/types'
import { getMuscleContributions } from '$lib/muscle-contributions'

const DAY_MS = 24 * 60 * 60 * 1_000
const HOUR_MS = 60 * 60 * 1_000
const READY_THRESHOLD = 80
const STIMULUS_SET_TARGET = 6
const DEFAULT_RECOVERY_HOURS = 48


export const muscleRecoveryHours: Record<string, number> = {
  Chest: 60,
  Back: 72,
  Shoulders: 48,
  Quadriceps: 72,
  Hamstrings: 72,
  Glutes: 72,
  Calves: 48,
  Biceps: 48,
  Triceps: 48,
  Forearms: 36,
  Core: 36,
  Adductors: 48,
  Abductors: 48,
}

export interface PlannedMovement {
  exerciseId: string
  name: string
  muscle: string
  equipment: string
  secondaryMuscles: MuscleContribution[]
}

export type WorkloadStatus = 'above-prior' | 'near-prior' | 'below-prior' | 'no-data'
export type RecoveryStatus = 'recover' | 'partial' | 'ready' | 'fully-recovered'
export type RecoveryConfidenceLevel = 'low' | 'moderate' | 'high'

export interface TargetedWorkload {
  acuteLoad: number
  chronicWeeklyLoad: number
  ratio: number | null
  status: WorkloadStatus
}

export interface MuscleRecovery {
  muscle: string
  recoveryWindowHours: number
  readiness: number
  status: RecoveryStatus
  lastLoadedAt: string | null
  elapsedHours: number | null
  hoursUntilReady: number
  lastStimulusPercent: number | null
  lastStimulusUnits: number | null
  exposureCount: number
}

export interface RecoveryConfidence {
  level: RecoveryConfidenceLevel
  label: string
  reason: string
}

export interface RoutineRecommendation {
  routine: RoutineTemplate
  readiness: number
  limitingMuscle: string | null
}

export interface TrainingReadiness {
  targetMuscles: string[]
  workload: TargetedWorkload
  recovery: MuscleRecovery[]
  targetRecovery: MuscleRecovery[]
  targetReadiness: number
  recoveryConfidence: RecoveryConfidence
  consecutiveLoadDays: number
  systemicFatigueWarning: boolean
}

interface MuscleExposure {
  muscle: string
  timestamp: number
  timestampIso: string
  stimulus: number
  stimulusUnits: number
}


function completedWorkouts(workouts: WorkoutSession[]) {
  return workouts.filter((workout) => workout.status === 'completed')
}

function setTonnage(set: WorkoutSet) {
  if (set.warmup || !set.completed || set.weight === null || set.reps === null) return 0
  return Math.max(0, set.weight) * Math.max(0, set.reps)
}

function targetedTonnage(workout: WorkoutSession, targetMuscles: Set<string>, start: number, end: number) {
  const fallback = workout.completedAt ?? workout.startedAt
  return workout.exercises.reduce((workoutTotal, exercise) => {
    const targetFraction = getMuscleContributions(exercise)
      .filter((contribution) => targetMuscles.has(contribution.muscle))
      .reduce((total, contribution) => total + contribution.fraction, 0)
    if (targetFraction === 0) return workoutTotal
    return workoutTotal + exercise.sets.reduce((total, set) => {
      const timestamp = new Date(set.completedAt ?? fallback).getTime()
      return Number.isFinite(timestamp) && timestamp >= start && timestamp <= end
        ? total + setTonnage(set) * targetFraction
        : total
    }, 0)
  }, 0)
}

function getTargetedWorkload(workouts: WorkoutSession[], targetMuscles: string[], now: number): TargetedWorkload {
  const targets = new Set(targetMuscles)
  const acuteStart = now - 7 * DAY_MS
  const chronicStart = now - 28 * DAY_MS
  let acuteLoad = 0
  let chronicLoad = 0

  for (const workout of workouts) {
    chronicLoad += targetedTonnage(workout, targets, chronicStart, now)
    acuteLoad += targetedTonnage(workout, targets, acuteStart, now)
  }

  const chronicWeeklyLoad = chronicLoad / 4
  const ratio = chronicWeeklyLoad > 0 ? acuteLoad / chronicWeeklyLoad : null
  const status: WorkloadStatus = ratio === null
    ? 'no-data'
    : ratio > 1.1
      ? 'above-prior'
      : ratio < 0.9
        ? 'below-prior'
        : 'near-prior'
  return { acuteLoad, chronicWeeklyLoad, ratio, status }
}

function setStimulus(set: WorkoutSet) {
  if (set.warmup || !set.completed) return 0
  if (set.rpe !== null && set.rpe >= 10) return 1
  if (set.rpe === null) return 0.65
  if (set.rpe <= 6) return 0.35
  if (set.rpe <= 7.5) return 0.55
  if (set.rpe <= 8.5) return 0.75
  return 0.9
}

function collectMuscleExposures(workouts: WorkoutSession[], now: number) {
  const exposures: MuscleExposure[] = []
  for (const workout of workouts) {
    if (workout.status === 'cancelled') continue
    const fallback = workout.completedAt ?? workout.startedAt
    const sessionMuscles = new Map<string, { stimulus: number; latest: { iso: string; value: number } | null }>()
    for (const exercise of workout.exercises) {
      for (const contribution of getMuscleContributions(exercise)) {
        const current = sessionMuscles.get(contribution.muscle) ?? { stimulus: 0, latest: null }
        for (const set of exercise.sets) {
          if (set.warmup || !set.completed) continue
          const iso = set.completedAt ?? fallback
          const value = new Date(iso).getTime()
          if (!Number.isFinite(value) || value > now) continue
          current.stimulus += setStimulus(set) * contribution.fraction
          if (!current.latest || value > current.latest.value) current.latest = { iso, value }
        }
        sessionMuscles.set(contribution.muscle, current)
      }
    }
    for (const [muscle, exposure] of sessionMuscles) {
      if (!exposure.latest || exposure.stimulus <= 0) continue
      exposures.push({
        muscle,
        timestamp: exposure.latest.value,
        timestampIso: exposure.latest.iso,
        stimulus: Math.min(1, exposure.stimulus / STIMULUS_SET_TARGET),
        stimulusUnits: exposure.stimulus,
      })
    }
  }
  return exposures
}

function residualFatigue(exposures: MuscleExposure[], recoveryWindowHours: number, timestamp: number) {
  return Math.min(1, exposures.reduce((total, exposure) => {
    const elapsedHours = Math.max(0, (timestamp - exposure.timestamp) / HOUR_MS)
    return total + exposure.stimulus * Math.max(0, 1 - elapsedHours / recoveryWindowHours)
  }, 0))
}

function recoveryStatus(readiness: number): RecoveryStatus {
  if (readiness >= 100) return 'fully-recovered'
  if (readiness >= READY_THRESHOLD) return 'ready'
  if (readiness >= 50) return 'partial'
  return 'recover'
}

function hoursUntilReady(exposures: MuscleExposure[], recoveryWindowHours: number, now: number) {
  if ((1 - residualFatigue(exposures, recoveryWindowHours, now)) * 100 >= READY_THRESHOLD) return 0
  const searchLimit = recoveryWindowHours * 3
  for (let hours = 1; hours <= searchLimit; hours += 1) {
    if ((1 - residualFatigue(exposures, recoveryWindowHours, now + hours * HOUR_MS)) * 100 >= READY_THRESHOLD) return hours
  }
  return searchLimit
}

function getMuscleRecovery(workouts: WorkoutSession[], now: number) {
  const exposures = collectMuscleExposures(workouts, now)
  const byMuscle = new Map<string, MuscleExposure[]>()
  for (const exposure of exposures) {
    const current = byMuscle.get(exposure.muscle) ?? []
    current.push(exposure)
    byMuscle.set(exposure.muscle, current)
  }

  return Array.from(byMuscle.entries())
    .map(([muscle, muscleExposures]): MuscleRecovery => {
      const windowHours = muscleRecoveryHours[muscle] ?? DEFAULT_RECOVERY_HOURS
      const latest = muscleExposures.reduce((current, candidate) => candidate.timestamp > current.timestamp ? candidate : current)
      const readiness = Math.round((1 - residualFatigue(muscleExposures, windowHours, now)) * 100)
      return {
        muscle,
        recoveryWindowHours: windowHours,
        readiness,
        status: recoveryStatus(readiness),
        lastLoadedAt: latest.timestampIso,
        elapsedHours: Math.floor((now - latest.timestamp) / HOUR_MS),
        hoursUntilReady: hoursUntilReady(muscleExposures, windowHours, now),
        lastStimulusPercent: Math.round(latest.stimulus * 100),
        lastStimulusUnits: Math.round(latest.stimulusUnits * 10) / 10,
        exposureCount: muscleExposures.length,
      }
    })
    .sort((a, b) => a.readiness - b.readiness || a.muscle.localeCompare(b.muscle))
}

function getRecoveryConfidence(workouts: WorkoutSession[]): RecoveryConfidence {
  const completed = completedWorkouts(workouts)
  const sets = completed.flatMap((workout) => workout.exercises.flatMap((exercise) => exercise.sets.filter((set) => set.completed && !set.warmup)))
  const rpeCoverage = sets.length > 0 ? sets.filter((set) => set.rpe !== null).length / sets.length : 0

  if (completed.length < 3) {
    return { level: 'low', label: 'Low confidence', reason: 'Complete three sessions to improve this estimate.' }
  }
  if (completed.length >= 6 && rpeCoverage >= 0.75) {
    return { level: 'high', label: 'High confidence', reason: 'Built from consistent session and RPE history.' }
  }
  return {
    level: 'moderate',
    label: 'Moderate confidence',
    reason: rpeCoverage < 0.75 ? 'Log RPE more consistently to improve this estimate.' : 'More session history will improve this estimate.',
  }
}

function recoveryForMuscle(muscle: string, recovery: MuscleRecovery[]): MuscleRecovery {
  return recovery.find((item) => item.muscle === muscle) ?? {
    muscle,
    recoveryWindowHours: muscleRecoveryHours[muscle] ?? DEFAULT_RECOVERY_HOURS,
    readiness: 100,
    status: 'fully-recovered',
    lastLoadedAt: null,
    elapsedHours: null,
    hoursUntilReady: 0,
    lastStimulusPercent: null,
    lastStimulusUnits: null,
    exposureCount: 0,
  }
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function shiftedDate(timestamp: number, days: number) {
  const date = new Date(timestamp)
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return date
}

export function getConsecutiveLoadDays(workouts: WorkoutSession[], now = Date.now()) {
  const workoutDays = new Set(completedWorkouts(workouts).map((workout) => localDateKey(new Date(workout.completedAt ?? workout.startedAt))))
  const today = shiftedDate(now, 0)
  const yesterday = shiftedDate(now, -1)
  let cursor = workoutDays.has(localDateKey(today)) ? today : yesterday
  let count = 0

  while (workoutDays.has(localDateKey(cursor))) {
    count += 1
    cursor = shiftedDate(cursor.getTime(), -1)
  }
  return count
}

export function getRecommendedRoutine(routines: RoutineTemplate[], recovery: MuscleRecovery[]): RoutineRecommendation | null {
  const candidates = routines
    .filter((routine) => !routine.deletedAt && routine.exercises.length > 0)
    .map((routine) => {
      const muscles = Array.from(new Set(routine.exercises.flatMap((exercise) => getMuscleContributions(exercise).map((contribution) => contribution.muscle))))
      const muscleRecovery = muscles.map((muscle) => recoveryForMuscle(muscle, recovery))
      const readiness = muscleRecovery.length > 0
        ? Math.round(muscleRecovery.reduce((total, item) => total + item.readiness, 0) / muscleRecovery.length)
        : 100
      const limiting = muscleRecovery.reduce<MuscleRecovery | null>(
        (lowest, candidate) => !lowest || candidate.readiness < lowest.readiness ? candidate : lowest,
        null,
      )
      return { routine, readiness, limitingMuscle: limiting?.muscle ?? null }
    })
    .sort((a, b) => b.readiness - a.readiness || a.routine.name.localeCompare(b.routine.name))
  return candidates[0] ?? null
}

export function getTrainingReadiness(movements: PlannedMovement[], workouts: WorkoutSession[], now = Date.now()): TrainingReadiness {
  const targetMuscles = Array.from(new Set(movements.flatMap((movement) => getMuscleContributions(movement).map((contribution) => contribution.muscle))))
  const loadWorkouts = workouts.filter((workout) => workout.status !== 'cancelled')
  const recovery = getMuscleRecovery(loadWorkouts, now)
  const targetRecovery = targetMuscles.map((muscle) => recoveryForMuscle(muscle, recovery))
  const targetReadiness = targetRecovery.length > 0
    ? Math.round(targetRecovery.reduce((total, item) => total + item.readiness, 0) / targetRecovery.length)
    : 100
  const consecutiveLoadDays = getConsecutiveLoadDays(workouts, now)

  return {
    targetMuscles,
    workload: getTargetedWorkload(loadWorkouts, targetMuscles, now),
    recovery,
    targetRecovery,
    targetReadiness,
    recoveryConfidence: getRecoveryConfidence(workouts),
    consecutiveLoadDays,
    systemicFatigueWarning: consecutiveLoadDays >= 3,
  }
}
