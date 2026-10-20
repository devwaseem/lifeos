import type {
  MuscleContribution,
  ProgressionRule,
  RoutineExercise,
  RoutineTemplate,
  TrainingCycle,
  TrainingCycleSlot,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from '../types'

const MAX_BINDINGS_PER_STATEMENT = 90

type SqlValue = string | number | null

type EntityType = 'workout' | 'routine' | 'training_cycle'

interface VersionRow {
  id: string
  updated_at: string
}

interface WorkoutRow extends VersionRow {
  title: string
  routine_id: string | null
  cycle_slot_id: string | null
  status: WorkoutSession['status']
  started_at: string
  completed_at: string | null
  notes: string
  session_rpe: number | null
}

interface WorkoutExerciseRow {
  id: string
  workout_id: string
  exercise_id: string
  name: string
  primary_muscle: string
  equipment: string
  notes: string
  rest_seconds: number
  rest_until: string | null
  progression_min_reps: number
  progression_max_reps: number
  progression_weight_increment: number | null
  progression_max_rpe: number
}

interface SecondaryMuscleRow {
  parent_id: string
  muscle: string
  fraction: number
}

interface WorkoutSetRow {
  workout_id: string
  workout_exercise_id: string
  id: string
  weight: number | null
  repetitions: number | null
  rpe: number | null
  duration_seconds: number | null
  distance_meters: number | null
  completed: number
  completed_at: string | null
  warmup: number
  notes: string
}

interface RoutineRow extends VersionRow {
  name: string
  created_at: string
  deleted_at: string | null
}

interface RoutineExerciseRow {
  id: string
  routine_id: string
  exercise_id: string
  name: string
  primary_muscle: string
  equipment: string
  notes: string
  rest_seconds: number
  set_count: number
  has_warmup_set: number
  progression_min_reps: number
  progression_max_reps: number
  progression_weight_increment: number | null
  progression_max_rpe: number
}

interface TrainingCycleRow extends VersionRow {
  name: string
  created_at: string
  deleted_at: string | null
  current_index: number
}

interface TrainingCycleSlotRow {
  training_cycle_id: string
  id: string
  type: TrainingCycleSlot['type']
  routine_id: string | null
}

export interface TrainingSyncInput {
  workouts: WorkoutSession[]
  routines: RoutineTemplate[]
  trainingCycle: TrainingCycle | null
  cursor: number | null
}

export interface TrainingSyncSnapshot {
  workouts: WorkoutSession[]
  routines: RoutineTemplate[]
  trainingCycle: TrainingCycle | null
  cursor: number
}

function progression(row: {
  progression_min_reps: number
  progression_max_reps: number
  progression_weight_increment: number | null
  progression_max_rpe: number
}): ProgressionRule {
  return {
    minReps: row.progression_min_reps,
    maxReps: row.progression_max_reps,
    weightIncrement: row.progression_weight_increment,
    maxRpe: row.progression_max_rpe,
  }
}

function groupBy<T, K>(rows: T[], key: (row: T) => K) {
  const groups = new Map<K, T[]>()
  for (const row of rows) {
    const groupKey = key(row)
    const group = groups.get(groupKey)
    if (group) group.push(row)
    else groups.set(groupKey, [row])
  }
  return groups
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size))
  return result
}

function conditionalInsertStatements(
  database: D1Database,
  table: string,
  columns: string[],
  rows: SqlValue[][],
  condition: string,
  conditionValues: SqlValue[],
) {
  if (rows.length === 0) return []
  const rowsPerStatement = Math.max(1, Math.floor((MAX_BINDINGS_PER_STATEMENT - conditionValues.length) / columns.length))
  return chunks(rows, rowsPerStatement).map((rowChunk) => {
    const placeholders = rowChunk.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ')
    const sql = `
      WITH incoming (${columns.join(', ')}) AS (VALUES ${placeholders})
      INSERT INTO ${table} (${columns.join(', ')})
      SELECT ${columns.join(', ')} FROM incoming
      WHERE ${condition}
    `
    return database.prepare(sql).bind(...rowChunk.flat(), ...conditionValues)
  })
}

async function versions(database: D1Database, table: 'workouts' | 'routines' | 'training_cycles') {
  const result = await database.prepare(`SELECT id, updated_at FROM ${table}`).all<VersionRow>()
  return new Map(result.results.map((row) => [row.id, row.updated_at]))
}

function newer<T extends { id: string; updatedAt: string }>(records: T[], stored: Map<string, string>) {
  return records.filter((record) => !stored.has(record.id) || record.updatedAt > stored.get(record.id)!)
}

function changeStatement(database: D1Database, type: EntityType, id: string, table: string, token: string) {
  return database.prepare(`
    INSERT INTO sync_changes (entity_type, entity_id)
    SELECT ?, ? WHERE EXISTS (SELECT 1 FROM ${table} WHERE id = ? AND sync_token = ?)
  `).bind(type, id, id, token)
}

async function storeWorkout(database: D1Database, workout: WorkoutSession) {
  const token = crypto.randomUUID()
  const statements: D1PreparedStatement[] = [database.prepare(`
    INSERT INTO workouts (
      id, title, routine_id, cycle_slot_id, status, started_at, completed_at,
      updated_at, notes, session_rpe, sync_token
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      routine_id = excluded.routine_id,
      cycle_slot_id = excluded.cycle_slot_id,
      status = excluded.status,
      started_at = excluded.started_at,
      completed_at = excluded.completed_at,
      updated_at = excluded.updated_at,
      notes = excluded.notes,
      session_rpe = excluded.session_rpe,
      sync_token = excluded.sync_token
    WHERE excluded.updated_at > workouts.updated_at
  `).bind(
    workout.id,
    workout.title,
    workout.routineId,
    workout.cycleSlotId,
    workout.status,
    workout.startedAt,
    workout.completedAt,
    workout.updatedAt,
    workout.notes,
    workout.sessionRpe,
    token,
  )]
  const condition = 'EXISTS (SELECT 1 FROM workouts WHERE id = ? AND sync_token = ?)'
  const conditionValues = [workout.id, token]
  statements.push(database.prepare(`
    DELETE FROM workout_exercises
    WHERE workout_id = ? AND ${condition}
  `).bind(workout.id, ...conditionValues))
  statements.push(...conditionalInsertStatements(database, 'workout_exercises', [
    'id', 'workout_id', 'position', 'exercise_id', 'name', 'primary_muscle', 'equipment', 'notes',
    'rest_seconds', 'rest_until', 'progression_min_reps', 'progression_max_reps',
    'progression_weight_increment', 'progression_max_rpe',
  ], workout.exercises.map((exercise, position) => [
    exercise.id,
    workout.id,
    position,
    exercise.exerciseId,
    exercise.name,
    exercise.muscle,
    exercise.equipment,
    exercise.notes,
    exercise.restSeconds,
    exercise.restUntil,
    exercise.progression.minReps,
    exercise.progression.maxReps,
    exercise.progression.weightIncrement,
    exercise.progression.maxRpe,
  ]), condition, conditionValues))
  statements.push(...conditionalInsertStatements(database, 'workout_exercise_secondary_muscles', [
    'workout_exercise_id', 'position', 'muscle', 'fraction',
  ], workout.exercises.flatMap((exercise) => exercise.secondaryMuscles.map((secondary, position) => [
    exercise.id,
    position,
    secondary.muscle,
    secondary.fraction,
  ])), condition, conditionValues))
  statements.push(...conditionalInsertStatements(database, 'workout_sets', [
    'id', 'workout_exercise_id', 'position', 'weight', 'repetitions', 'rpe', 'duration_seconds',
    'distance_meters', 'completed', 'completed_at', 'warmup', 'notes',
  ], workout.exercises.flatMap((exercise) => exercise.sets.map((workoutSet, position) => [
    workoutSet.id,
    exercise.id,
    position,
    workoutSet.weight,
    workoutSet.reps,
    workoutSet.rpe,
    workoutSet.durationSeconds,
    workoutSet.distanceMeters,
    workoutSet.completed ? 1 : 0,
    workoutSet.completedAt,
    workoutSet.warmup ? 1 : 0,
    workoutSet.notes,
  ])), condition, conditionValues))
  statements.push(changeStatement(database, 'workout', workout.id, 'workouts', token))
  await database.batch(statements)
}

async function storeRoutine(database: D1Database, routine: RoutineTemplate) {
  const token = crypto.randomUUID()
  const statements: D1PreparedStatement[] = [database.prepare(`
    INSERT INTO routines (id, name, created_at, updated_at, deleted_at, sync_token)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at,
      sync_token = excluded.sync_token
    WHERE excluded.updated_at > routines.updated_at
  `).bind(routine.id, routine.name, routine.createdAt, routine.updatedAt, routine.deletedAt, token)]
  const condition = 'EXISTS (SELECT 1 FROM routines WHERE id = ? AND sync_token = ?)'
  const conditionValues = [routine.id, token]
  statements.push(database.prepare(`
    DELETE FROM routine_exercises
    WHERE routine_id = ? AND ${condition}
  `).bind(routine.id, ...conditionValues))
  statements.push(...conditionalInsertStatements(database, 'routine_exercises', [
    'id', 'routine_id', 'position', 'exercise_id', 'name', 'primary_muscle', 'equipment', 'notes',
    'rest_seconds', 'set_count', 'has_warmup_set', 'progression_min_reps', 'progression_max_reps',
    'progression_weight_increment', 'progression_max_rpe',
  ], routine.exercises.map((exercise, position) => [
    exercise.id,
    routine.id,
    position,
    exercise.exerciseId,
    exercise.name,
    exercise.muscle,
    exercise.equipment,
    exercise.notes,
    exercise.restSeconds,
    exercise.setCount,
    exercise.hasWarmupSet ? 1 : 0,
    exercise.progression.minReps,
    exercise.progression.maxReps,
    exercise.progression.weightIncrement,
    exercise.progression.maxRpe,
  ]), condition, conditionValues))
  statements.push(...conditionalInsertStatements(database, 'routine_exercise_secondary_muscles', [
    'routine_exercise_id', 'position', 'muscle', 'fraction',
  ], routine.exercises.flatMap((exercise) => exercise.secondaryMuscles.map((secondary, position) => [
    exercise.id,
    position,
    secondary.muscle,
    secondary.fraction,
  ])), condition, conditionValues))
  statements.push(changeStatement(database, 'routine', routine.id, 'routines', token))
  await database.batch(statements)
}

async function storeTrainingCycle(database: D1Database, cycle: TrainingCycle) {
  const token = crypto.randomUUID()
  const condition = 'EXISTS (SELECT 1 FROM training_cycles WHERE id = ? AND sync_token = ?)'
  const conditionValues = [cycle.id, token]
  const statements: D1PreparedStatement[] = [database.prepare(`
    INSERT INTO training_cycles (id, name, created_at, updated_at, deleted_at, current_index, sync_token)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at,
      current_index = excluded.current_index,
      sync_token = excluded.sync_token
    WHERE excluded.updated_at > training_cycles.updated_at
  `).bind(cycle.id, cycle.name, cycle.createdAt, cycle.updatedAt, cycle.deletedAt, cycle.currentIndex, token)]
  statements.push(database.prepare(`
    DELETE FROM training_cycle_slots
    WHERE training_cycle_id = ? AND ${condition}
  `).bind(cycle.id, ...conditionValues))
  statements.push(...conditionalInsertStatements(database, 'training_cycle_slots', [
    'id', 'training_cycle_id', 'position', 'type', 'routine_id',
  ], cycle.slots.map((slot, position) => [slot.id, cycle.id, position, slot.type, slot.routineId]), condition, conditionValues))
  statements.push(changeStatement(database, 'training_cycle', cycle.id, 'training_cycles', token))
  await database.batch(statements)
}

async function changedRows<T>(
  database: D1Database,
  table: string,
  type: EntityType,
  columns: string,
  cursor: number | null,
  upperRevision: number,
  limit: number,
) {
  if (cursor === null) {
    return (await database.prepare(`SELECT ${columns} FROM ${table} ORDER BY updated_at DESC LIMIT ?`).bind(limit).all<T>()).results
  }
  if (cursor >= upperRevision) return []
  return (await database.prepare(`
    SELECT ${columns} FROM ${table} entity
    WHERE EXISTS (
      SELECT 1 FROM sync_changes change
      WHERE change.entity_type = ?
        AND change.entity_id = entity.id
        AND change.revision > ?
        AND change.revision <= ?
    )
    ORDER BY updated_at DESC
    LIMIT ?
  `).bind(type, cursor, upperRevision, limit).all<T>()).results
}

async function rowsForParents<T>(
  database: D1Database,
  parentIds: string[],
  query: (placeholders: string) => string,
) {
  const rows: T[] = []
  for (const idChunk of chunks(parentIds, MAX_BINDINGS_PER_STATEMENT)) {
    const result = await database.prepare(query(idChunk.map(() => '?').join(', '))).bind(...idChunk).all<T>()
    rows.push(...result.results)
  }
  return rows
}

function secondaryMuscles(rows: SecondaryMuscleRow[] | undefined): MuscleContribution[] {
  return rows?.map((row) => ({ muscle: row.muscle, fraction: row.fraction })) ?? []
}

async function loadWorkouts(database: D1Database, cursor: number | null, upperRevision: number) {
  const workouts = await changedRows<WorkoutRow>(database, 'workouts', 'workout', `
    id, title, routine_id, cycle_slot_id, status, started_at, completed_at,
    updated_at, notes, session_rpe
  `, cursor, upperRevision, 500)
  const workoutIds = workouts.map((workout) => workout.id)
  const exercises = await rowsForParents<WorkoutExerciseRow>(database, workoutIds, (placeholders) => `
    SELECT id, workout_id, exercise_id, name, primary_muscle, equipment, notes, rest_seconds,
      rest_until, progression_min_reps, progression_max_reps, progression_weight_increment,
      progression_max_rpe
    FROM workout_exercises
    WHERE workout_id IN (${placeholders})
    ORDER BY workout_id, position
  `)
  const muscles = await rowsForParents<SecondaryMuscleRow>(database, workoutIds, (placeholders) => `
    SELECT secondary.workout_exercise_id AS parent_id, secondary.muscle, secondary.fraction
    FROM workout_exercise_secondary_muscles secondary
    JOIN workout_exercises exercise ON exercise.id = secondary.workout_exercise_id
    WHERE exercise.workout_id IN (${placeholders})
    ORDER BY exercise.workout_id, exercise.position, secondary.position
  `)
  const sets = await rowsForParents<WorkoutSetRow>(database, workoutIds, (placeholders) => `
    SELECT exercise.workout_id, workout_set.workout_exercise_id, workout_set.id,
      workout_set.weight, workout_set.repetitions, workout_set.rpe, workout_set.duration_seconds,
      workout_set.distance_meters, workout_set.completed, workout_set.completed_at,
      workout_set.warmup, workout_set.notes
    FROM workout_sets workout_set
    JOIN workout_exercises exercise ON exercise.id = workout_set.workout_exercise_id
    WHERE exercise.workout_id IN (${placeholders})
    ORDER BY exercise.workout_id, exercise.position, workout_set.position
  `)
  const musclesByExercise = groupBy(muscles, (row) => row.parent_id)
  const setsByExercise = groupBy(sets, (row) => row.workout_exercise_id)
  const exercisesByWorkout = groupBy(exercises, (row) => row.workout_id)

  return workouts.map((workout): WorkoutSession => ({
    id: workout.id,
    title: workout.title,
    routineId: workout.routine_id,
    cycleSlotId: workout.cycle_slot_id,
    status: workout.status,
    startedAt: workout.started_at,
    completedAt: workout.completed_at,
    updatedAt: workout.updated_at,
    notes: workout.notes,
    sessionRpe: workout.session_rpe,
    exercises: (exercisesByWorkout.get(workout.id) ?? []).map((exercise): WorkoutExercise => ({
      id: exercise.id,
      exerciseId: exercise.exercise_id,
      name: exercise.name,
      muscle: exercise.primary_muscle,
      equipment: exercise.equipment,
      secondaryMuscles: secondaryMuscles(musclesByExercise.get(exercise.id)),
      notes: exercise.notes,
      restSeconds: exercise.rest_seconds,
      restUntil: exercise.rest_until,
      progression: progression(exercise),
      sets: (setsByExercise.get(exercise.id) ?? []).map((workoutSet): WorkoutSet => ({
        id: workoutSet.id,
        weight: workoutSet.weight,
        reps: workoutSet.repetitions,
        rpe: workoutSet.rpe,
        durationSeconds: workoutSet.duration_seconds,
        distanceMeters: workoutSet.distance_meters,
        completed: workoutSet.completed === 1,
        completedAt: workoutSet.completed_at,
        warmup: workoutSet.warmup === 1,
        notes: workoutSet.notes,
      })),
    })),
  }))
}

async function loadRoutines(database: D1Database, cursor: number | null, upperRevision: number) {
  const routines = await changedRows<RoutineRow>(database, 'routines', 'routine', `
    id, name, created_at, updated_at, deleted_at
  `, cursor, upperRevision, 200)
  const routineIds = routines.map((routine) => routine.id)
  const exercises = await rowsForParents<RoutineExerciseRow>(database, routineIds, (placeholders) => `
    SELECT id, routine_id, exercise_id, name, primary_muscle, equipment, notes, rest_seconds,
      set_count, has_warmup_set, progression_min_reps, progression_max_reps, progression_weight_increment,
      progression_max_rpe
    FROM routine_exercises
    WHERE routine_id IN (${placeholders})
    ORDER BY routine_id, position
  `)
  const muscles = await rowsForParents<SecondaryMuscleRow>(database, routineIds, (placeholders) => `
    SELECT secondary.routine_exercise_id AS parent_id, secondary.muscle, secondary.fraction
    FROM routine_exercise_secondary_muscles secondary
    JOIN routine_exercises exercise ON exercise.id = secondary.routine_exercise_id
    WHERE exercise.routine_id IN (${placeholders})
    ORDER BY exercise.routine_id, exercise.position, secondary.position
  `)
  const exercisesByRoutine = groupBy(exercises, (row) => row.routine_id)
  const musclesByExercise = groupBy(muscles, (row) => row.parent_id)

  return routines.map((routine): RoutineTemplate => ({
    id: routine.id,
    name: routine.name,
    createdAt: routine.created_at,
    updatedAt: routine.updated_at,
    deletedAt: routine.deleted_at,
    exercises: (exercisesByRoutine.get(routine.id) ?? []).map((exercise): RoutineExercise => ({
      id: exercise.id,
      exerciseId: exercise.exercise_id,
      name: exercise.name,
      muscle: exercise.primary_muscle,
      equipment: exercise.equipment,
      notes: exercise.notes,
      secondaryMuscles: secondaryMuscles(musclesByExercise.get(exercise.id)),
      restSeconds: exercise.rest_seconds,
      setCount: exercise.set_count,
      hasWarmupSet: exercise.has_warmup_set === 1,
      progression: progression(exercise),
    })),
  }))
}

async function loadTrainingCycle(database: D1Database, cursor: number | null, upperRevision: number) {
  const cycles = await changedRows<TrainingCycleRow>(database, 'training_cycles', 'training_cycle', `
    id, name, created_at, updated_at, deleted_at, current_index
  `, cursor, upperRevision, 1)
  const slots = await rowsForParents<TrainingCycleSlotRow>(database, cycles.map((cycle) => cycle.id), (placeholders) => `
    SELECT training_cycle_id, id, type, routine_id
    FROM training_cycle_slots
    WHERE training_cycle_id IN (${placeholders})
    ORDER BY training_cycle_id, position
  `)
  const slotsByCycle = groupBy(slots, (slot) => slot.training_cycle_id)
  const cycle = cycles[0]
  if (!cycle) return null
  return {
    id: cycle.id,
    name: cycle.name,
    createdAt: cycle.created_at,
    updatedAt: cycle.updated_at,
    deletedAt: cycle.deleted_at,
    currentIndex: cycle.current_index,
    slots: (slotsByCycle.get(cycle.id) ?? []).map((slot): TrainingCycleSlot => slot.type === 'rest'
      ? { id: slot.id, type: 'rest', routineId: null }
      : { id: slot.id, type: 'routine', routineId: slot.routine_id! }),
  }
}

export async function syncTrainingData(database: D1Database, input: TrainingSyncInput): Promise<TrainingSyncSnapshot> {
  const [workoutVersions, routineVersions, cycleVersions] = await Promise.all([
    versions(database, 'workouts'),
    versions(database, 'routines'),
    versions(database, 'training_cycles'),
  ])
  for (const workout of newer(input.workouts, workoutVersions)) await storeWorkout(database, workout)
  for (const routine of newer(input.routines, routineVersions)) await storeRoutine(database, routine)
  if (input.trainingCycle && newer([input.trainingCycle], cycleVersions).length > 0) {
    await storeTrainingCycle(database, input.trainingCycle)
  }

  const revision = await database.prepare('SELECT COALESCE(MAX(revision), 0) AS revision FROM sync_changes').first<number>('revision') ?? 0
  const [workouts, routines, trainingCycle] = await Promise.all([
    loadWorkouts(database, input.cursor, revision),
    loadRoutines(database, input.cursor, revision),
    loadTrainingCycle(database, input.cursor, revision),
  ])
  return { workouts, routines, trainingCycle, cursor: revision }
}
