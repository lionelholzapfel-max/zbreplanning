-- Knockout phase support
-- 1. Add qualifier prediction to match_score_predictions
-- 2. Create table for team overrides (actual teams for knockout matches)
-- 3. Add qualifier tracking to match_results

-- Add qualifier prediction (which team the user thinks will advance)
-- null for group stage, 'home' or 'away' for knockout
ALTER TABLE match_score_predictions
ADD COLUMN IF NOT EXISTS qualifier_pick TEXT
CHECK (qualifier_pick IS NULL OR qualifier_pick IN ('home', 'away'));

-- Add 90-minute score tracking for knockout (stored separately from final score)
-- For group stage matches, these are the same as home_score/away_score
ALTER TABLE match_results
ADD COLUMN IF NOT EXISTS home_score_90min INTEGER,
ADD COLUMN IF NOT EXISTS away_score_90min INTEGER,
ADD COLUMN IF NOT EXISTS qualifier TEXT CHECK (qualifier IS NULL OR qualifier IN ('home', 'away'));

-- Backfill: For existing results (group stage), 90min score = final score
UPDATE match_results
SET home_score_90min = home_score,
    away_score_90min = away_score
WHERE home_score_90min IS NULL;

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
