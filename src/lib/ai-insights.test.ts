import { describe, expect, it } from 'vitest'
import { buildAiInsightContext, buildTrainingReportInsightContext, type AiInsightDataset, type AiInsightSelection } from './ai-insights'
import { buildTrainingProgressReport } from './training-progress-report'
import type { ExerciseDefinition, RoutineTemplate, TrainingProfile, WorkoutSession } from './types'

const exercises: ExerciseDefinition[] = [
  { id: 'bench', name: 'Barbell Bench Press', muscle: 'Chest', equipment: 'Barbell', secondaryMuscles: [{ muscle: 'Triceps', fraction: 0.5 }] },
  { id: 'db-bench', name: 'Dumbbell Bench Press', muscle: 'Chest', equipment: 'Dumbbells', secondaryMuscles: [{ muscle: 'Triceps', fraction: 0.5 }] },
  { id: 'machine-bench', name: 'Machine Chest Press', muscle: 'Chest', equipment: 'Machine', secondaryMuscles: [{ muscle: 'Triceps', fraction: 0.5 }] },
]

const routine: RoutineTemplate = {
  id: 'push',
  name: 'Push Day',
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-20T08:00:00.000Z',
  deletedAt: null,
  exercises: [{
    id: 'routine-bench',
    exerciseId: 'bench',
    name: 'Barbell Bench Press',
    muscle: 'Chest',
    equipment: 'Barbell',
    secondaryMuscles: [{ muscle: 'Triceps', fraction: 0.5 }],
    notes: 'private routine note',
    restSeconds: 120,
    setCount: 3,
    hasWarmupSet: true,
    progression: { minReps: 6, maxReps: 10, weightIncrement: 2.5, weightOptions: [] },
  }],
}

const workout: WorkoutSession = {
  id: 'workout-1',
  title: 'Push Day',
  routineId: routine.id,
  cycleSlotId: null,
  status: 'completed',
  startedAt: '2026-10-21T08:00:00.000Z',
  completedAt: '2026-10-21T09:00:00.000Z',
  updatedAt: '2026-10-21T09:00:00.000Z',
  notes: 'private workout note',
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
    notes: 'private check-in note',
  },
  exercises: [{
    id: 'workout-bench',
    exerciseId: 'bench',
    name: 'Barbell Bench Press',
    muscle: 'Chest',
    equipment: 'Barbell',
    secondaryMuscles: [{ muscle: 'Triceps', fraction: 0.5 }],
    notes: 'private exercise note',
    restSeconds: 120,
    restUntil: null,
    progression: { minReps: 6, maxReps: 10, weightIncrement: 2.5, weightOptions: [] },
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
      notes: 'private set note',
    }],
  }],
}

const profile: TrainingProfile = {
  id: 'primary-training-profile',
  primaryGoal: 'strength',
  experienceLevel: 'intermediate',
  daysPerWeek: 4,
  sessionMinutes: 60,
  availableEquipment: ['Barbell', 'Dumbbells'],
  excludedExercises: ['Machine Chest Press'],
  movementConstraints: 'Prefer neutral grips',
  updatedAt: '2026-10-20T09:00:00.000Z',
}

const dataset: AiInsightDataset = { workouts: [workout], routines: [routine], exercises, profile }
const now = Date.parse('2026-10-22T12:00:00.000Z')
const report = buildTrainingProgressReport({
  workouts: [workout],
  routines: [routine],
  trainingCycle: null,
  profile,
  latestCheckIn: workout.checkIn,
  freshness: { latestDeviceSyncAt: workout.updatedAt, latestWorkoutUpdatedAt: workout.updatedAt },
}, { now })

describe('AI insight contexts', () => {
  it('builds bounded, note-free evidence for every analysis mode', () => {
    const selections: AiInsightSelection[] = [
      { kind: 'natural-language', question: 'How has my training changed?' },
      { kind: 'workout-review', subjectId: workout.id },
      { kind: 'routine-review', subjectId: routine.id },
      { kind: 'exercise-substitutions', subjectId: 'bench' },
      { kind: 'progress-analysis', subjectId: 'bench' },
      { kind: 'training-report', subjectId: report.fingerprint, report },
    ]

    for (const selection of selections) {
      const context = buildAiInsightContext(selection, dataset, now)
      const serialized = JSON.stringify(context)
      expect(context.kind).toBe(selection.kind)
      expect(context.facts.length).toBeGreaterThan(0)
      expect(context.facts.length).toBeLessThanOrEqual(80)
      expect(serialized).not.toContain('private workout note')
      expect(serialized).not.toContain('private routine note')
      expect(serialized).not.toContain('private exercise note')
      expect(serialized).not.toContain('private set note')
      expect(serialized).not.toContain('private check-in note')
    }
  })

  it('answers natural-language questions from portfolio-level facts', () => {
    const context = buildAiInsightContext({ kind: 'natural-language', question: '  Why has bench stalled?  ' }, dataset, now)

    expect(context.question).toBe('Why has bench stalled?')
    expect(context.subject).toBeNull()
    expect(context.facts.map((item) => item.id)).toContain('systemic-load')
    expect(context.facts.some((item) => item.label === 'Barbell Bench Press trend')).toBe(true)
  })

  it('preserves typed report structure while keeping private notes out of the model context', () => {
    const context = buildTrainingReportInsightContext(report, now)

    expect(context.kind).toBe('training-report')
    expect(context.subject?.id).toBe(report.fingerprint)
    expect(context.report?.coverage.completedSessions).toBe(1)
    expect(context.report?.exerciseTrends[0]?.exerciseId).toBe('bench')
    expect(context.facts.map((item) => item.id)).toContain('report-summary')
    expect(JSON.stringify(context)).not.toContain('private')
  })

  it('limits substitution candidates to compatible saved constraints', () => {
    const context = buildAiInsightContext({ kind: 'exercise-substitutions', subjectId: 'bench' }, dataset, now)
    const serialized = JSON.stringify(context.facts)

    expect(serialized).toContain('Dumbbell Bench Press')
    expect(context.facts.some((item) => item.id.startsWith('candidate-') && item.label === 'Machine Chest Press')).toBe(false)
    expect(context.facts.find((item) => item.id === 'candidate-pool')?.value).toContain('1 candidates')
  })

  it('requires a subject for structured analysis modes', () => {
    expect(() => buildAiInsightContext({ kind: 'workout-review' }, dataset, now)).toThrow('Choose an item to analyze.')
  })
})
