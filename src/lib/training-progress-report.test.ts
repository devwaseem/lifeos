import { describe, expect, it } from 'vitest'
import { buildTrainingProgressReport, type TrainingDataset } from './training-progress-report'
import type { RoutineTemplate, WorkoutSession } from './types'

const now = Date.parse('2026-10-20T12:00:00.000Z')
const routine: RoutineTemplate = {
  id: 'push',
  name: 'Push',
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-10-19T08:00:00.000Z',
  deletedAt: null,
  exercises: [{
    id: 'routine-bench',
    exerciseId: 'bench',
    name: 'Barbell Bench Press',
    muscle: 'Chest',
    equipment: 'Barbell',
    secondaryMuscles: [{ muscle: 'Triceps', fraction: 0.5 }],
    notes: 'private routine note',
    restSeconds: 120,
    setCount: 3,
    hasWarmupSet: true,
    progression: { minReps: 6, maxReps: 10, weightIncrement: 2.5, weightOptions: [] },
  }],
}

function workout(index: number, weight: number): WorkoutSession {
  const completedAt = new Date(now - (6 - index) * 3 * 24 * 60 * 60 * 1_000).toISOString()
  return {
    id: `workout-${index}`,
    title: 'Push',
    routineId: routine.id,
    cycleSlotId: null,
    status: 'completed',
    startedAt: new Date(Date.parse(completedAt) - 60 * 60_000).toISOString(),
    completedAt,
    updatedAt: completedAt,
    notes: 'private workout note',
    sessionRpe: 8,
    checkIn: index === 6 ? {
      recordedAt: new Date(Date.parse(completedAt) - 5 * 60_000).toISOString(),
      sleepQuality: 4,
      energy: 4,
      soreness: 2,
      stress: 2,
      motivation: 5,
      painPresent: true,
      illnessPresent: false,
      notes: 'private check-in note',
    } : null,
    exercises: [{
      id: `workout-bench-${index}`,
      exerciseId: 'bench',
      name: 'Barbell Bench Press',
      muscle: 'Chest',
      equipment: 'Barbell',
      secondaryMuscles: [{ muscle: 'Triceps', fraction: 0.5 }],
      notes: 'private exercise note',
      restSeconds: 120,
      restUntil: null,
      progression: { minReps: 6, maxReps: 10, weightIncrement: 2.5, weightOptions: [] },
      sets: [{
        id: `set-${index}`,
        weight,
        reps: 8,
        rpe: 8,
        durationSeconds: null,
        distanceMeters: null,
        completed: true,
        completedAt,
        warmup: false,
        notes: 'private set note',
      }],
    }],
  }
}

function dataset(): TrainingDataset {
  const workouts = [1, 2, 3, 4, 5, 6].map((index) => workout(index, index <= 3 ? 70 : 80))
  return {
    workouts,
    routines: [routine],
    trainingCycle: null,
    profile: null,
    latestCheckIn: workouts[5].checkIn,
    freshness: {
      latestDeviceSyncAt: '2026-10-18T08:00:00.000Z',
      latestWorkoutUpdatedAt: workouts[5].updatedAt,
    },
  }
}

describe('training progress report', () => {
  it('turns comparable exercise history into a deterministic cited verdict', () => {
    const report = buildTrainingProgressReport(dataset(), { now })

    expect(report.verdict.status).toBe('progressing')
    expect(report.coverage).toMatchObject({ completedSessions: 6, exercisesObserved: 1, comparableExercises: 1, routinesAnalyzed: 1 })
    expect(report.exerciseTrends[0]).toMatchObject({
      exerciseId: 'bench',
      status: 'progressing',
      inActiveRoutine: true,
      latestExposure: { weight: 80, repetitions: 8, rpe: 8 },
    })
    expect(report.verdict.evidenceRefs).toContain(report.exerciseTrends[0].evidenceId)
    expect(report.trainingState.recommendationBlocked).toBe(true)
    expect(report.freshness.hasUnsyncedChanges).toBe(true)
  })

  it('excludes private notes and invalidates the narrative fingerprint when source data changes', () => {
    const source = dataset()
    const first = buildTrainingProgressReport(source, { now })
    const changed = {
      ...source,
      workouts: source.workouts.map((item, index) => index === 5 ? { ...item, updatedAt: '2026-10-20T11:00:00.000Z' } : item),
      freshness: { ...source.freshness, latestWorkoutUpdatedAt: '2026-10-20T11:00:00.000Z' },
    }
    const second = buildTrainingProgressReport(changed, { now })

    expect(second.fingerprint).not.toBe(first.fingerprint)
    expect(JSON.stringify(first)).not.toContain('private')
  })

  it('reports insufficient data without pretending that early exposure is a trend', () => {
    const source = dataset()
    source.workouts = source.workouts.slice(-2)
    source.latestCheckIn = source.workouts[1].checkIn

    const report = buildTrainingProgressReport(source, { now })

    expect(report.verdict.status).toBe('insufficient-data')
    expect(report.exerciseTrends[0].status).toBe('insufficient-data')
    expect(report.coverage.comparableExercises).toBe(0)
  })
  it('does not treat an in-progress workout as completed progress evidence', () => {
    const source = dataset()
    const completed = buildTrainingProgressReport(source, { now })
    const active: WorkoutSession = {
      ...workout(7, 200),
      id: 'active-workout',
      status: 'active',
      completedAt: null,
      updatedAt: '2026-10-20T11:30:00.000Z',
    }

    const withActiveWorkout = buildTrainingProgressReport({ ...source, workouts: [active, ...source.workouts] }, { now })

    expect(withActiveWorkout.exerciseTrends[0].profile).toEqual(completed.exerciseTrends[0].profile)
    expect(withActiveWorkout.exerciseTrends[0].latestExposure).toEqual(completed.exerciseTrends[0].latestExposure)
    expect(withActiveWorkout.fingerprint).toBe(completed.fingerprint)
  })

})
