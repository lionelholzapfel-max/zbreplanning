-- Knockout phase support
-- Table for team overrides (actual teams for knockout matches)

-- Table to store actual teams for knockout matches (overrides placeholders)
CREATE TABLE IF NOT EXISTS match_team_overrides (
  match_id INTEGER PRIMARY KEY,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'auto' CHECK (source IN ('auto', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_match_team_overrides_match_id ON match_team_overrides(match_id);
