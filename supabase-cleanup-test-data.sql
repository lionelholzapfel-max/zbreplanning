-- ZbrePlanning: Cleanup Test Data from Production
-- Run this in Supabase SQL Editor to remove test artifacts

-- ============================================
-- 1. DELETE TEST WATCH LOCATIONS
-- ============================================
DELETE FROM public.watch_locations
WHERE location ILIKE 'Test Location%'
   OR location ILIKE 'test_%'
   OR location ILIKE '%[TEST]%'
   OR location ILIKE 'E2E%';

-- ============================================
-- 2. DELETE TEST ACTIVITIES
-- ============================================
DELETE FROM public.activity_participations
WHERE activity_id IN (
  SELECT id FROM public.activities
  WHERE title ILIKE 'Test%'
     OR title ILIKE 'E2E%'
     OR title ILIKE '%[TEST]%'
     OR description ILIKE '%test%location%'
);

DELETE FROM public.activities
WHERE title ILIKE 'Test%'
   OR title ILIKE 'E2E%'
   OR title ILIKE '%[TEST]%'
   OR description ILIKE '%test%location%';

-- ============================================
-- 3. DELETE TEST NOTIFICATIONS
-- ============================================
DELETE FROM public.notifications
WHERE title ILIKE '%Test%'
   OR message ILIKE '%Test Location%'
   OR message ILIKE '%E2E%';

-- ============================================
-- 4. VERIFY CLEANUP
-- ============================================
SELECT 'watch_locations with Test' as table_name, COUNT(*) as remaining
FROM public.watch_locations
WHERE location ILIKE '%test%'
UNION ALL
SELECT 'activities with Test', COUNT(*)
FROM public.activities
WHERE title ILIKE '%test%'
UNION ALL
SELECT 'notifications with Test', COUNT(*)
FROM public.notifications
WHERE title ILIKE '%test%' OR message ILIKE '%test%';

-- Expected: All counts should be 0
