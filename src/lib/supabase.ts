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
 * 
 * IMPORTANT: In Next.js server actions, we need to read cookies to get user session.
 * Service role keys bypass RLS but don't have user context, so getSession() won't work.
 * 
 * This function uses the anon key and reads session from cookies.
 */
export async function createServerClient(clientAccessToken?: string): Promise<SupabaseClient<Database>> {
  const serverUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  
  if (!serverUrl) {
    throw new Error('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  // For server actions, we need to use anon key and read cookies for user session
  // Service role key bypasses RLS but doesn't have user context for getSession()
  const anonKey = 
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!anonKey) {
    throw new Error(
      'Missing Supabase anon key. ' +
      'Please set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  // Create a custom storage that reads from Next.js cookies
  // IMPORTANT: cookies() is now async in Next.js 15 and must be awaited
  // So we call it once and cache all cookies
  let cachedCookies: Map<string, string> | null = null;
  
  try {
    // Use require for dynamic import in server context
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { cookies } = require('next/headers');
    // cookies() returns a Promise in Next.js 15 - must await it
    const cookieStore = await cookies();
    // getAll() is synchronous on the cookie store
    const allCookies = cookieStore.getAll();
    cachedCookies = new Map(allCookies.map((c: { name: string; value: string }) => [c.name, c.value]));
  } catch {
    // cookies() not available (e.g., in non-server context)
    cachedCookies = null;
  }
  
  // Extract project ref from URL to build correct cookie name
  const projectRef = serverUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] || '';
  const authCookieName = projectRef ? `sb-${projectRef}-auth-token` : null;
  
  // Extract access token from cookies for explicit session setting
  let accessToken: string | null = null;
  let refreshToken: string | null = null;
  
  if (cachedCookies) {
    // Try the calculated cookie name first
    if (authCookieName) {
      const cookieValue = cachedCookies.get(authCookieName);
      if (cookieValue) {
        try {
          const decoded = decodeURIComponent(cookieValue);
          const parsed = JSON.parse(decoded);
          if (parsed.access_token) {
            accessToken = parsed.access_token;
            refreshToken = parsed.refresh_token || null;
          }
        } catch {
          // Not JSON, might be token directly
          if (cookieValue.length > 100) {
            accessToken = cookieValue;
          }
        }
      }
    }
    
    // Fallback: search all cookies for auth token
    if (!accessToken) {
      for (const [name, value] of cachedCookies.entries()) {
        if (name.includes('auth-token') || (name.startsWith('sb-') && name.includes('auth'))) {
          try {
            const decoded = decodeURIComponent(value);
            const parsed = JSON.parse(decoded);
            if (parsed.access_token) {
              accessToken = parsed.access_token;
              refreshToken = parsed.refresh_token || null;
              break;
            }
          } catch {
            // Not JSON
            if (value.length > 100 && value.startsWith('eyJ')) {
              accessToken = value;
            }
          }
        }
      }
    }
    
    // Debug: Log available cookies if no token found (only in development)
    if (!accessToken && process.env.NODE_ENV === 'development') {
      const authCookies = Array.from(cachedCookies.entries())
        .filter(([name]) => name.includes('auth') || name.startsWith('sb-'));
      if (authCookies.length > 0) {
        console.log('[Supabase] Found auth-related cookies but couldn\'t extract token:', 
          authCookies.map(([name]) => name));
      }
    }
  }
  
  const createCookieStorage = () => {
    if (!cachedCookies) {
      return {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      };
    }
    
    return {
      getItem: (key: string): string | null => {
        try {
          // Supabase uses keys like 'sb-<project-ref>-auth-token'
          // First try the exact key
          const cookieValue = cachedCookies!.get(key);
          if (cookieValue) {
            return cookieValue;
          }
          
          // Try the calculated cookie name
          if (authCookieName && key.includes('auth-token')) {
            const cookieValue = cachedCookies!.get(authCookieName);
            if (cookieValue) {
              return cookieValue;
            }
          }
          
          // Also try looking for any Supabase auth cookie
          // Supabase stores session as JSON: { access_token, refresh_token, expires_at, etc. }
          for (const [name, value] of cachedCookies!.entries()) {
            if (name.includes('auth-token') || 
                (name.startsWith('sb-') && name.includes('auth'))) {
              // Return the value as-is - Supabase will parse it
              return value;
            }
          }
          return null;
        } catch {
          return null;
        }
      },
      setItem: () => {
        // Server actions can't set cookies - handled by client
      },
      removeItem: () => {
        // Server actions can't remove cookies - handled by client
      },
    };
  };
  
  // If access token is provided as parameter, use it (from client-side)
  // Validate client-provided token format before using it
  // If malformed, ignore it and rely on cookies only
  let validClientToken: string | undefined = undefined;
  if (clientAccessToken) {
    const tokenParts = clientAccessToken.split('.');
    if (tokenParts.length === 3) {
      validClientToken = clientAccessToken;
    } else {
      // Malformed token from client - ignore it and use cookies instead
      console.warn('[Supabase] Client provided malformed token - ignoring and using cookies only');
    }
  }
  
  // Otherwise, try to extract from cookies
  const finalAccessToken = validClientToken || accessToken;
  const finalRefreshToken = refreshToken;
  
  const client = createClient<Database>(serverUrl, anonKey, {
    auth: {
      persistSession: true, // Enable persistence so getSession() reads from storage
      autoRefreshToken: false,
      storage: createCookieStorage(),
    },
    global: {
      // Only set Authorization header if we have a valid token
      // If token is malformed, cookies should still work for authentication
      headers: finalAccessToken ? {
        Authorization: `Bearer ${finalAccessToken}`
      } : {}
    }
  });
  
  // CRITICAL: If we found tokens, set them explicitly on the client BEFORE returning
  // This ensures the session is available for RLS checks AND for getUser()/getSession() calls
  // The Authorization header works for RLS, but getUser() requires a session in storage
  if (finalAccessToken) {
    try {
      // Validate token format before setting (JWT should have 3 parts separated by dots)
      const tokenParts = finalAccessToken.split('.');
      if (tokenParts.length !== 3) {
        console.warn('[Supabase] Invalid token format (malformed JWT) - skipping setSession, but Authorization header will still work');
        // Don't set session if token is malformed, but Authorization header should still work for RLS
      } else {
        const { error } = await client.auth.setSession({
          access_token: finalAccessToken,
          refresh_token: finalRefreshToken || '',
        } as { access_token: string; refresh_token: string });
        
        if (error) {
          // Only log if it's not a "session missing" or "malformed" error
          // Authorization header should still work for RLS
          if (!error.message.includes('session missing') && 
              !error.message.includes('Auth session missing') &&
              !error.message.includes('malformed')) {
            console.warn('[Supabase] Failed to set session:', error.message);
          }
        }
      }
    } catch (err: any) {
      // Only log if it's not a "session missing" or "malformed" error
      // Authorization header should still work for RLS even if setSession() fails
      const errMsg = err?.message || String(err);
      if (!errMsg.includes('session missing') && 
          !errMsg.includes('Auth session missing') &&
          !errMsg.includes('malformed')) {
        console.warn('[Supabase] Failed to set session:', errMsg);
      }
    }
  }
  
  return client;
}

