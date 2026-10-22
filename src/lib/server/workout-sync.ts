import { isEquipmentSettings } from '../equipment-settings'
import type { RoutineTemplate, TrainingCycle, TrainingProfile, WorkoutCheckIn, WorkoutSession } from '../types'
import { authenticateOwnerRequest, type OwnerAuthEnvironment } from './owner-auth'
import { recordDeviceSync, syncTrainingContext } from './training-context-store'
import { syncTrainingData } from './training-sync-store'

const MAX_SYNC_PAYLOAD_BYTES = 5 * 1024 * 1024

export interface WorkoutSyncEnvironment extends OwnerAuthEnvironment {
  DB: D1Database
}

interface SyncBody {
  deviceId?: unknown
  workouts?: unknown
  routines?: unknown
  trainingCycle?: unknown
  cursor?: unknown
  profile?: unknown
  equipmentSettings?: unknown
}



function json(data: unknown, status = 200) {
  return Response.json(data, { status })
}

function isWorkoutCheckIn(value: unknown): value is WorkoutCheckIn {
  if (!value || typeof value !== 'object') return false
  const checkIn = value as Partial<WorkoutCheckIn>
  const ratings = [checkIn.sleepQuality, checkIn.energy, checkIn.soreness, checkIn.stress, checkIn.motivation]
  return typeof checkIn.recordedAt === 'string'
    && ratings.every((rating) => Number.isInteger(rating) && (rating ?? 0) >= 1 && (rating ?? 0) <= 5)
    && typeof checkIn.painPresent === 'boolean'
    && typeof checkIn.illnessPresent === 'boolean'
    && typeof checkIn.notes === 'string' && checkIn.notes.length <= 2_000
}

function isWorkout(value: unknown): value is WorkoutSession {
  if (!value || typeof value !== 'object') return false
  const workout = value as Partial<WorkoutSession>
  return typeof workout.id === 'string'
    && typeof workout.title === 'string'
    && (workout.status === 'active' || workout.status === 'completed' || workout.status === 'cancelled')
    && typeof workout.startedAt === 'string'
    && typeof workout.updatedAt === 'string'
    && (workout.checkIn === undefined || workout.checkIn === null || isWorkoutCheckIn(workout.checkIn))
    && Array.isArray(workout.exercises)
}

function isRoutine(value: unknown): value is RoutineTemplate {
  if (!value || typeof value !== 'object') return false
  const routine = value as Partial<RoutineTemplate>
  return typeof routine.id === 'string'
    && typeof routine.name === 'string'
    && typeof routine.createdAt === 'string'
    && typeof routine.updatedAt === 'string'
    && (routine.deletedAt === null || typeof routine.deletedAt === 'string')
    && Array.isArray(routine.exercises)
}

function isTrainingCycle(value: unknown): value is TrainingCycle {
  if (!value || typeof value !== 'object') return false
  const cycle = value as Partial<TrainingCycle>
  return cycle.id === 'primary-training-cycle'
    && typeof cycle.name === 'string'
    && typeof cycle.createdAt === 'string'
    && typeof cycle.updatedAt === 'string'
    && (cycle.deletedAt === null || typeof cycle.deletedAt === 'string')
    && typeof cycle.currentIndex === 'number'
    && Number.isInteger(cycle.trainingDaysBeforeRest)
    && (cycle.trainingDaysBeforeRest ?? 0) >= 1
    && (cycle.trainingDaysBeforeRest ?? 0) <= 7
    && Array.isArray(cycle.slots)
    && cycle.slots.length <= 100
    && cycle.slots.every((slot) => slot
      && typeof slot === 'object'
      && typeof slot.id === 'string'
      && typeof slot.routineId === 'string'
      && slot.routineId.length > 0)
}

function isTrainingProfile(value: unknown): value is TrainingProfile {
  if (!value || typeof value !== 'object') return false
  const profile = value as Partial<TrainingProfile>
  return profile.id === 'primary-training-profile'
    && (profile.primaryGoal === 'strength' || profile.primaryGoal === 'hypertrophy' || profile.primaryGoal === 'general-fitness' || profile.primaryGoal === 'conditioning')
    && (profile.experienceLevel === 'beginner' || profile.experienceLevel === 'intermediate' || profile.experienceLevel === 'advanced')
    && Number.isInteger(profile.daysPerWeek) && (profile.daysPerWeek ?? 0) >= 1 && (profile.daysPerWeek ?? 0) <= 7
    && Number.isInteger(profile.sessionMinutes) && (profile.sessionMinutes ?? 0) >= 10 && (profile.sessionMinutes ?? 0) <= 300
    && Array.isArray(profile.availableEquipment) && profile.availableEquipment.length <= 100 && profile.availableEquipment.every((item) => typeof item === 'string')
    && Array.isArray(profile.excludedExercises) && profile.excludedExercises.length <= 200 && profile.excludedExercises.every((item) => typeof item === 'string' && item.length <= 200)
    && typeof profile.movementConstraints === 'string' && profile.movementConstraints.length <= 2_000
    && typeof profile.updatedAt === 'string'
}


export async function handleWorkoutSyncRequest(
  request: Request,
  environment: WorkoutSyncEnvironment | undefined,
) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!environment) return json({ error: 'Cloudflare bindings unavailable' }, 503)

  const authenticatedSubject = await authenticateOwnerRequest(request, environment)
  if (!authenticatedSubject) return json({ error: 'Unauthorized' }, 401)

  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_SYNC_PAYLOAD_BYTES) {
    return json({ error: 'Payload too large' }, 413)
  }

  let body: SyncBody
  try {
    body = await request.json() as SyncBody
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  if (typeof body.deviceId !== 'string'
    || !Array.isArray(body.workouts)
    || body.workouts.length > 500
    || !Array.isArray(body.routines)
    || body.routines.length > 200
    || (body.cursor !== undefined
      && body.cursor !== null
      && (!Number.isSafeInteger(body.cursor) || (body.cursor as number) < 0))) {
    return json({ error: 'Invalid sync payload' }, 400)
  }

  const workouts = body.workouts.filter(isWorkout)
  if (workouts.length !== body.workouts.length) return json({ error: 'Invalid workout record' }, 400)
  const routines = body.routines.filter(isRoutine)
  if (routines.length !== body.routines.length) return json({ error: 'Invalid routine record' }, 400)
  const trainingCycle = body.trainingCycle === undefined || body.trainingCycle === null
    ? null
    : isTrainingCycle(body.trainingCycle)
      ? body.trainingCycle
      : undefined
  if (trainingCycle === undefined) return json({ error: 'Invalid training cycle record' }, 400)
  const profile = body.profile === undefined || body.profile === null
    ? null
    : isTrainingProfile(body.profile)
      ? body.profile
      : undefined
  if (profile === undefined) return json({ error: 'Invalid training profile' }, 400)
  const equipmentSettings = body.equipmentSettings === undefined || body.equipmentSettings === null
    ? null
    : isEquipmentSettings(body.equipmentSettings)
      ? body.equipmentSettings
      : undefined
  if (equipmentSettings === undefined) return json({ error: 'Invalid equipment settings' }, 400)


  const snapshot = await syncTrainingData(environment.DB, {
    workouts,
    routines,
    trainingCycle,
    cursor: typeof body.cursor === 'number' ? body.cursor : null,
  })
  const context = await syncTrainingContext(environment.DB, profile, equipmentSettings)
  const syncedAt = new Date().toISOString()
  await recordDeviceSync(environment.DB, body.deviceId, authenticatedSubject, snapshot.cursor, syncedAt)
  return json({ ...snapshot, ...context, syncedAt })
}
