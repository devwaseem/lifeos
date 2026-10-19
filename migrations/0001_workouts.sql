CREATE TABLE IF NOT EXISTS workouts (
  id TEXT PRIMARY KEY,
  updated_at TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS workouts_updated_at_idx ON workouts(updated_at);
