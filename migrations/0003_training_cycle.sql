CREATE TABLE IF NOT EXISTS training_cycles (
  id TEXT PRIMARY KEY,
  updated_at TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS training_cycles_updated_at_idx ON training_cycles(updated_at);
