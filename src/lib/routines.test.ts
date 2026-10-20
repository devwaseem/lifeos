import { describe, expect, it } from 'vitest'
import { createWorkoutFromRoutine } from './routines'
import type { RoutineTemplate, WorkoutSession, WorkoutSet } from './types'

function completedSet(id: string, weight: number, reps: number, warmup = false): WorkoutSet {
  return {
    id,
    weight,
    reps,
    rpe: warmup ? null : 8,
    durationSeconds: null,
    distanceMeters: null,
    completed: true,
    completedAt: '2026-10-19T08:30:00.000Z',
    warmup,
    notes: '',
  }
}

const routine: RoutineTemplate = {
  id: 'routine',
  name: 'Push',
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-19T09:00:00.000Z',
  deletedAt: null,
  exercises: [{
    id: 'routine-bench',
    exerciseId: 'bench',
    name: 'Bench Press',
    muscle: 'Chest',
    equipment: 'Barbell',
    secondaryMuscles: [],
    notes: '',
    restSeconds: 120,
    setCount: 3,
    hasWarmupSet: true,
    progression: { minReps: 6, maxReps: 10, weightIncrement: 2.5, maxRpe: 9 },
  }],
}

const previousWorkout: WorkoutSession = {
  id: 'previous',
  title: 'Push',
  routineId: 'routine',
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
    progression: routine.exercises[0].progression,
    sets: [
      completedSet('warmup', 20, 10, true),
      completedSet('working-1', 80, 8),
      completedSet('working-2', 80, 7),
    ],
  }],
}

describe('routine workout set planning', () => {
  it('adds one optional warmup and keeps the configured count as working sets', () => {
    const workout = createWorkoutFromRoutine(routine, '2026-10-20T08:00:00.000Z', null, [previousWorkout])

    expect(workout.exercises[0].sets.map((set) => set.warmup)).toEqual([true, false, false, false])
  })

  it('prefills each set from the matching previous-workout set and repeats the last known set when needed', () => {
    const workout = createWorkoutFromRoutine(routine, '2026-10-20T08:00:00.000Z', null, [previousWorkout])

    expect(workout.exercises[0].sets.map(({ weight, reps, rpe }) => ({ weight, reps, rpe }))).toEqual([
      { weight: 20, reps: 10, rpe: null },
      { weight: 80, reps: 8, rpe: 8 },
      { weight: 80, reps: 7, rpe: 8 },
      { weight: 80, reps: 7, rpe: 8 },
    ])
  })
})
