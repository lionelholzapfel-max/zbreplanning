-- ============================================
-- V6: Tournament Results & Global Predictions Scoring
-- ============================================
-- Adds:
-- 1. tournament_results table for storing actual winners (MVP, best young, etc.)
-- 2. global_prediction_points table for tracking +20 pts per correct prediction
-- ============================================

-- Tournament Results Table
-- Stores the actual tournament outcomes entered by admin
CREATE TABLE IF NOT EXISTS public.tournament_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_type TEXT NOT NULL CHECK (prediction_type IN ('winner', 'best_player', 'best_young', 'surprise_team')),
  result_value TEXT NOT NULL,
  entered_by TEXT REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(prediction_type)
);

-- Trigger for updated_at
CREATE OR REPLACE TRIGGER tournament_results_updated_at
  BEFORE UPDATE ON public.tournament_results
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Global Prediction Points Table
-- Tracks which users earned points for correct global predictions
CREATE TABLE IF NOT EXISTS public.global_prediction_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  prediction_type TEXT NOT NULL CHECK (prediction_type IN ('winner', 'best_player', 'best_young', 'surprise_team')),
  predicted_value TEXT NOT NULL,
  actual_value TEXT NOT NULL,
  points_awarded INTEGER NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, prediction_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_global_prediction_points_user ON public.global_prediction_points(user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_results_type ON public.tournament_results(prediction_type);

-- RLS Policies (using admin service role for writes, public read)
ALTER TABLE public.tournament_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_prediction_points ENABLE ROW LEVEL SECURITY;

-- Tournament results: public read, admin write (via service role)
CREATE POLICY "tournament_results_read" ON public.tournament_results FOR SELECT USING (true);
CREATE POLICY "tournament_results_admin" ON public.tournament_results FOR ALL USING (true) WITH CHECK (true);

-- Global prediction points: public read (for leaderboard), admin write
CREATE POLICY "global_prediction_points_read" ON public.global_prediction_points FOR SELECT USING (true);
CREATE POLICY "global_prediction_points_admin" ON public.global_prediction_points FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Run this migration in Supabase SQL Editor
-- ============================================
