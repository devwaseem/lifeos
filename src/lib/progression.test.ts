import { describe, expect, it } from 'vitest'
import { buildSetProgressionTargets, defaultProgressionRule, getSetProgressionOutcome, supportsProgression, type SetProgressionTarget } from './progression'
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
          warmup: false,
          notes: '',
        }],
      }],
    }

    expect(buildSetProgressionTargets(workout, []).size).toBe(0)
  })
})

describe('historical progression targets', () => {
  it('matches working sets across a warmup and does not replace previous values with live-set data', () => {
    const historicalSet = (id: string, reps: number, warmup = false) => ({
      id,
      weight: warmup ? 20 : 80,
      reps,
      rpe: warmup ? null : 8,
      durationSeconds: null,
      distanceMeters: null,
      completed: true,
      completedAt: '2026-10-19T08:30:00.000Z',
      warmup,
      notes: '',
    })
    const previous: WorkoutSession = {
      id: 'previous',
      title: 'Push',
      routineId: null,
      cycleSlotId: null,
      status: 'completed',
      startedAt: '2026-10-19T08:00:00.000Z',
      completedAt: '2026-10-19T09:00:00.000Z',
      updatedAt: '2026-10-19T09:00:00.000Z',
      notes: '',
      sessionRpe: 8,
      exercises: [{
        id: 'previous-bench',
        exerciseId: 'bench',
        name: 'Bench Press',
        muscle: 'Chest',
        equipment: 'Barbell',
        secondaryMuscles: [],
        notes: '',
        restSeconds: 120,
        restUntil: null,
        progression: { minReps: 6, maxReps: 10, weightIncrement: 2.5, maxRpe: 9 },
        sets: [historicalSet('previous-warmup', 10, true), historicalSet('previous-1', 8), historicalSet('previous-2', 7)],
      }],
    }
    const current: WorkoutSession = {
      ...previous,
      id: 'current',
      status: 'active',
      startedAt: '2026-10-20T08:00:00.000Z',
      completedAt: null,
      updatedAt: '2026-10-20T08:00:00.000Z',
      exercises: [{
        ...previous.exercises[0],
        id: 'current-bench',
        sets: [
          { ...historicalSet('current-warmup', 10, true), completed: false, completedAt: null },
          { ...historicalSet('current-1', 12), weight: 85, rpe: 6 },
          { ...historicalSet('current-2', 7), completed: false, completedAt: null, rpe: null },
        ],
      }],
    }

    const targets = buildSetProgressionTargets(current, [current, previous])

    expect(targets.has('current-warmup')).toBe(false)
    expect(targets.get('current-2')).toMatchObject({
      previousWeight: 80,
      previousReps: 7,
    })
  })
})

describe('completed set progression outcomes', () => {
  const target: SetProgressionTarget = {
    setId: 'set',
    setIndex: 0,
    previousWeight: 80,
    previousReps: 8,
    previousRpe: 8,
    targetWeight: 80,
    targetReps: 9,
    action: 'add-rep',
    rule: { minReps: 6, maxReps: 10, weightIncrement: 2.5, maxRpe: 9 },
  }

  const completedSet = {
    id: 'set',
    weight: 80,
    reps: 8,
    rpe: 8,
    durationSeconds: null,
    distanceMeters: null,
    completed: true,
    completedAt: '2026-10-20T08:30:00.000Z',
    warmup: false,
    notes: '',
  } as const

  it.each([
    [{ ...completedSet, reps: 9 }, 'progressed'],
    [{ ...completedSet, rpe: 7.5 }, 'progressed'],
    [completedSet, 'maintained'],
    [{ ...completedSet, reps: 7 }, 'below-previous'],
    [{ ...completedSet, rpe: 9 }, 'below-previous'],
  ] as const)('classifies a comparable result as %s', (set, expected) => {
    expect(getSetProgressionOutcome(set, target)).toBe(expected)
  })

  it('reports a baseline without a comparable historical set', () => {
    expect(getSetProgressionOutcome(completedSet, { ...target, previousWeight: null, previousReps: null, previousRpe: null })).toBe('baseline')
  })

  it('does not classify incomplete sets', () => {
    expect(getSetProgressionOutcome({ ...completedSet, completed: false }, target)).toBeNull()
  })
})
