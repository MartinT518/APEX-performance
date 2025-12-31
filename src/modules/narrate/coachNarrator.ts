/**
 * LLM Coach Narrator
 * 
 * Generates AI-powered narratives comparing current status to historical blocks.
 * 
 * Roadmap requirement: "Output cites specific historical parallels (e.g., 'Stride Length decaying like May 2023')"
 */

import { logger } from '@/lib/logger';
import type { DailyDecisionSnapshot } from '@/types/analysis';
import { findSimilarHistoricalBlocks } from './logic/historicalSimilarity';

export interface HistoricalBlock {
  month: number; // 1-12
  year: number;
  averageHRV: number;
  averageVolume: number;
  averagePace: number;
  injuryGaps: number;
  status: 'SUCCESS' | 'INJURY' | 'OVERTRAINING';
  // Biomechanical trends
  strideLengthTrend?: 'IMPROVING' | 'STABLE' | 'DECAYING';
  gctTrend?: 'IMPROVING' | 'STABLE' | 'DECAYING';
  verticalOscillationTrend?: 'IMPROVING' | 'STABLE' | 'DECAYING';
  averageStrideLength?: number | null;
  averageGCT?: number | null;
  averageVerticalOscillation?: number | null;
  similarityScore?: number; // 0-1, for similarity-based matching
  matchReasons?: string[]; // What metrics matched
}

export interface NarrativeContext {
  snapshot: DailyDecisionSnapshot;
  currentMetrics: {
    hrv: number | null;
    volume: number; // km/week
    pace: number | null; // seconds per km
    niggleScore: number | null;
  };
  historicalBlock: HistoricalBlock | null;
}

/**
 * Loads historical block data for a specific month/year
 */
export async function loadHistoricalBlock(
  month: number,
  year: number,
  userId: string
): Promise<HistoricalBlock | null> {
  try {
    const { createServerClient } = await import('@/lib/supabase');
    const supabase = await createServerClient();
    
    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    // Load monitoring data
    const { data: monitoring } = await supabase
      .from('daily_monitoring')
      .select('hrv, niggle_score')
      .eq('user_id', userId)
      .gte('date', startDateStr)
      .lte('date', endDateStr);
    
    // Load session data (including biomechanical metrics)
    const { data: sessions } = await supabase
      .from('session_logs')
      .select('metadata, duration_minutes, session_date')
      .eq('user_id', userId)
      .eq('sport_type', 'RUNNING')
      .gte('session_date', startDateStr)
      .lte('session_date', endDateStr)
      .order('session_date', { ascending: true });
    
    if (!monitoring || !sessions) {
      return null;
    }
    
    // Calculate averages
    const hrvValues = monitoring.map(m => m.hrv).filter((h): h is number => h !== null);
    const averageHRV = hrvValues.length > 0 
      ? hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length 
      : 0;
    
    // Calculate weekly volume
    // P0 Fix: Use proper distance calculation instead of minutes/5 fallback
    const { calculateDistanceFromSession } = await import('@/modules/monitor/utils/volumeCalculator');
    const distances = sessions
      .map(s => calculateDistanceFromSession(s))
      .filter((d): d is number => d !== null && d !== undefined && d > 0);
    
    const totalVolume = distances.reduce((a, b) => a + b, 0);
    const weeksInMonth = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7);
    const averageVolume = weeksInMonth > 0 ? totalVolume / weeksInMonth : 0;
    
    // Calculate average pace
    const paces = sessions
      .map(s => {
        const metadata = s.metadata as any;
        return metadata?.averagePace || null;
      })
      .filter((p): p is number => p !== null && p !== undefined);
    
    const averagePace = paces.length > 0 
      ? paces.reduce((a, b) => a + b, 0) / paces.length 
      : 0;
    
    // Extract biomechanical metrics
    const strideLengths = sessions
      .map(s => {
        const metadata = s.metadata as any;
        return metadata?.strideLength as number | null;
      })
      .filter((sl): sl is number => sl !== null && sl !== undefined);
    
    const gctValues = sessions
      .map(s => {
        const metadata = s.metadata as any;
        return metadata?.groundContactTime as number | null;
      })
      .filter((gct): gct is number => gct !== null && gct !== undefined);
    
    const verticalOscillationValues = sessions
      .map(s => {
        const metadata = s.metadata as any;
        return metadata?.verticalOscillation as number | null;
      })
      .filter((vo): vo is number => vo !== null && vo !== undefined);
    
    const averageStrideLength = strideLengths.length > 0
      ? strideLengths.reduce((a, b) => a + b, 0) / strideLengths.length
      : null;
    
    const averageGCT = gctValues.length > 0
      ? gctValues.reduce((a, b) => a + b, 0) / gctValues.length
      : null;
    
    const averageVerticalOscillation = verticalOscillationValues.length > 0
      ? verticalOscillationValues.reduce((a, b) => a + b, 0) / verticalOscillationValues.length
      : null;
    
    // Calculate trends (comparing first half vs second half of month)
    const midpoint = Math.floor(sessions.length / 2);
    const firstHalfStride = strideLengths.slice(0, midpoint);
    const secondHalfStride = strideLengths.slice(midpoint);
    
    let strideLengthTrend: 'IMPROVING' | 'STABLE' | 'DECAYING' = 'STABLE';
    if (firstHalfStride.length > 0 && secondHalfStride.length > 0) {
      const firstAvg = firstHalfStride.reduce((a, b) => a + b, 0) / firstHalfStride.length;
      const secondAvg = secondHalfStride.reduce((a, b) => a + b, 0) / secondHalfStride.length;
      const change = ((secondAvg - firstAvg) / firstAvg) * 100;
      if (change > 5) strideLengthTrend = 'IMPROVING';
      else if (change < -5) strideLengthTrend = 'DECAYING';
    }
    
    const firstHalfGCT = gctValues.slice(0, midpoint);
    const secondHalfGCT = gctValues.slice(midpoint);
    let gctTrend: 'IMPROVING' | 'STABLE' | 'DECAYING' = 'STABLE';
    if (firstHalfGCT.length > 0 && secondHalfGCT.length > 0) {
      const firstAvg = firstHalfGCT.reduce((a, b) => a + b, 0) / firstHalfGCT.length;
      const secondAvg = secondHalfGCT.reduce((a, b) => a + b, 0) / secondHalfGCT.length;
      const change = ((secondAvg - firstAvg) / firstAvg) * 100;
      if (change < -5) gctTrend = 'IMPROVING'; // Lower GCT is better
      else if (change > 5) gctTrend = 'DECAYING';
    }
    
    const firstHalfVO = verticalOscillationValues.slice(0, midpoint);
    const secondHalfVO = verticalOscillationValues.slice(midpoint);
    let verticalOscillationTrend: 'IMPROVING' | 'STABLE' | 'DECAYING' = 'STABLE';
    if (firstHalfVO.length > 0 && secondHalfVO.length > 0) {
      const firstAvg = firstHalfVO.reduce((a, b) => a + b, 0) / firstHalfVO.length;
      const secondAvg = secondHalfVO.reduce((a, b) => a + b, 0) / secondHalfVO.length;
      const change = ((secondAvg - firstAvg) / firstAvg) * 100;
      if (change < -5) verticalOscillationTrend = 'IMPROVING'; // Lower VO is better
      else if (change > 5) verticalOscillationTrend = 'DECAYING';
    }
    
    // Count injury gaps (niggle >5 followed by >3 day gap)
    const niggleScores = monitoring.map(m => m.niggle_score).filter((n): n is number => n !== null && n > 5);
    const injuryGaps = niggleScores.length; // Simplified: count high niggle days
    
    // Determine status
    let status: 'SUCCESS' | 'INJURY' | 'OVERTRAINING' = 'SUCCESS';
    if (injuryGaps > 3) {
      status = 'INJURY';
    } else if (averageVolume > 150 && averageHRV < 40) {
      status = 'OVERTRAINING';
    }
    
    return {
      month,
      year,
      averageHRV,
      averageVolume,
      averagePace,
      injuryGaps,
      status,
      strideLengthTrend,
      gctTrend,
      verticalOscillationTrend,
      averageStrideLength,
      averageGCT,
      averageVerticalOscillation
    };
  } catch (error) {
    logger.error(`Failed to load historical block for ${month}/${year}:`, error);
    return null;
  }
}

/**
 * Generates coach narrative using Gemini
 */
export async function generateNarrative(
  context: NarrativeContext
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in environment variables");
  }
  
  const { snapshot, currentMetrics, historicalBlock } = context;
  
  // P2 Fix (FR-6.2): Explicitly pass constraints to LLM
  const { getCurrentPhase } = await import('@/modules/analyze/blueprintEngine');
  const currentPhase = getCurrentPhase(new Date());
  const maxRampRate = 10; // 10% per week (from constraintEngine.ts)
  const intensitySpacing = 48; // 48 hours minimum between hard sessions
  
  // Build prompt
  let prompt = `The Governor triggered ${snapshot.global_status} status. `;
  
  if (snapshot.reason) {
    prompt += `Reason: ${snapshot.reason}. `;
  }
  
  // FR-6.2: Explicitly pass constraints to LLM (must obey)
  prompt += `\n\nCONSTRAINTS (MUST OBEY):\n`;
  prompt += `- Max Ramp Rate: ${maxRampRate}% volume increase per week (volume governor)\n`;
  prompt += `- Intensity Spacing: Minimum ${intensitySpacing} hours between hard sessions (Z4+ or >90min)\n`;
  prompt += `- Phase Caps: Current phase "${currentPhase.name}" (Phase ${currentPhase.phaseNumber})\n`;
  prompt += `  * Max Weekly Volume: ${currentPhase.maxWeeklyVolume}km/week\n`;
  prompt += `  * Max Allowed Zone: ${currentPhase.maxAllowedZone}\n`;
  if (currentPhase.hrCap) {
    prompt += `  * HR Cap: ${currentPhase.hrCap.min}-${currentPhase.hrCap.max} BPM\n`;
  }
  if (currentPhase.requiresStructuralIntegrity) {
    prompt += `  * Requires Structural Integrity: ${currentPhase.requiresStructuralIntegrity}% minimum\n`;
  }
  prompt += `\nIMPORTANT: Your narrative must acknowledge these constraints. Do not suggest workouts that violate ramp rate, intensity spacing, or phase caps.\n`;
  
  prompt += `\n\nCurrent Metrics:\n`;
  prompt += `- HRV: ${currentMetrics.hrv || 'N/A'}ms\n`;
  prompt += `- Weekly Volume: ${currentMetrics.volume.toFixed(1)}km\n`;
  prompt += `- Average Pace: ${currentMetrics.pace ? (currentMetrics.pace / 60).toFixed(2) + ' min/km' : 'N/A'}\n`;
  prompt += `- Niggle Score: ${currentMetrics.niggleScore || 'N/A'}/10\n`;
  
  // Add historical context with specific dates and biomechanical trends
  if (historicalBlock) {
    const monthName = getMonthName(historicalBlock.month);
    prompt += `\n\nHistorical Context (${monthName} ${historicalBlock.year}):\n`;
    prompt += `- Average HRV: ${historicalBlock.averageHRV.toFixed(1)}ms\n`;
    prompt += `- Average Weekly Volume: ${historicalBlock.averageVolume.toFixed(1)}km\n`;
    prompt += `- Average Pace: ${(historicalBlock.averagePace / 60).toFixed(2)} min/km\n`;
    prompt += `- Injury Gaps: ${historicalBlock.injuryGaps}\n`;
    prompt += `- Status: ${historicalBlock.status}\n`;
    
    // Add biomechanical trends if available
    if (historicalBlock.strideLengthTrend) {
      prompt += `- Stride Length Trend: ${historicalBlock.strideLengthTrend} (${historicalBlock.averageStrideLength?.toFixed(1) || 'N/A'}cm avg)\n`;
    }
    if (historicalBlock.gctTrend) {
      prompt += `- Ground Contact Time Trend: ${historicalBlock.gctTrend} (${historicalBlock.averageGCT?.toFixed(0) || 'N/A'}ms avg)\n`;
    }
    if (historicalBlock.verticalOscillationTrend) {
      prompt += `- Vertical Oscillation Trend: ${historicalBlock.verticalOscillationTrend} (${historicalBlock.averageVerticalOscillation?.toFixed(1) || 'N/A'}cm avg)\n`;
    }
    
    // Add match reasons if available (from similarity finder)
    if (historicalBlock.matchReasons && historicalBlock.matchReasons.length > 0) {
      prompt += `- Matching Metrics: ${historicalBlock.matchReasons.join(', ')}\n`;
    }
    
    // Force specific date citation in prompt
    prompt += `\n\nIMPORTANT: You MUST cite the specific date "${monthName} ${historicalBlock.year}" in your response. `;
    prompt += `For example: "Your Stride Length is ${historicalBlock.strideLengthTrend === 'DECAYING' ? 'decaying' : historicalBlock.strideLengthTrend === 'IMPROVING' ? 'improving' : 'stable'} exactly like it was in ${monthName} ${historicalBlock.year}."\n`;
  }
  
  prompt += `\n\nGenerate a coach narrative that:\n`;
  prompt += `1. Explains the decision in plain language\n`;
  prompt += `2. Compares current status to the historical block (if provided) - MUST cite specific date (e.g., "May 2023")\n`;
  prompt += `3. Cites specific parallels with exact dates (e.g., "Stride Length decaying like May 2023" or "HRV pattern matches March 2022")\n`;
  prompt += `4. References biomechanical trends if available (stride length, GCT, vertical oscillation)\n`;
  prompt += `5. Provides actionable guidance\n`;
  prompt += `6. Uses a supportive but direct coaching tone\n`;
  prompt += `\nIMPORTANT: Do not express certainty above 85%. Biological systems are inherently uncertain. Use phrases like "likely", "probably", "suggests" rather than "definitely" or "certainly".\n`;
  
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500
          }
        })
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP Error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      throw new Error("Empty response from AI");
    }
    
    return text;
  } catch (error) {
    logger.error('Failed to generate narrative:', error);
    // Fallback narrative
    return `The Governor triggered ${snapshot.global_status} status. ${snapshot.reason || 'No specific reason provided.'}`;
  }
}

/**
 * Helper to get month name
 */
function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || 'Unknown';
}

/**
 * Main function to generate narrative from snapshot
 */
export async function generateNarrativeFromSnapshot(
  snapshot: DailyDecisionSnapshot,
  userId: string,
  currentMetrics: {
    hrv: number | null;
    volume: number;
    pace: number | null;
    niggleScore: number | null;
    strideLength?: number | null;
    groundContactTime?: number | null;
    verticalOscillation?: number | null;
  }
): Promise<string> {
  // Use similarity finder to get most relevant historical blocks
  const similarBlocks = await findSimilarHistoricalBlocks(
    {
      hrv: currentMetrics.hrv,
      volume: currentMetrics.volume,
      pace: currentMetrics.pace,
      niggleScore: currentMetrics.niggleScore,
      strideLength: currentMetrics.strideLength,
      groundContactTime: currentMetrics.groundContactTime,
      verticalOscillation: currentMetrics.verticalOscillation
    },
    userId,
    3, // Look back 3 years
    1  // Get top 1 match
  );
  
  // Use most similar block, or fallback to same month previous year
  let historicalBlock: HistoricalBlock | null = null;
  
  if (similarBlocks.length > 0 && similarBlocks[0].similarityScore > 0.5) {
    // Use similar block if similarity is high enough
    historicalBlock = similarBlocks[0];
    logger.info(`Using similar historical block: ${getMonthName(historicalBlock.month)} ${historicalBlock.year} (similarity: ${historicalBlock.similarityScore.toFixed(2)})`);
  } else {
    // Fallback to same month, previous year
    const today = new Date();
    const lastYear = today.getFullYear() - 1;
    const sameMonth = today.getMonth() + 1;
    historicalBlock = await loadHistoricalBlock(sameMonth, lastYear, userId);
    if (historicalBlock) {
      logger.info(`Using fallback historical block: ${getMonthName(historicalBlock.month)} ${historicalBlock.year}`);
    }
  }
  
  const context: NarrativeContext = {
    snapshot,
    currentMetrics,
    historicalBlock
  };
  
  return generateNarrative(context);
}
