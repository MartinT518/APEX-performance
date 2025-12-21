import type { IAgentVote } from '@/types/agents';

export interface StatusResolverInput {
  votes: IAgentVote[];
  niggleScore: number;
}

export interface StatusResolverOutput {
  global_status: 'GO' | 'ADAPTED' | 'SHUTDOWN';
  reason: string;
  votes: {
    structural: { vote: string; color: string; label: string };
    metabolic: { vote: string; color: string; label: string };
    fueling: { vote: string; color: string; label: string };
  };
  substitutions_suggested: boolean;
}

/**
 * Pure function that resolves daily status from agent votes
 * 
 * Rules:
 * - SHUTDOWN: Multiple RED votes OR (Structural RED + Metabolic RED)
 * - ADAPTED: Single RED vote (any agent) OR structural RED triggers substitution
 * - GO: All GREEN or only AMBER votes
 * 
 * Must be pure (no side effects, no zustand)
 */
export function resolveDailyStatus(input: StatusResolverInput): StatusResolverOutput {
  const { votes, niggleScore } = input;
  
  // Extract votes by agent
  const structuralVote = votes.find(v => v.agentId === 'structural_agent');
  const metabolicVote = votes.find(v => v.agentId === 'metabolic_agent');
  const fuelingVote = votes.find(v => v.agentId === 'fueling_agent');
  
  // Count RED votes
  const redVotes = votes.filter(v => v.vote === 'RED');
  const structuralRed = structuralVote?.vote === 'RED';
  const metabolicRed = metabolicVote?.vote === 'RED';
  const fuelingRed = fuelingVote?.vote === 'RED';
  
  // Helper to format vote display
  const formatVote = (vote: IAgentVote | undefined) => {
    if (!vote) {
      return { vote: 'UNKNOWN', color: 'gray', label: 'No Vote' };
    }
    const colorMap: Record<string, string> = {
      'RED': 'red',
      'AMBER': 'amber',
      'YELLOW': 'amber',
      'GREEN': 'green'
    };
    const labelMap: Record<string, string> = {
      'RED': 'Veto',
      'AMBER': 'Caution',
      'YELLOW': 'Caution',
      'GREEN': 'Go'
    };
    return {
      vote: vote.vote,
      color: colorMap[vote.vote] || 'gray',
      label: labelMap[vote.vote] || vote.vote
    };
  };
  
  // Determine status
  let global_status: 'GO' | 'ADAPTED' | 'SHUTDOWN';
  let reason: string;
  let substitutions_suggested = false;
  
  // SHUTDOWN: Multiple REDs OR (Structural RED + Metabolic RED)
  if (redVotes.length > 1 || (structuralRed && metabolicRed)) {
    global_status = 'SHUTDOWN';
    const redAgents = redVotes.map(v => v.agentId.replace('_agent', '')).join(' + ');
    reason = `System Shutdown: Multiple critical flags (${redAgents}). Complete rest required.`;
  }
  // ADAPTED: Single RED vote (any agent)
  else if (redVotes.length === 1) {
    global_status = 'ADAPTED';
    const redAgent = redVotes[0];
    const agentName = redAgent.agentId.replace('_agent', '');
    
    if (structuralRed) {
      reason = `Structural Agent Veto (Pain ${niggleScore}/10). Run substituted for non-impact load.`;
      substitutions_suggested = true;
    } else if (metabolicRed) {
      reason = `Metabolic Agent Veto: ${redAgent.reason}. Intensity downgraded.`;
    } else if (fuelingRed) {
      reason = `Fueling Agent Veto: ${redAgent.reason}. Duration capped.`;
    } else {
      reason = `${agentName} Agent Veto: ${redAgent.reason}`;
    }
  }
  // GO: All GREEN or only AMBER votes
  else {
    global_status = 'GO';
    const amberVotes = votes.filter(v => v.vote === 'AMBER' || v.vote === 'YELLOW');
    if (amberVotes.length > 0) {
      const amberReason = amberVotes[0].reason;
      reason = `CAUTION: ${amberReason}`;
    } else {
      reason = 'Chassis and Engine are Green. Execute High-Rev Protocol.';
    }
  }
  
  return {
    global_status,
    reason,
    votes: {
      structural: formatVote(structuralVote),
      metabolic: formatVote(metabolicVote),
      fueling: formatVote(fuelingVote)
    },
    substitutions_suggested
  };
}

