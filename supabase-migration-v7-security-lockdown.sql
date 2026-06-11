-- ============================================
-- V7: SECURITY LOCKDOWN - Close write policies
-- ============================================
-- This migration locks down client writes on sensitive tables.
-- All writes MUST go through API routes with service role key.
-- ============================================

-- ============================================
-- 1. PREDICTIONS TABLE (CRITICAL)
-- Global predictions must go through /api/predictions/global
-- ============================================

-- Drop the open policy
DROP POLICY IF EXISTS "predictions_all" ON public.predictions;

-- Allow public read
CREATE POLICY "predictions_select" ON public.predictions
  FOR SELECT USING (true);

-- Block direct writes - API route uses service role
CREATE POLICY "predictions_insert" ON public.predictions
  FOR INSERT WITH CHECK (false);
CREATE POLICY "predictions_update" ON public.predictions
  FOR UPDATE USING (false);
CREATE POLICY "predictions_delete" ON public.predictions
  FOR DELETE USING (false);

-- ============================================
-- 2. USERS TABLE
-- Writes via /api/auth/* routes only
-- ============================================

DROP POLICY IF EXISTS "users_insert" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;

-- Keep public read for member info display
-- users_select already exists from v2

-- Block direct writes
CREATE POLICY "users_insert" ON public.users
  FOR INSERT WITH CHECK (false);
CREATE POLICY "users_update" ON public.users
  FOR UPDATE USING (false);
CREATE POLICY "users_delete" ON public.users
  FOR DELETE USING (false);

-- ============================================
-- 3. NOTIFICATIONS TABLE
-- System-only writes via API routes
-- ============================================

DROP POLICY IF EXISTS "notifications_all" ON public.notifications;

CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT USING (true);
CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT WITH CHECK (false);
CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE USING (false);
CREATE POLICY "notifications_delete" ON public.notifications
  FOR DELETE USING (false);

-- ============================================
-- 4. ACTIVITIES, PARTICIPATIONS, LOCATIONS
-- These are less sensitive - members can CRUD
-- Keep open for now (no secrets, no points)
-- If needed, migrate to API routes later
-- ============================================

-- Optional: Lock these down too if you want full API control
-- For now, keeping open as they don't affect scoring

-- ============================================
-- VERIFY POLICIES
-- ============================================

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================
-- DONE - Run this in Supabase SQL Editor
-- ============================================
