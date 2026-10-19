import type { AppleHealthExportRecord } from '$lib/apple-health'
import type { ExerciseDefinition, ExerciseVideo, RoutineTemplate, SyncSettings, TrainingCycle, WorkoutSession } from '$lib/types'
import { normalizeExerciseDefinition } from '$lib/muscle-contributions'
import { normalizeRoutines } from '$lib/routines'
import { normalizeTrainingCycle } from '$lib/training-cycle'
import { normalizeWorkouts } from '$lib/workouts'

const DATABASE_NAME = 'lifeos-training'
const DATABASE_VERSION = 5
const WORKOUTS_STORE = 'workouts'
const ROUTINES_STORE = 'routines'
const TRAINING_CYCLE_STORE = 'training-cycle'
const CUSTOM_EXERCISES_STORE = 'custom-exercises'
const EXERCISE_VIDEOS_STORE = 'exercise-videos'
const META_STORE = 'meta'
const SETTINGS_KEY = 'sync-settings'
const APPLE_HEALTH_EXPORTS_KEY = 'apple-health-exports'

interface MetaRecord<T> {
  key: string
  value: T
}

interface StoredSyncSettings extends Partial<SyncSettings> {
  apiUrl?: unknown
  token?: unknown
}

let databasePromise: Promise<IDBDatabase> | null = null

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  const { promise, resolve, reject } = Promise.withResolvers<T>()
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
  return promise
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  const { promise, resolve, reject } = Promise.withResolvers<void>()
  transaction.oncomplete = () => resolve()
  transaction.onerror = () => reject(transaction.error)
  transaction.onabort = () => reject(transaction.error)
  return promise
}

function openDatabase() {
  if (databasePromise) return databasePromise

  const { promise, resolve, reject } = Promise.withResolvers<IDBDatabase>()
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
  request.onupgradeneeded = () => {
    const database = request.result
    if (!database.objectStoreNames.contains(WORKOUTS_STORE)) {
      database.createObjectStore(WORKOUTS_STORE, { keyPath: 'id' })
    }
    if (!database.objectStoreNames.contains(ROUTINES_STORE)) {
      database.createObjectStore(ROUTINES_STORE, { keyPath: 'id' })
    }
    if (!database.objectStoreNames.contains(TRAINING_CYCLE_STORE)) {
      database.createObjectStore(TRAINING_CYCLE_STORE, { keyPath: 'id' })
    }
    if (!database.objectStoreNames.contains(CUSTOM_EXERCISES_STORE)) {
      database.createObjectStore(CUSTOM_EXERCISES_STORE, { keyPath: 'id' })
    }
    if (!database.objectStoreNames.contains(EXERCISE_VIDEOS_STORE)) {
      database.createObjectStore(EXERCISE_VIDEOS_STORE, { keyPath: 'id' })
    }
    if (!database.objectStoreNames.contains(META_STORE)) {
      database.createObjectStore(META_STORE, { keyPath: 'key' })
    }
  }
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
  databasePromise = promise
  return databasePromise
}

export async function getWorkouts() {
  const database = await openDatabase()
  const transaction = database.transaction(WORKOUTS_STORE, 'readonly')
  const workouts = await requestResult(transaction.objectStore(WORKOUTS_STORE).getAll() as IDBRequest<WorkoutSession[]>)
  await transactionComplete(transaction)
  return normalizeWorkouts(workouts).sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

export async function saveWorkout(workout: WorkoutSession) {
  const database = await openDatabase()
  const transaction = database.transaction(WORKOUTS_STORE, 'readwrite')
  transaction.objectStore(WORKOUTS_STORE).put(workout)
  await transactionComplete(transaction)
}


export async function replaceWorkouts(workouts: WorkoutSession[]) {
  const database = await openDatabase()
  const transaction = database.transaction(WORKOUTS_STORE, 'readwrite')
  const store = transaction.objectStore(WORKOUTS_STORE)
  store.clear()
  workouts.forEach((workout) => store.put(workout))
  await transactionComplete(transaction)
}

export async function getRoutines() {
  const database = await openDatabase()
  const transaction = database.transaction(ROUTINES_STORE, 'readonly')
  const routines = await requestResult(transaction.objectStore(ROUTINES_STORE).getAll() as IDBRequest<RoutineTemplate[]>)
  await transactionComplete(transaction)
  return normalizeRoutines(routines)
}

export async function saveRoutine(routine: RoutineTemplate) {
  const database = await openDatabase()
  const transaction = database.transaction(ROUTINES_STORE, 'readwrite')
  transaction.objectStore(ROUTINES_STORE).put(routine)
  await transactionComplete(transaction)
}

export async function replaceRoutines(routines: RoutineTemplate[]) {
  const database = await openDatabase()
  const transaction = database.transaction(ROUTINES_STORE, 'readwrite')
  const store = transaction.objectStore(ROUTINES_STORE)
  store.clear()
  routines.forEach((routine) => store.put(routine))
  await transactionComplete(transaction)
}
export async function getTrainingCycle() {
  const database = await openDatabase()
  const transaction = database.transaction(TRAINING_CYCLE_STORE, 'readonly')
  const cycle = await requestResult(
    transaction.objectStore(TRAINING_CYCLE_STORE).get('primary-training-cycle') as IDBRequest<TrainingCycle | undefined>,
  )
  await transactionComplete(transaction)
  return cycle ? normalizeTrainingCycle(cycle) : null
}

export async function saveTrainingCycle(cycle: TrainingCycle) {
  const database = await openDatabase()
  const transaction = database.transaction(TRAINING_CYCLE_STORE, 'readwrite')
  transaction.objectStore(TRAINING_CYCLE_STORE).put(cycle)
  await transactionComplete(transaction)
}

export async function replaceTrainingCycle(cycle: TrainingCycle | null) {
  const database = await openDatabase()
  const transaction = database.transaction(TRAINING_CYCLE_STORE, 'readwrite')
  const store = transaction.objectStore(TRAINING_CYCLE_STORE)
  store.clear()
  if (cycle) store.put(cycle)
  await transactionComplete(transaction)
}

export async function getCustomExercises() {
  const database = await openDatabase()
  const transaction = database.transaction(CUSTOM_EXERCISES_STORE, 'readonly')
  const exercises = await requestResult(
    transaction.objectStore(CUSTOM_EXERCISES_STORE).getAll() as IDBRequest<ExerciseDefinition[]>,
  )
  await transactionComplete(transaction)
  return exercises.map(normalizeExerciseDefinition).sort((a, b) => a.name.localeCompare(b.name))
}

export async function saveCustomExercise(exercise: ExerciseDefinition) {
  const database = await openDatabase()
  const transaction = database.transaction(CUSTOM_EXERCISES_STORE, 'readwrite')
  transaction.objectStore(CUSTOM_EXERCISES_STORE).put(normalizeExerciseDefinition(exercise))
  await transactionComplete(transaction)
}

export async function getExerciseVideos() {
  const database = await openDatabase()
  const transaction = database.transaction(EXERCISE_VIDEOS_STORE, 'readonly')
  const videos = await requestResult(
    transaction.objectStore(EXERCISE_VIDEOS_STORE).getAll() as IDBRequest<ExerciseVideo[]>,
  )
  await transactionComplete(transaction)
  return videos.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function saveExerciseVideo(video: ExerciseVideo) {
  const database = await openDatabase()
  const transaction = database.transaction(EXERCISE_VIDEOS_STORE, 'readwrite')
  transaction.objectStore(EXERCISE_VIDEOS_STORE).put(video)
  await transactionComplete(transaction)
}

export async function deleteExerciseVideo(videoId: string) {
  const database = await openDatabase()
  const transaction = database.transaction(EXERCISE_VIDEOS_STORE, 'readwrite')
  transaction.objectStore(EXERCISE_VIDEOS_STORE).delete(videoId)
  await transactionComplete(transaction)
}

export async function getSyncSettings(): Promise<SyncSettings> {
  const database = await openDatabase()
  const transaction = database.transaction(META_STORE, 'readonly')
  const record = await requestResult(
    transaction.objectStore(META_STORE).get(SETTINGS_KEY) as IDBRequest<MetaRecord<StoredSyncSettings> | undefined>,
  )
  await transactionComplete(transaction)
  const settings = {
    deviceId: record?.value.deviceId || crypto.randomUUID(),
    lastSyncedAt: record?.value.lastSyncedAt ?? null,
    syncCursor: typeof record?.value.syncCursor === 'number' ? record.value.syncCursor : null,
  }
  if (record && ('apiUrl' in record.value || 'token' in record.value)) await saveSyncSettings(settings)
  return settings
}

export async function saveSyncSettings(settings: SyncSettings) {
  const database = await openDatabase()
  const transaction = database.transaction(META_STORE, 'readwrite')
  transaction.objectStore(META_STORE).put({ key: SETTINGS_KEY, value: settings } satisfies MetaRecord<SyncSettings>)
  await transactionComplete(transaction)
}

function normalizeAppleHealthExports(value: unknown): AppleHealthExportRecord[] {
  if (!Array.isArray(value)) return []
  return value.filter((record): record is AppleHealthExportRecord => {
    if (!record || typeof record !== 'object') return false
    const candidate = record as Partial<AppleHealthExportRecord>
    return typeof candidate.workoutId === 'string'
      && typeof candidate.workoutUpdatedAt === 'string'
      && (candidate.status === 'pending' || candidate.status === 'exporting' || candidate.status === 'exported')
      && (candidate.attemptId === null || typeof candidate.attemptId === 'string')
      && (candidate.attemptedAt === null || typeof candidate.attemptedAt === 'string')
      && (candidate.exportedAt === null || typeof candidate.exportedAt === 'string')
      && (candidate.lastError === null || typeof candidate.lastError === 'string')
  })
}

export async function getAppleHealthExports() {
  const database = await openDatabase()
  const transaction = database.transaction(META_STORE, 'readonly')
  const record = await requestResult(
    transaction.objectStore(META_STORE).get(APPLE_HEALTH_EXPORTS_KEY) as IDBRequest<MetaRecord<unknown> | undefined>,
  )
  await transactionComplete(transaction)
  return normalizeAppleHealthExports(record?.value)
}

export async function saveAppleHealthExport(exportRecord: AppleHealthExportRecord) {
  const exports = await getAppleHealthExports()
  const nextExports = [exportRecord, ...exports.filter((record) => record.workoutId !== exportRecord.workoutId)]
  const database = await openDatabase()
  const transaction = database.transaction(META_STORE, 'readwrite')
  transaction.objectStore(META_STORE).put({ key: APPLE_HEALTH_EXPORTS_KEY, value: nextExports } satisfies MetaRecord<AppleHealthExportRecord[]>)
  await transactionComplete(transaction)
}

export async function deleteAppleHealthExport(workoutId: string) {
  const exports = await getAppleHealthExports()
  const database = await openDatabase()
  const transaction = database.transaction(META_STORE, 'readwrite')
  transaction.objectStore(META_STORE).put({
    key: APPLE_HEALTH_EXPORTS_KEY,
    value: exports.filter((record) => record.workoutId !== workoutId),
  } satisfies MetaRecord<AppleHealthExportRecord[]>)
  await transactionComplete(transaction)
}
