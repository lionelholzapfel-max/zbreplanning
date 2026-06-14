-- Add 'mzi' award type to daily_awards
-- Drop the existing constraint and recreate with new values
ALTER TABLE public.daily_awards DROP CONSTRAINT IF EXISTS daily_awards_award_type_check;
ALTER TABLE public.daily_awards ADD CONSTRAINT daily_awards_award_type_check
  CHECK (award_type IN ('drere', 'wooden_spoon', 'mzi'));
