ALTER TABLE routine_exercises
DROP COLUMN progression_weight_options;

CREATE TABLE equipment_settings (
  id TEXT PRIMARY KEY CHECK (id = 'primary-equipment-settings'),
  weight_options_by_equipment TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
