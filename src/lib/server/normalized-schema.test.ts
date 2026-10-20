import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import type { RoutineTemplate, TrainingCycle, WorkoutSession } from '../types'

function migration(name: string) {
  return readFileSync(new URL(`../../../migrations/${name}`, import.meta.url), 'utf8')
}

const workout: WorkoutSession = {
  id: 'workout-1',
  title: 'Leg A',
  routineId: 'routine-1',
  cycleSlotId: 'slot-1',
  status: 'completed',
  startedAt: '2026-10-19T08:00:00.000Z',
  completedAt: '2026-10-19T09:00:00.000Z',
  updatedAt: '2026-10-19T09:00:00.000Z',
  notes: 'Strong session',
  sessionRpe: 8,
  exercises: [{
    id: 'workout-exercise-1',
    exerciseId: 'barbell-squat',
    name: 'Barbell Squat',
    muscle: 'Quadriceps',
    equipment: 'Barbell',
    secondaryMuscles: [{ muscle: 'Glutes', fraction: 0.5 }],
    notes: 'Controlled eccentric',
    restSeconds: 120,
    restUntil: null,
    progression: { minReps: 6, maxReps: 10, weightIncrement: 2.5, maxRpe: 9 },
    sets: [{
      id: 'set-1',
      weight: 100,
      reps: 8,
      rpe: 9,
      durationSeconds: null,
      distanceMeters: null,
      completed: true,
      completedAt: '2026-10-19T08:30:00.000Z',
      warmup: false,
      notes: 'Clean rep',
    }],
  }],
}

const routine: RoutineTemplate = {
  id: 'routine-1',
  name: 'Leg A',
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-19T09:00:00.000Z',
  deletedAt: null,
  exercises: [{
    id: 'routine-exercise-1',
    exerciseId: 'barbell-squat',
    name: 'Barbell Squat',
    muscle: 'Quadriceps',
    equipment: 'Barbell',
    secondaryMuscles: [{ muscle: 'Glutes', fraction: 0.5 }],
    notes: 'Controlled eccentric',
    restSeconds: 120,
    setCount: 3,
    hasWarmupSet: false,
    progression: { minReps: 6, maxReps: 10, weightIncrement: 2.5, maxRpe: 9 },
  }],
}

const cycle: TrainingCycle = {
  id: 'primary-training-cycle',
  name: 'PPL',
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-19T09:00:00.000Z',
  deletedAt: null,
  currentIndex: 0,
  slots: [{ id: 'slot-1', type: 'routine', routineId: 'routine-1' }],
}

describe('normalized D1 migration', () => {
  it('backfills legacy aggregates into relational rows that support indexed analytics', () => {
    const database = new DatabaseSync(':memory:')
    database.exec(migration('0001_workouts.sql'))
    database.exec(migration('0002_routines.sql'))
    database.exec(migration('0003_training_cycle.sql'))
    database.prepare('INSERT INTO workouts (id, updated_at, payload) VALUES (?, ?, ?)')
      .run(workout.id, workout.updatedAt, JSON.stringify(workout))
    database.prepare('INSERT INTO routines (id, updated_at, payload) VALUES (?, ?, ?)')
      .run(routine.id, routine.updatedAt, JSON.stringify(routine))
    database.prepare('INSERT INTO training_cycles (id, updated_at, payload) VALUES (?, ?, ?)')
      .run(cycle.id, cycle.updatedAt, JSON.stringify(cycle))

    database.exec(migration('0004_normalized_training.sql'))
    database.exec('UPDATE workout_sets SET failure = 1')
    database.exec(migration('0005_warmup_rpe.sql'))

    const workoutColumns = database.prepare('PRAGMA table_info(workouts)').all().map((column) => column.name)
    const workoutSetColumns = database.prepare('PRAGMA table_info(workout_sets)').all().map((column) => column.name)
    expect(workoutColumns).toContain('completed_at')
    expect(workoutColumns).not.toContain('payload')
    expect(workoutSetColumns).toContain('warmup')
    expect(workoutSetColumns).not.toContain('failure')
    expect(database.prepare(`
      SELECT
        w.title,
        we.exercise_id,
        we.primary_muscle,
        ws.weight,
        ws.repetitions,
        ws.rpe
      FROM workouts w
      JOIN workout_exercises we ON we.workout_id = w.id
      JOIN workout_sets ws ON ws.workout_exercise_id = we.id
      WHERE w.status = 'completed' AND w.completed_at >= ?
    `).get('2026-10-01T00:00:00.000Z')).toEqual({
      title: 'Leg A',
      exercise_id: 'barbell-squat',
      primary_muscle: 'Quadriceps',
      weight: 100,
      repetitions: 8,
      rpe: 10,
    })
    expect(database.prepare('SELECT muscle, fraction FROM workout_exercise_secondary_muscles').get()).toEqual({ muscle: 'Glutes', fraction: 0.5 })
    expect(database.prepare('SELECT exercise_id, set_count, has_warmup_set FROM routine_exercises').get()).toEqual({ exercise_id: 'barbell-squat', set_count: 3, has_warmup_set: 0 })
    expect(database.prepare('SELECT type, routine_id FROM training_cycle_slots').get()).toEqual({ type: 'routine', routine_id: 'routine-1' })
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'workouts_status_completed_at_idx'").get()).toEqual({ name: 'workouts_status_completed_at_idx' })

    database.close()
  })
})
