import type { TrainingProfile, WorkoutCheckIn } from '../types'
import { readTrainingSnapshot } from './training-sync-store'
import type { TrainingDataset } from './training-analysis'

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

interface FreshnessRow {
  latest_device_sync_at: string | null
  latest_workout_updated_at: string | null
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

function latestWorkoutCheckIn(workouts: TrainingDataset['workouts']): WorkoutCheckIn | null {
  let latest: WorkoutCheckIn | null = null
  for (const workout of workouts) {
    if (workout.checkIn && (!latest || workout.checkIn.recordedAt > latest.recordedAt)) latest = workout.checkIn
  }
  return latest
}

export async function loadTrainingDataset(database: D1Database): Promise<TrainingDataset> {
  const [snapshot, profileRow, freshness] = await Promise.all([
    readTrainingSnapshot(database),
    database.prepare(`
      SELECT id, primary_goal, experience_level, days_per_week, session_minutes,
        available_equipment, excluded_exercises, movement_constraints, updated_at
      FROM training_profiles
      WHERE id = 'primary-training-profile'
    `).first<TrainingProfileRow>(),
    database.prepare(`
      SELECT
        (SELECT MAX(last_synced_at) FROM device_sync_state) AS latest_device_sync_at,
        (SELECT MAX(updated_at) FROM workouts) AS latest_workout_updated_at
    `).first<FreshnessRow>(),
  ])
  return {
    workouts: snapshot.workouts,
    routines: snapshot.routines,
    trainingCycle: snapshot.trainingCycle,
    profile: profileFromRow(profileRow),
    latestCheckIn: latestWorkoutCheckIn(snapshot.workouts),
    freshness: {
      latestDeviceSyncAt: freshness?.latest_device_sync_at ?? null,
      latestWorkoutUpdatedAt: freshness?.latest_workout_updated_at ?? null,
    },
  }
}
