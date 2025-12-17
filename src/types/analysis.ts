import { ISubstitutionResult } from './workout';
import { IAgentVote } from './agents';

export interface IAnalysisResult {
  success: boolean;
  decision?: ISubstitutionResult & { votes?: IAgentVote[] };
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

