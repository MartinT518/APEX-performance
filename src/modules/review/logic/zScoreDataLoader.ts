/**
 * Z-Score Data Loader
 * 
 * Loads historical data from daily_monitoring table for Z-score calculations.
 * Uses 42-day rolling window as specified in the roadmap.
 */

import { createServerClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export interface HistoricalMonitoringData {
  date: string;
  hrv: number | null;
  sleep_seconds: number | null;
}

/**
 * Loads historical monitoring data for Z-score calculations
 * 
 * @param userId - User ID
 * @param targetDate - Date to calculate Z-scores for (defaults to today)
 * @param windowDays - Number of days in rolling window (default: 42)
 * @returns Array of historical data points, ordered by date (oldest first)
 */
export async function loadHistoricalMonitoringForZScore(
  userId: string,
  targetDate: string = new Date().toISOString().split('T')[0],
  windowDays: number = 42
): Promise<HistoricalMonitoringData[]> {
  try {
    const supabase = await createServerClient();
    
    // Calculate date range: windowDays before targetDate (excluding targetDate itself)
    const target = new Date(targetDate);
    const startDate = new Date(target);
    startDate.setDate(startDate.getDate() - windowDays);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = new Date(target.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // Day before target
    
    const { data, error } = await supabase
      .from('daily_monitoring')
      .select('date, hrv, sleep_seconds')
      .eq('user_id', userId)
      .gte('date', startDateStr)
      .lte('date', endDateStr)
      .order('date', { ascending: true });
    
    if (error) {
      logger.error('Failed to load historical monitoring data for Z-score:', error);
      throw error;
    }
    
    if (!data || data.length === 0) {
      logger.warn(`No historical monitoring data found for user ${userId} in range ${startDateStr} to ${endDateStr}`);
      return [];
    }
    
    return data.map(row => ({
      date: row.date,
      hrv: row.hrv !== null ? Number(row.hrv) : null,
      sleep_seconds: row.sleep_seconds !== null ? Number(row.sleep_seconds) : null
    }));
  } catch (err) {
    logger.error('Error loading historical monitoring data:', err);
    return [];
  }
}

/**
 * Loads current day's monitoring data
 */
export async function loadCurrentMonitoringData(
  userId: string,
  targetDate: string = new Date().toISOString().split('T')[0]
): Promise<{ hrv: number | null; sleep_seconds: number | null }> {
  try {
    const supabase = await createServerClient();
    
    const { data, error } = await supabase
      .from('daily_monitoring')
      .select('hrv, sleep_seconds')
      .eq('user_id', userId)
      .eq('date', targetDate)
      .maybeSingle();
    
    if (error) {
      logger.error('Failed to load current monitoring data:', error);
      return { hrv: null, sleep_seconds: null };
    }
    
    if (!data) {
      return { hrv: null, sleep_seconds: null };
    }
    
    return {
      hrv: data.hrv !== null ? Number(data.hrv) : null,
      sleep_seconds: data.sleep_seconds !== null ? Number(data.sleep_seconds) : null
    };
  } catch (err) {
    logger.error('Error loading current monitoring data:', err);
    return { hrv: null, sleep_seconds: null };
  }
}
