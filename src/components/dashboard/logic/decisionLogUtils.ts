export function getAgentName(agentId: string): string {
  const names: Record<string, string> = {
    structural_agent: 'Structural Agent',
    metabolic_agent: 'Metabolic Agent',
    fueling_agent: 'Fueling Agent',
  };
  return names[agentId] || agentId;
}

export const VOTE_COLORS = {
  RED: 'bg-red-900/20 border-red-900 text-red-400',
  AMBER: 'bg-yellow-900/20 border-yellow-900 text-yellow-400',
  GREEN: 'bg-green-900/20 border-green-900 text-green-400',
} as const;

export const VOTE_LABELS = {
  RED: 'VETO',
  AMBER: 'CAUTION',
  GREEN: 'GO',
} as const;

