/**
 * Feature Engineering for ML Niggle Risk Prediction
 * 
 * Extracts features from historical data to train ML model.
 * Features: Mechanical_Drift (GCT/Vertical Ratio), volume, HRV trend, niggle history
 * Label: Training interruption (>3 days gap) = 1, else 0
 */

import { createServerClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { calculateDecoupling, calculateCadenceDrift, calculateFormDecay } from '../durabilityCalculator';
import type { ISessionDataPoint } from '@/types/session';

export interface FeatureVector {
  // Mechanical drift features
  mechanical_drift: number; // GCT/Vertical Ratio drift
  gct_trend: number; // Ground contact time trend (7-day)
  vertical_ratio_trend: number; // Vertical oscillation / stride length trend
  cadence_drift: number; // Cadence decline over time
  
  // Volume features
  weekly_volume: number; // km/week
  volume_change_7d: number; // % change in volume vs. previous week
  volume_change_28d: number; // % change in volume vs. 4 weeks ago
  
  // HRV features
  hrv_7d_avg: number; // 7-day average HRV
  hrv_trend: number; // HRV trend (increasing/decreasing)
  hrv_z_score: number; // Z-score vs. 42-day baseline
  
  // Niggle features
  niggle_current: number; // Current niggle score
  niggle_7d_avg: number; // 7-day average niggle
  niggle_trend: number; // Niggle trend (increasing/decreasing)
  niggle_high_days: number; // Days with niggle >5 in last 7 days
  
  // Training history
  days_since_last_lift: number; // Days since last strength session
  training_consistency: number; // % of days with training in last 14 days
}

export interface TrainingSample {
  features: FeatureVector;
  label: number; // 1 = injury gap occurred within 7 days, 0 = no injury
  date: string; // Date of the sample
}

/**
 * Extracts features for a specific date
 */
export async function extractFeaturesForDate(
  userId: string,
  targetDate: string
): Promise<FeatureVector | null> {
  try {
    const supabase = await createServerClient();
    const target = new Date(targetDate);
    
    // Calculate date ranges
    const date7dAgo = new Date(target);
    date7dAgo.setDate(date7dAgo.getDate() - 7);
    
    const date14dAgo = new Date(target);
    date14dAgo.setDate(date14dAgo.getDate() - 14);
    
    const date28dAgo = new Date(target);
    date28dAgo.setDate(date28dAgo.getDate() - 28);
    
    const date42dAgo = new Date(target);
    date42dAgo.setDate(date42dAgo.getDate() - 42);
    
    const date7dAgoStr = date7dAgo.toISOString().split('T')[0];
    const date14dAgoStr = date14dAgo.toISOString().split('T')[0];
    const date28dAgoStr = date28dAgo.toISOString().split('T')[0];
    const date42dAgoStr = date42dAgo.toISOString().split('T')[0];
    
    // Load monitoring data
    const { data: monitoring } = await supabase
      .from('daily_monitoring')
      .select('date, hrv, niggle_score, strength_session')
      .eq('user_id', userId)
      .gte('date', date42dAgoStr)
      .lte('date', targetDate)
      .order('date', { ascending: true });
    
    // Load sessions
    const { data: sessions } = await supabase
      .from('session_logs')
      .select('session_date, metadata, duration_minutes, sport_type')
      .eq('user_id', userId)
      .gte('session_date', date42dAgoStr)
      .lte('session_date', targetDate)
      .order('session_date', { ascending: true });
    
    if (!monitoring || !sessions) {
      return null;
    }
    
    // Calculate HRV features
    const hrv7d = monitoring
      .filter(m => m.date >= date7dAgoStr && m.hrv !== null)
      .map(m => Number(m.hrv));
    const hrv7dAvg = hrv7d.length > 0 ? hrv7d.reduce((a, b) => a + b, 0) / hrv7d.length : 0;
    
    const hrv42d = monitoring
      .filter(m => m.date >= date42dAgoStr && m.hrv !== null)
      .map(m => Number(m.hrv));
    const hrv42dAvg = hrv42d.length > 0 ? hrv42d.reduce((a, b) => a + b, 0) / hrv42d.length : 0;
    const hrv42dStd = hrv42d.length > 1
      ? Math.sqrt(hrv42d.reduce((sum, val) => sum + Math.pow(val - hrv42dAvg, 2), 0) / (hrv42d.length - 1))
      : 1;
    const hrvZScore = hrv42dStd > 0 ? (hrv7dAvg - hrv42dAvg) / hrv42dStd : 0;
    
    const hrvTrend = hrv7d.length >= 2
      ? (hrv7d[hrv7d.length - 1] - hrv7d[0]) / hrv7d[0]
      : 0;
    
    // Calculate volume features
    const sessions7d = sessions.filter(s => s.session_date >= date7dAgoStr);
    const sessions28d = sessions.filter(s => s.session_date >= date28dAgoStr);
    
    // P0 Fix: Use proper distance calculation instead of minutes/5 fallback
    const { calculateDistanceFromSession } = await import('@/modules/monitor/utils/volumeCalculator');
    
    const volume7d = sessions7d
      .map(s => calculateDistanceFromSession(s))
      .reduce((sum, dist) => sum + dist, 0);
    
    const volume28d = sessions28d
      .map(s => calculateDistanceFromSession(s))
      .reduce((sum, dist) => sum + dist, 0);
    
    const weeklyVolume = volume7d; // Already weekly (7 days)
    const volumePrev7d = sessions
      .filter(s => s.session_date >= date14dAgoStr && s.session_date < date7dAgoStr)
      .map(s => calculateDistanceFromSession(s))
      .reduce((sum, dist) => sum + dist, 0);
    
    const volumePrev28d = sessions
      .filter(s => s.session_date >= date28dAgoStr && s.session_date < date14dAgoStr)
      .map(s => calculateDistanceFromSession(s))
      .reduce((sum, dist) => sum + dist, 0);
    
    const volumeChange7d = volumePrev7d > 0 ? ((volume7d - volumePrev7d) / volumePrev7d) * 100 : 0;
    const volumeChange28d = volumePrev28d > 0 ? ((volume7d - volumePrev28d) / volumePrev28d) * 100 : 0;
    
    // Calculate niggle features
    const niggle7d = monitoring
      .filter(m => m.date >= date7dAgoStr && m.niggle_score !== null)
      .map(m => Number(m.niggle_score));
    const niggleCurrent = niggle7d.length > 0 ? niggle7d[niggle7d.length - 1] : 0;
    const niggle7dAvg = niggle7d.length > 0 ? niggle7d.reduce((a, b) => a + b, 0) / niggle7d.length : 0;
    const niggleTrend = niggle7d.length >= 2
      ? niggle7d[niggle7d.length - 1] - niggle7d[0]
      : 0;
    const niggleHighDays = niggle7d.filter(n => n > 5).length;
    
    // Calculate mechanical drift from recent sessions
    const recentSessions = sessions7d.filter(s => s.sport_type === 'RUNNING');
    let mechanicalDrift = 0;
    let gctTrend = 0;
    let verticalRatioTrend = 0;
    let cadenceDrift = 0;
    
    if (recentSessions.length > 0) {
      // Extract biomechanical metrics from sessions
      const gctValues: number[] = [];
      const verticalOscillationValues: number[] = [];
      const strideLengthValues: number[] = [];
      const cadenceValues: number[][] = [];
      
      for (const session of recentSessions) {
        const metadata = session.metadata as any;
        if (metadata?.groundContactTime) gctValues.push(Number(metadata.groundContactTime));
        if (metadata?.verticalOscillation) verticalOscillationValues.push(Number(metadata.verticalOscillation));
        if (metadata?.strideLength) strideLengthValues.push(Number(metadata.strideLength));
        
        // For cadence drift, we'd need time-series data points
        // For now, use average cadence if available
        if (metadata?.avgRunCadence) {
          cadenceValues.push([Number(metadata.avgRunCadence)]);
        }
      }
      
      // Calculate trends (comparing first half vs second half)
      if (gctValues.length >= 2) {
        const midpoint = Math.floor(gctValues.length / 2);
        const firstHalf = gctValues.slice(0, midpoint);
        const secondHalf = gctValues.slice(midpoint);
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        gctTrend = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
      }
      
      if (verticalOscillationValues.length >= 2 && strideLengthValues.length >= 2) {
        const midpoint = Math.floor(Math.min(verticalOscillationValues.length, strideLengthValues.length) / 2);
        const firstHalfVO = verticalOscillationValues.slice(0, midpoint);
        const secondHalfVO = verticalOscillationValues.slice(midpoint);
        const firstHalfSL = strideLengthValues.slice(0, midpoint);
        const secondHalfSL = strideLengthValues.slice(midpoint);
        
        const firstVR = firstHalfVO.reduce((a, b) => a + b, 0) / firstHalfVO.length /
                       (firstHalfSL.reduce((a, b) => a + b, 0) / firstHalfSL.length);
        const secondVR = secondHalfVO.reduce((a, b) => a + b, 0) / secondHalfVO.length /
                         (secondHalfSL.reduce((a, b) => a + b, 0) / secondHalfSL.length);
        
        verticalRatioTrend = firstVR > 0 ? ((secondVR - firstVR) / firstVR) * 100 : 0;
      }
      
      // Mechanical drift = combination of form decay indicators
      mechanicalDrift = (Math.max(0, gctTrend) + Math.max(0, verticalRatioTrend)) / 2;
    }
    
    // Calculate days since last lift
    const strengthSessions = monitoring
      .filter(m => m.strength_session === true && m.date <= targetDate)
      .map(m => m.date)
      .sort()
      .reverse();
    
    const lastLiftDate = strengthSessions.length > 0 ? new Date(strengthSessions[0]) : null;
    const daysSinceLastLift = lastLiftDate
      ? Math.floor((target.getTime() - lastLiftDate.getTime()) / (1000 * 60 * 60 * 24))
      : 999;
    
    // Calculate training consistency (days with training in last 14 days)
    const trainingDays = new Set(sessions
      .filter(s => s.session_date >= date14dAgoStr)
      .map(s => s.session_date));
    const trainingConsistency = (trainingDays.size / 14) * 100;
    
    return {
      mechanical_drift: mechanicalDrift,
      gct_trend: gctTrend,
      vertical_ratio_trend: verticalRatioTrend,
      cadence_drift: cadenceDrift,
      weekly_volume: weeklyVolume,
      volume_change_7d: volumeChange7d,
      volume_change_28d: volumeChange28d,
      hrv_7d_avg: hrv7dAvg,
      hrv_trend: hrvTrend,
      hrv_z_score: hrvZScore,
      niggle_current: niggleCurrent,
      niggle_7d_avg: niggle7dAvg,
      niggle_trend: niggleTrend,
      niggle_high_days: niggleHighDays,
      days_since_last_lift: daysSinceLastLift,
      training_consistency: trainingConsistency
    };
  } catch (error) {
    logger.error(`Failed to extract features for ${targetDate}:`, error);
    return null;
  }
}

/**
 * Extracts training dataset from historical data
 * 
 * @param userId - User ID
 * @param startDate - Start date for training data
 * @param endDate - End date for training data
 * @returns Array of training samples with features and labels
 */
export async function extractTrainingDataset(
  userId: string,
  startDate: string,
  endDate: string
): Promise<TrainingSample[]> {
  try {
    const supabase = await createServerClient();
    
    // Load all sessions to detect injury gaps
    const { data: sessions } = await supabase
      .from('session_logs')
      .select('session_date')
      .eq('user_id', userId)
      .eq('sport_type', 'RUNNING')
      .gte('session_date', startDate)
      .lte('session_date', endDate)
      .order('session_date', { ascending: true });
    
    if (!sessions || sessions.length < 2) {
      return [];
    }
    
    // Detect injury gaps (>3 days between sessions)
    const injuryGapDates = new Set<string>();
    for (let i = 0; i < sessions.length - 1; i++) {
      const currentDate = new Date(sessions[i].session_date);
      const nextDate = new Date(sessions[i + 1].session_date);
      const daysDiff = Math.floor((nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff > 3) {
        // Mark the date before the gap as having an injury
        injuryGapDates.add(sessions[i].session_date);
      }
    }
    
    // Extract features for each date with monitoring data
    const { data: monitoring } = await supabase
      .from('daily_monitoring')
      .select('date')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });
    
    const samples: TrainingSample[] = [];
    
    for (const m of monitoring || []) {
      const features = await extractFeaturesForDate(userId, m.date);
      if (!features) continue;
      
      // Check if injury gap occurred within 7 days
      const checkDate = new Date(m.date);
      const windowEnd = new Date(checkDate);
      windowEnd.setDate(windowEnd.getDate() + 7);
      
      const hasInjury = Array.from(injuryGapDates).some(gapDate => {
        const gap = new Date(gapDate);
        return gap >= checkDate && gap <= windowEnd;
      });
      
      samples.push({
        features,
        label: hasInjury ? 1 : 0,
        date: m.date
      });
    }
    
    logger.info(`Extracted ${samples.length} training samples from ${startDate} to ${endDate}`);
    logger.info(`  Positive samples (injury): ${samples.filter(s => s.label === 1).length}`);
    logger.info(`  Negative samples (no injury): ${samples.filter(s => s.label === 0).length}`);
    
    return samples;
  } catch (error) {
    logger.error('Failed to extract training dataset:', error);
    return [];
  }
}
