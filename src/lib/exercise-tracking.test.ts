import { describe, expect, it } from 'vitest'
import {
  formatSetDistance,
  formatSetDuration,
  getExerciseTrackingMode,
  getSupplementalSetNote,
  parseSetDistanceMeters,
  parseSetDurationSeconds,
} from './exercise-tracking'

describe('exercise tracking modes', () => {
  it.each([
    [{ name: 'Treadmill', muscle: 'Cardio' }, 'distance-duration'],
    [{ name: 'Spinning', muscle: 'Cardio' }, 'distance-duration'],
    [{ name: 'Warm Up', muscle: 'Full body' }, 'duration'],
    [{ name: 'Stretching', muscle: 'Other' }, 'duration'],
    [{ name: 'Dead Hang', muscle: 'Back' }, 'duration'],
    [{ name: 'Bench Press', muscle: 'Chest' }, 'strength'],
  ] as const)('classifies $0.name as $1', (exercise, expected) => {
    expect(getExerciseTrackingMode(exercise)).toBe(expected)
  })
})

describe('legacy timed set metrics', () => {
  it('parses minute, second, and distance values from imported notes', () => {
    const note = 'Set type: warm-up · Distance: 1300 m · Duration: 5m 15s'
    expect(parseSetDurationSeconds(note)).toBe(315)
    expect(parseSetDistanceMeters(note)).toBe(1300)
  })

  it('formats time and distance for workout review', () => {
    expect(formatSetDuration(315)).toBe('5:15')
    expect(formatSetDistance(1300)).toBe('1.3 km')
    expect(formatSetDistance(600)).toBe('600 m')
  })

  it('removes duplicated imported metrics from timed set notes', () => {
    expect(getSupplementalSetNote(
      'Set type: warm-up · Distance: 1300 m · Duration: 5m 15s',
      'distance-duration',
    )).toBe('Set type: warm-up')
  })
})
