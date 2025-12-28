export type VoteColor = 'RED' | 'AMBER' | 'GREEN' | 'REJECTED';

export interface IFlaggedMetric {
  metric: string;
  value: number | string;
  threshold: number | string;
}

export interface IAgentVote {
  agentId: string;
  vote: VoteColor; // The "Veto"
  confidence: number; // 0.0 - 1.0
  reason: string;
  flaggedMetrics: IFlaggedMetric[];
  score?: number; // 0-100 normalized risk score (optional for backward compatibility)
}

// Data Integrity Agent types
export type IntegrityStatus = 'VALID' | 'SUSPECT' | 'REJECTED';

export interface SessionIntegrity {
  status: IntegrityStatus;
  confidence: number; // 0.0 - 1.0
  flags: string[];
  reason?: string;
}

export interface IDataIntegrityInput {
  sessionPoints: import('@/types/session').ISessionDataPoint[];
  phenotypeProfile: import('@/types/phenotype').IPhenotypeProfile;
  diagnostics?: {
    highRevDiagnostics?: { flaggedIndices: number[] };
    cadenceLockDiagnostics?: { flaggedIndices: number[] };
    dropoutDiagnostics?: { flaggedIndices: number[] };
    clippingDiagnostics?: { flaggedIndices: number[] };
  };
}

export interface IDataIntegrityVote extends IAgentVote {
  status: IntegrityStatus;
}

export type TonnageTier = 'maintenance' | 'hypertrophy' | 'strength' | 'power' | 'explosive';

export interface IStructuralInput {
  niggleScore: number; // 0-10
  daysSinceLastLift: number;
  acuteTonnageLoad?: number;
  tonnageTier?: TonnageTier;
  currentWeeklyVolume?: number; // km/week
}

export interface IMetabolicInput {
  aerobicDecoupling: number; // % (e.g. 5.5)
  timeInRedZone: number; // minutes
  planLimitRedZone: number; // minutes
  hrvBaseline?: number; // HRV baseline for comparison
  currentHRV?: number; // Current HRV reading
}

export interface IFuelingInput {
  gutTrainingIndex: number; // Count of recent >60g/hr sessions
  nextRunDuration: number; // minutes
}
