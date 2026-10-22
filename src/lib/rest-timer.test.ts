import { describe, expect, it } from 'vitest'
import type { WorkoutExercise, WorkoutSession } from './types'
import { getActiveRestTimer } from './rest-timer'

const now = new Date('2026-10-23T10:00:00.000Z').getTime()

function exercise(id: string, name: string, completed: boolean[]): WorkoutExercise {
  return {
    id,
    exerciseId: id,
    name,
    muscle: 'Back',
    secondaryMuscles: [],
    equipment: 'Cable',
    notes: '',
    restSeconds: 120,
    restUntil: id === 'pulldown' ? '2026-10-23T10:02:00.000Z' : null,
    progression: { minReps: 8, maxReps: 12, weightIncrement: 2.5, weightOptions: [] },
    sets: completed.map((isCompleted, index) => ({
      id: `${id}-${index}`,
      weight: 40,
      reps: 10,
      rpe: 8,
      durationSeconds: null,
      distanceMeters: null,
      completed: isCompleted,
      completedAt: isCompleted ? `2026-10-23T10:00:0${index}.000Z` : null,
      warmup: false,
      notes: '',
    })),
  }
}

function workout(exercises: WorkoutExercise[]): WorkoutSession {
  return {
    id: 'active-workout',
    title: 'Pull B',
    routineId: 'pull-b',
    cycleSlotId: 'pull-b-slot',
    status: 'active',
    startedAt: '2026-10-23T09:30:00.000Z',
    completedAt: null,
    updatedAt: '2026-10-23T10:00:00.000Z',
    notes: '',
    sessionRpe: null,
    checkIn: null,
    exercises,
  }
}

describe('active rest timer next target', () => {
  it('names the next pending set in the current exercise', () => {
    const timer = getActiveRestTimer(workout([
      exercise('pulldown', 'Cable Lat Pulldown', [true, false]),
      exercise('row', 'Seated Cable Row', [false, false]),
    ]), now)

    expect(timer).toMatchObject({
      sourceExerciseId: 'pulldown',
      nextLabel: 'Next · Cable Lat Pulldown · Set 2',
    })
  })

  it('names the first pending set in the next exercise after the last current set', () => {
    const timer = getActiveRestTimer(workout([
      exercise('pulldown', 'Cable Lat Pulldown', [true, true]),
      exercise('row', 'Seated Cable Row', [false, false]),
    ]), now)

    expect(timer?.nextLabel).toBe('Next · Seated Cable Row · Set 1')
  })

  it('points to finishing the workout when every set is complete', () => {
    const timer = getActiveRestTimer(workout([
      exercise('pulldown', 'Cable Lat Pulldown', [true, true]),
      exercise('row', 'Seated Cable Row', [true, true]),
    ]), now)

    expect(timer?.nextLabel).toBe('Finish workout')
  })
})
