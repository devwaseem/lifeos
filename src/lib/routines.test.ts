import { describe, expect, it } from 'vitest'
import { createWorkoutFromRoutine, routineFromWorkout } from './routines'
import type { EquipmentSettings, RoutineTemplate, WorkoutCheckIn, WorkoutSession, WorkoutSet } from './types'

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

const checkIn: WorkoutCheckIn = {
  recordedAt: '2026-10-20T08:00:00.000Z',
  sleepQuality: 4,
  energy: 3,
  soreness: 2,
  stress: 3,
  motivation: 4,
  painPresent: false,
  illnessPresent: false,
  notes: 'Ready to train',
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
    progression: { minReps: 6, maxReps: 10, weightIncrement: 2.5, weightOptions: [] },
  }],
}

const equipmentSettings: EquipmentSettings = {
  id: 'primary-equipment-settings',
  weightOptionsByEquipment: {
    Barbell: [20, 40, 47.5, 55],
  },
  updatedAt: '2026-10-20T07:00:00.000Z',
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
  checkIn: null,
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
    const workout = createWorkoutFromRoutine(routine, checkIn, '2026-10-20T08:00:00.000Z', null, [previousWorkout])

    expect(workout.checkIn).toEqual(checkIn)
    expect(workout.exercises[0].sets.map((set) => set.warmup)).toEqual([true, false, false, false])
  })

  it('prefills each set from the matching previous-workout set and repeats the last known set when needed', () => {
    const workout = createWorkoutFromRoutine(routine, checkIn, '2026-10-20T08:00:00.000Z', null, [previousWorkout])

    expect(workout.exercises[0].sets.map(({ weight, reps, rpe }) => ({ weight, reps, rpe }))).toEqual([
      { weight: 20, reps: 10, rpe: null },
      { weight: 80, reps: 8, rpe: 8 },
      { weight: 80, reps: 7, rpe: 8 },
      { weight: 80, reps: 7, rpe: 8 },
    ])
  })

  it('snapshots the equipment rack into the workout without storing it on the routine', () => {
    const workout = createWorkoutFromRoutine(
      routine,
      checkIn,
      '2026-10-20T08:00:00.000Z',
      null,
      [previousWorkout],
      equipmentSettings,
    )

    expect(routine.exercises[0].progression.weightOptions).toEqual([])
    expect(workout.exercises[0].progression.weightOptions).toEqual([20, 40, 47.5, 55])
  })

  it('saves a modified session as a separate template that seeds its next workout', () => {
    const started = createWorkoutFromRoutine(routine, checkIn, '2026-10-20T08:00:00.000Z', null, [previousWorkout])
    const modified = {
      ...started,
      exercises: started.exercises.map((exercise) => ({
        ...exercise,
        notes: 'Pause at the chest',
        restSeconds: 90,
        sets: [...exercise.sets, completedSet('working-4', 80, 6)],
      })),
    }

    const saved = routineFromWorkout(modified, 'Paused Push', undefined, '2026-10-20T09:00:00.000Z')
    const nextWorkout = createWorkoutFromRoutine(saved, checkIn, '2026-10-21T08:00:00.000Z')

    expect(routine).toMatchObject({ name: 'Push', exercises: [{ notes: '', restSeconds: 120, setCount: 3 }] })
    expect(saved).toMatchObject({ name: 'Paused Push', exercises: [{ notes: 'Pause at the chest', restSeconds: 90, setCount: 4 }] })
    expect(nextWorkout.exercises[0]).toMatchObject({ notes: 'Pause at the chest', restSeconds: 90 })
    expect(nextWorkout.exercises[0].sets).toHaveLength(5)
  })
})
