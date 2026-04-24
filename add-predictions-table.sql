-- Add predictions table for World Cup betting
-- Run this in Supabase SQL Editor

-- Drop if exists (for testing)
DROP TABLE IF EXISTS public.predictions CASCADE;

-- Predictions table
CREATE TABLE public.predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  prediction_type TEXT NOT NULL CHECK (prediction_type IN ('best_player', 'best_young', 'surprise_team', 'winner')),
  prediction_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, prediction_type)
);

-- Enable RLS
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

-- Allow all operations (no auth)
CREATE POLICY "Allow all operations on predictions" ON public.predictions FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_predictions_user ON public.predictions(user_id);
CREATE INDEX idx_predictions_type ON public.predictions(prediction_type);

-- Trigger to update updated_at
CREATE TRIGGER predictions_updated_at
  BEFORE UPDATE ON public.predictions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
