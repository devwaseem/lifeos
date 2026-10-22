import type { WorkoutSession } from '$lib/types'

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

export function formatDuration(startedAt: string, completedAt: string | null, now = Date.now()) {
  const end = completedAt ? new Date(completedAt).getTime() : now
  const minutes = Math.max(0, Math.floor((end - new Date(startedAt).getTime()) / 60_000))
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return hours > 0 ? `${hours}h ${remainder}m` : `${remainder}m`
}

export function formatElapsed(startedAt: string, now = Date.now()) {
  const totalSeconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1_000))
  const hours = Math.floor(totalSeconds / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60
  const clock = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return hours > 0 ? `${hours}:${clock}` : clock
}

export function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function getWorkoutVolume(workout: WorkoutSession) {
  return workout.exercises.reduce(
    (total, exercise) => total + exercise.sets.reduce((sum, set) => {
      if (set.warmup || !set.completed || set.weight === null || set.reps === null) return sum
      return sum + set.weight * set.reps
    }, 0),
    0,
  )
}

export function getLiveWorkoutVolume(workout: WorkoutSession) {
  return getWorkoutVolume(workout)
}
export interface WorkoutVolumeComparison {
  currentVolume: number
  previousVolume: number | null
  delta: number | null
  percentChange: number | null
  direction: 'up' | 'down' | 'same' | 'baseline'
}

function hasComparablePlan(current: WorkoutSession, candidate: WorkoutSession) {
  if (current.routineId) return candidate.routineId === current.routineId
  if (candidate.routineId || candidate.exercises.length !== current.exercises.length) return false
  return current.exercises.every((exercise, index) => candidate.exercises[index]?.exerciseId === exercise.exerciseId)
}

export function getWorkoutVolumeComparison(current: WorkoutSession, workouts: WorkoutSession[]): WorkoutVolumeComparison {
  const currentTime = new Date(current.completedAt ?? current.startedAt).getTime()
  let previous: WorkoutSession | null = null
  let previousTime = Number.NEGATIVE_INFINITY

  for (const candidate of workouts) {
    if (candidate.id === current.id || candidate.status !== 'completed' || !hasComparablePlan(current, candidate)) continue
    const candidateTime = new Date(candidate.completedAt ?? candidate.startedAt).getTime()
    if (!Number.isFinite(candidateTime) || candidateTime >= currentTime || candidateTime <= previousTime) continue
    previous = candidate
    previousTime = candidateTime
  }

  const currentVolume = getWorkoutVolume(current)
  if (!previous) {
    return { currentVolume, previousVolume: null, delta: null, percentChange: null, direction: 'baseline' }
  }

  const previousVolume = getWorkoutVolume(previous)
  const delta = currentVolume - previousVolume
  return {
    currentVolume,
    previousVolume,
    delta,
    percentChange: previousVolume > 0 ? Math.round((delta / previousVolume) * 1_000) / 10 : null,
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'same',
  }
}

export function getWorkoutSetCount(workout: WorkoutSession) {
  return workout.exercises.reduce((total, exercise) => total + exercise.sets.filter((set) => !set.warmup).length, 0)
}

export function getCompletedSetCount(workout: WorkoutSession) {
  return workout.exercises.reduce(
    (total, exercise) => total + exercise.sets.filter((set) => set.completed && !set.warmup).length,
    0,
  )
}

export function formatVolume(value: number) {
  return new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(value)
}

export function newId() {
  return crypto.randomUUID()
}
