import { createServerClient } from '@/lib/supabase';
import type { IAgentVote } from '@/types/agents';
import { logger } from '@/lib/logger';
import { sanitizeErrorMessage } from '@/lib/errorSanitizer';

export interface PersistenceResult {
  success: boolean;
  error?: string;
}

/**
 * Maps agent ID to database agent_type enum
 */
function mapAgentType(agentId: string): 'STRUCTURAL' | 'METABOLIC' | 'FUELING' {
  if (agentId.includes('structural')) return 'STRUCTURAL';
  if (agentId.includes('metabolic')) return 'METABOLIC';
  if (agentId.includes('fueling')) return 'FUELING';
  // Default fallback
  return 'STRUCTURAL';
}

/**
 * Maps vote color to database vote_type enum
 */
function mapVoteType(vote: 'RED' | 'AMBER' | 'GREEN'): 'RED' | 'YELLOW' | 'GREEN' {
  if (vote === 'AMBER') return 'YELLOW';
  return vote;
}

/**
 * Validates UUID format
 */
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Persists agent votes to agent_votes table
 */
export async function persistAgentVotes(
  sessionId: string,
  votes: IAgentVote[]
): Promise<PersistenceResult> {
  try {
    // Validate session ID format
    if (!isValidUUID(sessionId)) {
      return { success: false, error: 'Invalid session ID format' };
    }

    const supabase = await createServerClient();
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    
    if (!userId) {
      return { success: false, error: 'No authenticated user' };
    }

    // Verify session belongs to user
    const { data: sessionData, error: sessionError } = await supabase
      .from('session_logs')
      .select('user_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !sessionData || sessionData.user_id !== userId) {
      return { success: false, error: 'Session not found or access denied' };
    }

    // Insert all votes
    const voteInserts = votes.map(vote => ({
      session_id: sessionId,
      agent_type: mapAgentType(vote.agentId),
      vote: mapVoteType(vote.vote),
      reasoning: vote.reason
    }));

    const { error } = await supabase
      .from('agent_votes')
      .insert(voteInserts);

    if (error) {
      logger.error('Failed to persist agent votes', error);
      return { success: false, error: sanitizeErrorMessage(error) };
    }

    logger.info(`Persisted ${votes.length} agent votes for session ${sessionId}`);
    return { success: true };
  } catch (err) {
    logger.error('Failed to persist agent votes to Supabase', err);
    return { success: false, error: sanitizeErrorMessage(err) };
  }
}

