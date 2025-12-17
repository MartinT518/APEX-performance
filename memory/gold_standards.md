# Gold Standards

## 1. Standard Logic Example: The Substitution Matrix
This code demonstrates the "Clean Code" standard for this project:
*   **Type Safety:** Strict Interfaces.
*   **Pure Functions:** Deterministic logic (Input -> Output).
*   **Readable:** Clear variable names matching the Domain (FRD).

```typescript
// types/agents.ts
export type VoteColor = 'RED' | 'AMBER' | 'GREEN';

export interface IAgentVote {
  agentId: string;
  vote: VoteColor;
  reason: string;
}

export interface ISubstitutionResult {
  action: 'SUBSTITUTE' | 'DOWNGRADE' | 'CAP' | 'SHUTDOWN' | 'PROCEED';
  protocol: string;
}

// core/logic/substitutionMatrix.ts
export const evaluateSubstitution = (
  structural: IAgentVote,
  metabolic: IAgentVote,
  fueling: IAgentVote
): ISubstitutionResult => {
  
  // 1. SHUTDOWN: Any Double Red or Structural Red + Metabolic Red
  if (structural.vote === 'RED' && metabolic.vote === 'RED') {
    return {
      action: 'SHUTDOWN',
      protocol: 'Complete Rest + Mobility. Chassis and Engine both compromised.'
    };
  }

  // 2. SUBSTITUTE: Structural Risk (Pain/No Lift) but Engine is Green
  if (structural.vote === 'RED' && metabolic.vote === 'GREEN') {
    return {
      action: 'SUBSTITUTE',
      protocol: 'Bike Intervals (Match HR Duration) OR BFR. Offload the Chassis.'
    };
  }

  // 3. DOWNGRADE: Engine Fatigue
  if (metabolic.vote === 'RED') {
    return {
      action: 'DOWNGRADE',
      protocol: 'Zone 1 Recovery Run. Engine needs flush.'
    };
  }

  // 4. CAP: Fueling Risk
  if (fueling.vote === 'RED') {
    return {
      action: 'CAP',
      protocol: 'Cap Long Run at 120min + 5 min surges. Gut is untrained.'
    };
  }

  // Default
  return {
    action: 'PROCEED',
    protocol: 'Execute Planned Workout.'
  };
};
```
