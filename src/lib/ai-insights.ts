import type { AiProviderOption, AiSettings } from '$lib/ai-coach'
import { getExerciseHistory } from '$lib/exercise-insights'
import { getMuscleContributions } from '$lib/muscle-contributions'
import type { TrainingProgressReport } from '$lib/training-progress-report'
import {
  estimateSetE1rm,
  getExerciseStrengthProfile,
  getFatigueSignal,
  getMuscleDose,
  getSystemicLoad,
} from '$lib/training-science'
import type { ExerciseDefinition, RoutineTemplate, TrainingProfile, WorkoutExercise, WorkoutSession } from '$lib/types'

export type AiInsightKind = 'natural-language' | 'workout-review' | 'routine-review' | 'exercise-substitutions' | 'progress-analysis' | 'training-report'
export type AiInsightState = 'idle' | 'loading' | 'success' | 'error'

export interface AiInsightFact {
  id: string
  label: string
  value: string
}

export interface AiTrainingReportContext {
  schemaVersion: number
  period: TrainingProgressReport['period']
  freshness: TrainingProgressReport['freshness']
  verdict: TrainingProgressReport['verdict']
  coverage: TrainingProgressReport['coverage']
  workload: Pick<TrainingProgressReport['workload'], 'recentLoad' | 'weeklyAverageLoad' | 'ratio' | 'context' | 'confidence'>
  performanceSignal: TrainingProgressReport['performanceSignal']
  latestCheckIn: TrainingProgressReport['latestCheckIn']
  exerciseTrends: Array<{
    evidenceId: string
    exerciseId: string
    name: string
    muscle: string
    status: TrainingProgressReport['exerciseTrends'][number]['status']
    profile: TrainingProgressReport['exerciseTrends'][number]['profile']
    latestExposure: TrainingProgressReport['exerciseTrends'][number]['latestExposure']
  }>
  routineReviews: Array<{
    evidenceId: string
    id: string
    name: string
    workingSetsPerExposure: number
    muscleSetEquivalents: Array<{ muscle: string; sets: number }>
    excludedExercises: Array<{ exerciseId: string; name: string }>
    targetReadiness: number
    requiresUserReview: boolean
    changeRecommendationsBlocked: boolean
  }>
  muscleDose: TrainingProgressReport['muscleDose']
  limitations: string[]
}

export interface AiInsightContext {
  kind: AiInsightKind
  asOf: string
  question: string | null
  subject: { id: string; label: string } | null
  facts: AiInsightFact[]
  report?: AiTrainingReportContext
}

export interface AiInsight {
  kind: AiInsightKind
  headline: string
  summary: string
  findings: Array<{ title: string; detail: string; evidence: AiInsightFact[] }>
  actions: string[]
  evidence: AiInsightFact[]
  caveat: string
  generatedAt: string
  contextAsOf: string
  subject: AiInsightContext['subject']
  provider: AiProviderOption
}

export interface AiInsightDataset {
  workouts: WorkoutSession[]
  routines: RoutineTemplate[]
  exercises: ExerciseDefinition[]
  profile: TrainingProfile | null
}

export interface AiInsightSelection {
  kind: AiInsightKind
  question?: string
  subjectId?: string
  report?: TrainingProgressReport
}

const DAY_MS = 24 * 60 * 60 * 1_000

function safeId(value: string) {
  return value.replace(/[^A-Za-z0-9:_-]/g, '-').slice(0, 80)
}

function bounded(value: string) {
  return value.length <= 750 ? value : `${value.slice(0, 747)}…`
}

function fact(id: string, label: string, value: string): AiInsightFact {
  return { id: safeId(id), label, value: bounded(value) }
}

function timestamp(workout: WorkoutSession) {
  return workout.completedAt ?? workout.startedAt
}

function completedWorkouts(workouts: WorkoutSession[]) {
  return workouts
    .filter((workout) => workout.status === 'completed')
    .sort((left, right) => timestamp(right).localeCompare(timestamp(left)))
}

function workingSets(exercise: WorkoutExercise) {
  return exercise.sets.filter((set) => set.completed && !set.warmup)
}

function setDescription(exercise: WorkoutExercise) {
  const descriptions = workingSets(exercise).slice(0, 8).map((set) => {
    const parts: string[] = []
    if (set.weight !== null || set.reps !== null) parts.push(`${set.weight ?? 'bodyweight'} × ${set.reps ?? 'unlogged reps'}`)
    if (set.durationSeconds !== null) parts.push(`${set.durationSeconds}s`)
    if (set.distanceMeters !== null) parts.push(`${set.distanceMeters}m`)
    if (set.rpe !== null) parts.push(`RPE ${set.rpe}`)
    return parts.join(' · ') || 'completed set without load details'
  })
  return descriptions.length > 0 ? descriptions.join('; ') : 'no completed working sets'
}

function profileFact(profile: TrainingProfile | null) {
  if (!profile) return fact('training-profile', 'Training profile', 'No training profile has been saved.')
  return fact(
    'training-profile',
    'Training profile',
    `Goal: ${profile.primaryGoal}; experience: ${profile.experienceLevel}; target frequency: ${profile.daysPerWeek} days/week; session target: ${profile.sessionMinutes} minutes; equipment: ${profile.availableEquipment.join(', ') || 'not specified'}; excluded exercises: ${profile.excludedExercises.join(', ') || 'none'}; movement constraints: ${profile.movementConstraints || 'none recorded'}.`,
  )
}

function naturalLanguageFacts(dataset: AiInsightDataset, now: number) {
  const completed = completedWorkouts(dataset.workouts)
  const last7Days = completed.filter((workout) => Date.parse(timestamp(workout)) >= now - 7 * DAY_MS)
  const last28Days = completed.filter((workout) => Date.parse(timestamp(workout)) >= now - 28 * DAY_MS)
  const load = getSystemicLoad(dataset.workouts, now)
  const fatigue = getFatigueSignal(dataset.workouts)
  const dose = getMuscleDose(dataset.workouts, now).slice(0, 12)
  const facts: AiInsightFact[] = [
    fact('dataset-summary', 'Available training data', `${completed.length} completed workouts, ${dataset.routines.filter((routine) => !routine.deletedAt).length} active routines, ${last7Days.length} sessions in the last 7 days, and ${last28Days.length} sessions in the last 28 days.`),
    profileFact(dataset.profile),
    fact('systemic-load', 'Recent systemic load', `Context: ${load.context}; seven-day load: ${load.recentLoad ?? 'unavailable'}; prior weekly average: ${load.weeklyAverageLoad ?? 'unavailable'}; ratio: ${load.ratio ?? 'unavailable'}; confidence: ${load.confidence}.`),
    fact('performance-signal', 'Performance signal', `${fatigue.title}. ${fatigue.recommendation} Status: ${fatigue.status}; affected exercises: ${fatigue.affectedExercises.join(', ') || 'none'}; confidence: ${fatigue.confidence}.`),
    fact('muscle-dose', 'Seven-day muscle dose', dose.length > 0 ? dose.map((item) => `${item.muscle}: ${item.hardSetEquivalents} hard-set equivalents (${item.status}, ${item.confidence} confidence)`).join('; ') : 'No recent hard-set dose is available.'),
  ]

  completed.slice(0, 10).forEach((workout, index) => {
    const exercises = workout.exercises.map((exercise) => `${exercise.name}: ${workingSets(exercise).length} working sets`).join(', ')
    facts.push(fact(`recent-workout-${index + 1}`, `Recent workout · ${workout.title}`, `${timestamp(workout).slice(0, 10)}; session RPE: ${workout.sessionRpe ?? 'unlogged'}; ${exercises || 'no completed exercises'}.`))
  })

  const seenExercises = new Set<string>()
  for (const workout of completed) {
    for (const exercise of workout.exercises) {
      if (seenExercises.has(exercise.exerciseId) || seenExercises.size >= 16) continue
      seenExercises.add(exercise.exerciseId)
      const strength = getExerciseStrengthProfile(exercise.exerciseId, dataset.workouts)
      facts.push(fact(`exercise-trend-${seenExercises.size}`, `${exercise.name} trend`, `Current estimated 1RM: ${strength.currentEstimated1Rm ?? 'unavailable'}; best: ${strength.bestEstimated1Rm ?? 'unavailable'}; recent trend: ${strength.trendPercent === null ? 'insufficient comparison data' : `${strength.trendPercent}%`}; comparable sessions: ${strength.comparableSessions}; confidence: ${strength.confidence}.`))
    }
  }

  dataset.routines.filter((routine) => !routine.deletedAt).slice(0, 8).forEach((routine, index) => {
    facts.push(fact(`routine-${index + 1}`, `Routine · ${routine.name}`, `${routine.exercises.length} exercises and ${routine.exercises.reduce((sum, exercise) => sum + exercise.setCount, 0)} planned working sets: ${routine.exercises.map((exercise) => `${exercise.name} ${exercise.setCount}×${exercise.progression.minReps}-${exercise.progression.maxReps}`).join(', ')}.`))
  })
  return facts
}

function workoutReviewContext(workout: WorkoutSession, dataset: AiInsightDataset, now: number): AiInsightContext {
  const completedAt = timestamp(workout)
  const durationMinutes = workout.completedAt
    ? Math.max(0, Math.round((Date.parse(workout.completedAt) - Date.parse(workout.startedAt)) / 60_000))
    : null
  const facts: AiInsightFact[] = [
    fact('workout-summary', 'Workout summary', `${workout.title} on ${completedAt.slice(0, 10)}; duration: ${durationMinutes ?? 'unavailable'} minutes; session RPE: ${workout.sessionRpe ?? 'unlogged'}; ${workout.exercises.reduce((sum, exercise) => sum + workingSets(exercise).length, 0)} completed working sets.`),
  ]
  if (workout.checkIn) {
    facts.push(fact('pre-workout-check-in', 'Pre-workout check-in', `Sleep ${workout.checkIn.sleepQuality}/5; energy ${workout.checkIn.energy}/5; soreness ${workout.checkIn.soreness}/5; stress ${workout.checkIn.stress}/5; motivation ${workout.checkIn.motivation}/5; pain recorded: ${workout.checkIn.painPresent ? 'yes' : 'no'}; illness recorded: ${workout.checkIn.illnessPresent ? 'yes' : 'no'}.`))
  }
  workout.exercises.slice(0, 30).forEach((exercise, index) => {
    const historyBeforeWorkout = dataset.workouts.filter((candidate) => candidate.id !== workout.id && timestamp(candidate) < completedAt)
    const previous = getExerciseStrengthProfile(exercise.exerciseId, historyBeforeWorkout)
    const estimates = workingSets(exercise).map(estimateSetE1rm).filter((value): value is number => value !== null)
    facts.push(fact(`workout-exercise-${index + 1}`, exercise.name, `${setDescription(exercise)}. Best session estimated 1RM: ${estimates.length > 0 ? Math.max(...estimates) : 'unavailable'}; previous best estimated 1RM: ${previous.bestEstimated1Rm ?? 'unavailable'}; previous comparable sessions: ${previous.comparableSessions}; comparison confidence: ${previous.confidence}.`))
  })
  facts.push(profileFact(dataset.profile))
  return { kind: 'workout-review', asOf: new Date(now).toISOString(), question: null, subject: { id: workout.id, label: workout.title }, facts }
}

function routineReviewContext(routine: RoutineTemplate, dataset: AiInsightDataset, now: number): AiInsightContext {
  const muscleSets = new Map<string, number>()
  for (const exercise of routine.exercises) {
    for (const contribution of getMuscleContributions(exercise)) {
      muscleSets.set(contribution.muscle, (muscleSets.get(contribution.muscle) ?? 0) + exercise.setCount * contribution.fraction)
    }
  }
  const load = getSystemicLoad(dataset.workouts, now)
  const fatigue = getFatigueSignal(dataset.workouts)
  const facts: AiInsightFact[] = [
    fact('routine-summary', 'Routine summary', `${routine.name}; ${routine.exercises.length} exercises; ${routine.exercises.reduce((sum, exercise) => sum + exercise.setCount, 0)} planned working sets; last updated ${routine.updatedAt.slice(0, 10)}.`),
    profileFact(dataset.profile),
    fact('routine-muscle-distribution', 'Planned muscle-set distribution', [...muscleSets].sort((left, right) => right[1] - left[1]).map(([muscle, sets]) => `${muscle}: ${Math.round(sets * 10) / 10}`).join('; ') || 'No exercises are assigned.'),
    fact('routine-load-context', 'Current load context', `Systemic load is ${load.context} with ${load.confidence} confidence. Performance signal: ${fatigue.status}; ${fatigue.title}; affected exercises: ${fatigue.affectedExercises.join(', ') || 'none'}.`),
  ]
  routine.exercises.slice(0, 40).forEach((exercise, index) => {
    const strength = getExerciseStrengthProfile(exercise.exerciseId, dataset.workouts)
    facts.push(fact(`routine-exercise-${index + 1}`, exercise.name, `${exercise.setCount} working sets at ${exercise.progression.minReps}-${exercise.progression.maxReps} reps; ${exercise.equipment}; primary muscle ${exercise.muscle}; strength trend ${strength.trendPercent === null ? 'unavailable' : `${strength.trendPercent}%`}; ${strength.comparableSessions} comparable sessions; ${strength.confidence} confidence.`))
  })
  return { kind: 'routine-review', asOf: new Date(now).toISOString(), question: null, subject: { id: routine.id, label: routine.name }, facts }
}

function substitutionContext(source: ExerciseDefinition, dataset: AiInsightDataset, now: number): AiInsightContext {
  const available = new Set((dataset.profile?.availableEquipment ?? []).map((item) => item.trim().toLocaleLowerCase()))
  const excluded = new Set((dataset.profile?.excludedExercises ?? []).map((item) => item.trim().toLocaleLowerCase()))
  const candidates = dataset.exercises
    .filter((candidate) => candidate.id !== source.id && candidate.muscle.toLocaleLowerCase() === source.muscle.toLocaleLowerCase())
    .filter((candidate) => !excluded.has(candidate.name.trim().toLocaleLowerCase()))
    .filter((candidate) => available.size === 0 || candidate.equipment.toLocaleLowerCase() === 'bodyweight' || available.has(candidate.equipment.trim().toLocaleLowerCase()))
    .sort((left, right) => {
      const leftEquipmentMatch = left.equipment === source.equipment ? 0 : 1
      const rightEquipmentMatch = right.equipment === source.equipment ? 0 : 1
      return leftEquipmentMatch - rightEquipmentMatch || left.name.localeCompare(right.name)
    })
    .slice(0, 30)
  const facts: AiInsightFact[] = [
    fact('source-exercise', 'Exercise to replace', `${source.name}; primary muscle ${source.muscle}; equipment ${source.equipment}; secondary muscles ${source.secondaryMuscles.map((item) => `${item.muscle} ${item.fraction}`).join(', ') || 'none recorded'}.`),
    profileFact(dataset.profile),
    fact('candidate-pool', 'Eligible candidate pool', `${candidates.length} candidates match the primary muscle and saved equipment/exclusion constraints. Rank only candidates listed below.`),
  ]
  candidates.forEach((candidate, index) => {
    const history = getExerciseHistory(dataset.workouts, candidate.id)
    facts.push(fact(`candidate-${index + 1}`, candidate.name, `Candidate ID: ${candidate.id}; primary muscle ${candidate.muscle}; equipment ${candidate.equipment}; secondary muscles ${candidate.secondaryMuscles.map((item) => item.muscle).join(', ') || 'none recorded'}; logged exposures: ${history.length}.`))
  })
  return { kind: 'exercise-substitutions', asOf: new Date(now).toISOString(), question: null, subject: { id: source.id, label: source.name }, facts }
}

function progressContext(exercise: ExerciseDefinition, dataset: AiInsightDataset, now: number): AiInsightContext {
  const history = getExerciseHistory(dataset.workouts, exercise.id)
  const strength = getExerciseStrengthProfile(exercise.id, dataset.workouts)
  const fatigue = getFatigueSignal(dataset.workouts)
  const facts: AiInsightFact[] = [
    fact('exercise-summary', 'Exercise', `${exercise.name}; primary muscle ${exercise.muscle}; equipment ${exercise.equipment}; ${history.length} logged exposures.`),
    fact('strength-profile', 'Strength trend', `Current estimated 1RM: ${strength.currentEstimated1Rm ?? 'unavailable'}; best estimated 1RM: ${strength.bestEstimated1Rm ?? 'unavailable'}; recent trend: ${strength.trendPercent === null ? 'insufficient comparison data' : `${strength.trendPercent}%`}; comparable sessions: ${strength.comparableSessions}; RPE coverage: ${Math.round(strength.rpeCoverage * 100)}%; confidence: ${strength.confidence}.`),
    fact('fatigue-context', 'Cross-exercise performance context', `${fatigue.title}. Status: ${fatigue.status}; affected exercises: ${fatigue.affectedExercises.join(', ') || 'none'}; performance change: ${fatigue.performanceChangePercent ?? 'unavailable'}%; RPE change: ${fatigue.rpeChange ?? 'unavailable'}; confidence: ${fatigue.confidence}.`),
  ]
  history.slice(0, 12).forEach((entry, index) => {
    const estimates = entry.sets.map(estimateSetE1rm).filter((value): value is number => value !== null)
    facts.push(fact(`exposure-${index + 1}`, `Exposure · ${(entry.workout.completedAt ?? entry.workout.startedAt).slice(0, 10)}`, `${setDescription(entry.exercise)}. Best estimated 1RM: ${estimates.length > 0 ? Math.max(...estimates) : 'unavailable'}; session RPE: ${entry.workout.sessionRpe ?? 'unlogged'}.`))
  })
  return { kind: 'progress-analysis', asOf: new Date(now).toISOString(), question: null, subject: { id: exercise.id, label: exercise.name }, facts }
}

export function buildTrainingReportInsightContext(report: TrainingProgressReport, now = Date.now()): AiInsightContext {
  const facts: AiInsightFact[] = [
    fact('report-summary', 'Report coverage', `${report.coverage.completedSessions} completed sessions in ${report.period.days} days; ${report.coverage.exercisesObserved} exercises observed; ${report.coverage.comparableExercises} exercises with comparable trends; ${report.coverage.routinesAnalyzed} routines reviewed. Overall signal: ${report.verdict.status}; confidence: ${report.verdict.confidence}.`),
    fact('report-workload', 'Workload and performance', `Seven-day load: ${report.workload.recentLoad ?? 'unavailable'}; prior weekly average: ${report.workload.weeklyAverageLoad ?? 'unavailable'}; ratio: ${report.workload.ratio ?? 'unavailable'}; context: ${report.workload.context}; performance signal: ${report.performanceSignal.status}; ${report.performanceSignal.title}; confidence: ${report.performanceSignal.confidence}.`),
    fact('report-readiness', 'Training state', `Current routine: ${report.currentRoutine?.name ?? 'none'}; target readiness: ${report.trainingState.readiness.targetReadiness}%; consecutive training days: ${report.trainingState.readiness.consecutiveLoadDays}; recovery confidence: ${report.trainingState.readiness.recoveryConfidence.level}; recommendations blocked: ${report.trainingState.recommendationBlocked ? 'yes' : 'no'}.`),
  ]
  if (report.latestCheckIn) {
    facts.push(fact('report-check-in', 'Latest pre-workout check-in', `Sleep ${report.latestCheckIn.sleepQuality}/5; energy ${report.latestCheckIn.energy}/5; soreness ${report.latestCheckIn.soreness}/5; stress ${report.latestCheckIn.stress}/5; motivation ${report.latestCheckIn.motivation}/5; pain recorded: ${report.latestCheckIn.painPresent ? 'yes' : 'no'}; illness recorded: ${report.latestCheckIn.illnessPresent ? 'yes' : 'no'}.`))
  }
  report.exerciseTrends.forEach((trend) => {
    facts.push(fact(trend.evidenceId, `${trend.name} progression`, `Status: ${trend.status}; current estimated 1RM: ${trend.profile.currentEstimated1Rm ?? 'unavailable'}; best: ${trend.profile.bestEstimated1Rm ?? 'unavailable'}; trend: ${trend.profile.trendPercent === null ? 'insufficient comparison data' : `${trend.profile.trendPercent}%`}; comparable sessions: ${trend.profile.comparableSessions}; confidence: ${trend.profile.confidence}; latest representative set: ${trend.latestExposure ? `${trend.latestExposure.weight ?? 'bodyweight'} × ${trend.latestExposure.repetitions ?? 'unlogged reps'} at RPE ${trend.latestExposure.rpe ?? 'unlogged'}` : 'unavailable'}.`))
  })
  report.routineReviews.forEach((review) => {
    facts.push(fact(review.evidenceId, `Routine · ${review.routine.name}`, `${review.workingSetsPerExposure} planned working sets; target readiness ${review.targetReadiness}%; muscle distribution: ${review.muscleSetEquivalents.map((item) => `${item.muscle} ${item.sets}`).join(', ') || 'unavailable'}; excluded exercise conflicts: ${review.excludedExercises.map((item) => item.name).join(', ') || 'none'}; requires review: ${review.requiresUserReview ? 'yes' : 'no'}.`))
  })
  report.muscleDose.slice(0, 12).forEach((dose) => {
    facts.push(fact(`muscle-dose:${safeId(dose.muscle)}`, `${dose.muscle} dose`, `${dose.hardSetEquivalents} recent hard-set equivalents; prior weekly baseline: ${dose.baselineWeeklySets ?? 'unavailable'}; ratio: ${dose.ratio ?? 'unavailable'}; status: ${dose.status}; confidence: ${dose.confidence}.`))
  })

  const structured: AiTrainingReportContext = {
    schemaVersion: report.schemaVersion,
    period: report.period,
    freshness: report.freshness,
    verdict: report.verdict,
    coverage: report.coverage,
    workload: {
      recentLoad: report.workload.recentLoad,
      weeklyAverageLoad: report.workload.weeklyAverageLoad,
      ratio: report.workload.ratio,
      context: report.workload.context,
      confidence: report.workload.confidence,
    },
    performanceSignal: report.performanceSignal,
    latestCheckIn: report.latestCheckIn,
    exerciseTrends: report.exerciseTrends.map((trend) => ({
      evidenceId: trend.evidenceId,
      exerciseId: trend.exerciseId,
      name: trend.name,
      muscle: trend.muscle,
      status: trend.status,
      profile: trend.profile,
      latestExposure: trend.latestExposure,
    })),
    routineReviews: report.routineReviews.map((review) => ({
      evidenceId: review.evidenceId,
      id: review.routine.id,
      name: review.routine.name,
      workingSetsPerExposure: review.workingSetsPerExposure,
      muscleSetEquivalents: review.muscleSetEquivalents,
      excludedExercises: review.excludedExercises,
      targetReadiness: review.targetReadiness,
      requiresUserReview: review.requiresUserReview,
      changeRecommendationsBlocked: review.changeRecommendationsBlocked,
    })),
    muscleDose: report.muscleDose,
    limitations: report.limitations,
  }
  return {
    kind: 'training-report',
    asOf: new Date(now).toISOString(),
    question: null,
    subject: { id: report.fingerprint, label: `${report.period.days}-day training report` },
    facts,
    report: structured,
  }
}

export function buildAiInsightContext(selection: AiInsightSelection, dataset: AiInsightDataset, now = Date.now()): AiInsightContext {
  if (selection.kind === 'training-report') {
    if (!selection.report) throw new Error('Build the training report before generating its narrative.')
    return buildTrainingReportInsightContext(selection.report, now)
  }
  if (selection.kind === 'natural-language') {
    const question = selection.question?.trim() ?? ''
    if (question.length < 3) throw new Error('Enter a training question with at least three characters.')
    return { kind: selection.kind, asOf: new Date(now).toISOString(), question, subject: null, facts: naturalLanguageFacts(dataset, now) }
  }
  if (!selection.subjectId) throw new Error('Choose an item to analyze.')
  if (selection.kind === 'workout-review') {
    const workout = dataset.workouts.find((candidate) => candidate.id === selection.subjectId && candidate.status === 'completed')
    if (!workout) throw new Error('Choose a completed workout to review.')
    return workoutReviewContext(workout, dataset, now)
  }
  if (selection.kind === 'routine-review') {
    const routine = dataset.routines.find((candidate) => candidate.id === selection.subjectId && !candidate.deletedAt)
    if (!routine) throw new Error('Choose an active routine to review.')
    return routineReviewContext(routine, dataset, now)
  }
  const exercise = dataset.exercises.find((candidate) => candidate.id === selection.subjectId)
  if (!exercise) throw new Error('Choose an exercise to analyze.')
  return selection.kind === 'exercise-substitutions'
    ? substitutionContext(exercise, dataset, now)
    : progressContext(exercise, dataset, now)
}

function requestHeaders() {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (import.meta.env.DEV) headers.set('Authorization', 'Bearer lifeos-local-dev')
  return headers
}

async function responseError(response: Response) {
  if (response.status === 401) return 'Your Cloudflare Access session has expired. Reload to sign in again.'
  if (response.status === 429) return 'The selected model is busy or rate-limited. Try again shortly.'
  if (response.headers.get('Content-Type')?.includes('application/json')) {
    const body = await response.json().catch(() => null) as { error?: unknown } | null
    if (typeof body?.error === 'string') return body.error
  }
  return 'LifeOS could not complete this analysis.'
}

export async function generateAiInsight(settings: AiSettings, context: AiInsightContext): Promise<AiInsight> {
  if (!navigator.onLine) throw new Error('You are offline. AI analysis requires a connection.')
  const response = await fetch('/api/insights', {
    method: 'POST',
    headers: requestHeaders(),
    body: JSON.stringify({
      provider: settings.provider,
      models: settings.models,
      credentials: {
        'workers-ai': { apiKey: settings.apiKeys['workers-ai'], accountId: settings.cloudflareAccountId || undefined },
        gemini: { apiKey: settings.apiKeys.gemini },
        anthropic: { apiKey: settings.apiKeys.anthropic },
      },
      context,
    }),
  })
  if (!response.ok) throw new Error(await responseError(response))
  return response.json() as Promise<AiInsight>
}

export const aiInsightCaveat = 'Training analysis only. LifeOS does not diagnose injury, illness, recovery, or provide medical clearance.'
