import { describe, expect, it } from 'vitest'
import {
  advanceTrainingCycleForWorkout,
  createTrainingCycle,
  getCycleRoutine,
  getTrainingCycleState,
  normalizeTrainingCycle,
} from './training-cycle'
import type { RoutineTemplate, TrainingCycle, WorkoutSession } from './types'

const routines: RoutineTemplate[] = ['push-a', 'pull-a', 'legs-a', 'push-b'].map((id) => ({
  id,
  name: id.replace('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-01T08:00:00.000Z',
  deletedAt: null,
  exercises: [],
}))

function completedCycleWorkout(slotId: string, routineId: string, completedAt: string): WorkoutSession {
  return {
    id: `workout-${completedAt}`,
    title: routineId,
    routineId,
    cycleSlotId: slotId,
    status: 'completed',
    startedAt: completedAt,
    completedAt,
    updatedAt: completedAt,
    notes: '',
    sessionRpe: 8,
    checkIn: null,
    exercises: [],
  }
}

function cycle(): TrainingCycle {
  return {
    ...createTrainingCycle('2026-10-01T08:00:00.000Z'),
    name: 'Push pull legs',
    trainingDaysBeforeRest: 3,
    slots: routines.map((routine, index) => ({ id: `slot-${index}`, routineId: routine.id })),
  }
}

describe('FIFO training cycle cadence', () => {
  it('keeps the next routine queued when an unscheduled rest day breaks the training streak', () => {
    let trainingCycle = cycle()
    const push = completedCycleWorkout('slot-0', 'push-a', '2026-10-19T09:00:00.000Z')
    trainingCycle = advanceTrainingCycleForWorkout(trainingCycle, push, '2026-10-19T09:00:00.000Z')

    const state = getTrainingCycleState(trainingCycle, [push], new Date('2026-10-21T08:00:00.000Z').getTime())

    expect(state).toMatchObject({ consecutiveTrainingDays: 0, restDue: false })
    expect(getCycleRoutine(trainingCycle, routines)?.id).toBe('pull-a')
  })

  it('infers rest after three consecutive training days without consuming the next routine', () => {
    let trainingCycle = cycle()
    const workouts = [
      completedCycleWorkout('slot-0', 'push-a', '2026-10-21T09:00:00.000Z'),
      completedCycleWorkout('slot-1', 'pull-a', '2026-10-22T09:00:00.000Z'),
      completedCycleWorkout('slot-2', 'legs-a', '2026-10-23T09:00:00.000Z'),
    ]
    for (const workout of workouts) trainingCycle = advanceTrainingCycleForWorkout(trainingCycle, workout, workout.completedAt!)

    const saturday = getTrainingCycleState(trainingCycle, workouts, new Date('2026-10-24T08:00:00.000Z').getTime())
    const sunday = getTrainingCycleState(trainingCycle, workouts, new Date('2026-10-25T08:00:00.000Z').getTime())

    expect(saturday).toMatchObject({ consecutiveTrainingDays: 3, restDue: true })
    expect(sunday).toMatchObject({ consecutiveTrainingDays: 0, restDue: false })
    expect(getCycleRoutine(trainingCycle, routines)?.id).toBe('push-b')
  })

  it('does not mark the third training date itself as a rest day', () => {
    const trainingCycle = cycle()
    const workouts = [
      completedCycleWorkout('slot-0', 'push-a', '2026-10-21T09:00:00.000Z'),
      completedCycleWorkout('slot-1', 'pull-a', '2026-10-22T09:00:00.000Z'),
      completedCycleWorkout('slot-2', 'legs-a', '2026-10-23T09:00:00.000Z'),
    ]

    expect(getTrainingCycleState(trainingCycle, workouts, new Date('2026-10-23T18:00:00.000Z').getTime()).restDue).toBe(false)
  })

  it('migrates legacy rest slots to inferred rest while preserving the next queued routine', () => {
    const legacy = {
      ...cycle(),
      currentIndex: 1,
      trainingDaysBeforeRest: undefined,
      slots: [
        { id: 'slot-push', type: 'routine', routineId: 'push-a' },
        { id: 'slot-rest', type: 'rest', routineId: null },
        { id: 'slot-pull', type: 'routine', routineId: 'pull-a' },
      ],
    }

    const normalized = normalizeTrainingCycle(legacy as unknown as TrainingCycle)

    expect(normalized.trainingDaysBeforeRest).toBe(3)
    expect(normalized.slots).toEqual([
      { id: 'slot-push', routineId: 'push-a' },
      { id: 'slot-pull', routineId: 'pull-a' },
    ])
    expect(normalized.currentIndex).toBe(1)
  })
})
