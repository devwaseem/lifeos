import type { TrainingProfile } from '../types'

interface TrainingProfileRow {
  id: TrainingProfile['id']
  primary_goal: TrainingProfile['primaryGoal']
  experience_level: TrainingProfile['experienceLevel']
  days_per_week: number
  session_minutes: number
  available_equipment: string
  excluded_exercises: string
  movement_constraints: string
  updated_at: string
}

function stringArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function profileFromRow(row: TrainingProfileRow | null): TrainingProfile | null {
  if (!row) return null
  return {
    id: row.id,
    primaryGoal: row.primary_goal,
    experienceLevel: row.experience_level,
    daysPerWeek: row.days_per_week,
    sessionMinutes: row.session_minutes,
    availableEquipment: stringArray(row.available_equipment),
    excludedExercises: stringArray(row.excluded_exercises),
    movementConstraints: row.movement_constraints,
    updatedAt: row.updated_at,
  }
}

export async function syncTrainingContext(database: D1Database, profile: TrainingProfile | null) {
  if (profile) {
    await database.prepare(`
      INSERT INTO training_profiles (
        id, primary_goal, experience_level, days_per_week, session_minutes,
        available_equipment, excluded_exercises, movement_constraints, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        primary_goal = excluded.primary_goal,
        experience_level = excluded.experience_level,
        days_per_week = excluded.days_per_week,
        session_minutes = excluded.session_minutes,
        available_equipment = excluded.available_equipment,
        excluded_exercises = excluded.excluded_exercises,
        movement_constraints = excluded.movement_constraints,
        updated_at = excluded.updated_at
      WHERE excluded.updated_at > training_profiles.updated_at
    `).bind(
      profile.id,
      profile.primaryGoal,
      profile.experienceLevel,
      profile.daysPerWeek,
      profile.sessionMinutes,
      JSON.stringify(profile.availableEquipment),
      JSON.stringify(profile.excludedExercises),
      profile.movementConstraints,
      profile.updatedAt,
    ).run()
  }

  const profileRow = await database.prepare(`
    SELECT id, primary_goal, experience_level, days_per_week, session_minutes,
      available_equipment, excluded_exercises, movement_constraints, updated_at
    FROM training_profiles WHERE id = 'primary-training-profile'
  `).first<TrainingProfileRow>()
  return { profile: profileFromRow(profileRow) }
}

export async function recordDeviceSync(database: D1Database, deviceId: string, authenticatedSubject: string, revision: number, syncedAt: string) {
  await database.prepare(`
    INSERT INTO device_sync_state (device_id, authenticated_subject, last_synced_at, last_revision)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(device_id) DO UPDATE SET
      authenticated_subject = excluded.authenticated_subject,
      last_synced_at = excluded.last_synced_at,
      last_revision = excluded.last_revision
  `).bind(deviceId, authenticatedSubject, syncedAt, revision).run()
}
