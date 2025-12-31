/**
 * Session Summary Builder
 * 
 * Purpose: Aggregates all data sources into typed session summary.
 * Each agent receives only its slice of the summary - no shared state or calculations.
 */

import type { ISessionSummary } from '@/types/session';
import type { ISessionDataPoint } from '@/types/session';
import type { IWorkout } from '@/types/workout';
import type { PrototypeSessionDetail } from '@/types/prototype';
import { useMonitorStore } from '../../monitor/monitorStore';
import { useAnalyzeStore } from '../../analyze/analyzeStore';
import { logger } from '@/lib/logger';

export interface SessionSummaryInputs {
  sessionPoints: ISessionDataPoint[];
  workout: IWorkout;
  metabolicData?: {
    hrvBaseline?: number;
    currentHRV?: number;
    planLimitRedZone?: number;
  };
  sessionHistory?: PrototypeSessionDetail[]; // For fueling agent
  // P0 Fix: Accept database-loaded values instead of using client-side state
  structuralData?: {
    niggleScore?: number;
    daysSinceLastLift?: number;
    lastLiftTier?: 'maintenance' | 'hypertrophy' | 'strength' | 'power' | 'explosive';
    currentWeeklyVolume?: number;
  };
}

/**
 * Builds a typed session summary from all data sources.
 * Each agent receives only its slice - no shared calculations.
 */
export async function buildSessionSummary(
  inputs: SessionSummaryInputs
): Promise<ISessionSummary> {
  const { sessionPoints, workout, metabolicData, sessionHistory, structuralData } = inputs;
  
  // P0 Fix: Use provided structural data if available (from database), otherwise fall back to client state
  // This allows server actions to pass database-loaded values
  let niggleScore: number;
  let daysSinceLift: number;
  let lastLiftTier: 'maintenance' | 'hypertrophy' | 'strength' | 'power' | 'explosive' | undefined;
  let currentWeeklyVolume: number;
  
  if (structuralData) {
    // Use database-loaded values (server action context)
    niggleScore = structuralData.niggleScore ?? 0;
    daysSinceLift = structuralData.daysSinceLastLift ?? 999;
    lastLiftTier = structuralData.lastLiftTier;
    currentWeeklyVolume = structuralData.currentWeeklyVolume ?? 0;
  } else {
    // Fall back to client state (client component context)
    const monitor = useMonitorStore.getState();
    niggleScore = monitor.todayEntries.niggleScore || 0;
    daysSinceLift = monitor.getDaysSinceLastLift();
    lastLiftTier = await monitor.getLastLiftTier();
    currentWeeklyVolume = await monitor.calculateCurrentWeeklyVolume();
  }
  
  // Build summary - each agent gets only its slice
  const summary: ISessionSummary = {
    structural: {
      niggleScore,
      daysSinceLastLift: daysSinceLift, // Use local variable daysSinceLift
      tonnageTier: lastLiftTier,
      currentWeeklyVolume,
      sessionPoints: sessionPoints.length > 0 ? sessionPoints : undefined // For cadence stability calculation
    },
    metabolic: {
      sessionPoints: sessionPoints.length > 0 ? sessionPoints : [],
      hrvBaseline: metabolicData?.hrvBaseline,
      currentHRV: metabolicData?.currentHRV,
      planLimitRedZone: metabolicData?.planLimitRedZone || 10
    },
    fueling: {
      nextRunDuration: workout.durationMinutes,
      sessionHistory: sessionHistory // Rolling history for Gut_Training_Index calculation
    }
  };
  
  logger.info(`Session Summary built: Structural (${summary.structural.niggleScore} niggle, ${summary.structural.daysSinceLastLift} days since lift), Metabolic (${sessionPoints.length} points), Fueling (${workout.durationMinutes}min)`);
  
  return summary;
}

