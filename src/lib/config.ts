/**
 * Environment-specific configuration
 */

export type Environment = 'development' | 'staging' | 'production';

export interface AppConfig {
  environment: Environment;
  supabaseUrl: string;
  enableGarmin: boolean;
  enableAnalytics: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Detects current environment
 */
function getEnvironment(): Environment {
  if (typeof window === 'undefined') {
    // Server-side
    const env = process.env.NODE_ENV;
    if (env === 'production') return 'production';
    // Check for custom staging environment variable
    if (process.env.ENVIRONMENT === 'staging') return 'staging';
    return 'development';
  }
  
  // Client-side
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'development';
  }
  if (hostname.includes('staging') || hostname.includes('preview')) {
    return 'staging';
  }
  return 'production';
}

/**
 * Gets application configuration
 */
export function getConfig(): AppConfig {
  const environment = getEnvironment();
  
  return {
    environment,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    enableGarmin: !!process.env.GARMIN_EMAIL && !!process.env.GARMIN_PASSWORD,
    enableAnalytics: environment === 'production',
    logLevel: environment === 'production' ? 'info' : 'debug'
  };
}

/**
 * Feature flags
 */
export const featureFlags = {
  garminIntegration: () => getConfig().enableGarmin,
  analytics: () => getConfig().enableAnalytics,
  debugMode: () => getConfig().environment === 'development'
};

/**
 * API endpoints per environment
 */
export const apiEndpoints = {
  supabase: () => getConfig().supabaseUrl,
  garmin: () => {
    // Garmin API endpoints would go here if needed
    return '';
  }
};

