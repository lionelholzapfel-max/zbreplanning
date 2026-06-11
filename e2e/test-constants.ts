/**
 * Test Constants
 *
 * All test-created data should use these prefixes for easy identification and cleanup.
 */

// Prefix for all test-created data (easy to identify and clean up)
export const TEST_PREFIX = '[E2E-TEST]';

// Test location names
export const TEST_LOCATION_NAME = `${TEST_PREFIX} Location`;

// Test activity names
export const TEST_ACTIVITY_TITLE = `${TEST_PREFIX} Activity`;

// Helper to create prefixed test data
export function testLocationName(suffix: string = ''): string {
  return `${TEST_LOCATION_NAME}${suffix ? ' ' + suffix : ''}`;
}

export function testActivityTitle(suffix: string = ''): string {
  return `${TEST_ACTIVITY_TITLE}${suffix ? ' ' + suffix : ''}`;
}

// Patterns for cleanup
export const CLEANUP_PATTERNS = {
  locations: [
    `${TEST_PREFIX}%`,
    'Test Location%',
    'test_%',
    'E2E%',
  ],
  activities: [
    `${TEST_PREFIX}%`,
    'Test%',
    'E2E%',
  ],
};
