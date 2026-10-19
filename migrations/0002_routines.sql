CREATE TABLE IF NOT EXISTS routines (
  id TEXT PRIMARY KEY,
  updated_at TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS routines_updated_at_idx ON routines(updated_at);
