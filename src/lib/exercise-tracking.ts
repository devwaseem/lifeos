import type { ExerciseDefinition } from '$lib/types'

export type ExerciseTrackingMode = 'strength' | 'duration' | 'distance-duration'

type TrackableExercise = Pick<ExerciseDefinition, 'name' | 'muscle'>

const distanceFormatter = new Intl.NumberFormat('en', { maximumFractionDigits: 2 })

export function getExerciseTrackingMode(exercise: TrackableExercise): ExerciseTrackingMode {
  const name = exercise.name.trim().toLowerCase()
  const isCardio = exercise.muscle.trim().toLowerCase() === 'cardio'
    || name.includes('treadmill')
    || name.includes('elliptical')
    || name.includes('spinning')

  if (isCardio) return 'distance-duration'
  if (/\bwarm[\s-]*up\b/.test(name) || name.includes('stretch') || name.includes('dead hang')) return 'duration'
  return 'strength'
}

export function parseSetDurationSeconds(note: string) {
  const match = note.match(/(?:^|·)\s*Duration:\s*(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s)?/i)
  if (!match) return null
  const hours = Number(match[1] ?? 0)
  const minutes = Number(match[2] ?? 0)
  const seconds = Number(match[3] ?? 0)
  const total = (hours * 60 * 60) + (minutes * 60) + seconds
  return total > 0 ? total : null
}

export function parseSetDistanceMeters(note: string) {
  const match = note.match(/(?:^|·)\s*Distance:\s*(\d+(?:\.\d+)?)\s*(km|m)\b/i)
  if (!match) return null
  const distance = Number(match[1])
  if (!Number.isFinite(distance) || distance < 0) return null
  return match[2].toLowerCase() === 'km' ? distance * 1_000 : distance
}

export function formatSetDuration(totalSeconds: number | null) {
  if (totalSeconds === null || !Number.isFinite(totalSeconds) || totalSeconds < 0) return '—'
  const rounded = Math.round(totalSeconds)
  const hours = Math.floor(rounded / 3_600)
  const minutes = Math.floor((rounded % 3_600) / 60)
  const seconds = rounded % 60
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function formatSetDistance(meters: number | null) {
  if (meters === null || !Number.isFinite(meters) || meters < 0) return '—'
  if (meters >= 1_000) return `${distanceFormatter.format(meters / 1_000)} km`
  return `${distanceFormatter.format(meters)} m`
}

export function getSupplementalSetNote(note: string, mode: ExerciseTrackingMode) {
  if (mode === 'strength') return note.trim()
  return note
    .split('·')
    .map((part) => part.trim())
    .filter((part) => part && !/^Duration:/i.test(part) && !/^Distance:/i.test(part))
    .join(' · ')
}
