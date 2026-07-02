-- ============================================================================
-- Security hardening — Iteration 1 (deploy-INDEPENDENT part)
-- Safe to apply to prod BEFORE deploying the code: every table touched here is
-- only accessed by service-role API routes, never by the browser (anon key).
--
-- Closes:
--  - Pre-kickoff score-prediction leak (match_score_predictions readable by anon)
--  - Scoring manipulation (tournament_results / global_prediction_points writable by anon)
--  - drere_speeches fully open (RLS disabled)
--  - user_stats SECURITY DEFINER view
--  - update_updated_at mutable search_path
-- ============================================================================

-- 1. Score predictions: all reads/writes go through service-role routes that
--    mask picks before kickoff. The anon key must have zero access.
REVOKE ALL ON public.match_score_predictions FROM anon;

-- 2. Scoring tables: written only by admin/service-role routes. Keep SELECT
--    (leaderboard reads them via service role anyway), block anon writes so a
--    member can't self-attribute points or fake tournament results.
REVOKE INSERT, UPDATE, DELETE ON public.tournament_results       FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.global_prediction_points FROM anon;

-- 3. drere_speeches: RLS was disabled → fully open to the anon key. Enable RLS
--    with read-only access; writes happen through service-role routes.
ALTER TABLE public.drere_speeches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS drere_speeches_read ON public.drere_speeches;
CREATE POLICY drere_speeches_read ON public.drere_speeches
  FOR SELECT USING (true);

-- 4. user_stats view: run with the querying role's privileges, not the creator's.
ALTER VIEW public.user_stats SET (security_invoker = on);

-- 5. Pin the trigger function's search_path (advisor warning).
ALTER FUNCTION public.update_updated_at() SET search_path = '';
