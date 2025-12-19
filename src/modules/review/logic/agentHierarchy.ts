/**
 * Agent Hierarchy Definition
 * 
 * Purpose: Defines vote priority for deterministic Coach Veto Engine.
 * Hierarchy: Structural > Metabolic > Fueling
 * 
 * CRITICAL: This enforces that Structural RED always wins (no weighted averages).
 */

import type { IAgentVote } from '@/types/agents';

export type AgentId = 'structural_agent' | 'metabolic_agent' | 'fueling_agent';

/**
 * Vote priority: Lower number = higher priority
 * Structural = 1 (highest priority)
 * Metabolic = 2
 * Fueling = 3 (lowest priority)
 */
const AGENT_PRIORITY: Record<AgentId, number> = {
  'structural_agent': 1,
  'metabolic_agent': 2,
  'fueling_agent': 3
};

/**
 * Gets the priority of an agent vote
 */
export function getVotePriority(agentId: string): number {
  return AGENT_PRIORITY[agentId as AgentId] || 999; // Unknown agents get lowest priority
}

/**
 * Sorts votes by priority (Structural first, then Metabolic, then Fueling)
 */
export function sortVotesByPriority(votes: IAgentVote[]): IAgentVote[] {
  return [...votes].sort((a, b) => {
    const priorityA = getVotePriority(a.agentId);
    const priorityB = getVotePriority(b.agentId);
    return priorityA - priorityB;
  });
}

/**
 * Gets the highest priority RED vote (Structural RED wins over all others)
 */
export function getHighestPriorityRedVote(votes: IAgentVote[]): IAgentVote | null {
  const redVotes = votes.filter(v => v.vote === 'RED');
  if (redVotes.length === 0) return null;
  
  const sorted = sortVotesByPriority(redVotes);
  return sorted[0]; // First = highest priority
}

/**
 * Gets the highest priority vote (regardless of color)
 */
export function getHighestPriorityVote(votes: IAgentVote[]): IAgentVote | null {
  if (votes.length === 0) return null;
  const sorted = sortVotesByPriority(votes);
  return sorted[0];
}

