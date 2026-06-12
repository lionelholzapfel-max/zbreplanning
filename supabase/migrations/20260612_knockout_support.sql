-- Knockout phase support
-- 1. Add qualifier prediction to match_score_predictions
-- 2. Create table for team overrides (actual teams for knockout matches)
-- 3. Add qualifier tracking to match_results

-- Add qualifier prediction (which team the user thinks will advance)
-- null for group stage, 'home' or 'away' for knockout
ALTER TABLE match_score_predictions
ADD COLUMN IF NOT EXISTS qualifier_pick TEXT
CHECK (qualifier_pick IS NULL OR qualifier_pick IN ('home', 'away'));

-- Add qualifier to match_results (who advanced for knockout matches)
-- Note: home_score/away_score = fullTime score (includes extra time, NOT penalties)
-- For knockout: draw is possible if match goes to penalties (e.g., 2-2 ap)
ALTER TABLE match_results
ADD COLUMN IF NOT EXISTS qualifier TEXT CHECK (qualifier IS NULL OR qualifier IN ('home', 'away'));

-- Table to store actual teams for knockout matches (overrides placeholders)
CREATE TABLE IF NOT EXISTS match_team_overrides (
  match_id INTEGER PRIMARY KEY,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'auto' CHECK (source IN ('auto', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add qualifier bonus tracking to points_log
ALTER TABLE points_log
ADD COLUMN IF NOT EXISTS qualifier_bonus INTEGER DEFAULT 0;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_match_team_overrides_match_id ON match_team_overrides(match_id);
