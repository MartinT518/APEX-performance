/**
 * Audit Log Persistence
 * 
 * Purpose: Persist immutable Coach Veto Engine decisions to coach_audit_logs table.
 * These logs are never updated - only inserted for full auditability.
 */

import { supabase } from '@/lib/supabase';
import type { CoachAuditLog } from '@/types/workout';
import type { IAgentVote } from '@/types/agents';
import type { ISubstitutionResult } from '@/types/workout';
import { logger } from '@/lib/logger';

export interface AuditLogInput {
  sessionId?: string | null;
  votes: IAgentVote[];
  decision: ISubstitutionResult;
  dataIntegrityStatus?: 'VALID' | 'SUSPECT' | 'REJECTED';
}

/**
 * Persists a Coach Veto Engine decision to the audit log
 */
export async function persistCoachAuditLog(input: AuditLogInput): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    
    if (!userId) {
      logger.warn('No user ID available for audit log');
      return { success: false, error: 'No user ID' };
    }

    // Build vote combination string
    const redVotes = input.votes.filter(v => v.vote === 'RED');
    const voteCombination = redVotes.length > 0
      ? redVotes.map(v => v.agentId.replace('_agent', '') + '_RED').join('_')
      : 'ALL_GREEN';

    // Build decision path JSON
    const decisionPath = {
      votes: input.votes.map(v => ({
        agentId: v.agentId,
        vote: v.vote,
        score: v.score
      })),
      action: input.decision.action,
      modifications: input.decision.modifications
    };

    const auditLog: Omit<CoachAuditLog, 'id' | 'createdAt'> = {
      sessionId: input.sessionId || null,
      userId,
      ruleVersion: input.decision.ruleVersion || '1.0',
      voteCombination,
      decisionPath: JSON.stringify(decisionPath),
      substitutionApplied: input.decision.modifications.length > 0 
        ? input.decision.modifications.join('; ')
        : null,
      actionTaken: input.decision.action,
      reasoning: input.decision.reasoning,
      dataIntegrityStatus: input.dataIntegrityStatus || null
    };

    const { error } = await supabase
      .from('coach_audit_logs')
      .insert(auditLog);

    if (error) {
      logger.error('Failed to persist audit log', error);
      return { success: false, error: error.message };
    }

    logger.info(`Audit log persisted: ${voteCombination} → ${input.decision.action}`);
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Error persisting audit log', err);
    return { success: false, error: errorMessage };
  }
}

