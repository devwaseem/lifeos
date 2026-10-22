import { equipmentOptions } from '$lib/data/exercise-options'
import { normalizeWeightOptions } from '$lib/progression'
import type { EquipmentSettings } from '$lib/types'

export function normalizeEquipmentSettings(value: unknown): EquipmentSettings {
  const candidate = value && typeof value === 'object' ? value as Partial<EquipmentSettings> : {}
  const source = candidate.weightOptionsByEquipment && typeof candidate.weightOptionsByEquipment === 'object'
    ? candidate.weightOptionsByEquipment
    : {}
  const weightOptionsByEquipment: Record<string, number[]> = {}
  for (const equipment of equipmentOptions) {
    const weights = normalizeWeightOptions(source[equipment])
    if (weights.length > 0) weightOptionsByEquipment[equipment] = weights
  }
  return {
    id: 'primary-equipment-settings',
    weightOptionsByEquipment,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date(0).toISOString(),
  }
}

export function isEquipmentSettings(value: unknown): value is EquipmentSettings {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<EquipmentSettings>
  if (candidate.id !== 'primary-equipment-settings'
    || typeof candidate.updatedAt !== 'string'
    || !candidate.weightOptionsByEquipment
    || typeof candidate.weightOptionsByEquipment !== 'object'
    || Array.isArray(candidate.weightOptionsByEquipment)) return false
  const entries = Object.entries(candidate.weightOptionsByEquipment)
  if (entries.length > equipmentOptions.length) return false
  return entries.every(([equipment, weights]) => {
    if (!equipmentOptions.includes(equipment as typeof equipmentOptions[number]) || !Array.isArray(weights)) return false
    const normalized = normalizeWeightOptions(weights)
    return normalized.length === weights.length
      && normalized.every((weight, index) => weight === weights[index])
  })
}

export function getEquipmentWeightOptions(settings: EquipmentSettings | null | undefined, equipment: string) {
  return settings?.weightOptionsByEquipment[equipment] ?? []
}
