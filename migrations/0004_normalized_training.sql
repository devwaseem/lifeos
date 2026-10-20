DROP INDEX IF EXISTS workouts_updated_at_idx;
DROP INDEX IF EXISTS routines_updated_at_idx;
DROP INDEX IF EXISTS training_cycles_updated_at_idx;

ALTER TABLE workouts RENAME TO workouts_legacy;
ALTER TABLE routines RENAME TO routines_legacy;
ALTER TABLE training_cycles RENAME TO training_cycles_legacy;

CREATE TABLE workouts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  routine_id TEXT,
  cycle_slot_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'cancelled')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  notes TEXT NOT NULL,
  session_rpe REAL,
  sync_token TEXT NOT NULL
);

CREATE TABLE workout_exercises (
  id TEXT PRIMARY KEY,
  workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  exercise_id TEXT NOT NULL,
  name TEXT NOT NULL,
  primary_muscle TEXT NOT NULL,
  equipment TEXT NOT NULL,
  notes TEXT NOT NULL,
  rest_seconds INTEGER NOT NULL,
  rest_until TEXT,
  progression_min_reps INTEGER NOT NULL,
  progression_max_reps INTEGER NOT NULL,
  progression_weight_increment REAL,
  progression_max_rpe REAL NOT NULL,
  UNIQUE (workout_id, position)
);

CREATE TABLE workout_exercise_secondary_muscles (
  workout_exercise_id TEXT NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  muscle TEXT NOT NULL,
  fraction REAL NOT NULL,
  PRIMARY KEY (workout_exercise_id, position)
);

CREATE TABLE workout_sets (
  id TEXT PRIMARY KEY,
  workout_exercise_id TEXT NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  weight REAL,
  repetitions INTEGER,
  rpe REAL,
  duration_seconds INTEGER,
  distance_meters REAL,
  completed INTEGER NOT NULL CHECK (completed IN (0, 1)),
  completed_at TEXT,
  failure INTEGER NOT NULL CHECK (failure IN (0, 1)),
  notes TEXT NOT NULL,
  UNIQUE (workout_exercise_id, position)
);

CREATE TABLE routines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_token TEXT NOT NULL
);

CREATE TABLE routine_exercises (
  id TEXT PRIMARY KEY,
  routine_id TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  exercise_id TEXT NOT NULL,
  name TEXT NOT NULL,
  primary_muscle TEXT NOT NULL,
  equipment TEXT NOT NULL,
  notes TEXT NOT NULL,
  rest_seconds INTEGER NOT NULL,
  set_count INTEGER NOT NULL,
  progression_min_reps INTEGER NOT NULL,
  progression_max_reps INTEGER NOT NULL,
  progression_weight_increment REAL,
  progression_max_rpe REAL NOT NULL,
  UNIQUE (routine_id, position)
);

CREATE TABLE routine_exercise_secondary_muscles (
  routine_exercise_id TEXT NOT NULL REFERENCES routine_exercises(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  muscle TEXT NOT NULL,
  fraction REAL NOT NULL,
  PRIMARY KEY (routine_exercise_id, position)
);

CREATE TABLE training_cycles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  current_index INTEGER NOT NULL,
  sync_token TEXT NOT NULL
);

CREATE TABLE training_cycle_slots (
  id TEXT PRIMARY KEY,
  training_cycle_id TEXT NOT NULL REFERENCES training_cycles(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('routine', 'rest')),
  routine_id TEXT,
  UNIQUE (training_cycle_id, position)
);

CREATE TABLE sync_changes (
  revision INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('workout', 'routine', 'training_cycle')),
  entity_id TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO workouts (
  id, title, routine_id, cycle_slot_id, status, started_at, completed_at,
  updated_at, notes, session_rpe, sync_token
)
SELECT
  id,
  json_extract(payload, '$.title'),
  json_extract(payload, '$.routineId'),
  json_extract(payload, '$.cycleSlotId'),
  json_extract(payload, '$.status'),
  json_extract(payload, '$.startedAt'),
  json_extract(payload, '$.completedAt'),
  updated_at,
  COALESCE(json_extract(payload, '$.notes'), ''),
  json_extract(payload, '$.sessionRpe'),
  'migration:' || id || ':' || updated_at
FROM workouts_legacy;

INSERT INTO workout_exercises (
  id, workout_id, position, exercise_id, name, primary_muscle, equipment, notes,
  rest_seconds, rest_until, progression_min_reps, progression_max_reps,
  progression_weight_increment, progression_max_rpe
)
SELECT
  json_extract(exercise.value, '$.id'),
  workout.id,
  CAST(exercise.key AS INTEGER),
  json_extract(exercise.value, '$.exerciseId'),
  json_extract(exercise.value, '$.name'),
  json_extract(exercise.value, '$.muscle'),
  json_extract(exercise.value, '$.equipment'),
  COALESCE(json_extract(exercise.value, '$.notes'), ''),
  json_extract(exercise.value, '$.restSeconds'),
  json_extract(exercise.value, '$.restUntil'),
  json_extract(exercise.value, '$.progression.minReps'),
  json_extract(exercise.value, '$.progression.maxReps'),
  json_extract(exercise.value, '$.progression.weightIncrement'),
  COALESCE(json_extract(exercise.value, '$.progression.maxRpe'), 10)
FROM workouts_legacy workout, json_each(workout.payload, '$.exercises') exercise;

INSERT INTO workout_exercise_secondary_muscles (workout_exercise_id, position, muscle, fraction)
SELECT
  json_extract(exercise.value, '$.id'),
  CAST(secondary.key AS INTEGER),
  json_extract(secondary.value, '$.muscle'),
  json_extract(secondary.value, '$.fraction')
FROM workouts_legacy workout,
  json_each(workout.payload, '$.exercises') exercise,
  json_each(exercise.value, '$.secondaryMuscles') secondary;

INSERT INTO workout_sets (
  id, workout_exercise_id, position, weight, repetitions, rpe, duration_seconds,
  distance_meters, completed, completed_at, failure, notes
)
SELECT
  json_extract(workout_set.value, '$.id'),
  json_extract(exercise.value, '$.id'),
  CAST(workout_set.key AS INTEGER),
  json_extract(workout_set.value, '$.weight'),
  json_extract(workout_set.value, '$.reps'),
  json_extract(workout_set.value, '$.rpe'),
  json_extract(workout_set.value, '$.durationSeconds'),
  json_extract(workout_set.value, '$.distanceMeters'),
  CASE WHEN json_extract(workout_set.value, '$.completed') = 1 THEN 1 ELSE 0 END,
  json_extract(workout_set.value, '$.completedAt'),
  CASE WHEN json_extract(workout_set.value, '$.failure') = 1 THEN 1 ELSE 0 END,
  COALESCE(json_extract(workout_set.value, '$.notes'), '')
FROM workouts_legacy workout,
  json_each(workout.payload, '$.exercises') exercise,
  json_each(exercise.value, '$.sets') workout_set;

INSERT INTO routines (id, name, created_at, updated_at, deleted_at, sync_token)
SELECT
  id,
  json_extract(payload, '$.name'),
  json_extract(payload, '$.createdAt'),
  updated_at,
  json_extract(payload, '$.deletedAt'),
  'migration:' || id || ':' || updated_at
FROM routines_legacy;

INSERT INTO routine_exercises (
  id, routine_id, position, exercise_id, name, primary_muscle, equipment, notes,
  rest_seconds, set_count, progression_min_reps, progression_max_reps,
  progression_weight_increment, progression_max_rpe
)
SELECT
  json_extract(exercise.value, '$.id'),
  routine.id,
  CAST(exercise.key AS INTEGER),
  json_extract(exercise.value, '$.exerciseId'),
  json_extract(exercise.value, '$.name'),
  json_extract(exercise.value, '$.muscle'),
  json_extract(exercise.value, '$.equipment'),
  COALESCE(json_extract(exercise.value, '$.notes'), ''),
  json_extract(exercise.value, '$.restSeconds'),
  json_extract(exercise.value, '$.setCount'),
  json_extract(exercise.value, '$.progression.minReps'),
  json_extract(exercise.value, '$.progression.maxReps'),
  json_extract(exercise.value, '$.progression.weightIncrement'),
  COALESCE(json_extract(exercise.value, '$.progression.maxRpe'), 10)
FROM routines_legacy routine, json_each(routine.payload, '$.exercises') exercise;

INSERT INTO routine_exercise_secondary_muscles (routine_exercise_id, position, muscle, fraction)
SELECT
  json_extract(exercise.value, '$.id'),
  CAST(secondary.key AS INTEGER),
  json_extract(secondary.value, '$.muscle'),
  json_extract(secondary.value, '$.fraction')
FROM routines_legacy routine,
  json_each(routine.payload, '$.exercises') exercise,
  json_each(exercise.value, '$.secondaryMuscles') secondary;

INSERT INTO training_cycles (id, name, created_at, updated_at, deleted_at, current_index, sync_token)
SELECT
  id,
  json_extract(payload, '$.name'),
  json_extract(payload, '$.createdAt'),
  updated_at,
  json_extract(payload, '$.deletedAt'),
  json_extract(payload, '$.currentIndex'),
  'migration:' || id || ':' || updated_at
FROM training_cycles_legacy;

INSERT INTO training_cycle_slots (id, training_cycle_id, position, type, routine_id)
SELECT
  json_extract(slot.value, '$.id'),
  cycle.id,
  CAST(slot.key AS INTEGER),
  COALESCE(json_extract(slot.value, '$.type'), 'routine'),
  json_extract(slot.value, '$.routineId')
FROM training_cycles_legacy cycle, json_each(cycle.payload, '$.slots') slot;

INSERT INTO sync_changes (entity_type, entity_id)
SELECT 'workout', id FROM workouts;
INSERT INTO sync_changes (entity_type, entity_id)
SELECT 'routine', id FROM routines;
INSERT INTO sync_changes (entity_type, entity_id)
SELECT 'training_cycle', id FROM training_cycles;

DROP TABLE workouts_legacy;
DROP TABLE routines_legacy;
DROP TABLE training_cycles_legacy;

CREATE INDEX workouts_updated_at_idx ON workouts(updated_at);
CREATE INDEX workouts_status_completed_at_idx ON workouts(status, completed_at DESC);
CREATE INDEX workout_exercises_workout_position_idx ON workout_exercises(workout_id, position);
CREATE INDEX workout_exercises_exercise_idx ON workout_exercises(exercise_id, workout_id);
CREATE INDEX workout_exercises_muscle_idx ON workout_exercises(primary_muscle, workout_id);
CREATE INDEX workout_sets_exercise_position_idx ON workout_sets(workout_exercise_id, position);
CREATE INDEX workout_sets_completed_at_idx ON workout_sets(completed_at);
CREATE INDEX workout_sets_rpe_idx ON workout_sets(rpe) WHERE completed = 1 AND rpe IS NOT NULL;

CREATE INDEX routines_updated_at_idx ON routines(updated_at);
CREATE INDEX routine_exercises_routine_position_idx ON routine_exercises(routine_id, position);
CREATE INDEX routine_exercises_exercise_idx ON routine_exercises(exercise_id, routine_id);

CREATE INDEX training_cycles_updated_at_idx ON training_cycles(updated_at);
CREATE INDEX training_cycle_slots_cycle_position_idx ON training_cycle_slots(training_cycle_id, position);

CREATE INDEX sync_changes_revision_idx ON sync_changes(revision, entity_type, entity_id);
