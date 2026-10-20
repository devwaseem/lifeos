import { describe, expect, it } from 'vitest'
import { buildExerciseProgressionResults, buildSetProgressionTargets, defaultProgressionRule, supportsProgression } from './progression'
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

  it('defaults progressive exercises to an 8–12 rep band and two-minute rest', () => {
    expect(defaultProgressionRule('Barbell')).toEqual({ minReps: 8, maxReps: 12, weightIncrement: 2.5 })
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
      checkIn: null,
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

  function workout(id: string, startedAt: string, firstReps: number, secondReps: number, rpe = 10): WorkoutSession {
    return {
      id,
      title: 'Push',
      routineId: null,
      cycleSlotId: null,
      status: 'completed',
      startedAt,
      completedAt: startedAt,
      updatedAt: startedAt,
      notes: '',
      sessionRpe: 8,
      checkIn: null,
      exercises: [{
        id: `${id}-bench`,
        exerciseId: 'bench',
        name: 'Bench Press',
        muscle: 'Chest',
        equipment: 'Barbell',
        secondaryMuscles: [],
        notes: '',
        restSeconds: 120,
        restUntil: null,
        progression: { minReps: 6, maxReps: 10, weightIncrement: 2.5 },
        sets: [
          { id: `${id}-1`, weight: 80, reps: firstReps, rpe, durationSeconds: null, distanceMeters: null, completed: true, completedAt: startedAt, warmup: false, notes: '' },
          { id: `${id}-2`, weight: 80, reps: secondReps, rpe: 10, durationSeconds: null, distanceMeters: null, completed: true, completedAt: startedAt, warmup: false, notes: '' },
        ],
      }],
    }
  }
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
        progression: { minReps: 6, maxReps: 10, weightIncrement: 2.5 },
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

  it('adds load after reaching the rep ceiling at RPE 10', () => {
    const previous = workout('previous', '2026-10-19T08:00:00.000Z', 10, 7)
    const current = workout('current', '2026-10-20T08:00:00.000Z', 10, 6)
    current.status = 'active'
    current.completedAt = null

    const targets = buildSetProgressionTargets(current, [current, previous])

    expect(targets.get('current-1')).toMatchObject({
      action: 'increase-load',
      targetWeight: 82.5,
      targetReps: 6,
    })
  })
})


describe('first-set exercise progression', () => {

  it('progresses when the first working set gains a rep even if a later set loses reps', () => {
    const previous = workout('previous', '2026-10-19T08:00:00.000Z', 8, 7)
    const current = workout('current', '2026-10-20T08:00:00.000Z', 9, 6)

    expect(buildExerciseProgressionResults(current, [current, previous]).get('current-bench')).toMatchObject({
      status: 'progressed',
      repDelta: 1,
      effortTrend: 'same',
    })
  })

  it('maintains first-set performance and reports meaningfully lower effort', () => {
    const previous = workout('previous', '2026-10-19T08:00:00.000Z', 8, 7, 10)
    const current = workout('current', '2026-10-20T08:00:00.000Z', 8, 9, 9)

    expect(buildExerciseProgressionResults(current, [current, previous]).get('current-bench')).toMatchObject({
      status: 'maintained',
      repDelta: 0,
      effortTrend: 'lower',
    })
  })

  it('declines when the first set loses a rep even if later sets improve', () => {
    const previous = workout('previous', '2026-10-19T08:00:00.000Z', 8, 7)
    const current = workout('current', '2026-10-20T08:00:00.000Z', 7, 9)

    expect(buildExerciseProgressionResults(current, [current, previous]).get('current-bench')).toMatchObject({
      status: 'declined',
      repDelta: -1,
    })
  })

  it('recognizes a prescribed load increase at the configured minimum repetitions', () => {
    const previous = workout('previous', '2026-10-19T08:00:00.000Z', 10, 7)
    const current = workout('current', '2026-10-20T08:00:00.000Z', 6, 6)
    current.exercises[0].sets[0].weight = 82.5

    expect(buildExerciseProgressionResults(current, [current, previous]).get('current-bench')).toMatchObject({
      status: 'progressed',
      repDelta: null,
      target: { action: 'increase-load', targetWeight: 82.5, targetReps: 6 },
    })
  })

  it('does not fabricate a comparison for an unplanned load change', () => {
    const previous = workout('previous', '2026-10-19T08:00:00.000Z', 8, 7)
    const current = workout('current', '2026-10-20T08:00:00.000Z', 8, 7)
    current.exercises[0].sets[0].weight = 85

    expect(buildExerciseProgressionResults(current, [current, previous]).get('current-bench')).toMatchObject({
      status: 'not-comparable',
      repDelta: null,
    })
  })

  it('keeps progression pending until the actual first working set is completed', () => {
    const previous = workout('previous', '2026-10-19T08:00:00.000Z', 8, 7)
    const current = workout('current', '2026-10-20T08:00:00.000Z', 9, 8)
    current.exercises[0].sets[0].completed = false

    expect(buildExerciseProgressionResults(current, [current, previous]).get('current-bench')).toMatchObject({
      status: 'pending',
      repDelta: null,
    })
  })

  it('uses only earlier sessions and establishes a baseline without one', () => {
    const older = workout('older', '2026-10-18T08:00:00.000Z', 7, 6)
    const current = workout('current', '2026-10-19T08:00:00.000Z', 8, 7)
    const future = workout('future', '2026-10-20T08:00:00.000Z', 10, 8)

    expect(buildExerciseProgressionResults(current, [future, current, older]).get('current-bench')).toMatchObject({
      status: 'progressed',
      previousSet: { id: 'older-1' },
    })
    expect(buildExerciseProgressionResults(older, [future, current, older]).get('older-bench')).toMatchObject({
      status: 'baseline',
      previousSet: null,
    })
  })

  it('compares bodyweight sets when null and zero both represent external load', () => {
    const previous = workout('previous', '2026-10-19T08:00:00.000Z', 8, 7)
    const current = workout('current', '2026-10-20T08:00:00.000Z', 9, 6)
    previous.exercises[0].sets[0].weight = null
    current.exercises[0].sets[0].weight = 0

    expect(buildExerciseProgressionResults(current, [current, previous]).get('current-bench')).toMatchObject({
      status: 'progressed',
      repDelta: 1,
    })
  })
})
