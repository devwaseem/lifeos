ALTER TABLE workout_exercises
ADD COLUMN progression_weight_options TEXT NOT NULL DEFAULT '[]';

ALTER TABLE routine_exercises
ADD COLUMN progression_weight_options TEXT NOT NULL DEFAULT '[]';
