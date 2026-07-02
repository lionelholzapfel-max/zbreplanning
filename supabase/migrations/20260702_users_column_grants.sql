-- ============================================================================
-- Security hardening — Iteration 1 (deploy-COUPLED part)
--
-- ⚠️  RUN THIS ONLY AFTER DEPLOYING the matching code change, where
--     /api/auth/login, /api/auth/setup-pin and /api/auth/me switch from the
--     anon client to the service-role client (getSupabaseAdmin).
--
--     If you run it while prod still runs the old code, login BREAKS for
--     everyone (the old login reads pin_hash with the anon key).
--
-- Closes:
--  - pin_hash readable with the public anon key (offline brute-force of 4-digit PINs)
--  - Account takeover: anyone could PATCH users.pin_hash / insert an admin row
--    via the anon key (the inherited "Allow all operations on users" RLS policy).
--
-- Approach: column-level GRANTs. The browser still needs to INSERT a bare
-- profile (ensureUserInDb) and read member_name / member_slug for joins, but it
-- must never read pin_hash nor write pin_hash / is_admin.
-- ============================================================================

-- No column of users may be updated by the anon key (the browser never updates
-- users; login/setup/me now use the service role).
REVOKE UPDATE ON public.users FROM anon;

-- Reset INSERT, then re-grant ONLY the safe columns so ensureUserInDb keeps
-- working while pin_hash / is_admin can never be set from the client.
REVOKE INSERT ON public.users FROM anon;
GRANT  INSERT (id, email, member_id, member_name, member_slug)
  ON public.users TO anon;

-- Never expose the PIN hash to the anon key.
REVOKE SELECT (pin_hash) ON public.users FROM anon;
