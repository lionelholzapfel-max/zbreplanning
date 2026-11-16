-- FPL Drère song: Suno only gives a temporary audio URL, so the callback copies
-- the mp3 into the private `fpl-private` bucket; this column remembers where.
-- Rollback: ALTER TABLE public.fpl_gw_reviews DROP COLUMN song_storage_path;
ALTER TABLE public.fpl_gw_reviews ADD COLUMN IF NOT EXISTS song_storage_path text;
