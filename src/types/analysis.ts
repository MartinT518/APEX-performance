import { ISubstitutionResult } from './workout';
import { IAgentVote } from './agents';

export interface IAnalysisResult {
  success: boolean;
  decision?: ISubstitutionResult & { 
    votes?: IAgentVote[];
    global_status?: 'GO' | 'ADAPTED' | 'SHUTDOWN';
    reason?: string;
    votes_display?: {
      structural: { vote: string; color: string; label: string };
      metabolic: { vote: string; color: string; label: string };
      fueling: { vote: string; color: string; label: string };
    };
    substitutions_suggested?: boolean;
  };
  simulation?: {
    successProbability: number;
    confidenceScore: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  auditStatus?: string;
  metadata?: {
    dataSource: string;
    activityName?: string;
    timestamp?: string;
  };
  message?: string;
}

export interface DailyDecisionSnapshot {
  id: string;
  user_id: string;
  date: string;
  global_status: 'GO' | 'ADAPTED' | 'SHUTDOWN';
  reason: string;
  votes_jsonb: IAgentVote[];
  final_workout_jsonb: import('./workout').IWorkout;
  certainty_score: number | null;
  certainty_delta: number | null;
  inputs_summary_jsonb: {
    niggle_score: number | null;
    strength_tier: string | null;
    last_run_duration: number;
    fueling_carbs_per_hour: number | null;
    fueling_gi_distress: number | null;
  } | null;
  created_at: string;
  updated_at: string;
}

