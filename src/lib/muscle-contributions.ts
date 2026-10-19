import type { ExerciseDefinition, MuscleContribution } from '$lib/types'

const DEFAULT_SECONDARY_CONTRIBUTION = 0.5
const ANATOMICAL_MUSCLES = new Set([
  'Chest',
  'Back',
  'Shoulders',
  'Quadriceps',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Biceps',
  'Triceps',
  'Forearms',
  'Core',
  'Adductors',
  'Abductors',
])


function contribution(muscle: string, fraction: number): MuscleContribution {
  return { muscle, fraction }
}

export function normalizeSecondaryMuscles(value: unknown, primaryMuscle: string): MuscleContribution[] {
  if (!Array.isArray(value)) return []
  const normalized = new Map<string, number>()
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const candidate = item as Partial<MuscleContribution>
    if (typeof candidate.muscle !== 'string' || candidate.muscle === primaryMuscle) continue
    if (typeof candidate.fraction !== 'number' || !Number.isFinite(candidate.fraction)) continue
    normalized.set(candidate.muscle, Math.min(1, Math.max(0.1, Math.round(candidate.fraction * 100) / 100)))
  }
  return [...normalized].map(([muscle, fraction]) => ({ muscle, fraction }))
}

export function getDefaultSecondaryMuscles(exercise: Pick<ExerciseDefinition, 'name' | 'muscle'>): MuscleContribution[] {
  const name = exercise.name.toLowerCase()
  const includes = (...terms: string[]) => terms.some((term) => name.includes(term))

  if (exercise.muscle === 'Chest') {
    if (includes('pullover')) return [contribution('Back', 0.5), contribution('Triceps', 0.25)]
    if (includes('fly', 'crossover', 'pec deck')) return [contribution('Shoulders', 0.25)]
    return [contribution('Triceps', 0.5), contribution('Shoulders', 0.4)]
  }
  if (exercise.muscle === 'Back') {
    if (includes('deadlift', 'good morning')) return [contribution('Glutes', 0.5), contribution('Hamstrings', 0.5), contribution('Forearms', 0.25)]
    if (includes('shrug')) return [contribution('Shoulders', 0.4), contribution('Forearms', 0.25)]
    return [contribution('Biceps', 0.5), contribution('Forearms', 0.25), contribution('Shoulders', 0.25)]
  }
  if (exercise.muscle === 'Shoulders') {
    if (includes('press', 'handstand')) return [contribution('Triceps', 0.5)]
    if (includes('rear', 'face pull', 'reverse fly')) return [contribution('Back', 0.35)]
    if (includes('upright row')) return [contribution('Back', 0.25), contribution('Biceps', 0.25)]
    return []
  }
  if (exercise.muscle === 'Quadriceps') {
    if (includes('extension', 'sissy squat')) return []
    return [contribution('Glutes', 0.5), contribution('Hamstrings', 0.25)]
  }
  if (exercise.muscle === 'Hamstrings') {
    if (includes('curl', 'nordic', 'glute-ham')) return [contribution('Glutes', 0.25)]
    return [contribution('Glutes', 0.5), contribution('Back', 0.25)]
  }
  if (exercise.muscle === 'Glutes') {
    if (includes('abduction', 'kickback')) return [contribution('Abductors', 0.25)]
    return [contribution('Hamstrings', 0.25)]
  }
  if (exercise.muscle === 'Biceps') return [contribution('Forearms', 0.25)]
  if (exercise.muscle === 'Adductors') return [contribution('Glutes', 0.25)]
  if (exercise.muscle === 'Abductors') return [contribution('Glutes', 0.25)]
  if (exercise.muscle === 'Full body') {
    if (includes('thruster', 'wall ball')) return [contribution('Quadriceps', 0.75), contribution('Shoulders', 0.75), contribution('Glutes', 0.5), contribution('Triceps', 0.4)]
    if (includes('deadlift')) return [contribution('Glutes', 0.75), contribution('Hamstrings', 0.75), contribution('Back', 0.5), contribution('Forearms', 0.25)]
    if (includes('carry', 'farmer')) return [contribution('Forearms', 0.75), contribution('Core', 0.5), contribution('Shoulders', 0.25)]
    if (includes('swing', 'clean', 'snatch')) return [contribution('Glutes', 0.75), contribution('Hamstrings', 0.5), contribution('Shoulders', 0.5), contribution('Core', 0.4)]
    if (includes('burpee', 'devil press')) return [contribution('Chest', 0.5), contribution('Quadriceps', 0.5), contribution('Shoulders', 0.25), contribution('Triceps', 0.25)]
    if (includes('sled push')) return [contribution('Quadriceps', 0.75), contribution('Glutes', 0.5), contribution('Calves', 0.25)]
    if (includes('sled pull')) return [contribution('Back', 0.5), contribution('Quadriceps', 0.5), contribution('Glutes', 0.5)]
    return [contribution('Core', DEFAULT_SECONDARY_CONTRIBUTION)]
  }
  return []
}

export function resolveSecondaryMuscles(
  exercise: Pick<ExerciseDefinition, 'name' | 'muscle'> & { secondaryMuscles?: unknown },
): MuscleContribution[] {
  return Array.isArray(exercise.secondaryMuscles)
    ? normalizeSecondaryMuscles(exercise.secondaryMuscles, exercise.muscle)
    : getDefaultSecondaryMuscles(exercise)
}

export function normalizeExerciseDefinition(exercise: ExerciseDefinition): ExerciseDefinition {
  return { ...exercise, secondaryMuscles: resolveSecondaryMuscles(exercise) }
}

export function withDefaultMuscleContributions(exercise: Omit<ExerciseDefinition, 'secondaryMuscles'>): ExerciseDefinition {
  return { ...exercise, secondaryMuscles: getDefaultSecondaryMuscles(exercise) }
}

export function getMuscleContributions(exercise: Pick<ExerciseDefinition, 'muscle' | 'secondaryMuscles'>): MuscleContribution[] {
  return [
    { muscle: exercise.muscle, fraction: 1 },
    ...normalizeSecondaryMuscles(exercise.secondaryMuscles, exercise.muscle),
  ].filter((contribution) => ANATOMICAL_MUSCLES.has(contribution.muscle))
}
