/**
 * Feature Store
 * 
 * Computes rolling windows (7d, 14d, 28d, 42d) for readiness context.
 * Implements memoization to avoid recalculating 2,707 days of data on every page load.
 * 
 * Roadmap requirement: "do not re-calculate 2,707 days of Z-Scores on every page load"
 */

import { createServerClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { calculateRollingAverage } from './baselineEngine';
import { getSourceQuality } from '@/modules/monitor/ingestion/normalizer';

export interface RollingWindowMetrics {
  load_volume: number; // km
  intensity_minutes: number; // minutes in Z4/Z5
  hrv_trend: number; // average HRV
  rhr_trend: number; // average RHR
  sleep_midpoint_irregularity: number; // standard deviation of sleep midpoint times
}

export interface ReadinessContext {
  date: string;
  windows: {
    '7d': RollingWindowMetrics;
    '14d': RollingWindowMetrics;
    '28d': RollingWindowMetrics;
    '42d': RollingWindowMetrics;
  };
  cached_at: string; // ISO timestamp
}

// In-memory cache for readiness contexts (keyed by userId:date)
const readinessCache = new Map<string, ReadinessContext>();

// Cache TTL: 1 hour (3600000 ms)
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Gets cached readiness context if available and not expired
 */
function getCachedContext(userId: string, date: string): ReadinessContext | null {
  const cacheKey = `${userId}:${date}`;
  const cached = readinessCache.get(cacheKey);
  
  if (!cached) return null;
  
  const cacheAge = Date.now() - new Date(cached.cached_at).getTime();
  if (cacheAge > CACHE_TTL_MS) {
    readinessCache.delete(cacheKey);
    return null;
  }
  
  return cached;
}

/**
 * Sets cached readiness context
 */
function setCachedContext(userId: string, date: string, context: ReadinessContext): void {
  const cacheKey = `${userId}:${date}`;
  readinessCache.set(cacheKey, context);
  
  // Limit cache size to prevent memory issues (keep last 100 entries)
  if (readinessCache.size > 100) {
    const firstKey = readinessCache.keys().next().value;
    if (firstKey) {
      readinessCache.delete(firstKey);
    }
  }
}

/**
 * Calculates sleep midpoint irregularity (standard deviation of sleep midpoint times)
 * 
 * @param bedtimes - Array of bedtime strings (HH:MM:SS format)
 * @param wakeTimes - Array of wake time strings (HH:MM:SS format)
 * @returns Standard deviation of sleep midpoints in hours
 */
function calculateSleepMidpointIrregularity(
  bedtimes: (string | null)[],
  wakeTimes: (string | null)[]
): number {
  const midpoints: number[] = [];
  
  for (let i = 0; i < bedtimes.length; i++) {
    const bedtime = bedtimes[i];
    const wakeTime = wakeTimes[i];
    
    if (!bedtime || !wakeTime) continue;
    
    try {
      // Parse HH:MM:SS to hours since midnight
      const [bedHour, bedMin, bedSec] = bedtime.split(':').map(Number);
      const [wakeHour, wakeMin, wakeSec] = wakeTime.split(':').map(Number);
      
      const bedHours = bedHour + bedMin / 60 + bedSec / 3600;
      const wakeHours = wakeHour + wakeMin / 60 + wakeSec / 3600;
      
      // Handle bedtime after midnight (e.g., 23:00 to 07:00)
      let bedHoursAdjusted = bedHours;
      if (bedHours > wakeHours) {
        bedHoursAdjusted = bedHours - 24; // Bedtime is previous day
      }
      
      // Sleep midpoint = (wakeTime + bedtime) / 2
      const midpoint = (wakeHours + bedHoursAdjusted) / 2;
      midpoints.push(midpoint);
    } catch (e) {
      // Skip invalid time formats
      continue;
    }
  }
  
  if (midpoints.length < 2) return 0;
  
  // Calculate standard deviation
  const mean = calculateRollingAverage(midpoints);
  const variance = calculateRollingAverage(midpoints.map(m => Math.pow(m - mean, 2)));
  return Math.sqrt(variance);
}

/**
 * Loads historical data for rolling window calculations
 */
async function loadHistoricalData(
  userId: string,
  targetDate: string,
  windowDays: number
): Promise<{
  monitoring: Array<{
    date: string;
    hrv: number | null;
    rhr: number | null;
    sleep_seconds: number | null;
    bedtime: string | null;
    wake_time: string | null;
  }>;
  sessions: Array<{
    session_date: string;
    distance_km: number | null;
    duration_minutes: number;
    metadata: any;
    hr_source: 'WRIST_HR' | 'CHEST_STRAP' | 'UNKNOWN' | null;
    device: string | null;
  }>;
  monitoringWithSource: Array<{
    date: string;
    hrv: number | null;
    rhr: number | null;
    sleep_seconds: number | null;
    bedtime: string | null;
    wake_time: string | null;
    hrv_method: 'GARMIN' | 'MANUAL' | 'UNKNOWN' | null;
  }>;
}> {
  const supabase = await createServerClient();
  
  // Calculate date range
  const target = new Date(targetDate);
  const startDate = new Date(target);
  startDate.setDate(startDate.getDate() - windowDays);
  
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = target.toISOString().split('T')[0];
  
  // Load monitoring data (including hrv_method for source weighting)
  const { data: monitoring, error: monitoringError } = await supabase
    .from('daily_monitoring')
    .select('date, hrv, rhr, sleep_seconds, bedtime, wake_time, hrv_method')
    .eq('user_id', userId)
    .gte('date', startDateStr)
    .lte('date', endDateStr)
    .order('date', { ascending: true });
  
  if (monitoringError) {
    logger.error('Failed to load monitoring data for feature store:', monitoringError);
    throw monitoringError;
  }
  
  // Load session data (including hr_source and device for source weighting)
  const { data: sessions, error: sessionsError } = await supabase
    .from('session_logs')
    .select('session_date, duration_minutes, metadata, hr_source, device')
    .eq('user_id', userId)
    .gte('session_date', startDateStr)
    .lte('session_date', endDateStr)
    .eq('sport_type', 'RUNNING')
    .order('session_date', { ascending: true });
  
  if (sessionsError) {
    logger.error('Failed to load session data for feature store:', sessionsError);
    throw sessionsError;
  }
  
  // Extract distance from metadata or calculate from duration
  const sessionsWithDistance = (sessions || []).map(session => {
    const metadata = session.metadata as any;
    let distanceKm: number | null = null;
    
    if (metadata?.distanceKm) {
      distanceKm = Number(metadata.distanceKm);
    } else if (metadata?.distanceInMeters) {
      distanceKm = Number(metadata.distanceInMeters) / 1000;
    } else if (metadata?.averagePace && session.duration_minutes) {
      // Calculate from pace: distance = (duration * 60) / pace_seconds_per_km
      const paceSeconds = Number(metadata.averagePace);
      if (paceSeconds > 0) {
        distanceKm = (session.duration_minutes * 60) / paceSeconds;
      }
    }
    
    return {
      session_date: session.session_date,
      distance_km: distanceKm,
      duration_minutes: session.duration_minutes,
      metadata: session.metadata,
      hr_source: (session as any).hr_source || null,
      device: (session as any).device || null
    };
  });
  
  return {
    monitoring: (monitoring || []).map(m => ({
      date: m.date,
      hrv: m.hrv !== null ? Number(m.hrv) : null,
      rhr: m.rhr !== null ? Number(m.rhr) : null,
      sleep_seconds: m.sleep_seconds !== null ? Number(m.sleep_seconds) : null,
      bedtime: m.bedtime,
      wake_time: m.wake_time
    })),
    monitoringWithSource: (monitoring || []).map(m => ({
      date: m.date,
      hrv: m.hrv !== null ? Number(m.hrv) : null,
      rhr: m.rhr !== null ? Number(m.rhr) : null,
      sleep_seconds: m.sleep_seconds !== null ? Number(m.sleep_seconds) : null,
      bedtime: m.bedtime,
      wake_time: m.wake_time,
      hrv_method: (m as any).hrv_method || null
    })),
    sessions: sessionsWithDistance
  };
}

/**
 * Calculates weighted average based on source quality
 * 
 * @param values - Array of values to average
 * @param sources - Array of source quality indicators (hrv_method for HRV, hr_source for RHR)
 * @returns Weighted average
 */
function calculateWeightedAverage(
  values: number[],
  sources: Array<'HIGH' | 'MEDIUM' | 'LOW' | null>
): number {
  if (values.length === 0) return 0;
  if (values.length !== sources.length) {
    // If sources don't match, fall back to unweighted average
    return calculateRollingAverage(values);
  }
  
  // Source quality weights
  const weights: Record<'HIGH' | 'MEDIUM' | 'LOW', number> = {
    HIGH: 1.0,    // Chest strap - most accurate
    MEDIUM: 0.8,  // Wrist HR - less accurate
    LOW: 0.5      // Unknown - lowest confidence
  };
  
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    const source = sources[i];
    const weight = source ? weights[source] : weights.LOW;
    
    weightedSum += value * weight;
    totalWeight += weight;
  }
  
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Calculates rolling window metrics for a specific window size
 * Uses source weighting for HR-based metrics (HRV, RHR)
 */
function calculateWindowMetrics(
  data: {
    monitoring: Array<{
      date: string;
      hrv: number | null;
      rhr: number | null;
      sleep_seconds: number | null;
      bedtime: string | null;
      wake_time: string | null;
    }>;
    monitoringWithSource: Array<{
      date: string;
      hrv: number | null;
      rhr: number | null;
      sleep_seconds: number | null;
      bedtime: string | null;
      wake_time: string | null;
      hrv_method: 'GARMIN' | 'MANUAL' | 'UNKNOWN' | null;
    }>;
    sessions: Array<{
      session_date: string;
      distance_km: number | null;
      duration_minutes: number;
      metadata: any;
      hr_source: 'WRIST_HR' | 'CHEST_STRAP' | 'UNKNOWN' | null;
      device: string | null;
    }>;
  },
  windowDays: number
): RollingWindowMetrics {
  // Get last N days of data
  const recentMonitoring = data.monitoring.slice(-windowDays);
  const recentMonitoringWithSource = data.monitoringWithSource.slice(-windowDays);
  const recentSessions = data.sessions.slice(-windowDays * 2); // More sessions than days (multiple per day possible)
  
  // Calculate load volume (sum of distances in km)
  const load_volume = recentSessions
    .map(s => s.distance_km || 0)
    .reduce((sum, dist) => sum + dist, 0);
  
  // Calculate intensity minutes (Z4/Z5 zones)
  // Check metadata for zone information, or estimate from HR if available
  let intensity_minutes = 0;
  for (const session of recentSessions) {
    const metadata = session.metadata as any;
    // If metadata has intensity zone info, use it
    // Otherwise, estimate: threshold/VO2max sessions are typically 20-40% of duration
    if (metadata?.primaryZone === 'Z4_THRESHOLD' || metadata?.primaryZone === 'Z5_VO2MAX') {
      intensity_minutes += session.duration_minutes * 0.3; // Estimate 30% of session is in target zone
    }
  }
  
  // Calculate HRV trend with source weighting
  // HRV source quality is determined by hrv_method (GARMIN = HIGH, MANUAL = MEDIUM, UNKNOWN = LOW)
  const hrvData = recentMonitoringWithSource
    .map(m => ({
      value: m.hrv,
      source: m.hrv_method === 'GARMIN' ? 'HIGH' as const :
              m.hrv_method === 'MANUAL' ? 'MEDIUM' as const :
              'LOW' as const
    }))
    .filter((d): d is { value: number; source: 'HIGH' | 'MEDIUM' | 'LOW' } => d.value !== null);
  
  const hrvValues = hrvData.map(d => d.value);
  const hrvSources = hrvData.map(d => d.source);
  const hrv_trend = hrvValues.length > 0 
    ? calculateWeightedAverage(hrvValues, hrvSources)
    : 0;
  
  // Calculate RHR trend with source weighting
  // RHR source quality is determined by hr_source from sessions (need to match by date)
  // For RHR, we use the most recent session's hr_source for each day
  const rhrData: Array<{ value: number; source: 'HIGH' | 'MEDIUM' | 'LOW' }> = [];
  
  for (const monitoring of recentMonitoringWithSource) {
    if (monitoring.rhr === null) continue;
    
    // Find most recent session for this date to get hr_source
    const sessionForDate = recentSessions
      .filter(s => s.session_date === monitoring.date)
      .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime())[0];
    
    const hrSource = sessionForDate?.hr_source || null;
    const sourceQuality = getSourceQuality(hrSource);
    
    rhrData.push({
      value: monitoring.rhr,
      source: sourceQuality
    });
  }
  
  const rhrValues = rhrData.map(d => d.value);
  const rhrSources = rhrData.map(d => d.source);
  const rhr_trend = rhrValues.length > 0
    ? calculateWeightedAverage(rhrValues, rhrSources)
    : 0;
  
  // Calculate sleep midpoint irregularity
  const bedtimes = recentMonitoring.map(m => m.bedtime);
  const wakeTimes = recentMonitoring.map(m => m.wake_time);
  const sleep_midpoint_irregularity = calculateSleepMidpointIrregularity(bedtimes, wakeTimes);
  
  return {
    load_volume,
    intensity_minutes,
    hrv_trend,
    rhr_trend,
    sleep_midpoint_irregularity
  };
}

/**
 * Gets readiness context for a specific historical date
 * 
 * Roadmap requirement: "API returns a 42-day 'Readiness Context' for any historical date requested"
 * 
 * @param userId - User ID
 * @param date - Target date (YYYY-MM-DD format)
 * @returns Readiness context with all rolling windows
 */
export async function getReadinessContext(
  userId: string,
  date: string = new Date().toISOString().split('T')[0]
): Promise<ReadinessContext> {
  // Check cache first
  const cached = getCachedContext(userId, date);
  if (cached) {
    logger.debug(`Using cached readiness context for ${date}`);
    return cached;
  }
  
  logger.info(`Calculating readiness context for ${date} (not in cache)`);
  
  // Load data for the longest window (42 days)
  const data = await loadHistoricalData(userId, date, 42);
  
  // Calculate metrics for each window
  const windows = {
    '7d': calculateWindowMetrics(data, 7),
    '14d': calculateWindowMetrics(data, 14),
    '28d': calculateWindowMetrics(data, 28),
    '42d': calculateWindowMetrics(data, 42)
  };
  
  const context: ReadinessContext = {
    date,
    windows,
    cached_at: new Date().toISOString()
  };
  
  // Cache the result
  setCachedContext(userId, date, context);
  
  return context;
}

/**
 * Clears the readiness context cache (useful for testing or forced refresh)
 */
export function clearReadinessCache(): void {
  readinessCache.clear();
}
