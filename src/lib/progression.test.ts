import { describe, expect, it } from 'vitest'
import { buildSetProgressionTargets, defaultProgressionRule, supportsProgression } from './progression'
import { DEFAULT_REST_SECONDS } from './workouts'
import type { WorkoutSession } from './types'

describe('exercise progression eligibility', () => {
  it.each([
    { name: 'Treadmill', muscle: 'Cardio' },
    { name: 'Rowing Ergometer', muscle: 'Cardio' },
    { name: 'Warm Up', muscle: 'Full body' },
    { name: 'Dynamic Warm-Up', muscle: 'Full body' },
    { name: 'Stretching', muscle: 'Other' },
  ])('disables progression for $name', (exercise) => {
    expect(supportsProgression(exercise)).toBe(false)
  })

  it('keeps progression for resistance exercises', () => {
    expect(supportsProgression({ name: 'Bench Press', muscle: 'Chest' })).toBe(true)
  })

  it('defaults progressive exercises to max RPE 10 and two-minute rest', () => {
    expect(defaultProgressionRule('Barbell').maxRpe).toBe(10)
    expect(DEFAULT_REST_SECONDS).toBe(120)
  })

  it('does not create progression targets for cardio sets', () => {
    const workout: WorkoutSession = {
      id: 'workout',
      title: 'Cardio',
      routineId: null,
      cycleSlotId: null,
      status: 'active',
      startedAt: '2026-10-20T00:00:00.000Z',
      completedAt: null,
      updatedAt: '2026-10-20T00:00:00.000Z',
      notes: '',
      sessionRpe: null,
      exercises: [{
        id: 'workout-exercise',
        exerciseId: 'treadmill',
        name: 'Treadmill',
        muscle: 'Cardio',
        equipment: 'Machine',
        secondaryMuscles: [],
        notes: '',
        restSeconds: 120,
        restUntil: null,
        progression: defaultProgressionRule('Machine'),
        sets: [{
          id: 'set',
          weight: null,
          reps: null,
          rpe: null,
          durationSeconds: null,
          distanceMeters: null,
          completed: false,
          completedAt: null,
          failure: false,
          notes: '',
        }],
      }],
    }

    expect(buildSetProgressionTargets(workout, []).size).toBe(0)
  })
})
