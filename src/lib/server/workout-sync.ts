import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'
import type { RoutineTemplate, TrainingCycle, WorkoutSession } from '../types'
import { syncTrainingData } from './training-sync-store'

export interface WorkoutSyncEnvironment {
  DB: D1Database
  LOCAL_SYNC_TOKEN?: string
  CF_ACCESS_TEAM_DOMAIN?: string
  CF_ACCESS_AUD?: string
}

interface SyncBody {
  deviceId?: unknown
  workouts?: unknown
  routines?: unknown
  trainingCycle?: unknown
  cursor?: unknown
}


const MAX_SYNC_PAYLOAD_BYTES = 5 * 1024 * 1024

const accessKeySets = new Map<string, JWTVerifyGetKey>()

async function hasValidSyncAuthentication(request: Request, environment: WorkoutSyncEnvironment) {
  if (environment.LOCAL_SYNC_TOKEN) {
    return request.headers.get('Authorization') === `Bearer ${environment.LOCAL_SYNC_TOKEN}`
  }

  if (!environment.CF_ACCESS_TEAM_DOMAIN || !environment.CF_ACCESS_AUD) return false
  const assertion = request.headers.get('Cf-Access-Jwt-Assertion')
  if (!assertion) return false

  const issuer = `https://${environment.CF_ACCESS_TEAM_DOMAIN}.cloudflareaccess.com`
  let keySet = accessKeySets.get(issuer)
  if (!keySet) {
    keySet = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`))
    accessKeySets.set(issuer, keySet)
  }

  try {
    await jwtVerify(assertion, keySet, {
      issuer,
      audience: environment.CF_ACCESS_AUD,
    })
    return true
  } catch {
    return false
  }
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status })
}

function isWorkout(value: unknown): value is WorkoutSession {
  if (!value || typeof value !== 'object') return false
  const workout = value as Partial<WorkoutSession>
  return typeof workout.id === 'string'
    && typeof workout.title === 'string'
    && (workout.status === 'active' || workout.status === 'completed' || workout.status === 'cancelled')
    && typeof workout.startedAt === 'string'
    && typeof workout.updatedAt === 'string'
    && typeof workout.notes === 'string'
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
    && Array.isArray(cycle.slots)
    && cycle.slots.length <= 100
    && cycle.slots.every((slot) => slot
      && typeof slot === 'object'
      && typeof slot.id === 'string'
      && (slot.type === 'rest'
        ? slot.routineId === null
        : slot.type === 'routine' && typeof slot.routineId === 'string'))
}

export async function handleWorkoutSyncRequest(
  request: Request,
  environment: WorkoutSyncEnvironment | undefined,
) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!environment) return json({ error: 'Cloudflare bindings unavailable' }, 503)

  if (!await hasValidSyncAuthentication(request, environment)) {
    return json({ error: 'Unauthorized' }, 401)
  }

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

  const snapshot = await syncTrainingData(environment.DB, {
    workouts,
    routines,
    trainingCycle,
    cursor: typeof body.cursor === 'number' ? body.cursor : null,
  })
  return json({ ...snapshot, syncedAt: new Date().toISOString() })
}
