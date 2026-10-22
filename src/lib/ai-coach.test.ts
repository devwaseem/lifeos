import { describe, expect, it } from 'vitest'
import type { RoutineTemplate, TrainingProfile, WorkoutSession } from './types'
import { buildCoachBriefContext } from './ai-coach'

const now = Date.parse('2026-10-22T12:00:00.000Z')
const routine: RoutineTemplate = {
  id: 'push-a',
  name: 'Push A',
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-20T08:00:00.000Z',
  deletedAt: null,
  exercises: [{
    id: 'routine-bench',
    exerciseId: 'bench-press',
    name: 'Barbell Bench Press',
    muscle: 'Chest',
    equipment: 'Barbell',
    notes: 'Private routine instruction',
    secondaryMuscles: [{ muscle: 'Triceps', fraction: 0.5 }],
    restSeconds: 120,
    setCount: 3,
    hasWarmupSet: true,
    progression: { minReps: 6, maxReps: 10, weightIncrement: 2.5 },
  }],
}

const workout: WorkoutSession = {
  id: 'workout-1',
  title: 'Push A',
  routineId: routine.id,
  cycleSlotId: null,
  status: 'completed',
  startedAt: '2026-10-21T08:00:00.000Z',
  completedAt: '2026-10-21T09:00:00.000Z',
  updatedAt: '2026-10-21T09:00:00.000Z',
  notes: 'Private workout note',
  sessionRpe: 8,
  checkIn: {
    recordedAt: '2026-10-21T07:55:00.000Z',
    sleepQuality: 4,
    energy: 4,
    soreness: 2,
    stress: 2,
    motivation: 5,
    painPresent: false,
    illnessPresent: false,
    notes: 'Private check-in note',
  },
  exercises: [{
    id: 'workout-bench',
    exerciseId: 'bench-press',
    name: 'Barbell Bench Press',
    muscle: 'Chest',
    equipment: 'Barbell',
    secondaryMuscles: [{ muscle: 'Triceps', fraction: 0.5 }],
    notes: 'Private exercise note',
    restSeconds: 120,
    restUntil: null,
    progression: { minReps: 6, maxReps: 10, weightIncrement: 2.5 },
    sets: [{
      id: 'set-1',
      weight: 80,
      reps: 8,
      rpe: 8,
      durationSeconds: null,
      distanceMeters: null,
      completed: true,
      completedAt: '2026-10-21T08:20:00.000Z',
      warmup: false,
      notes: 'Private set note',
    }],
  }],
}

const profile: TrainingProfile = {
  id: 'primary-training-profile',
  primaryGoal: 'strength',
  experienceLevel: 'intermediate',
  daysPerWeek: 4,
  sessionMinutes: 60,
  availableEquipment: ['Barbell'],
  excludedExercises: [],
  movementConstraints: 'Prefer neutral grips',
  updatedAt: '2026-10-20T09:00:00.000Z',
}

describe('AI coach context', () => {
  it('sends bounded deterministic facts without workout, exercise, set, or check-in notes', () => {
    const context = buildCoachBriefContext(routine, false, [workout], profile, now)
    const serialized = JSON.stringify(context)

    expect(context.plan).toMatchObject({ routineId: 'push-a', name: 'Push A', restDay: false })
    expect(context.plan.exercises[0]).toMatchObject({
      exerciseId: 'bench-press',
      workingSets: 3,
      latestExposure: { weight: 80, repetitions: 8, rpe: 8 },
    })
    expect(context.latestCheckIn).toMatchObject({ energy: 4, ageHours: 28.1 })
    expect(context.evidence.map((item) => item.id)).toContain('latest-check-in')
    expect(serialized).not.toContain('Private workout note')
    expect(serialized).not.toContain('Private check-in note')
    expect(serialized).not.toContain('Private exercise note')
    expect(serialized).not.toContain('Private set note')
    expect(serialized).not.toContain('Private routine instruction')
  })

  it('drops stale check-ins rather than presenting them as current context', () => {
    const context = buildCoachBriefContext(routine, false, [workout], profile, now + 2 * 24 * 60 * 60_000)

    expect(context.latestCheckIn).toBeNull()
    expect(context.evidence.map((item) => item.id)).not.toContain('latest-check-in')
  })
})
