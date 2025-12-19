export type FilterStatus = 'VALID' | 'DISCARD' | 'SUSPECT';

export interface ISessionDataPoint {
  timestamp: number; // Unix timestamp
  heartRate?: number;
  cadence?: number;
  speed?: number; // m/s
  power?: number; // Watts
  altitude?: number; // Meters
}

export interface ISessionStream {
  id: string;
  source: 'garmin_health' | 'manual_upload' | 'test_mock';
  dataPoints: ISessionDataPoint[];
  sportType: 'RUNNING' | 'CYCLING' | 'STRENGTH' | 'OTHER';
}

export interface IFilterDiagnostics {
  status: FilterStatus;
  reason?: string;
  flaggedIndices: number[]; // Indices of data points that failed validation
  originalPointCount: number;
  validPointCount: number;
}

/**
 * Session Summary: Typed inputs for independent micro-agents
 * Each agent receives only its slice of the summary
 */
import type { TonnageTier } from '@/types/agents';
import type { PrototypeSessionDetail } from '@/types/prototype';

export interface ISessionSummary {
  // Structural Agent inputs
  structural: {
    niggleScore: number;
    daysSinceLastLift: number;
    tonnageTier: TonnageTier | undefined;
    currentWeeklyVolume: number;
    sessionPoints?: ISessionDataPoint[]; // For cadence stability calculation
    // Agent computes: cadenceStability, Acute_Chronic_Ratio (based on Tonnage)
  };
  // Metabolic Agent inputs
  metabolic: {
    sessionPoints: ISessionDataPoint[];
    hrvBaseline?: number;
    currentHRV?: number;
    planLimitRedZone: number;
    // Agent computes: aerobicDecoupling, timeInRedZone
  };
  // Fueling Agent inputs
  fueling: {
    nextRunDuration: number;
    sessionHistory?: PrototypeSessionDetail[]; // Rolling history for Gut_Training_Index
    // Agent computes: Gut_Training_Index (last 4 long runs >90min)
  };
}