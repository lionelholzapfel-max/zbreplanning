-- ============================================
-- E2E Test Data Cleanup Script
-- ============================================
-- Run this in Supabase SQL Editor to clean up
-- all test data created by Playwright tests.
-- ============================================

-- Show what will be deleted first (DRY RUN)
SELECT 'watch_locations to delete:' as info;
SELECT id, location, created_at FROM watch_locations
WHERE location LIKE '[E2E-TEST]%'
   OR location LIKE 'Test Location%'
   OR location LIKE 'E2E%';

SELECT 'location_votes to delete:' as info;
SELECT lv.* FROM location_votes lv
JOIN watch_locations wl ON lv.location_id = wl.id
WHERE wl.location LIKE '[E2E-TEST]%'
   OR wl.location LIKE 'Test Location%'
   OR wl.location LIKE 'E2E%';

SELECT 'activities to delete:' as info;
SELECT id, title, created_at FROM activities
WHERE title LIKE '[E2E-TEST]%'
   OR title LIKE 'Test%Activity%'
   OR title LIKE 'E2E%';

-- ============================================
-- ACTUAL CLEANUP (uncomment to run)
-- ============================================

-- Step 1: Delete votes on test locations
DELETE FROM location_votes
WHERE location_id IN (
  SELECT id FROM watch_locations
  WHERE location LIKE '[E2E-TEST]%'
     OR location LIKE 'Test Location%'
     OR location LIKE 'E2E%'
);

-- Step 2: Delete test locations
DELETE FROM watch_locations
WHERE location LIKE '[E2E-TEST]%'
   OR location LIKE 'Test Location%'
   OR location LIKE 'E2E%';

-- Step 3: Delete participations on test activities
DELETE FROM activity_participations
WHERE activity_id IN (
  SELECT id FROM activities
  WHERE title LIKE '[E2E-TEST]%'
     OR title LIKE 'Test%Activity%'
     OR title LIKE 'E2E%'
);

-- Step 4: Delete test activities
DELETE FROM activities
WHERE title LIKE '[E2E-TEST]%'
   OR title LIKE 'Test%Activity%'
   OR title LIKE 'E2E%';

-- Verify cleanup
SELECT 'Remaining test locations:' as info, COUNT(*) as count
FROM watch_locations
WHERE location LIKE '%E2E%' OR location LIKE '%Test%';

SELECT 'Remaining test activities:' as info, COUNT(*) as count
FROM activities
WHERE title LIKE '%E2E%' OR title LIKE '%Test%';

SELECT 'Cleanup complete!' as status;
