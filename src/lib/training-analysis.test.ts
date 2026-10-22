import { describe, expect, it } from 'vitest'
import type { RoutineTemplate, TrainingProfile, WorkoutCheckIn, WorkoutSession } from './types'
import { buildExerciseProgress, buildRoutineReview, buildTrainingOverview, type TrainingDataset } from './training-analysis'

const now = Date.parse('2026-10-20T12:00:00.000Z')

const routine: RoutineTemplate = {
  id: 'routine-1',
  name: 'Push',
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-10-19T09:00:00.000Z',
  deletedAt: null,
  exercises: [{
    id: 'routine-exercise-1',
    exerciseId: 'bench-press',
    name: 'Bench Press',
    muscle: 'Chest',
    equipment: 'Barbell',
    secondaryMuscles: [{ muscle: 'Triceps', fraction: 0.5 }],
    notes: '',
    restSeconds: 120,
    setCount: 3,
    hasWarmupSet: true,
    progression: { minReps: 6, maxReps: 10, weightIncrement: 2.5, weightOptions: [] },
  }],
}

function workout(id: string, completedAt: string, weight: number, rpe: number): WorkoutSession {
  return {
    id,
    title: 'Push',
    routineId: routine.id,
    cycleSlotId: null,
    status: 'completed',
    startedAt: new Date(Date.parse(completedAt) - 60 * 60_000).toISOString(),
    completedAt,
    updatedAt: completedAt,
    notes: 'Private note that must not appear in analytics output',
    sessionRpe: rpe,
    checkIn: null,
    exercises: [{
      id: `exercise-${id}`,
      exerciseId: 'bench-press',
      name: 'Bench Press',
      muscle: 'Chest',
      equipment: 'Barbell',
      secondaryMuscles: [{ muscle: 'Triceps', fraction: 0.5 }],
      notes: '',
      restSeconds: 120,
      restUntil: null,
      progression: routine.exercises[0].progression,
      sets: [{
        id: `set-${id}`,
        weight,
        reps: 8,
        rpe,
        durationSeconds: null,
        distanceMeters: null,
        completed: true,
        completedAt,
        warmup: false,
        notes: '',
      }],
    }],
  }
}

const profile: TrainingProfile = {
  id: 'primary-training-profile',
  primaryGoal: 'strength',
  experienceLevel: 'intermediate',
  daysPerWeek: 4,
  sessionMinutes: 60,
  availableEquipment: ['Barbell'],
  excludedExercises: ['Bench Press'],
  movementConstraints: '',
  updatedAt: '2026-10-20T08:00:00.000Z',
}

const checkIn: WorkoutCheckIn = {
  recordedAt: '2026-10-19T08:00:00.000Z',
  sleepQuality: 3,
  energy: 2,
  soreness: 4,
  stress: 3,
  motivation: 2,
  painPresent: true,
  illnessPresent: false,
  notes: '',
}

function dataset(): TrainingDataset {
  return {
    workouts: [
      { ...workout('recent-1', '2026-10-19T09:00:00.000Z', 82.5, 9), checkIn },
      workout('recent-2', '2026-10-16T09:00:00.000Z', 80, 9),
      workout('baseline-1', '2026-10-10T09:00:00.000Z', 77.5, 8),
    ],
    routines: [routine],
    trainingCycle: null,
    profile,
    latestCheckIn: checkIn,
    freshness: {
      latestDeviceSyncAt: '2026-10-20T10:00:00.000Z',
      latestWorkoutUpdatedAt: '2026-10-19T09:00:00.000Z',
    },
  }
}

describe('training analytics interface', () => {
  it('returns evidence-labelled overview data without exposing private notes', () => {
    const result = buildTrainingOverview(dataset(), now)

    expect(result.asOf).toBe('2026-10-20T12:00:00.000Z')
    expect(result.data.sessionCount).toBe(3)
    expect(result.data.latestCheckIn?.painPresent).toBe(true)
    expect(result.freshness.possiblyStale).toBe(true)
    expect(result.evidence.map((item) => item.status)).toEqual(expect.arrayContaining(['observed', 'derived-estimate', 'pragmatic-heuristic']))
    expect(JSON.stringify(result)).not.toContain('Private note')
  })

  it('reviews routines against explicit profile constraints without claiming medical correctness', () => {
    const result = buildRoutineReview(dataset(), routine.id, now)

    expect(result.data.excludedExercises).toEqual([{ exerciseId: 'bench-press', name: 'Bench Press' }])
    expect(result.data.requiresUserReview).toBe(true)
    expect(result.data.workingSetsPerExposure).toBe(3)
    expect(result.limitations).toContain('Exercise selection and logged performance cannot establish technique quality or medical safety.')
  })

  it('returns bounded exercise exposures and deterministic progression context', () => {
    const result = buildExerciseProgress(dataset(), 'bench-press', 2, now)

    expect(result.data.exposures).toHaveLength(2)
    expect(result.data.exposures.map((item) => item.weight)).toEqual([82.5, 80])
    expect(result.data.profile.comparableSessions).toBe(3)
  })
})
