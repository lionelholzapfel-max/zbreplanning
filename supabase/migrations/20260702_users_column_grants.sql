-- ============================================================================
-- Security hardening — Iteration 1 (deploy-COUPLED part)
--
-- ⚠️  RUN THIS ONLY AFTER DEPLOYING the matching code change, where
--     /api/auth/login, /api/auth/setup-pin and /api/auth/me use the
--     service-role client (getSupabaseAdmin) to read/write pin_hash.
--     If run while the old code is live, login BREAKS (old login reads
--     pin_hash with the anon key).
--
-- Closes:
--  - pin_hash readable with the public anon key (offline brute-force of 4-digit PINs)
--  - Account takeover: anon could PATCH users.pin_hash / insert an admin row.
--
-- Applied to prod on 2026-07-02.
-- ============================================================================

-- Anon may no longer UPDATE any user column (the browser never updates users;
-- login/setup/me now use the service role).
REVOKE UPDATE ON public.users FROM anon;

-- INSERT limited to safe columns so ensureUserInDb keeps working, while pin_hash
-- and is_admin can never be set from the client.
REVOKE INSERT ON public.users FROM anon;
GRANT  INSERT (id, email, member_id, member_name, member_slug)
  ON public.users TO anon;

-- SELECT limited to non-sensitive columns.
-- IMPORTANT: a column-level `REVOKE SELECT (pin_hash)` is a NO-OP while a
-- table-level SELECT grant exists (the table grant wins). So we drop the
-- table-level grant and re-grant SELECT on every column EXCEPT pin_hash.
REVOKE SELECT ON public.users FROM anon;
GRANT  SELECT (id, email, member_id, member_name, member_slug, created_at, is_admin)
  ON public.users TO anon;
