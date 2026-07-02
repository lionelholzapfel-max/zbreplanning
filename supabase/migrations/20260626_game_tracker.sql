-- ============================================================================
-- Game Tracker Migration
-- Feature standalone pour enregistrer les parties de jeux entre potes
-- Applied to TEST database only (cmigotevaosnhjqxmoqe)
-- ============================================================================

-- Table: games (catalogue des jeux)
CREATE TABLE public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  default_type text DEFAULT 'individual'
    CHECK (default_type IN ('individual', 'team')),
  created_at timestamptz DEFAULT now()
);

-- Table: game_sessions (chaque partie jouée)
CREATE TABLE public.game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  played_at date NOT NULL DEFAULT CURRENT_DATE,
  location text,
  session_type text NOT NULL
    CHECK (session_type IN ('individual', 'team')),
  winner_id text REFERENCES public.users(id),
  created_by text NOT NULL REFERENCES public.users(id),
  updated_by text REFERENCES public.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: game_participants (qui a joué)
CREATE TABLE public.game_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (session_id, user_id)
);

-- Indexes
CREATE INDEX idx_game_sessions_game ON public.game_sessions(game_id);
CREATE INDEX idx_game_sessions_winner ON public.game_sessions(winner_id);
CREATE INDEX idx_game_sessions_played_at ON public.game_sessions(played_at DESC);
CREATE INDEX idx_game_sessions_type ON public.game_sessions(session_type);
CREATE INDEX idx_game_participants_session ON public.game_participants(session_id);
CREATE INDEX idx_game_participants_user ON public.game_participants(user_id);

-- Trigger: auto-update updated_at on game_sessions
CREATE TRIGGER game_sessions_updated_at
  BEFORE UPDATE ON public.game_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: games
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "games_select" ON public.games FOR SELECT USING (true);
CREATE POLICY "games_insert" ON public.games FOR INSERT WITH CHECK (false);
CREATE POLICY "games_update" ON public.games FOR UPDATE USING (false);
CREATE POLICY "games_delete" ON public.games FOR DELETE USING (false);

-- RLS: game_sessions
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "game_sessions_select" ON public.game_sessions FOR SELECT USING (true);
CREATE POLICY "game_sessions_insert" ON public.game_sessions FOR INSERT WITH CHECK (false);
CREATE POLICY "game_sessions_update" ON public.game_sessions FOR UPDATE USING (false);
CREATE POLICY "game_sessions_delete" ON public.game_sessions FOR DELETE USING (false);

-- RLS: game_participants
ALTER TABLE public.game_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "game_participants_select" ON public.game_participants FOR SELECT USING (true);
CREATE POLICY "game_participants_insert" ON public.game_participants FOR INSERT WITH CHECK (false);
CREATE POLICY "game_participants_update" ON public.game_participants FOR UPDATE USING (false);
CREATE POLICY "game_participants_delete" ON public.game_participants FOR DELETE USING (false);
