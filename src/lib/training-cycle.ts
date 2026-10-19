import type { RoutineTemplate, TrainingCycle, TrainingCycleSlot, WorkoutSession } from '$lib/types'
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
    slots: [],
  }
}

export function normalizeTrainingCycle(cycle: TrainingCycle): TrainingCycle {
  const rawSlots = Array.isArray(cycle.slots) ? cycle.slots : []
  const slots = rawSlots.flatMap((slot, index): TrainingCycleSlot[] => {
    if (!slot || typeof slot !== 'object') return []
    const id = typeof slot.id === 'string' && slot.id ? slot.id : `${cycle.id}-slot-${index}`
    if (slot.type === 'rest') return [{ id, type: 'rest', routineId: null }]
    if (slot.type === 'routine' && typeof slot.routineId === 'string' && slot.routineId) {
      return [{ id, type: 'routine', routineId: slot.routineId }]
    }
    return []
  })
  const requestedIndex = Number.isFinite(cycle.currentIndex) ? Math.round(cycle.currentIndex) : 0
  const currentIndex = slots.length > 0 ? Math.min(slots.length - 1, Math.max(0, requestedIndex)) : 0

  return {
    id: typeof cycle.id === 'string' && cycle.id ? cycle.id : PRIMARY_TRAINING_CYCLE_ID,
    name: typeof cycle.name === 'string' && cycle.name.trim() ? cycle.name.trim() : 'Training cycle',
    createdAt: typeof cycle.createdAt === 'string' ? cycle.createdAt : new Date(0).toISOString(),
    updatedAt: typeof cycle.updatedAt === 'string' ? cycle.updatedAt : new Date(0).toISOString(),
    deletedAt: typeof cycle.deletedAt === 'string' ? cycle.deletedAt : null,
    currentIndex,
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
  if (!slot || slot.type !== 'routine') return null
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
  const slots = normalized.slots.filter((slot) => slot.type !== 'routine' || slot.routineId !== routineId)
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
  return { id: newId(), type: 'routine', routineId }
}

export function addRestCycleSlot(): TrainingCycleSlot {
  return { id: newId(), type: 'rest', routineId: null }
}
