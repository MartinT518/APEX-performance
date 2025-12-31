/**
 * Test database utilities for Supabase test project
 */

import { createClient } from '@supabase/supabase-js';

const TEST_SUPABASE_URL = process.env.TEST_SUPABASE_URL || 'http://localhost:54321';
const TEST_SUPABASE_ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY || 'test-anon-key';
const TEST_SUPABASE_SERVICE_KEY = process.env.TEST_SUPABASE_SERVICE_KEY || 'test-service-key';

export function createTestSupabaseClient() {
  return createClient(TEST_SUPABASE_URL, TEST_SUPABASE_SERVICE_KEY);
}

export async function seedTestData(client: ReturnType<typeof createTestSupabaseClient>, data: {
  users?: Array<{ id: string; email: string }>;
  healthData?: Array<Record<string, unknown>>;
  sessions?: Array<Record<string, unknown>>;
}) {
  // Seed users
  if (data.users && data.users.length > 0) {
    // Note: In real implementation, you'd use Supabase Auth API
    // For testing, we'll insert directly into auth.users if service key allows
  }

  // Seed health data
  if (data.healthData && data.healthData.length > 0) {
    const { error } = await client.from('daily_monitoring').insert(data.healthData);
    if (error) {
      throw new Error(`Failed to seed health data: ${error.message}`);
    }
  }

  // Seed sessions
  if (data.sessions && data.sessions.length > 0) {
    const { error } = await client.from('session_logs').insert(data.sessions);
    if (error) {
      throw new Error(`Failed to seed sessions: ${error.message}`);
    }
  }
}

export async function cleanupTestData(
  client: ReturnType<typeof createTestSupabaseClient>,
  userId: string
) {
  // Clean up test data for a user
  await client.from('daily_decision_snapshot').delete().eq('user_id', userId);
  await client.from('session_logs').delete().eq('user_id', userId);
  await client.from('daily_monitoring').delete().eq('user_id', userId);
  // Note: User cleanup would require Supabase Auth API
}
