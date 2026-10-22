export type WorkoutStatus = 'active' | 'completed' | 'cancelled'

export interface WorkoutSet {
  id: string
  weight: number | null
  reps: number | null
  rpe: number | null
  durationSeconds: number | null
  distanceMeters: number | null
  completed: boolean
  completedAt: string | null
  warmup: boolean
  notes: string
}

export interface MuscleContribution {
  muscle: string
  fraction: number
}

export interface ProgressionRule {
  minReps: number
  maxReps: number
  weightIncrement: number | null
}

export interface WorkoutExercise {
  id: string
  exerciseId: string
  name: string
  muscle: string
  equipment: string
  secondaryMuscles: MuscleContribution[]
  notes: string
  restSeconds: number
  restUntil: string | null
  progression: ProgressionRule
  sets: WorkoutSet[]
}

export interface RoutineExercise {
  id: string
  exerciseId: string
  name: string
  muscle: string
  equipment: string
  notes: string
  secondaryMuscles: MuscleContribution[]
  restSeconds: number
  setCount: number
  hasWarmupSet: boolean
  progression: ProgressionRule
}

export interface RoutineTemplate {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  exercises: RoutineExercise[]
}

export interface TrainingCycleSlot {
  id: string
  routineId: string
}

export interface TrainingCycle {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  currentIndex: number
  trainingDaysBeforeRest: number
  slots: TrainingCycleSlot[]
}

export interface WorkoutCheckIn {
  recordedAt: string
  sleepQuality: number
  energy: number
  soreness: number
  stress: number
  motivation: number
  painPresent: boolean
  illnessPresent: boolean
  notes: string
}

export interface WorkoutSession {
  id: string
  title: string
  routineId: string | null
  cycleSlotId: string | null
  status: WorkoutStatus
  startedAt: string
  completedAt: string | null
  updatedAt: string
  notes: string
  sessionRpe: number | null
  checkIn: WorkoutCheckIn | null
  exercises: WorkoutExercise[]
}

export type WorkoutFinishDisposition = 'routine' | 'update-routine' | 'new-routine' | 'one-off'

export interface WorkoutFinishDecision {
  notes: string
  sessionRpe: number
  disposition: WorkoutFinishDisposition
  routineName: string
}

export interface ExerciseDefinition {
  id: string
  name: string
  muscle: string
  equipment: string
  secondaryMuscles: MuscleContribution[]
  custom?: boolean
}

export interface ExerciseVideo {
  id: string
  exerciseId: string
  videoId: string
  sourceUrl: string
  createdAt: string
}

export interface SyncSettings {
  deviceId: string
  lastSyncedAt: string | null
  syncCursor: number | null
}

export type TrainingGoal = 'strength' | 'hypertrophy' | 'general-fitness' | 'conditioning'
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced'

export interface TrainingProfile {
  id: 'primary-training-profile'
  primaryGoal: TrainingGoal
  experienceLevel: ExperienceLevel
  daysPerWeek: number
  sessionMinutes: number
  availableEquipment: string[]
  excludedExercises: string[]
  movementConstraints: string
  updatedAt: string
}


export type AppView = 'today' | 'history' | 'workout-history' | 'more' | 'report' | 'routines' | 'exercises' | 'settings' | 'workout' | 'exercise'
