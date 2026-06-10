-- ZbrePlanning Migration v5
-- Fix missing foreign key relationships that cause PGRST200 errors
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. FIX NOTIFICATIONS TABLE
-- ============================================
-- The created_by column needs a FK to users
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users(id)
  ON DELETE SET NULL;

-- ============================================
-- 2. FIX MATCH_PARTICIPATIONS TABLE
-- ============================================
-- The user_id column needs a FK to users
ALTER TABLE public.match_participations
  ADD CONSTRAINT match_participations_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.users(id)
  ON DELETE CASCADE;

-- ============================================
-- 3. FIX WATCH_LOCATIONS TABLE
-- ============================================
-- The proposed_by column needs a FK to users
ALTER TABLE public.watch_locations
  ADD CONSTRAINT watch_locations_proposed_by_fkey
  FOREIGN KEY (proposed_by)
  REFERENCES public.users(id)
  ON DELETE SET NULL;

-- ============================================
-- 4. FIX ACTIVITY_PARTICIPATIONS TABLE
-- ============================================
-- The user_id column needs a FK to users
ALTER TABLE public.activity_participations
  ADD CONSTRAINT activity_participations_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.users(id)
  ON DELETE CASCADE;

-- ============================================
-- 5. FIX ACTIVITIES TABLE
-- ============================================
-- The created_by column needs a FK to users (if not already exists)
ALTER TABLE public.activities
  DROP CONSTRAINT IF EXISTS activities_created_by_fkey;
ALTER TABLE public.activities
  ADD CONSTRAINT activities_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users(id)
  ON DELETE SET NULL;

-- ============================================
-- 6. VERIFY FOREIGN KEYS
-- ============================================
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
AND ccu.table_name = 'users'
ORDER BY tc.table_name;

-- ============================================
-- NOTE: If any ALTER fails with "constraint already exists",
-- the FK is already in place and you can ignore that specific error.
-- ============================================
