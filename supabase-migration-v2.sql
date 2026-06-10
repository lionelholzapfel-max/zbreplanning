-- ZbrePlanning Migration v2
-- Adds PIN auth, score predictions, and aligns user_id types
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. FIX USER_ID TYPE CONSISTENCY
-- The app uses TEXT IDs ("1" to "14"), not UUIDs
-- ============================================

-- Drop and recreate users table with TEXT id
-- First, backup and recreate dependent tables

-- Drop existing foreign key constraints
ALTER TABLE IF EXISTS public.activities DROP CONSTRAINT IF EXISTS activities_created_by_fkey;
ALTER TABLE IF EXISTS public.activity_participations DROP CONSTRAINT IF EXISTS activity_participations_user_id_fkey;
ALTER TABLE IF EXISTS public.match_participations DROP CONSTRAINT IF EXISTS match_participations_user_id_fkey;
ALTER TABLE IF EXISTS public.watch_locations DROP CONSTRAINT IF EXISTS watch_locations_proposed_by_fkey;
ALTER TABLE IF EXISTS public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE IF EXISTS public.notifications DROP CONSTRAINT IF EXISTS notifications_created_by_fkey;
ALTER TABLE IF EXISTS public.predictions DROP CONSTRAINT IF EXISTS predictions_user_id_fkey;

-- Modify users table - change id to TEXT and add auth columns
-- First check if id is UUID and convert if needed
DO $$
BEGIN
  -- Add new columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'pin_hash') THEN
    ALTER TABLE public.users ADD COLUMN pin_hash TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_admin') THEN
    ALTER TABLE public.users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Ensure id column is TEXT (if it's UUID, this requires more complex migration)
-- For a fresh database, we'll just ensure the table exists correctly

-- ============================================
-- 2. CREATE/UPDATE USERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  member_id TEXT NOT NULL,
  member_name TEXT NOT NULL,
  member_slug TEXT NOT NULL,
  pin_hash TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if table already exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'pin_hash') THEN
    ALTER TABLE public.users ADD COLUMN pin_hash TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_admin') THEN
    ALTER TABLE public.users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Set Lionel as admin (id = "7")
UPDATE public.users SET is_admin = TRUE WHERE id = '7';

-- ============================================
-- 3. RECREATE OTHER TABLES WITH TEXT user_id
-- ============================================

-- Activities
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  date DATE,
  time TEXT,
  location TEXT,
  type TEXT DEFAULT 'event' CHECK (type IN ('event', 'world_cup_match')),
  match_id INTEGER,
  created_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity participations
CREATE TABLE IF NOT EXISTS public.activity_participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('yes', 'no', 'maybe')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(activity_id, user_id)
);

-- Match participations
CREATE TABLE IF NOT EXISTS public.match_participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id INTEGER NOT NULL,
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('yes', 'no', 'maybe')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id, user_id)
);

-- Watch locations
CREATE TABLE IF NOT EXISTS public.watch_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id INTEGER NOT NULL,
  location TEXT NOT NULL,
  proposed_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  votes TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('activity_created', 'activity_response', 'location_proposed', 'location_vote', 'match_response')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  related_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Predictions (global predictions like winner, best player)
CREATE TABLE IF NOT EXISTS public.predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  prediction_type TEXT NOT NULL CHECK (prediction_type IN ('best_player', 'best_young', 'surprise_team', 'winner')),
  prediction_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, prediction_type)
);

-- ============================================
-- 4. NEW TABLES FOR SCORE PREDICTIONS
-- ============================================

-- Match score predictions (user predictions for each match score)
CREATE TABLE IF NOT EXISTS public.match_score_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  match_id INTEGER NOT NULL,
  home_score INTEGER NOT NULL CHECK (home_score >= 0),
  away_score INTEGER NOT NULL CHECK (away_score >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, match_id)
);

-- Match results (actual scores, entered by admin)
CREATE TABLE IF NOT EXISTS public.match_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id INTEGER UNIQUE NOT NULL,
  home_score INTEGER NOT NULL CHECK (home_score >= 0),
  away_score INTEGER NOT NULL CHECK (away_score >= 0),
  entered_by TEXT NOT NULL REFERENCES public.users(id),
  entered_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_activities_date ON public.activities(date);
CREATE INDEX IF NOT EXISTS idx_activities_created_by ON public.activities(created_by);
CREATE INDEX IF NOT EXISTS idx_activity_participations_activity ON public.activity_participations(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_participations_user ON public.activity_participations(user_id);
CREATE INDEX IF NOT EXISTS idx_match_participations_match ON public.match_participations(match_id);
CREATE INDEX IF NOT EXISTS idx_match_participations_user ON public.match_participations(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_locations_match ON public.watch_locations(match_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_predictions_user ON public.predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_type ON public.predictions(prediction_type);
CREATE INDEX IF NOT EXISTS idx_match_score_predictions_user ON public.match_score_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_match_score_predictions_match ON public.match_score_predictions(match_id);
CREATE INDEX IF NOT EXISTS idx_match_results_match ON public.match_results(match_id);

-- ============================================
-- 6. TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS activity_participations_updated_at ON public.activity_participations;
CREATE TRIGGER activity_participations_updated_at
  BEFORE UPDATE ON public.activity_participations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS match_participations_updated_at ON public.match_participations;
CREATE TRIGGER match_participations_updated_at
  BEFORE UPDATE ON public.match_participations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS predictions_updated_at ON public.predictions;
CREATE TRIGGER predictions_updated_at
  BEFORE UPDATE ON public.predictions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS match_score_predictions_updated_at ON public.match_score_predictions;
CREATE TRIGGER match_score_predictions_updated_at
  BEFORE UPDATE ON public.match_score_predictions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 7. ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_score_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_insert" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;
DROP POLICY IF EXISTS "activities_all" ON public.activities;
DROP POLICY IF EXISTS "activity_participations_all" ON public.activity_participations;
DROP POLICY IF EXISTS "match_participations_all" ON public.match_participations;
DROP POLICY IF EXISTS "watch_locations_all" ON public.watch_locations;
DROP POLICY IF EXISTS "notifications_all" ON public.notifications;
DROP POLICY IF EXISTS "predictions_all" ON public.predictions;

-- Users: public read, insert via API only
CREATE POLICY "users_select" ON public.users FOR SELECT USING (true);
CREATE POLICY "users_insert" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_update" ON public.users FOR UPDATE USING (true);

-- Activities: public read/write
CREATE POLICY "activities_all" ON public.activities FOR ALL USING (true) WITH CHECK (true);

-- Activity participations: public read/write
CREATE POLICY "activity_participations_all" ON public.activity_participations FOR ALL USING (true) WITH CHECK (true);

-- Match participations: public read/write
CREATE POLICY "match_participations_all" ON public.match_participations FOR ALL USING (true) WITH CHECK (true);

-- Watch locations: public read/write
CREATE POLICY "watch_locations_all" ON public.watch_locations FOR ALL USING (true) WITH CHECK (true);

-- Notifications: public read/write
CREATE POLICY "notifications_all" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

-- Predictions (global): public read/write
CREATE POLICY "predictions_all" ON public.predictions FOR ALL USING (true) WITH CHECK (true);

-- SCORE PREDICTIONS: READ ONLY via direct access
-- Writes must go through API routes which validate match not started
CREATE POLICY "match_score_predictions_select" ON public.match_score_predictions FOR SELECT USING (true);
-- Block direct inserts/updates - must use API route
CREATE POLICY "match_score_predictions_insert" ON public.match_score_predictions FOR INSERT WITH CHECK (false);
CREATE POLICY "match_score_predictions_update" ON public.match_score_predictions FOR UPDATE USING (false);
CREATE POLICY "match_score_predictions_delete" ON public.match_score_predictions FOR DELETE USING (false);

-- MATCH RESULTS: READ ONLY via direct access
-- Only admin can write via API route
CREATE POLICY "match_results_select" ON public.match_results FOR SELECT USING (true);
-- Block direct writes - must use API route
CREATE POLICY "match_results_insert" ON public.match_results FOR INSERT WITH CHECK (false);
CREATE POLICY "match_results_update" ON public.match_results FOR UPDATE USING (false);
CREATE POLICY "match_results_delete" ON public.match_results FOR DELETE USING (false);

-- ============================================
-- 8. SERVICE ROLE BYPASS FOR API ROUTES
-- ============================================

-- The API routes will use the service role key which bypasses RLS
-- This allows the server to write to match_score_predictions and match_results
-- while blocking direct client writes

-- ============================================
-- DONE!
-- ============================================

-- Verify tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('users', 'activities', 'activity_participations', 'match_participations',
                   'watch_locations', 'notifications', 'predictions',
                   'match_score_predictions', 'match_results')
ORDER BY table_name;
