-- ============================================================================
-- ZbrePlanning Test Database Schema
-- Generated from production schema (READ ONLY extraction)
-- Apply this to your test Supabase project via SQL Editor
-- Contents: 18 tables, 1 view (user_stats), 4 triggers, RLS policies, indexes
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- ============================================================================
-- TABLES (in dependency order)
-- ============================================================================

-- Users table (no dependencies)
CREATE TABLE public.users (
  id text PRIMARY KEY,
  email text NOT NULL,
  member_id text NOT NULL,
  member_name text NOT NULL,
  member_slug text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  pin_hash text,
  is_admin boolean DEFAULT false
);

-- Activities table
CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  title text NOT NULL,
  description text,
  date date,
  time text,
  location text,
  type text DEFAULT 'event'::text CHECK (type = ANY (ARRAY['event'::text, 'world_cup_match'::text])),
  match_id integer,
  created_by text REFERENCES public.users(id),
  created_at timestamptz DEFAULT now()
);

-- Activity participations
CREATE TABLE public.activity_participations (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  activity_id uuid REFERENCES public.activities(id),
  user_id text REFERENCES public.users(id),
  status text NOT NULL CHECK (status = ANY (ARRAY['yes'::text, 'no'::text, 'maybe'::text])),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (activity_id, user_id)
);

-- Match participations
CREATE TABLE public.match_participations (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  match_id integer NOT NULL,
  user_id text REFERENCES public.users(id),
  status text NOT NULL CHECK (status = ANY (ARRAY['yes'::text, 'no'::text, 'maybe'::text])),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (match_id, user_id)
);

-- Watch locations
CREATE TABLE public.watch_locations (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  match_id integer NOT NULL,
  location text NOT NULL,
  proposed_by text REFERENCES public.users(id),
  votes text[] DEFAULT '{}'::text[],
  created_at timestamptz DEFAULT now()
);

-- Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  link text,
  read boolean DEFAULT false,
  created_by text REFERENCES public.users(id),
  related_id text,
  created_at timestamptz DEFAULT now()
);

-- Predictions (global tournament predictions)
CREATE TABLE public.predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  prediction_type text NOT NULL CHECK (prediction_type = ANY (ARRAY['winner'::text, 'best_player'::text, 'best_young'::text, 'surprise_team'::text, 'top_scorer'::text, 'best_goalkeeper'::text])),
  prediction_value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, prediction_type)
);

-- Match score predictions
CREATE TABLE public.match_score_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.users(id),
  match_id integer NOT NULL,
  home_score integer NOT NULL CHECK (home_score >= 0),
  away_score integer NOT NULL CHECK (away_score >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  qualifier_pick text CHECK (qualifier_pick IS NULL OR (qualifier_pick = ANY (ARRAY['home'::text, 'away'::text]))),
  UNIQUE (user_id, match_id)
);

-- Match results
CREATE TABLE public.match_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id integer UNIQUE NOT NULL,
  home_score integer NOT NULL CHECK (home_score >= 0),
  away_score integer NOT NULL CHECK (away_score >= 0),
  entered_by text REFERENCES public.users(id),
  entered_at timestamptz DEFAULT now(),
  source text DEFAULT 'admin'::text CHECK (source = ANY (ARRAY['admin'::text, 'auto'::text]))
);

-- Points log
CREATE TABLE public.points_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.users(id),
  match_id integer NOT NULL,
  base_points integer DEFAULT 0,
  visionary_bonus integer DEFAULT 0,
  outsider_bonus integer DEFAULT 0,
  total_points integer DEFAULT 0,
  detail text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, match_id)
);

-- Daily awards (Drere du jour, MZI, etc.)
CREATE TABLE public.daily_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.users(id),
  award_date date NOT NULL,
  award_type text DEFAULT 'drere'::text CHECK (award_type = ANY (ARRAY['drere'::text, 'wooden_spoon'::text, 'mzi'::text, 'drere_week'::text])),
  points_earned integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  celebration_seen_at timestamptz,
  UNIQUE (user_id, award_date, award_type)
);

-- User favorite teams
CREATE TABLE public.user_favorite_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.users(id),
  team_code text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, team_code)
);

-- Tournament results
CREATE TABLE public.tournament_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_type text UNIQUE NOT NULL CHECK (prediction_type = ANY (ARRAY['winner'::text, 'best_player'::text, 'best_young'::text, 'surprise_team'::text])),
  result_value text NOT NULL,
  entered_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Global prediction points
CREATE TABLE public.global_prediction_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  prediction_type text NOT NULL CHECK (prediction_type = ANY (ARRAY['winner'::text, 'best_player'::text, 'best_young'::text, 'surprise_team'::text])),
  predicted_value text NOT NULL,
  actual_value text NOT NULL,
  points_awarded integer DEFAULT 20,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, prediction_type)
);

-- Sync log
CREATE TABLE public.sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  success boolean NOT NULL,
  matches_synced integer DEFAULT 0,
  matches_checked integer DEFAULT 0,
  error_message text
);

-- Match team overrides (for knockout stage)
CREATE TABLE public.match_team_overrides (
  match_id integer PRIMARY KEY,
  home_team text NOT NULL,
  away_team text NOT NULL,
  source text DEFAULT 'auto'::text CHECK (source = ANY (ARRAY['auto'::text, 'admin'::text])),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Drere speeches (audio recordings)
CREATE TABLE public.drere_speeches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  award_date date NOT NULL,
  audio_path text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (award_date, user_id)
);

-- Drere week songs
CREATE TABLE public.drere_week_songs (
  id serial PRIMARY KEY,
  week_start_date date UNIQUE NOT NULL,
  user_id text NOT NULL,
  lyrics text NOT NULL,
  audio_url text,
  audio_path text,
  style text DEFAULT 'hip-hop francais, victoire, epique'::text,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'generating'::text, 'completed'::text, 'failed'::text])),
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_activities_created_by ON public.activities(created_by);
CREATE INDEX idx_activities_date ON public.activities(date);
CREATE INDEX idx_activity_participations_activity ON public.activity_participations(activity_id);
CREATE INDEX idx_activity_participations_user ON public.activity_participations(user_id);
CREATE INDEX idx_daily_awards_date ON public.daily_awards(award_date);
CREATE INDEX idx_daily_awards_user ON public.daily_awards(user_id);
CREATE INDEX idx_drere_week_songs_status ON public.drere_week_songs(status);
CREATE INDEX idx_drere_week_songs_week ON public.drere_week_songs(week_start_date);
CREATE INDEX idx_global_prediction_points_user ON public.global_prediction_points(user_id);
CREATE INDEX idx_match_participations_match ON public.match_participations(match_id);
CREATE INDEX idx_match_participations_user ON public.match_participations(user_id);
CREATE INDEX idx_match_results_match ON public.match_results(match_id);
CREATE INDEX idx_match_score_predictions_match ON public.match_score_predictions(match_id);
CREATE INDEX idx_match_score_predictions_user ON public.match_score_predictions(user_id);
CREATE INDEX idx_match_team_overrides_match_id ON public.match_team_overrides(match_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_read ON public.notifications(user_id, read);
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_points_log_match ON public.points_log(match_id);
CREATE INDEX idx_points_log_user ON public.points_log(user_id);
CREATE INDEX idx_predictions_type ON public.predictions(prediction_type);
CREATE INDEX idx_predictions_user ON public.predictions(user_id);
CREATE INDEX idx_sync_log_created_at ON public.sync_log(created_at DESC);
CREATE INDEX idx_user_favorite_teams_team ON public.user_favorite_teams(team_code);
CREATE INDEX idx_user_favorite_teams_user ON public.user_favorite_teams(user_id);
CREATE INDEX idx_watch_locations_match ON public.watch_locations(match_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER activity_participations_updated_at
  BEFORE UPDATE ON public.activity_participations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER match_participations_updated_at
  BEFORE UPDATE ON public.match_participations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER match_score_predictions_updated_at
  BEFORE UPDATE ON public.match_score_predictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER predictions_updated_at
  BEFORE UPDATE ON public.predictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables (except drere_speeches which has RLS disabled in prod)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_score_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorite_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_prediction_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_team_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drere_week_songs ENABLE ROW LEVEL SECURITY;
-- Note: drere_speeches has RLS DISABLED in production

-- RLS Policies for users
CREATE POLICY "users_select" ON public.users FOR SELECT USING (true);
CREATE POLICY "users_insert" ON public.users FOR INSERT WITH CHECK (false);
CREATE POLICY "users_update" ON public.users FOR UPDATE USING (false);
CREATE POLICY "users_delete" ON public.users FOR DELETE USING (false);

-- RLS Policies for activities
CREATE POLICY "activities_all" ON public.activities FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for activity_participations
CREATE POLICY "activity_participations_all" ON public.activity_participations FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for match_participations
CREATE POLICY "match_participations_all" ON public.match_participations FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for watch_locations
CREATE POLICY "watch_locations_all" ON public.watch_locations FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for notifications
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT USING (true);
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT WITH CHECK (false);
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE USING (false);
CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE USING (false);

-- RLS Policies for predictions
CREATE POLICY "predictions_select" ON public.predictions FOR SELECT USING (true);
CREATE POLICY "predictions_insert" ON public.predictions FOR INSERT WITH CHECK (false);
CREATE POLICY "predictions_update" ON public.predictions FOR UPDATE USING (false);
CREATE POLICY "predictions_delete" ON public.predictions FOR DELETE USING (false);

-- RLS Policies for match_score_predictions
CREATE POLICY "match_score_predictions_select" ON public.match_score_predictions FOR SELECT USING (true);
CREATE POLICY "match_score_predictions_insert" ON public.match_score_predictions FOR INSERT WITH CHECK (false);
CREATE POLICY "match_score_predictions_update" ON public.match_score_predictions FOR UPDATE USING (false);
CREATE POLICY "match_score_predictions_delete" ON public.match_score_predictions FOR DELETE USING (false);

-- RLS Policies for match_results
CREATE POLICY "match_results_select" ON public.match_results FOR SELECT USING (true);
CREATE POLICY "match_results_insert" ON public.match_results FOR INSERT WITH CHECK (false);
CREATE POLICY "match_results_update" ON public.match_results FOR UPDATE USING (false);
CREATE POLICY "match_results_delete" ON public.match_results FOR DELETE USING (false);

-- RLS Policies for points_log
CREATE POLICY "points_log_select" ON public.points_log FOR SELECT USING (true);
CREATE POLICY "points_log_insert" ON public.points_log FOR INSERT WITH CHECK (false);
CREATE POLICY "points_log_update" ON public.points_log FOR UPDATE USING (false);
CREATE POLICY "points_log_delete" ON public.points_log FOR DELETE USING (false);

-- RLS Policies for daily_awards
CREATE POLICY "daily_awards_select" ON public.daily_awards FOR SELECT USING (true);
CREATE POLICY "daily_awards_insert" ON public.daily_awards FOR INSERT WITH CHECK (false);
CREATE POLICY "daily_awards_update" ON public.daily_awards FOR UPDATE USING (false);
CREATE POLICY "daily_awards_delete" ON public.daily_awards FOR DELETE USING (false);

-- RLS Policies for user_favorite_teams
CREATE POLICY "user_favorite_teams_select_own" ON public.user_favorite_teams FOR SELECT USING (true);
CREATE POLICY "user_favorite_teams_insert_own" ON public.user_favorite_teams FOR INSERT WITH CHECK (false);
CREATE POLICY "user_favorite_teams_delete_own" ON public.user_favorite_teams FOR DELETE USING (false);

-- RLS Policies for tournament_results
CREATE POLICY "tournament_results_all" ON public.tournament_results FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for global_prediction_points
CREATE POLICY "global_prediction_points_all" ON public.global_prediction_points FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for drere_week_songs
CREATE POLICY "Anyone can view songs" ON public.drere_week_songs FOR SELECT USING (true);
CREATE POLICY "Service role can manage songs" ON public.drere_week_songs FOR ALL USING (true);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- User stats view (aggregated user statistics for leaderboard)
CREATE OR REPLACE VIEW public.user_stats AS
SELECT
  u.id,
  u.member_name,
  u.member_slug,
  u.is_admin,
  COALESCE(sum(pl.total_points), 0::bigint)::integer AS total_points,
  count(
    CASE
      WHEN pl.base_points = 3 THEN 1
      ELSE NULL::integer
    END
  )::integer AS exact_scores,
  count(
    CASE
      WHEN pl.visionary_bonus = 1 THEN 1
      ELSE NULL::integer
    END
  )::integer AS visionary_count,
  count(
    CASE
      WHEN pl.outsider_bonus = 1 THEN 1
      ELSE NULL::integer
    END
  )::integer AS outsider_count,
  count(pl.id)::integer AS matches_predicted,
  (
    SELECT count(*)::integer
    FROM daily_awards da
    WHERE da.user_id = u.id AND da.award_type = 'drere'
  ) AS crown_count
FROM users u
LEFT JOIN points_log pl ON u.id = pl.user_id
GROUP BY u.id, u.member_name, u.member_slug, u.is_admin;

-- ============================================================================
-- TEST USERS SEED DATA
-- ============================================================================

INSERT INTO public.users (id, email, member_id, member_name, member_slug, is_admin) VALUES
  ('test-user-1', 'test1@zbreplanning.test', 'test1', 'Test User Alpha', 'test-alpha', true),
  ('test-user-2', 'test2@zbreplanning.test', 'test2', 'Test User Beta', 'test-beta', false),
  ('test-user-3', 'test3@zbreplanning.test', 'test3', 'Test User Gamma', 'test-gamma', false);
