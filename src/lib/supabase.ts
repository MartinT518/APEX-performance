import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Supabase Client Utility
 * 
 * Creates and exports a typed Supabase client for use throughout the application.
 * Uses environment variables for configuration.
 * 
 * For client-side usage, ensure NEXT_PUBLIC_ prefix is used for env vars.
 * For server-side usage, use standard env vars without prefix.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
// Support both new (publishable) and legacy (anon) key formats
const supabaseAnonKey = 
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Please set NEXT_PUBLIC_SUPABASE_URL and ' +
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY for legacy) ' +
    'or SUPABASE_URL and SUPABASE_ANON_KEY for server-side usage.'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Server-side Supabase client (for use in Server Actions and API routes)
 * Uses service role key for admin operations (if available)
 * 
 * SECURITY: Only accepts server-side keys, never falls back to client-side keys
 */
export function createServerClient(): SupabaseClient<Database> {
  const serverUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Only accept server-side keys - never fall back to client-side keys
  const serverKey = 
    process.env.SUPABASE_SECRET_DEFAULT_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serverUrl) {
    throw new Error('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!serverKey) {
    throw new Error(
      'Missing Supabase server key. ' +
      'Please set SUPABASE_SECRET_DEFAULT_KEY or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Never use client-side keys (NEXT_PUBLIC_*) for server operations.'
    );
  }

  return createClient<Database>(serverUrl, serverKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

