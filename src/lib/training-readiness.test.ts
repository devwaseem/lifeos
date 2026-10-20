import { describe, expect, it } from 'vitest'
import { getMuscleContributions } from './muscle-contributions'
import { getRecommendedRoutine, getTrainingReadiness, type MuscleRecovery } from './training-readiness'
import type { RoutineExercise, RoutineTemplate, WorkoutExercise, WorkoutSession, WorkoutSet } from './types'

function routineExercise(overrides: Partial<RoutineExercise>): RoutineExercise {
  return {
    id: 'routine-exercise',
    exerciseId: 'exercise',
    name: 'Exercise',
    muscle: 'Other',
    equipment: 'Bodyweight',
    notes: '',
    secondaryMuscles: [],
    restSeconds: 120,
    setCount: 1,
    hasWarmupSet: false,
    progression: { minReps: 8, maxReps: 12, weightIncrement: null, maxRpe: 10 },
    ...overrides,
  }
}

function routine(exercises: RoutineExercise[]): RoutineTemplate {
  return {
    id: 'routine',
    name: 'Routine',
    createdAt: '2026-10-19T08:00:00.000Z',
    updatedAt: '2026-10-19T08:00:00.000Z',
    deletedAt: null,
    exercises,
  }
}

function recovery(muscle: string, readiness: number): MuscleRecovery {
  return {
    muscle,
    recoveryWindowHours: 48,
    readiness,
    status: readiness >= 80 ? 'ready' : 'recover',
    lastLoadedAt: null,
    elapsedHours: null,
    hoursUntilReady: 0,
    lastStimulusPercent: null,
    lastStimulusUnits: null,
    exposureCount: 0,
  }
}

describe('anatomical muscle readiness', () => {
  it('does not treat exercise categories as muscles', () => {
    expect(getMuscleContributions({ muscle: 'Cardio', secondaryMuscles: [] })).toEqual([])
    expect(getMuscleContributions({ muscle: 'Other', secondaryMuscles: [] })).toEqual([])
    expect(getMuscleContributions({
      muscle: 'Full body',
      secondaryMuscles: [{ muscle: 'Forearms', fraction: 0.75 }, { muscle: 'Core', fraction: 0.5 }],
    })).toEqual([{ muscle: 'Forearms', fraction: 0.75 }, { muscle: 'Core', fraction: 0.5 }])
  })

  it('ignores cardio when choosing a routine limiting muscle', () => {
    const recommendation = getRecommendedRoutine([
      routine([
        routineExercise({ exerciseId: 'machine-treadmill-walk', name: 'Treadmill Walk', muscle: 'Cardio' }),
        routineExercise({ exerciseId: 'dumbbell-bench-press', name: 'Dumbbell Bench Press', muscle: 'Chest' }),
      ]),
    ], [recovery('Cardio', 10), recovery('Chest', 80)])

    expect(recommendation?.readiness).toBe(80)
    expect(recommendation?.limitingMuscle).toBe('Chest')
  })

  it('keeps category-only routines valid without inventing a limiting muscle', () => {
    const recommendation = getRecommendedRoutine([
      routine([routineExercise({ exerciseId: 'machine-treadmill-walk', name: 'Treadmill Walk', muscle: 'Cardio' })]),
    ], [])

    expect(recommendation?.readiness).toBe(100)
    expect(recommendation?.limitingMuscle).toBeNull()
  })
})

function completedSet(id: string): WorkoutSet {
  return {
    id,
    weight: 100,
    reps: 10,
    rpe: 10,
    durationSeconds: null,
    distanceMeters: null,
    completed: true,
    completedAt: '2026-10-19T09:00:00.000Z',
    warmup: false,
    notes: '',
  }
}

function workoutExercise(id: string, muscle: string, setCount: number): WorkoutExercise {
  return {
    id,
    exerciseId: id,
    name: id,
    muscle,
    equipment: 'Machine',
    secondaryMuscles: [],
    notes: '',
    restSeconds: 120,
    restUntil: null,
    progression: { minReps: 8, maxReps: 12, weightIncrement: 2.5, maxRpe: 10 },
    sets: Array.from({ length: setCount }, (_, index) => completedSet(`${id}-${index}`)),
  }
}

describe('muscle readiness explanation', () => {
  it('exposes the latest modeled set stimulus behind each readiness estimate', () => {
    const workout: WorkoutSession = {
      id: 'leg-workout',
      title: 'Leg',
      routineId: null,
      cycleSlotId: null,
      status: 'completed',
      startedAt: '2026-10-19T08:00:00.000Z',
      completedAt: '2026-10-19T10:00:00.000Z',
      updatedAt: '2026-10-19T10:00:00.000Z',
      notes: '',
      sessionRpe: null,
      exercises: [
        workoutExercise('quadriceps', 'Quadriceps', 5),
        workoutExercise('calves', 'Calves', 2),
      ],
    }

    const recovery = getTrainingReadiness([], [workout], Date.parse('2026-10-20T06:00:00.000Z')).recovery
    const quadriceps = recovery.find((item) => item.muscle === 'Quadriceps')
    const calves = recovery.find((item) => item.muscle === 'Calves')

    expect(quadriceps).toMatchObject({ lastStimulusUnits: 5, recoveryWindowHours: 72 })
    expect(calves).toMatchObject({ lastStimulusUnits: 2, recoveryWindowHours: 48 })
    expect(quadriceps!.readiness).toBeLessThan(calves!.readiness)
  })
})
