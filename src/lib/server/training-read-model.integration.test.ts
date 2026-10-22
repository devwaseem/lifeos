import { readFileSync } from 'node:fs'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { loadTrainingDataset } from './training-read-model'

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
      return { success: true, meta: {}, results: database.prepare(sql).all(...parameters as SQLInputValue[]) as T[] } as unknown as D1Result<T>
    },
    async first<T>(columnName?: string) {
      const row = database.prepare(sql).get(...parameters as SQLInputValue[]) as Record<string, unknown> | undefined
      if (!row) return null
      return (columnName ? row[columnName] : row) as T
    },
  })
  return { prepare: (sql: string) => statement(sql) as unknown as D1PreparedStatement } as unknown as D1Database
}

function applyMigrations(database: DatabaseSync) {
  for (const name of ['0001_workouts.sql', '0002_routines.sql', '0003_training_cycle.sql', '0004_normalized_training.sql', '0005_warmup_rpe.sql', '0006_first_set_progression.sql', '0007_ai_training.sql', '0008_inferred_cycle_rest.sql', '0009_workout_checkins.sql', '0010_progression_weight_options.sql', '0011_equipment_settings.sql']) {
    database.exec(readFileSync(new URL(`../../../migrations/${name}`, import.meta.url), 'utf8'))
  }
}

describe('training D1 read model', () => {
  it('loads normalized profile, latest workout check-in, and synchronization freshness', async () => {
    const database = new DatabaseSync(':memory:')
    applyMigrations(database)
    database.prepare(`
      INSERT INTO training_profiles (
        id, primary_goal, experience_level, days_per_week, session_minutes,
        available_equipment, excluded_exercises, movement_constraints, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('primary-training-profile', 'strength', 'intermediate', 4, 60, '["Barbell"]', '["Bench Press"]', '', '2026-10-20T08:00:00.000Z')
    database.prepare(`
      INSERT INTO workouts (
        id, title, routine_id, cycle_slot_id, status, started_at, completed_at,
        updated_at, notes, session_rpe, sync_token
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('workout-1', 'Push', null, null, 'completed', '2026-10-20T07:00:00.000Z', '2026-10-20T08:00:00.000Z', '2026-10-20T08:00:00.000Z', '', 8, 'test')
    database.prepare(`
      INSERT INTO workout_checkins (
        workout_id, recorded_at, sleep_quality, energy, soreness, stress,
        motivation, pain_present, illness_present, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('workout-1', '2026-10-20T07:00:00.000Z', 3, 2, 4, 3, 2, 1, 0, '')
    database.prepare(`
      INSERT INTO device_sync_state (device_id, authenticated_subject, last_synced_at, last_revision)
      VALUES (?, ?, ?, ?)
    `).run('device-1', 'owner-1', '2026-10-20T10:00:00.000Z', 2)

    const result = await loadTrainingDataset(d1Database(database))

    expect(result.profile).toMatchObject({ primaryGoal: 'strength', availableEquipment: ['Barbell'], excludedExercises: ['Bench Press'] })
    expect(result.latestCheckIn).toMatchObject({ recordedAt: '2026-10-20T07:00:00.000Z', painPresent: true, illnessPresent: false })
    expect(result.freshness.latestDeviceSyncAt).toBe('2026-10-20T10:00:00.000Z')
    expect(result.workouts[0].checkIn).toEqual(result.latestCheckIn)
    database.close()
  })
})
