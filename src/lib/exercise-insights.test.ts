import { describe, expect, it } from 'vitest'
import { getExerciseHistory } from './exercise-insights'
import type { WorkoutSession } from './types'

function completedTimedWorkout(): WorkoutSession {
  return {
    id: 'workout',
    title: 'Cardio',
    routineId: null,
    cycleSlotId: null,
    status: 'completed',
    startedAt: '2026-10-19T08:00:00.000Z',
    completedAt: '2026-10-19T08:30:00.000Z',
    updatedAt: '2026-10-19T08:30:00.000Z',
    notes: '',
    sessionRpe: null,
    exercises: [{
      id: 'workout-exercise',
      exerciseId: 'machine-treadmill-walk',
      name: 'Treadmill Walk',
      muscle: 'Cardio',
      equipment: 'Machine',
      secondaryMuscles: [],
      notes: '',
      restSeconds: 120,
      restUntil: null,
      progression: { minReps: 8, maxReps: 12, weightIncrement: 2.5, maxRpe: 10 },
      sets: [{
        id: 'set',
        weight: null,
        reps: null,
        rpe: null,
        durationSeconds: 1_800,
        distanceMeters: 2_000,
        completed: true,
        completedAt: '2026-10-19T08:30:00.000Z',
        failure: false,
        notes: '',
      }],
    }],
  }
}

describe('getExerciseHistory', () => {
  it('retains completed time-based sets without repetition values', () => {
    const history = getExerciseHistory([completedTimedWorkout()], 'machine-treadmill-walk')

    expect(history).toHaveLength(1)
    expect(history[0].sets).toHaveLength(1)
    expect(history[0].sets[0].durationSeconds).toBe(1_800)
  })
})
