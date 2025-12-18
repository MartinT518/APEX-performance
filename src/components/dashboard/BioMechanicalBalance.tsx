"use client";

import { ChassisGauge } from './ChassisGauge';
import { MetabolicGauge } from './MetabolicGauge';
import { IAgentVote } from '@/types/agents';
import { useMonitorStore } from '@/modules/monitor/monitorStore';
import { usePhenotypeStore } from '@/modules/monitor/phenotypeStore';

interface BioMechanicalBalanceProps {
  votes: IAgentVote[];
  hrvStatus?: string;
  aerobicDecoupling?: number;
}

export function BioMechanicalBalance({ votes, hrvStatus, aerobicDecoupling }: BioMechanicalBalanceProps) {
  const monitor = useMonitorStore();
  const profile = usePhenotypeStore().profile;
  
  // Find agent votes
  const structuralVote = votes.find(v => v.agentId === 'structural_agent') || null;
  const metabolicVote = votes.find(v => v.agentId === 'metabolic_agent') || null;

  // Calculate Chassis Integrity Score (0-100)
  const niggleScore = monitor.todayEntries.niggleScore || 0;
  const daysSinceLift = monitor.getDaysSinceLastLift();
  const cadenceStability = 95; // TODO: Calculate from actual data
  
  // SIS calculation: (Cadence Stability * 0.5) + (Tonnage Adherence * 0.5) - (Niggle * 10)
  // Simplified for now
  let chassisScore = 100;
  chassisScore -= niggleScore * 10;
  if (daysSinceLift > 5) {
    chassisScore -= 20;
  }
  chassisScore = Math.max(0, Math.min(100, chassisScore));

  const phenotypeMode = profile?.is_high_rev ? 'High-Rev Active' : 'Standard';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <ChassisGauge 
        score={chassisScore}
        tonnage={0} // TODO: Get from baselines
        cadenceStability={cadenceStability}
      />
      <MetabolicGauge 
        vote={metabolicVote}
        hrvStatus={hrvStatus}
        aerobicDecoupling={aerobicDecoupling}
        phenotypeMode={phenotypeMode}
      />
    </div>
  );
}

