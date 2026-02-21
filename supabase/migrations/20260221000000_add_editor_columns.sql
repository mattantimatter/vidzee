ALTER TABLE projects ADD COLUMN IF NOT EXISTS edit_state jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS music_url text;
