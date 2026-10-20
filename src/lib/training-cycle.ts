import type { RoutineTemplate, TrainingCycle, TrainingCycleSlot, WorkoutSession } from '$lib/types'
import { getConsecutiveLoadDays } from '$lib/training-readiness'
import { newId } from '$lib/utils'

export const PRIMARY_TRAINING_CYCLE_ID = 'primary-training-cycle'

export function createTrainingCycle(timestamp = new Date().toISOString()): TrainingCycle {
  return {
    id: PRIMARY_TRAINING_CYCLE_ID,
    name: 'Training cycle',
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    currentIndex: 0,
    trainingDaysBeforeRest: 3,
    slots: [],
  }
}

export function normalizeTrainingCycle(cycle: TrainingCycle): TrainingCycle {
  const rawSlots = Array.isArray(cycle.slots) ? cycle.slots as unknown[] : []
  const candidates = rawSlots.map((value, index): TrainingCycleSlot | null => {
    if (!value || typeof value !== 'object') return null
    const slot = value as { id?: unknown; type?: unknown; routineId?: unknown }
    if (slot.type === 'rest' || typeof slot.routineId !== 'string' || !slot.routineId) return null
    if (slot.type !== undefined && slot.type !== 'routine') return null
    return {
      id: typeof slot.id === 'string' && slot.id ? slot.id : `${cycle.id}-slot-${index}`,
      routineId: slot.routineId,
    }
  })
  const slots = candidates.filter((slot): slot is TrainingCycleSlot => slot !== null)
  const requestedIndex = rawSlots.length > 0 && Number.isFinite(cycle.currentIndex)
    ? Math.min(rawSlots.length - 1, Math.max(0, Math.round(cycle.currentIndex)))
    : 0
  const nextRawSlot = rawSlots.length > 0
    ? Array.from({ length: rawSlots.length }, (_, offset) => candidates[(requestedIndex + offset) % rawSlots.length])
        .find((slot): slot is TrainingCycleSlot => slot !== null)
    : null
  const mappedIndex = nextRawSlot ? slots.findIndex((slot) => slot.id === nextRawSlot.id) : -1
  const currentIndex = mappedIndex >= 0 ? mappedIndex : 0
  const requestedTrainingDays = Number.isFinite(cycle.trainingDaysBeforeRest)
    ? Math.round(cycle.trainingDaysBeforeRest)
    : 3

  return {
    id: typeof cycle.id === 'string' && cycle.id ? cycle.id : PRIMARY_TRAINING_CYCLE_ID,
    name: typeof cycle.name === 'string' && cycle.name.trim() ? cycle.name.trim() : 'Training cycle',
    createdAt: typeof cycle.createdAt === 'string' ? cycle.createdAt : new Date(0).toISOString(),
    updatedAt: typeof cycle.updatedAt === 'string' ? cycle.updatedAt : new Date(0).toISOString(),
    deletedAt: typeof cycle.deletedAt === 'string' ? cycle.deletedAt : null,
    currentIndex,
    trainingDaysBeforeRest: Math.min(7, Math.max(1, requestedTrainingDays)),
    slots,
  }
}

export function getCurrentCycleSlot(cycle: TrainingCycle | null | undefined) {
  if (!cycle || cycle.deletedAt || cycle.slots.length === 0) return null
  return cycle.slots[cycle.currentIndex] ?? null
}

export function getCycleRoutine(
  cycle: TrainingCycle | null | undefined,
  routines: RoutineTemplate[],
) {
  const slot = getCurrentCycleSlot(cycle)
  if (!slot) return null
  return routines.find((routine) => routine.id === slot.routineId && !routine.deletedAt) ?? null
}

export function advanceTrainingCycle(
  cycle: TrainingCycle,
  expectedSlotId: string,
  timestamp = new Date().toISOString(),
) {
  const normalized = normalizeTrainingCycle(cycle)
  const current = getCurrentCycleSlot(normalized)
  if (!current || current.id !== expectedSlotId) return normalized
  return {
    ...normalized,
    currentIndex: (normalized.currentIndex + 1) % normalized.slots.length,
    updatedAt: timestamp,
  }
}

export function setTrainingCyclePosition(
  cycle: TrainingCycle,
  currentIndex: number,
  timestamp = new Date().toISOString(),
) {
  const normalized = normalizeTrainingCycle(cycle)
  if (normalized.slots.length === 0) return normalized
  const nextIndex = Math.min(normalized.slots.length - 1, Math.max(0, Math.round(currentIndex)))
  return { ...normalized, currentIndex: nextIndex, updatedAt: timestamp }
}

export function advanceTrainingCycleForWorkout(
  cycle: TrainingCycle,
  workout: WorkoutSession,
  timestamp = new Date().toISOString(),
) {
  if (workout.status !== 'completed' || !workout.cycleSlotId) return normalizeTrainingCycle(cycle)
  return advanceTrainingCycle(cycle, workout.cycleSlotId, timestamp)
}

export function removeRoutineFromTrainingCycle(
  cycle: TrainingCycle,
  routineId: string,
  timestamp = new Date().toISOString(),
) {
  const normalized = normalizeTrainingCycle(cycle)
  const currentSlot = getCurrentCycleSlot(normalized)
  const slots = normalized.slots.filter((slot) => slot.routineId !== routineId)
  if (slots.length === normalized.slots.length) return normalized
  const retainedCurrentIndex = currentSlot ? slots.findIndex((slot) => slot.id === currentSlot.id) : -1
  const currentIndex = slots.length === 0
    ? 0
    : retainedCurrentIndex >= 0
      ? retainedCurrentIndex
      : Math.min(normalized.currentIndex, slots.length - 1)
  return { ...normalized, slots, currentIndex, updatedAt: timestamp }
}

export function addRoutineCycleSlot(routineId: string): TrainingCycleSlot {
  return { id: newId(), routineId }
}

function localDateKey(timestamp: number) {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getTrainingCycleState(
  cycle: TrainingCycle | null | undefined,
  workouts: WorkoutSession[],
  now = Date.now(),
) {
  const normalized = cycle ? normalizeTrainingCycle(cycle) : null
  const consecutiveTrainingDays = getConsecutiveLoadDays(workouts, now)
  const today = localDateKey(now)
  const trainedToday = workouts.some((workout) => {
    if (workout.status !== 'completed') return false
    const timestamp = new Date(workout.completedAt ?? workout.startedAt).getTime()
    return Number.isFinite(timestamp) && localDateKey(timestamp) === today
  })
  const trainingDaysBeforeRest = normalized?.trainingDaysBeforeRest ?? 3

  return {
    consecutiveTrainingDays,
    restDue: Boolean(normalized && !normalized.deletedAt && normalized.slots.length > 0)
      && !trainedToday
      && consecutiveTrainingDays >= trainingDaysBeforeRest,
    trainingDaysBeforeRest,
  }
}
