-- FPL mini-league: one AI-written review per gameweek (+ the Drère song of that GW).
-- Written ONLY by API routes with the service role; no anon/authenticated access
-- (RLS on, no policies). The site reads it server-side with the service role.
--
-- Rollback: DROP TABLE public.fpl_gw_reviews;  (new table, no existing data touched)

CREATE TABLE IF NOT EXISTS public.fpl_gw_reviews (
  season        text        NOT NULL,
  gw            integer     NOT NULL CHECK (gw BETWEEN 1 AND 38),
  -- 'generating' while the Claude call runs (acts as a lock), then 'ready' / 'failed'
  status        text        NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'ready', 'failed')),
  facts         jsonb,                -- deterministic numbers handed to the writer
  review        jsonb,                -- the written review (validated JSON)
  model         text,
  input_tokens  integer,
  output_tokens integer,
  cost_usd      numeric(10, 5) NOT NULL DEFAULT 0,
  error_message text,
  attempts      integer     NOT NULL DEFAULT 1, -- paid attempts; the pipeline stops at 3
  drere_slugs   text[]      NOT NULL DEFAULT '{}',
  mzi_slugs     text[]      NOT NULL DEFAULT '{}',
  song_status   text        NOT NULL DEFAULT 'none' CHECK (song_status IN ('none', 'generating', 'completed', 'failed')),
  song_task_id  text,
  song_audio_url text,
  song_cover_url text,
  song_title    text,
  song_lyrics   text,
  song_error    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- Budget lock: at most ONE review per gameweek, enforced by the database.
  PRIMARY KEY (season, gw)
);

CREATE UNIQUE INDEX IF NOT EXISTS fpl_gw_reviews_song_task_id_key
  ON public.fpl_gw_reviews (song_task_id) WHERE song_task_id IS NOT NULL;

ALTER TABLE public.fpl_gw_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fpl_gw_reviews FROM anon, authenticated;
