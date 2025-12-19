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
}

/**
 * Builds a typed session summary from all data sources.
 * Each agent receives only its slice - no shared calculations.
 */
export async function buildSessionSummary(
  inputs: SessionSummaryInputs
): Promise<ISessionSummary> {
  const { sessionPoints, workout, metabolicData, sessionHistory } = inputs;
  
  const monitor = useMonitorStore.getState();
  const analyzeStore = useAnalyzeStore.getState();
  
  // Get structural agent inputs
  const daysSinceLift = monitor.getDaysSinceLastLift();
  const lastLiftTier = await monitor.getLastLiftTier();
  const currentWeeklyVolume = await monitor.calculateCurrentWeeklyVolume();
  
  // Build summary - each agent gets only its slice
  const summary: ISessionSummary = {
    structural: {
      niggleScore: monitor.todayEntries.niggleScore || 0,
      daysSinceLastLift: daysSinceLift,
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
  
  logger.info(`Session Summary built: Structural (${summary.structural.niggleScore} niggle, ${daysSinceLift} days since lift), Metabolic (${sessionPoints.length} points), Fueling (${workout.durationMinutes}min)`);
  
  return summary;
}

