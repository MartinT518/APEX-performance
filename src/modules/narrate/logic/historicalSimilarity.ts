/**
 * Historical Similarity Finder
 * 
 * Finds similar historical blocks based on current metrics.
 * Used to provide specific historical parallels in coach narratives.
 * 
 * Roadmap requirement: "Output cites specific historical parallels (e.g., 'Stride Length decaying like May 2023')"
 */

import { createServerClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { HistoricalBlock } from '../coachNarrator';

export interface CurrentMetrics {
  hrv: number | null;
  volume: number; // km/week
  pace: number | null; // seconds per km
  niggleScore: number | null;
  strideLength?: number | null; // cm
  groundContactTime?: number | null; // ms
  verticalOscillation?: number | null; // cm
}

export interface SimilarHistoricalBlock extends HistoricalBlock {
  similarityScore: number; // 0-1, higher = more similar
  matchReasons: string[]; // What metrics matched
}

/**
 * Calculates cosine similarity between two metric vectors
 * 
 * @param current - Current metrics vector
 * @param historical - Historical metrics vector
 * @returns Similarity score (0-1)
 */
function calculateSimilarity(
  current: number[],
  historical: number[]
): number {
  if (current.length !== historical.length || current.length === 0) {
    return 0;
  }
  
  // Normalize vectors
  const currentNorm = Math.sqrt(current.reduce((sum, val) => sum + val * val, 0));
  const historicalNorm = Math.sqrt(historical.reduce((sum, val) => sum + val * val, 0));
  
  if (currentNorm === 0 || historicalNorm === 0) {
    return 0;
  }
  
  // Dot product
  const dotProduct = current.reduce((sum, val, i) => sum + val * historical[i], 0);
  
  // Cosine similarity
  return dotProduct / (currentNorm * historicalNorm);
}

/**
 * Normalizes metrics to comparable ranges
 */
function normalizeMetrics(metrics: CurrentMetrics): number[] {
  const normalized: number[] = [];
  
  // HRV: normalize to 0-100 range (typical range 30-100ms)
  if (metrics.hrv !== null) {
    normalized.push((metrics.hrv - 30) / 70); // 0-1 range
  } else {
    normalized.push(0.5); // Default middle value
  }
  
  // Volume: normalize to 0-200km/week range
  normalized.push(Math.min(metrics.volume / 200, 1));
  
  // Pace: normalize to 0-1 (faster = higher, typical range 3:00-6:00/km = 180-360s)
  if (metrics.pace !== null) {
    const paceNormalized = 1 - ((metrics.pace - 180) / 180); // Invert so faster = higher
    normalized.push(Math.max(0, Math.min(1, paceNormalized)));
  } else {
    normalized.push(0.5); // Default middle value
  }
  
  // Niggle: normalize to 0-10 range
  if (metrics.niggleScore !== null) {
    normalized.push(metrics.niggleScore / 10);
  } else {
    normalized.push(0);
  }
  
  // Biomechanical metrics (optional, weighted less if missing)
  if (metrics.strideLength !== null && metrics.strideLength !== undefined) {
    // Typical range 100-200cm, normalize to 0-1
    normalized.push((metrics.strideLength - 100) / 100);
  } else {
    normalized.push(0.5); // Default if missing
  }
  
  if (metrics.groundContactTime !== null && metrics.groundContactTime !== undefined) {
    // Typical range 200-300ms, normalize to 0-1 (invert so lower = better)
    const gctNormalized = 1 - ((metrics.groundContactTime - 200) / 100);
    normalized.push(Math.max(0, Math.min(1, gctNormalized)));
  } else {
    normalized.push(0.5); // Default if missing
  }
  
  if (metrics.verticalOscillation !== null && metrics.verticalOscillation !== undefined) {
    // Typical range 5-15cm, normalize to 0-1 (invert so lower = better)
    const voNormalized = 1 - ((metrics.verticalOscillation - 5) / 10);
    normalized.push(Math.max(0, Math.min(1, voNormalized)));
  } else {
    normalized.push(0.5); // Default if missing
  }
  
  return normalized;
}

/**
 * Finds similar historical blocks based on current metrics
 * 
 * @param currentMetrics - Current metrics to match against
 * @param userId - User ID
 * @param lookbackYears - How many years to look back (default: 3)
 * @param topN - Number of top matches to return (default: 3)
 * @returns Array of similar historical blocks, sorted by similarity
 */
export async function findSimilarHistoricalBlocks(
  currentMetrics: CurrentMetrics,
  userId: string,
  lookbackYears: number = 3,
  topN: number = 3
): Promise<SimilarHistoricalBlock[]> {
  try {
    const supabase = await createServerClient();
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - lookbackYears);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    // Load all historical monitoring data
    const { data: monitoring, error: monitoringError } = await supabase
      .from('daily_monitoring')
      .select('date, hrv, niggle_score')
      .eq('user_id', userId)
      .gte('date', startDateStr)
      .lt('date', endDateStr) // Exclude current period
      .order('date', { ascending: true });
    
    if (monitoringError) {
      logger.error('Failed to load monitoring data for similarity:', monitoringError);
      return [];
    }
    
    // Load all historical sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('session_logs')
      .select('session_date, metadata, duration_minutes')
      .eq('user_id', userId)
      .eq('sport_type', 'RUNNING')
      .gte('session_date', startDateStr)
      .lt('session_date', endDateStr)
      .order('session_date', { ascending: true });
    
    if (sessionsError) {
      logger.error('Failed to load sessions for similarity:', sessionsError);
      return [];
    }
    
    if (!monitoring || !sessions || monitoring.length === 0) {
      return [];
    }
    
    // Group data by month
    const monthlyBlocks = new Map<string, {
      month: number;
      year: number;
      hrvValues: number[];
      volumeValues: number[];
      paceValues: number[];
      niggleValues: number[];
      strideLengthValues: number[];
      gctValues: number[];
      verticalOscillationValues: number[];
      dates: string[];
    }>();
    
    // Process monitoring data
    for (const m of monitoring) {
      const date = new Date(m.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      
      if (!monthlyBlocks.has(monthKey)) {
        monthlyBlocks.set(monthKey, {
          month: date.getMonth() + 1,
          year: date.getFullYear(),
          hrvValues: [],
          volumeValues: [],
          paceValues: [],
          niggleValues: [],
          strideLengthValues: [],
          gctValues: [],
          verticalOscillationValues: [],
          dates: []
        });
      }
      
      const block = monthlyBlocks.get(monthKey)!;
      if (m.hrv !== null) block.hrvValues.push(Number(m.hrv));
      if (m.niggle_score !== null) block.niggleValues.push(Number(m.niggle_score));
      block.dates.push(m.date);
    }
    
    // Process session data
    for (const s of sessions) {
      const date = new Date(s.session_date);
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      
      const block = monthlyBlocks.get(monthKey);
      if (!block) continue;
      
      // P0 Fix: Use proper distance calculation instead of minutes/5 fallback
      const { calculateDistanceFromSession } = await import('@/modules/monitor/utils/volumeCalculator');
      const distanceKm = calculateDistanceFromSession(s);
      if (distanceKm > 0) block.volumeValues.push(distanceKm);
      
      // Extract pace
      const metadata = s.metadata as any;
      if (metadata?.averagePace) {
        block.paceValues.push(Number(metadata.averagePace));
      }
      
      // Extract biomechanical metrics
      if (metadata?.strideLength) {
        block.strideLengthValues.push(Number(metadata.strideLength));
      }
      if (metadata?.groundContactTime) {
        block.gctValues.push(Number(metadata.groundContactTime));
      }
      if (metadata?.verticalOscillation) {
        block.verticalOscillationValues.push(Number(metadata.verticalOscillation));
      }
    }
    
    // Calculate averages for each month and compute similarity
    const normalizedCurrent = normalizeMetrics(currentMetrics);
    const similarBlocks: SimilarHistoricalBlock[] = [];
    
    for (const [monthKey, block] of monthlyBlocks.entries()) {
      // Calculate monthly averages
      const avgHRV = block.hrvValues.length > 0
        ? block.hrvValues.reduce((a, b) => a + b, 0) / block.hrvValues.length
        : null;
      
      // Calculate weekly volume (sum of distances / weeks in month)
      const totalVolume = block.volumeValues.reduce((a, b) => a + b, 0);
      const weeksInMonth = block.dates.length / 7;
      const avgVolume = weeksInMonth > 0 ? totalVolume / weeksInMonth : 0;
      
      const avgPace = block.paceValues.length > 0
        ? block.paceValues.reduce((a, b) => a + b, 0) / block.paceValues.length
        : null;
      
      const avgNiggle = block.niggleValues.length > 0
        ? block.niggleValues.reduce((a, b) => a + b, 0) / block.niggleValues.length
        : null;
      
      const avgStrideLength = block.strideLengthValues.length > 0
        ? block.strideLengthValues.reduce((a, b) => a + b, 0) / block.strideLengthValues.length
        : null;
      
      const avgGCT = block.gctValues.length > 0
        ? block.gctValues.reduce((a, b) => a + b, 0) / block.gctValues.length
        : null;
      
      const avgVerticalOscillation = block.verticalOscillationValues.length > 0
        ? block.verticalOscillationValues.reduce((a, b) => a + b, 0) / block.verticalOscillationValues.length
        : null;
      
      // Create historical metrics vector
      const historicalMetrics: CurrentMetrics = {
        hrv: avgHRV,
        volume: avgVolume,
        pace: avgPace,
        niggleScore: avgNiggle,
        strideLength: avgStrideLength,
        groundContactTime: avgGCT,
        verticalOscillation: avgVerticalOscillation
      };
      
      // Calculate similarity
      const normalizedHistorical = normalizeMetrics(historicalMetrics);
      const similarity = calculateSimilarity(normalizedCurrent, normalizedHistorical);
      
      // Determine match reasons
      const matchReasons: string[] = [];
      if (avgHRV !== null && currentMetrics.hrv !== null) {
        const hrvDiff = Math.abs(avgHRV - currentMetrics.hrv);
        if (hrvDiff < 10) matchReasons.push('HRV');
      }
      if (Math.abs(avgVolume - currentMetrics.volume) < 20) {
        matchReasons.push('Volume');
      }
      if (avgPace !== null && currentMetrics.pace !== null) {
        const paceDiff = Math.abs(avgPace - currentMetrics.pace);
        if (paceDiff < 30) matchReasons.push('Pace');
      }
      if (avgNiggle !== null && currentMetrics.niggleScore !== null) {
        const niggleDiff = Math.abs(avgNiggle - currentMetrics.niggleScore);
        if (niggleDiff < 2) matchReasons.push('Niggle');
      }
      if (avgStrideLength !== null && currentMetrics.strideLength !== null) {
        const strideDiff = Math.abs(avgStrideLength - currentMetrics.strideLength);
        if (strideDiff < 10) matchReasons.push('Stride Length');
      }
      
      // Count injury gaps (high niggle days)
      const injuryGaps = block.niggleValues.filter(n => n > 5).length;
      
      // Determine status
      let status: 'SUCCESS' | 'INJURY' | 'OVERTRAINING' = 'SUCCESS';
      if (injuryGaps > 3) {
        status = 'INJURY';
      } else if (avgVolume > 150 && (avgHRV || 0) < 40) {
        status = 'OVERTRAINING';
      }
      
      similarBlocks.push({
        month: block.month,
        year: block.year,
        averageHRV: avgHRV || 0,
        averageVolume: avgVolume,
        averagePace: avgPace || 0,
        injuryGaps,
        status,
        similarityScore: similarity,
        matchReasons
      });
    }
    
    // Sort by similarity (highest first) and return top N
    similarBlocks.sort((a, b) => b.similarityScore - a.similarityScore);
    
    return similarBlocks.slice(0, topN);
  } catch (error) {
    logger.error('Failed to find similar historical blocks:', error);
    return [];
  }
}
