import { describe, expect, it } from 'vitest'
import {
  advanceTrainingCycleForWorkout,
  createTrainingCycle,
  getCycleRoutine,
  getTrainingCycleState,
  normalizeTrainingCycle,
  reconcileTrainingCycleAfterDeletedWorkouts,
  rewindTrainingCycleForDeletedWorkout,
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

  it('rewinds the queue when the latest cycle workout is deleted so that routine can be restarted', () => {
    let trainingCycle = cycle()
    const push = completedCycleWorkout('slot-0', 'push-a', '2026-10-21T09:00:00.000Z')
    const pull = completedCycleWorkout('slot-1', 'pull-a', '2026-10-22T09:00:00.000Z')
    trainingCycle = advanceTrainingCycleForWorkout(trainingCycle, push, push.completedAt!)
    trainingCycle = advanceTrainingCycleForWorkout(trainingCycle, pull, pull.completedAt!)

    const rewound = rewindTrainingCycleForDeletedWorkout(
      trainingCycle,
      pull,
      [push, pull],
      '2026-10-22T10:00:00.000Z',
    )

    expect(getCycleRoutine(rewound, routines)?.id).toBe('pull-a')
    expect(rewound.updatedAt).toBe('2026-10-22T10:00:00.000Z')
  })

  it('repairs a queue that was advanced before its latest completed workout was deleted', () => {
    let trainingCycle = cycle()
    const push = completedCycleWorkout('slot-0', 'push-a', '2026-10-21T09:00:00.000Z')
    const pull = completedCycleWorkout('slot-1', 'pull-a', '2026-10-22T09:00:00.000Z')
    trainingCycle = advanceTrainingCycleForWorkout(trainingCycle, push, push.completedAt!)
    trainingCycle = advanceTrainingCycleForWorkout(trainingCycle, pull, pull.completedAt!)
    const deletedPull: WorkoutSession = {
      ...pull,
      status: 'cancelled',
      updatedAt: '2026-10-22T10:00:00.000Z',
      sessionRpe: null,
      exercises: [],
    }

    const repaired = reconcileTrainingCycleAfterDeletedWorkouts(trainingCycle, [push, deletedPull])

    expect(getCycleRoutine(repaired, routines)?.id).toBe('pull-a')
    expect(repaired.updatedAt).toBe(deletedPull.updatedAt)
  })

  it('does not treat cancelling an unfinished workout as deleting a completed workout', () => {
    const cancelledPull: WorkoutSession = {
      ...completedCycleWorkout('slot-1', 'pull-a', '2026-10-22T10:00:00.000Z'),
      status: 'cancelled',
      sessionRpe: null,
    }
    const trainingCycle = {
      ...cycle(),
      currentIndex: 2,
      updatedAt: '2026-10-22T09:00:00.000Z',
    }

    const unchanged = reconcileTrainingCycleAfterDeletedWorkouts(trainingCycle, [cancelledPull])

    expect(unchanged).toEqual(trainingCycle)
  })

  it('does not repair a stale deletion after the queue was changed more recently', () => {
    const deletedPull: WorkoutSession = {
      ...completedCycleWorkout('slot-1', 'pull-a', '2026-10-22T09:00:00.000Z'),
      status: 'cancelled',
      updatedAt: '2026-10-22T10:00:00.000Z',
      sessionRpe: null,
    }
    const manuallyPositioned = {
      ...cycle(),
      currentIndex: 2,
      updatedAt: '2026-10-22T11:00:00.000Z',
    }

    const unchanged = reconcileTrainingCycleAfterDeletedWorkouts(manuallyPositioned, [deletedPull])

    expect(unchanged).toEqual(manuallyPositioned)
  })

  it('does not rewind an older deletion after later cycle completions have advanced the queue', () => {
    let trainingCycle = cycle()
    const workouts = [
      completedCycleWorkout('slot-0', 'push-a', '2026-10-20T09:00:00.000Z'),
      completedCycleWorkout('slot-1', 'pull-a', '2026-10-21T09:00:00.000Z'),
      completedCycleWorkout('slot-2', 'legs-a', '2026-10-22T09:00:00.000Z'),
      completedCycleWorkout('slot-3', 'push-b', '2026-10-23T09:00:00.000Z'),
      completedCycleWorkout('slot-0', 'push-a', '2026-10-24T09:00:00.000Z'),
      completedCycleWorkout('slot-1', 'pull-a', '2026-10-25T09:00:00.000Z'),
    ]
    for (const workout of workouts) trainingCycle = advanceTrainingCycleForWorkout(trainingCycle, workout, workout.completedAt!)

    const unchanged = rewindTrainingCycleForDeletedWorkout(
      trainingCycle,
      workouts[1],
      workouts,
      '2026-10-25T10:00:00.000Z',
    )

    expect(getCycleRoutine(unchanged, routines)?.id).toBe('legs-a')
    expect(unchanged.updatedAt).toBe(trainingCycle.updatedAt)
  })

  it('does not override a queue position that was manually changed after completion', () => {
    const pull = completedCycleWorkout('slot-1', 'pull-a', '2026-10-22T09:00:00.000Z')
    const manuallyPositioned = { ...cycle(), currentIndex: 3, updatedAt: '2026-10-22T09:30:00.000Z' }

    const unchanged = rewindTrainingCycleForDeletedWorkout(
      manuallyPositioned,
      pull,
      [pull],
      '2026-10-22T10:00:00.000Z',
    )

    expect(getCycleRoutine(unchanged, routines)?.id).toBe('push-b')
    expect(unchanged.updatedAt).toBe(manuallyPositioned.updatedAt)
  })

  it('reports the completed training date so Today does not present the next routine early', () => {
    const trainingCycle = cycle()
    const workouts = [
      completedCycleWorkout('slot-0', 'push-a', '2026-10-21T09:00:00.000Z'),
      completedCycleWorkout('slot-1', 'pull-a', '2026-10-22T09:00:00.000Z'),
      completedCycleWorkout('slot-2', 'legs-a', '2026-10-23T09:00:00.000Z'),
    ]

    expect(getTrainingCycleState(trainingCycle, workouts, new Date('2026-10-23T18:00:00.000Z').getTime())).toMatchObject({
      trainedToday: true,
      restDue: false,
    })
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
