INSERT INTO workouts (
  id, title, routine_id, cycle_slot_id, status, started_at, completed_at,
  updated_at, notes, session_rpe, sync_token
)
SELECT
  'server-demo-full-body',
  'Server Full Body',
  NULL,
  NULL,
  'completed',
  '2026-10-17T07:05:00.000Z',
  '2026-10-17T07:58:00.000Z',
  '2026-10-17T07:58:00.000Z',
  'Seeded by the local development stack.',
  8,
  'seed:server-demo-full-body'
WHERE NOT EXISTS (SELECT 1 FROM workouts);

WITH seed (
  id, workout_id, position, exercise_id, name, primary_muscle, equipment, notes,
  rest_seconds, rest_until, progression_min_reps, progression_max_reps,
  progression_weight_increment
) AS (VALUES
  ('server-demo-deadlift', 'server-demo-full-body', 0, 'deadlift', 'Deadlift', 'Back', 'Barbell', '', 120, NULL, 5, 8, 2.5),
  ('server-demo-press', 'server-demo-full-body', 1, 'overhead-press', 'Overhead Press', 'Shoulders', 'Barbell', '', 120, NULL, 8, 12, 2.5)
)
INSERT OR IGNORE INTO workout_exercises (
  id, workout_id, position, exercise_id, name, primary_muscle, equipment, notes,
  rest_seconds, rest_until, progression_min_reps, progression_max_reps,
  progression_weight_increment
)
SELECT * FROM seed
WHERE EXISTS (SELECT 1 FROM workouts WHERE id = 'server-demo-full-body');

WITH seed (
  id, workout_exercise_id, position, weight, repetitions, rpe, duration_seconds,
  distance_meters, completed, completed_at, warmup, notes
) AS (VALUES
  ('server-demo-deadlift-1', 'server-demo-deadlift', 0, 120, 5, 8, NULL, NULL, 1, '2026-10-17T07:20:00.000Z', 0, ''),
  ('server-demo-deadlift-2', 'server-demo-deadlift', 1, 120, 5, 9, NULL, NULL, 1, '2026-10-17T07:25:00.000Z', 0, ''),
  ('server-demo-deadlift-3', 'server-demo-deadlift', 2, 115, 6, 9, NULL, NULL, 1, '2026-10-17T07:30:00.000Z', 0, ''),
  ('server-demo-press-1', 'server-demo-press', 0, 42.5, 8, 8, NULL, NULL, 1, '2026-10-17T07:40:00.000Z', 0, ''),
  ('server-demo-press-2', 'server-demo-press', 1, 42.5, 8, 9, NULL, NULL, 1, '2026-10-17T07:45:00.000Z', 0, ''),
  ('server-demo-press-3', 'server-demo-press', 2, 40, 10, 9, NULL, NULL, 1, '2026-10-17T07:50:00.000Z', 0, '')
)
INSERT OR IGNORE INTO workout_sets
SELECT * FROM seed
WHERE EXISTS (SELECT 1 FROM workouts WHERE id = 'server-demo-full-body');

INSERT INTO sync_changes (entity_type, entity_id)
SELECT 'workout', 'server-demo-full-body'
WHERE EXISTS (SELECT 1 FROM workouts WHERE id = 'server-demo-full-body')
  AND NOT EXISTS (
    SELECT 1 FROM sync_changes
    WHERE entity_type = 'workout' AND entity_id = 'server-demo-full-body'
  );
