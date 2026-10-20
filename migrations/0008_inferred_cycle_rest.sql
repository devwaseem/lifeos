ALTER TABLE training_cycles
ADD COLUMN training_days_before_rest INTEGER NOT NULL DEFAULT 3
CHECK (training_days_before_rest BETWEEN 1 AND 7);

UPDATE training_cycles
SET current_index = COALESCE((
  WITH next_routine AS (
    SELECT COALESCE(
      MIN(CASE WHEN position >= training_cycles.current_index THEN position END),
      MIN(position)
    ) AS position
    FROM training_cycle_slots
    WHERE training_cycle_id = training_cycles.id
      AND type = 'routine'
  )
  SELECT COUNT(*)
  FROM training_cycle_slots, next_routine
  WHERE training_cycle_id = training_cycles.id
    AND type = 'routine'
    AND training_cycle_slots.position < next_routine.position
), 0);

DROP INDEX IF EXISTS training_cycle_slots_cycle_position_idx;

CREATE TABLE training_cycle_slots_next (
  id TEXT PRIMARY KEY,
  training_cycle_id TEXT NOT NULL REFERENCES training_cycles(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  routine_id TEXT NOT NULL,
  UNIQUE (training_cycle_id, position)
);

INSERT INTO training_cycle_slots_next (id, training_cycle_id, position, routine_id)
SELECT
  id,
  training_cycle_id,
  ROW_NUMBER() OVER (PARTITION BY training_cycle_id ORDER BY position) - 1,
  routine_id
FROM training_cycle_slots
WHERE type = 'routine'
  AND routine_id IS NOT NULL;

DROP TABLE training_cycle_slots;
ALTER TABLE training_cycle_slots_next RENAME TO training_cycle_slots;

CREATE INDEX training_cycle_slots_cycle_position_idx ON training_cycle_slots(training_cycle_id, position);
