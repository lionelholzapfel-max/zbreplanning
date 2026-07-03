/**
 * Database Connection Integration Test
 *
 * Verifies that tests connect to the TEST Supabase instance (not production)
 * and can read/write data correctly.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// These will be loaded from .env.test via vitest.config.ts
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

describe('Database Connection', () => {
  let supabase: ReturnType<typeof createClient>;

  beforeAll(() => {
    // Verify we're using the TEST instance, not production
    expect(supabaseUrl).toContain('cmigotevaosnhjqxmoqe');
    expect(supabaseUrl).not.toContain('wsimtsbtiijcyvgzavlp'); // prod ref

    supabase = createClient(supabaseUrl, supabaseServiceKey);
  });

  it('should connect to TEST Supabase instance', () => {
    expect(supabaseUrl).toBe('https://cmigotevaosnhjqxmoqe.supabase.co');
  });

  it('should have test users in the database', async () => {
    // Scoped to the test-user fixtures: the seed also holds the 14 real team
    // members (needed by the e2e suite) in the same table.
    const { data, error } = await supabase
      .from('users')
      .select('id, email, member_name, is_admin')
      .like('id', 'test-user-%')
      .order('id');

    expect(error).toBeNull();
    expect(data).toHaveLength(3);

    // Verify test users exist
    expect(data).toEqual([
      { id: 'test-user-1', email: 'test1@zbreplanning.test', member_name: 'Test User Alpha', is_admin: true },
      { id: 'test-user-2', email: 'test2@zbreplanning.test', member_name: 'Test User Beta', is_admin: false },
      { id: 'test-user-3', email: 'test3@zbreplanning.test', member_name: 'Test User Gamma', is_admin: false },
    ]);
  });

  it('should have user_stats view working', async () => {
    const { data, error } = await supabase
      .from('user_stats')
      .select('id, member_name, total_points')
      .like('id', 'test-user-%')
      .order('id');

    expect(error).toBeNull();
    expect(data).toHaveLength(3);
    expect(data![0].id).toBe('test-user-1');
    expect(data![0].total_points).toBe(0);
  });

  it('should be able to write and clean up test data', async () => {
    // Insert a test activity
    const testActivity = {
      title: '[VITEST] Connection Test Activity',
      description: 'Auto-generated test - safe to delete',
      date: '2099-12-31',
      location: 'Test Location',
      type: 'event',
    };

    const { data: inserted, error: insertError } = await supabase
      .from('activities')
      .insert(testActivity)
      .select()
      .single();

    expect(insertError).toBeNull();
    expect(inserted).toBeDefined();
    expect(inserted.title).toBe(testActivity.title);

    // Clean up: delete the test activity
    const { error: deleteError } = await supabase
      .from('activities')
      .delete()
      .eq('id', inserted.id);

    expect(deleteError).toBeNull();
  });
});
