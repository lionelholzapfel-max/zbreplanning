-- ZbrePlanning Migration v4
-- Adds user favorite teams for filtering
-- Run this AFTER supabase-migration-v3.sql

-- ============================================
-- 1. USER FAVORITE TEAMS TABLE
-- Stores teams that users want to follow
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_favorite_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  team_code TEXT NOT NULL, -- Country name as used in matches.json (e.g., "France", "Belgique")
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, team_code)
);

-- ============================================
-- 2. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_user_favorite_teams_user ON public.user_favorite_teams(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorite_teams_team ON public.user_favorite_teams(team_code);

-- ============================================
-- 3. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.user_favorite_teams ENABLE ROW LEVEL SECURITY;

-- Users can read their own favorites
CREATE POLICY "user_favorite_teams_select_own" ON public.user_favorite_teams
  FOR SELECT USING (true); -- Anyone can see favorites (for showing stars)

-- Users can insert their own favorites
CREATE POLICY "user_favorite_teams_insert_own" ON public.user_favorite_teams
  FOR INSERT WITH CHECK (false); -- Via API only (service role)

-- Users can delete their own favorites
CREATE POLICY "user_favorite_teams_delete_own" ON public.user_favorite_teams
  FOR DELETE USING (false); -- Via API only (service role)

-- ============================================
-- DONE!
-- ============================================

SELECT 'Migration v4 complete - user_favorite_teams table created' AS status;
