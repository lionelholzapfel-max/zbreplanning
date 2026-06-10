-- ZbrePlanning Migration v3
-- Adds points tracking and daily awards
-- Run this AFTER supabase-migration-v2.sql

-- ============================================
-- 1. POINTS LOG TABLE
-- Stores detailed points for each prediction
-- ============================================

CREATE TABLE IF NOT EXISTS public.points_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  match_id INTEGER NOT NULL,
  base_points INTEGER NOT NULL DEFAULT 0,
  visionary_bonus INTEGER NOT NULL DEFAULT 0,
  outsider_bonus INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  detail TEXT, -- Human-readable breakdown
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, match_id)
);

-- ============================================
-- 2. DAILY AWARDS TABLE
-- Tracks "Drère de la journée" history
-- ============================================

CREATE TABLE IF NOT EXISTS public.daily_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  award_date DATE NOT NULL,
  award_type TEXT NOT NULL DEFAULT 'drere' CHECK (award_type IN ('drere', 'wooden_spoon')),
  points_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, award_date, award_type)
);

-- ============================================
-- 3. USER STATS VIEW
-- Aggregated stats for leaderboard
-- ============================================

CREATE OR REPLACE VIEW public.user_stats AS
SELECT
  u.id,
  u.member_name,
  u.member_slug,
  u.is_admin,
  COALESCE(SUM(pl.total_points), 0)::INTEGER AS total_points,
  COUNT(CASE WHEN pl.base_points = 3 THEN 1 END)::INTEGER AS exact_scores,
  COUNT(CASE WHEN pl.visionary_bonus = 1 THEN 1 END)::INTEGER AS visionary_count,
  COUNT(CASE WHEN pl.outsider_bonus = 1 THEN 1 END)::INTEGER AS outsider_count,
  COUNT(pl.id)::INTEGER AS matches_predicted,
  (SELECT COUNT(*) FROM public.daily_awards da WHERE da.user_id = u.id AND da.award_type = 'drere')::INTEGER AS crown_count
FROM public.users u
LEFT JOIN public.points_log pl ON u.id = pl.user_id
GROUP BY u.id, u.member_name, u.member_slug, u.is_admin;

-- ============================================
-- 4. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_points_log_user ON public.points_log(user_id);
CREATE INDEX IF NOT EXISTS idx_points_log_match ON public.points_log(match_id);
CREATE INDEX IF NOT EXISTS idx_daily_awards_user ON public.daily_awards(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_awards_date ON public.daily_awards(award_date);

-- ============================================
-- 5. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.points_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_awards ENABLE ROW LEVEL SECURITY;

-- Points log: read only for clients, write via API (service role)
CREATE POLICY "points_log_select" ON public.points_log FOR SELECT USING (true);
CREATE POLICY "points_log_insert" ON public.points_log FOR INSERT WITH CHECK (false);
CREATE POLICY "points_log_update" ON public.points_log FOR UPDATE USING (false);
CREATE POLICY "points_log_delete" ON public.points_log FOR DELETE USING (false);

-- Daily awards: read only for clients
CREATE POLICY "daily_awards_select" ON public.daily_awards FOR SELECT USING (true);
CREATE POLICY "daily_awards_insert" ON public.daily_awards FOR INSERT WITH CHECK (false);
CREATE POLICY "daily_awards_update" ON public.daily_awards FOR UPDATE USING (false);
CREATE POLICY "daily_awards_delete" ON public.daily_awards FOR DELETE USING (false);

-- ============================================
-- DONE!
-- ============================================

SELECT 'Migration v3 complete' AS status;
