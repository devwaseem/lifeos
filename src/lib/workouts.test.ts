import { describe, expect, it } from 'vitest'
import type { WorkoutSession } from './types'
import { getCompletedSetCount, getLiveWorkoutVolume, getWorkoutSetCount, getWorkoutVolumeComparison } from './utils'
import { normalizeWorkout } from './workouts'

function workoutWithSets(sets: unknown[]): WorkoutSession {
  return {
    id: 'workout',
    title: 'Workout',
    routineId: null,
    cycleSlotId: null,
    status: 'active',
    startedAt: '2026-10-20T08:00:00.000Z',
    completedAt: null,
    updatedAt: '2026-10-20T08:00:00.000Z',
    notes: '',
    sessionRpe: 7.5,
    checkIn: null,
    exercises: [{
      id: 'exercise',
      exerciseId: 'bench',
      name: 'Bench Press',
      muscle: 'Chest',
      equipment: 'Barbell',
      secondaryMuscles: [],
      notes: '',
      restSeconds: 120,
      restUntil: null,
      progression: { minReps: 6, maxReps: 10, weightIncrement: 2.5, weightOptions: [] },
      sets,
    }],
  } as WorkoutSession
}

describe('workout set normalization', () => {
  it('accepts only the prescribed RPE scale and clears RPE from warmups', () => {
    const workout = normalizeWorkout(workoutWithSets([
      { id: 'warmup', weight: 20, reps: 10, rpe: 8, completed: false, completedAt: null, warmup: true, notes: '' },
      { id: 'half-step', weight: 80, reps: 8, rpe: 8.5, completed: false, completedAt: null, warmup: false, notes: '' },
      { id: 'invalid', weight: 80, reps: 8, rpe: 5, completed: false, completedAt: null, warmup: false, notes: '' },
    ]))

    expect(workout.exercises[0].sets.map((set) => set.rpe)).toEqual([null, 8.5, null])
  })

  it('migrates a legacy failure flag to RPE 10 without retaining the flag', () => {
    const workout = normalizeWorkout(workoutWithSets([
      { id: 'legacy', weight: 80, reps: 8, rpe: 9, completed: true, completedAt: null, failure: true, notes: '' },
    ]))
    const set = workout.exercises[0].sets[0]

    expect(set.rpe).toBe(10)
    expect(set).not.toHaveProperty('failure')
  })
})

describe('working-set totals', () => {
  it('excludes warmups from set counts and workout volume', () => {
    const workout = normalizeWorkout(workoutWithSets([
      { id: 'warmup', weight: 20, reps: 10, rpe: null, completed: true, completedAt: null, warmup: true, notes: '' },
      { id: 'working', weight: 80, reps: 8, rpe: 8, completed: true, completedAt: null, warmup: false, notes: '' },
      { id: 'prefilled', weight: 80, reps: 8, rpe: null, completed: false, completedAt: null, warmup: false, notes: '' },
    ]))

    expect(getWorkoutSetCount(workout)).toBe(2)
    expect(getCompletedSetCount(workout)).toBe(1)
    expect(getLiveWorkoutVolume(workout)).toBe(640)
  })

  it('compares completed volume with the latest completed session for the same routine', () => {
    const completedSet = (id: string, weight: number) => ({
      id,
      weight,
      reps: 8,
      rpe: 8,
      completed: true,
      completedAt: null,
      warmup: false,
      notes: '',
    })
    const previous = workoutWithSets([completedSet('previous-set', 70)])
    previous.id = 'previous'
    previous.routineId = 'push'
    previous.status = 'completed'
    previous.startedAt = '2026-10-19T08:00:00.000Z'
    previous.completedAt = '2026-10-19T09:00:00.000Z'
    const current = workoutWithSets([completedSet('current-set', 80)])
    current.id = 'current'
    current.routineId = 'push'
    current.status = 'completed'
    current.completedAt = '2026-10-20T09:00:00.000Z'

    expect(getWorkoutVolumeComparison(current, [current, previous])).toEqual({
      currentVolume: 640,
      previousVolume: 560,
      delta: 80,
      percentChange: 14.3,
      direction: 'up',
    })
  })
})
