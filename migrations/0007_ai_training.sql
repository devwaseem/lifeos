CREATE TABLE training_profiles (
  id TEXT PRIMARY KEY CHECK (id = 'primary-training-profile'),
  primary_goal TEXT NOT NULL CHECK (primary_goal IN ('strength', 'hypertrophy', 'general-fitness', 'conditioning')),
  experience_level TEXT NOT NULL CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  days_per_week INTEGER NOT NULL CHECK (days_per_week BETWEEN 1 AND 7),
  session_minutes INTEGER NOT NULL CHECK (session_minutes BETWEEN 10 AND 300),
  available_equipment TEXT NOT NULL,
  preferred_exercise_ids TEXT NOT NULL,
  excluded_exercise_ids TEXT NOT NULL,
  movement_constraints TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE training_checkins (
  id TEXT PRIMARY KEY,
  recorded_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sleep_quality INTEGER NOT NULL CHECK (sleep_quality BETWEEN 1 AND 5),
  energy INTEGER NOT NULL CHECK (energy BETWEEN 1 AND 5),
  soreness INTEGER NOT NULL CHECK (soreness BETWEEN 1 AND 5),
  stress INTEGER NOT NULL CHECK (stress BETWEEN 1 AND 5),
  motivation INTEGER NOT NULL CHECK (motivation BETWEEN 1 AND 5),
  pain_present INTEGER NOT NULL CHECK (pain_present IN (0, 1)),
  illness_present INTEGER NOT NULL CHECK (illness_present IN (0, 1)),
  notes TEXT NOT NULL
);

CREATE TABLE device_sync_state (
  device_id TEXT PRIMARY KEY,
  authenticated_subject TEXT NOT NULL,
  last_synced_at TEXT NOT NULL,
  last_revision INTEGER NOT NULL
);

CREATE TABLE routine_change_proposals (
  id TEXT PRIMARY KEY,
  authenticated_subject TEXT NOT NULL,
  routine_id TEXT NOT NULL REFERENCES routines(id),
  base_routine_updated_at TEXT NOT NULL,
  operations_json TEXT NOT NULL,
  before_routine_json TEXT NOT NULL,
  proposed_routine_json TEXT NOT NULL,
  rationale TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'stale')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE TABLE mcp_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  authenticated_subject TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  details_json TEXT NOT NULL
);

CREATE INDEX training_checkins_recorded_at_idx ON training_checkins(recorded_at DESC);
CREATE INDEX device_sync_state_last_synced_at_idx ON device_sync_state(last_synced_at DESC);
CREATE INDEX routine_change_proposals_status_created_idx ON routine_change_proposals(status, created_at DESC);
CREATE INDEX mcp_audit_log_target_idx ON mcp_audit_log(target_type, target_id, occurred_at DESC);
