/**
 * Injury Gap Detector
 * 
 * Detects "injury gaps" from historical data.
 * Definition: Training interruption >3 days with niggle_score >5 before the gap.
 * 
 * Used for walk-forward backtesting to compare system vetoes against actual injury gaps.
 */

import { createServerClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { extractFeaturesForDate } from './ml/featureEngineering';
import { predictNiggleRisk } from './ml/niggleRiskModel';

export interface InjuryGap {
  startDate: string; // Last activity date before gap
  endDate: string; // First activity date after gap
  gapDays: number; // Number of days in gap
  preGapNiggle: number | null; // Niggle score before gap
  preGapDays: number; // Days with niggle >5 before gap
}

/**
 * Detects injury gaps from historical data
 * 
 * @param userId - User ID
 * @param startDate - Start date for analysis (YYYY-MM-DD)
 * @param endDate - End date for analysis (YYYY-MM-DD)
 * @returns Array of detected injury gaps
 */
export async function detectInjuryGaps(
  userId: string,
  startDate: string,
  endDate: string
): Promise<InjuryGap[]> {
  const supabase = await createServerClient();
  
  // Load all sessions in date range
  const { data: sessions, error: sessionsError } = await supabase
    .from('session_logs')
    .select('session_date, sport_type')
    .eq('user_id', userId)
    .gte('session_date', startDate)
    .lte('session_date', endDate)
    .eq('sport_type', 'RUNNING') // Only check running sessions
    .order('session_date', { ascending: true });
  
  if (sessionsError) {
    logger.error('Failed to load sessions for injury gap detection:', sessionsError);
    throw sessionsError;
  }
  
  if (!sessions || sessions.length < 2) {
    return []; // Need at least 2 sessions to detect gaps
  }
  
  // Load niggle scores for the date range
  const { data: monitoring, error: monitoringError } = await supabase
    .from('daily_monitoring')
    .select('date, niggle_score')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });
  
  if (monitoringError) {
    logger.error('Failed to load monitoring data for injury gap detection:', monitoringError);
    throw monitoringError;
  }
  
  // Create a map of dates with niggle scores
  const niggleMap = new Map<string, number | null>();
  (monitoring || []).forEach(m => {
    niggleMap.set(m.date, m.niggle_score);
  });
  
  // Detect gaps between sessions
  const gaps: InjuryGap[] = [];
  
  for (let i = 0; i < sessions.length - 1; i++) {
    const currentDate = new Date(sessions[i].session_date);
    const nextDate = new Date(sessions[i + 1].session_date);
    
    const daysDiff = Math.floor((nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Gap is >3 days
    if (daysDiff > 3) {
      // Check niggle scores in the 7 days before the gap
      const preGapStart = new Date(currentDate);
      preGapStart.setDate(preGapStart.getDate() - 7);
      
      let preGapNiggle: number | null = null;
      let preGapDays = 0;
      
      // Check each day in the 7 days before gap
      for (let d = 0; d < 7; d++) {
        const checkDate = new Date(currentDate);
        checkDate.setDate(checkDate.getDate() - d);
        const dateStr = checkDate.toISOString().split('T')[0];
        const niggle = niggleMap.get(dateStr);
        
        if (niggle !== null && niggle !== undefined) {
          if (preGapNiggle === null) {
            preGapNiggle = niggle; // Use most recent niggle
          }
          if (niggle > 5) {
            preGapDays++;
          }
        }
      }
      
      // Only flag as injury gap if niggle >5 before gap
      if (preGapDays > 0) {
        gaps.push({
          startDate: sessions[i].session_date,
          endDate: sessions[i + 1].session_date,
          gapDays: daysDiff,
          preGapNiggle,
          preGapDays
        });
      }
    }
  }
  
  return gaps;
}

/**
 * Gets injury gaps for a specific date range (simplified interface)
 */
export async function getInjuryGaps(
  userId: string,
  lookbackDays: number = 365
): Promise<InjuryGap[]> {
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - lookbackDays);
  const startDateStr = startDate.toISOString().split('T')[0];
  
  return detectInjuryGaps(userId, startDateStr, endDate);
}

/**
 * Flags high-risk periods using ML predictions
 * 
 * Runs ML predictions on historical data and flags periods where ML predicted
 * high risk before actual injury occurred.
 * 
 * @param userId - User ID
 * @param startDate - Start date for analysis
 * @param endDate - End date for analysis
 * @returns Array of high-risk periods flagged by ML
 */
export interface HighRiskPeriod {
  date: string;
  mlRiskScore: number;
  actualInjury: boolean; // Did injury actually occur within 7 days?
  correctPrediction: boolean; // Did ML correctly predict?
}

export async function flagHighRiskPeriodsWithML(
  userId: string,
  startDate: string,
  endDate: string
): Promise<HighRiskPeriod[]> {
  const supabase = await createServerClient();
  
  // Get all dates with monitoring data
  const { data: monitoring } = await supabase
    .from('daily_monitoring')
    .select('date')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });
  
  if (!monitoring || monitoring.length === 0) {
    return [];
  }
  
  // Detect actual injury gaps for comparison
  const actualInjuryGaps = await detectInjuryGaps(userId, startDate, endDate);
  const injuryGapDates = new Set(actualInjuryGaps.map(gap => gap.startDate));
  
  const highRiskPeriods: HighRiskPeriod[] = [];
  
  // Run ML predictions for each date
  for (const m of monitoring) {
    try {
      const features = await extractFeaturesForDate(userId, m.date);
      if (!features) continue;
      
      const mlPrediction = await predictNiggleRisk(features);
      
      // Flag if ML predicts high risk (>=0.7)
      if (mlPrediction.riskScore >= 0.7) {
        // Check if injury actually occurred within 7 days
        const checkDate = new Date(m.date);
        const windowEnd = new Date(checkDate);
        windowEnd.setDate(windowEnd.getDate() + 7);
        
        const hasInjury = Array.from(injuryGapDates).some(gapDate => {
          const gap = new Date(gapDate);
          return gap >= checkDate && gap <= windowEnd;
        });
        
        highRiskPeriods.push({
          date: m.date,
          mlRiskScore: mlPrediction.riskScore,
          actualInjury: hasInjury,
          correctPrediction: hasInjury // True positive
        });
      }
    } catch (error) {
      logger.warn(`Failed to predict risk for ${m.date}:`, error);
      continue;
    }
  }
  
  // Calculate accuracy metrics
  const correctPredictions = highRiskPeriods.filter(p => p.correctPrediction).length;
  const accuracy = highRiskPeriods.length > 0
    ? (correctPredictions / highRiskPeriods.length) * 100
    : 0;
  
  logger.info(`ML High-Risk Flagging Results:`);
  logger.info(`  Total high-risk flags: ${highRiskPeriods.length}`);
  logger.info(`  Correct predictions (true positives): ${correctPredictions}`);
  logger.info(`  ML accuracy: ${accuracy.toFixed(1)}%`);
  logger.info(`  Actual injuries in period: ${actualInjuryGaps.length}`);
  
  return highRiskPeriods;
}
