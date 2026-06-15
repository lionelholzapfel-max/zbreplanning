-- Track when users see their Drère celebration
ALTER TABLE public.daily_awards ADD COLUMN IF NOT EXISTS celebration_seen_at TIMESTAMPTZ DEFAULT NULL;
