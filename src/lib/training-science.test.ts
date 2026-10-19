import { describe, expect, it } from 'vitest'
import { getSystemicLoad } from './training-science'
import type { WorkoutSession } from './types'

function completedWorkout(
  id: string,
  startedAt: string,
  completedAt: string,
  strengthSetRpes: number[],
): WorkoutSession {
  return {
    id,
    title: 'Workout',
    routineId: null,
    cycleSlotId: null,
    status: 'completed',
    startedAt,
    completedAt,
    updatedAt: completedAt,
    notes: '',
    sessionRpe: null,
    exercises: [
      {
        id: `${id}-strength`,
        exerciseId: 'strength',
        name: 'Strength exercise',
        muscle: 'Quadriceps',
        equipment: 'Machine',
        secondaryMuscles: [],
        notes: '',
        restSeconds: 120,
        restUntil: null,
        progression: { minReps: 8, maxReps: 12, weightIncrement: 2.5, maxRpe: 10 },
        sets: strengthSetRpes.map((rpe, index) => ({
          id: `${id}-strength-${index}`,
          weight: 100,
          reps: 10,
          rpe,
          durationSeconds: null,
          distanceMeters: null,
          completed: true,
          completedAt,
          failure: false,
          notes: '',
        })),
      },
      {
        id: `${id}-treadmill`,
        exerciseId: 'treadmill',
        name: 'Treadmill',
        muscle: 'Cardio',
        equipment: 'Machine',
        secondaryMuscles: [],
        notes: '',
        restSeconds: 0,
        restUntil: null,
        progression: { minReps: 0, maxReps: 0, weightIncrement: null, maxRpe: 10 },
        sets: [{
          id: `${id}-treadmill-set`,
          weight: null,
          reps: null,
          rpe: null,
          durationSeconds: 300,
          distanceMeters: 500,
          completed: true,
          completedAt,
          failure: false,
          notes: '',
        }],
      },
    ],
  }
}

describe('systemic load data availability', () => {
  it('estimates legacy workout effort from recorded set RPE and ignores missing treadmill RPE', () => {
    const now = Date.parse('2026-10-20T12:00:00.000Z')
    const recent = completedWorkout('recent', '2026-10-19T10:00:00.000Z', '2026-10-19T11:00:00.000Z', [8, 10])
    const baseline = completedWorkout('baseline', '2026-10-10T10:00:00.000Z', '2026-10-10T11:00:00.000Z', [6])

    expect(getSystemicLoad([recent, baseline], now)).toMatchObject({
      recentLoad: 540,
      weeklyAverageLoad: 90,
      ratio: 6,
      recentSessionCount: 1,
      recentSessionsWithEffort: 1,
      recentEstimatedSessions: 1,
      baselineSessionCount: 1,
      baselineSessionsWithEffort: 1,
      baselineEstimatedSessions: 1,
    })
  })

  it('keeps load unavailable when a completed workout has no usable effort rating', () => {
    const now = Date.parse('2026-10-20T12:00:00.000Z')
    const workout = completedWorkout('missing', '2026-10-19T10:00:00.000Z', '2026-10-19T11:00:00.000Z', [])

    expect(getSystemicLoad([workout], now)).toMatchObject({
      recentLoad: null,
      recentSessionCount: 1,
      recentSessionsWithEffort: 0,
      recentEstimatedSessions: 0,
    })
  })
})
