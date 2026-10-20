ALTER TABLE workout_sets
  ADD COLUMN warmup INTEGER NOT NULL DEFAULT 0 CHECK (warmup IN (0, 1));

UPDATE workout_sets
SET rpe = 10
WHERE failure = 1;

ALTER TABLE workout_sets DROP COLUMN failure;

ALTER TABLE routine_exercises
  ADD COLUMN has_warmup_set INTEGER NOT NULL DEFAULT 0 CHECK (has_warmup_set IN (0, 1));
