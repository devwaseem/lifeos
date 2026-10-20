import { readFileSync } from 'node:fs'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import type { RoutineTemplate, TrainingCycle, TrainingProfile, WorkoutSession } from '../types'
import { handleWorkoutSyncRequest, type WorkoutSyncEnvironment } from './workout-sync'

interface TestStatement {
  bind(...values: unknown[]): TestStatement
  run(): Promise<D1Result>
  all<T>(): Promise<D1Result<T>>
  first<T>(columnName?: string): Promise<T | null>
}

function d1Database(database: DatabaseSync) {
  const statement = (sql: string, parameters: unknown[] = []): TestStatement => ({
    bind: (...values) => statement(sql, values),
    async run() {
      const result = database.prepare(sql).run(...parameters as SQLInputValue[])
      return { success: true, meta: { changes: Number(result.changes) }, results: [] } as unknown as D1Result
    },
    async all<T>() {
      const results = database.prepare(sql).all(...parameters as SQLInputValue[]) as T[]
      return { success: true, meta: {}, results } as unknown as D1Result<T>
    },
    async first<T>(columnName?: string) {
      const row = database.prepare(sql).get(...parameters as SQLInputValue[]) as Record<string, unknown> | undefined
      if (!row) return null
      return (columnName ? row[columnName] : row) as T
    },
  })

  return {
    prepare: (sql: string) => statement(sql) as unknown as D1PreparedStatement,
    async batch(statements: D1PreparedStatement[]) {
      database.exec('BEGIN')
      try {
        const results = []
        for (const item of statements) results.push(await (item as unknown as TestStatement).run())
        database.exec('COMMIT')
        return results
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
    },
  } as unknown as D1Database
}

function applyMigrations(database: DatabaseSync) {
  for (const name of ['0001_workouts.sql', '0002_routines.sql', '0003_training_cycle.sql', '0004_normalized_training.sql', '0005_warmup_rpe.sql', '0006_first_set_progression.sql', '0007_ai_training.sql', '0008_inferred_cycle_rest.sql', '0009_workout_checkins.sql']) {
    database.exec(readFileSync(new URL(`../../../migrations/${name}`, import.meta.url), 'utf8'))
  }
}

const workout: WorkoutSession = {
  id: 'workout-1',
  title: 'Push A',
  routineId: 'routine-1',
  cycleSlotId: 'slot-1',
  status: 'completed',
  startedAt: '2026-10-19T08:00:00.000Z',
  completedAt: '2026-10-19T09:00:00.000Z',
  updatedAt: '2026-10-19T09:00:00.000Z',
  notes: '',
  sessionRpe: 8,
  checkIn: {
    recordedAt: '2026-10-19T07:55:00.000Z',
    sleepQuality: 4,
    energy: 4,
    soreness: 2,
    stress: 2,
    motivation: 5,
    painPresent: false,
    illnessPresent: false,
    notes: 'Ready to train',
  },
  exercises: [{
    id: 'workout-exercise-1',
    exerciseId: 'bench-press',
    name: 'Bench Press',
    muscle: 'Chest',
    equipment: 'Barbell',
    secondaryMuscles: [{ muscle: 'Triceps', fraction: 0.5 }],
    notes: '',
    restSeconds: 120,
    restUntil: null,
    progression: { minReps: 6, maxReps: 10, weightIncrement: 2.5 },
    sets: [{
      id: 'set-1',
      weight: 80,
      reps: 8,
      rpe: 9,
      durationSeconds: null,
      distanceMeters: null,
      completed: true,
      completedAt: '2026-10-19T08:30:00.000Z',
      warmup: false,
      notes: '',
    }],
  }, {
    id: 'workout-exercise-2',
    exerciseId: 'treadmill',
    name: 'Treadmill',
    muscle: 'Cardio',
    equipment: 'Machine',
    secondaryMuscles: [],
    notes: '',
    restSeconds: 120,
    restUntil: null,
    progression: { minReps: 0, maxReps: 0, weightIncrement: null },
    sets: [{
      id: 'set-2',
      weight: null,
      reps: null,
      rpe: null,
      durationSeconds: 180,
      distanceMeters: 500,
      completed: true,
      completedAt: '2026-10-19T08:05:00.000Z',
      warmup: true,
      notes: 'Warm-up',
    }],
  }],
}

const routine: RoutineTemplate = {
  id: 'routine-1',
  name: 'Push A',
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-19T09:00:00.000Z',
  deletedAt: null,
  exercises: [{
    id: 'routine-exercise-1',
    exerciseId: 'bench-press',
    name: 'Bench Press',
    muscle: 'Chest',
    equipment: 'Barbell',
    notes: '',
    secondaryMuscles: [{ muscle: 'Triceps', fraction: 0.5 }],
    restSeconds: 120,
    setCount: 3,
    hasWarmupSet: true,
    progression: { minReps: 6, maxReps: 10, weightIncrement: 2.5 },
  }],
}

const trainingCycle: TrainingCycle = {
  id: 'primary-training-cycle',
  name: 'PPL',
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-19T09:00:00.000Z',
  deletedAt: null,
  currentIndex: 0,
  trainingDaysBeforeRest: 3,
  slots: [{ id: 'slot-1', routineId: 'routine-1' }],
}

const profile: TrainingProfile = {
  id: 'primary-training-profile',
  primaryGoal: 'strength',
  experienceLevel: 'intermediate',
  daysPerWeek: 4,
  sessionMinutes: 60,
  availableEquipment: ['Barbell'],
  excludedExercises: ['Behind-neck press'],
  movementConstraints: '',
  updatedAt: '2026-10-19T09:00:00.000Z',
}


function syncRequest(body: unknown) {
  return new Request('http://localhost/api/sync', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer lifeos-local-dev',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

async function sync(environment: WorkoutSyncEnvironment, body: unknown) {
  const response = await handleWorkoutSyncRequest(syncRequest(body), environment)
  expect(response.status).toBe(200)
  return response.json() as Promise<{
    workouts: WorkoutSession[]
    routines: RoutineTemplate[]
    trainingCycle: TrainingCycle | null
    cursor: number
    profile: TrainingProfile | null
  }>
}

describe('normalized workout sync', () => {
  it('round-trips aggregates and returns only changes after a sync cursor', async () => {
    const database = new DatabaseSync(':memory:')
    applyMigrations(database)
    const environment: WorkoutSyncEnvironment = {
      DB: d1Database(database),
      LOCAL_SYNC_TOKEN: 'lifeos-local-dev',
    }
    const archive = { deviceId: 'device-1', workouts: [workout], routines: [routine], trainingCycle, profile }

    const first = await sync(environment, archive)
    expect(first.workouts).toEqual([workout])
    expect(first.routines).toEqual([routine])
    expect(first.trainingCycle).toEqual(trainingCycle)
    expect(first.profile).toEqual(profile)
    expect(first.cursor).toBeGreaterThan(0)

    const unchanged = await sync(environment, { ...archive, cursor: first.cursor })
    expect(unchanged.workouts).toEqual([])
    expect(unchanged.routines).toEqual([])
    expect(unchanged.trainingCycle).toBeNull()
    expect(unchanged.cursor).toBe(first.cursor)

    const updatedWorkout = { ...workout, notes: 'New personal best', updatedAt: '2026-10-20T09:00:00.000Z' }
    const changed = await sync(environment, { ...archive, workouts: [updatedWorkout], cursor: unchanged.cursor })
    expect(changed.workouts).toEqual([updatedWorkout])
    expect(changed.routines).toEqual([])
    expect(changed.trainingCycle).toBeNull()
    expect(changed.cursor).toBeGreaterThan(unchanged.cursor)

    const staleWorkout = { ...workout, notes: 'Stale device', updatedAt: '2026-10-18T09:00:00.000Z' }
    const stale = await sync(environment, { ...archive, workouts: [staleWorkout], cursor: changed.cursor })
    expect(stale.workouts).toEqual([])

    const complete = await sync(environment, { deviceId: 'device-2', workouts: [], routines: [], trainingCycle: null })
    expect(complete.workouts[0].notes).toBe('New personal best')
    expect(database.prepare('SELECT authenticated_subject FROM device_sync_state WHERE device_id = ?').get('device-1')).toEqual({ authenticated_subject: 'local-development' })

    database.close()
  })
})
