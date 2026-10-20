CREATE TABLE training_profiles_next (
  id TEXT PRIMARY KEY CHECK (id = 'primary-training-profile'),
  primary_goal TEXT NOT NULL CHECK (primary_goal IN ('strength', 'hypertrophy', 'general-fitness', 'conditioning')),
  experience_level TEXT NOT NULL CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  days_per_week INTEGER NOT NULL CHECK (days_per_week BETWEEN 1 AND 7),
  session_minutes INTEGER NOT NULL CHECK (session_minutes BETWEEN 10 AND 300),
  available_equipment TEXT NOT NULL,
  excluded_exercises TEXT NOT NULL,
  movement_constraints TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO training_profiles_next (
  id, primary_goal, experience_level, days_per_week, session_minutes,
  available_equipment, excluded_exercises, movement_constraints, updated_at
)
SELECT
  id, primary_goal, experience_level, days_per_week, session_minutes,
  available_equipment, excluded_exercise_ids, movement_constraints, updated_at
FROM training_profiles;

DROP TABLE training_profiles;
ALTER TABLE training_profiles_next RENAME TO training_profiles;

DROP TABLE IF EXISTS training_checkins;
DROP TABLE IF EXISTS mcp_audit_log;
DROP TABLE IF EXISTS routine_change_proposals;

CREATE TABLE workout_checkins (
  workout_id TEXT PRIMARY KEY REFERENCES workouts(id) ON DELETE CASCADE,
  recorded_at TEXT NOT NULL,
  sleep_quality INTEGER NOT NULL CHECK (sleep_quality BETWEEN 1 AND 5),
  energy INTEGER NOT NULL CHECK (energy BETWEEN 1 AND 5),
  soreness INTEGER NOT NULL CHECK (soreness BETWEEN 1 AND 5),
  stress INTEGER NOT NULL CHECK (stress BETWEEN 1 AND 5),
  motivation INTEGER NOT NULL CHECK (motivation BETWEEN 1 AND 5),
  pain_present INTEGER NOT NULL CHECK (pain_present IN (0, 1)),
  illness_present INTEGER NOT NULL CHECK (illness_present IN (0, 1)),
  notes TEXT NOT NULL
);

CREATE INDEX workout_checkins_recorded_at_idx ON workout_checkins(recorded_at DESC);
