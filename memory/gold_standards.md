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

## 2. External API Integration Pattern: Garmin MCP Sync

This demonstrates the pattern for integrating external APIs with token persistence and fallback:

```typescript
// src/modules/monitor/ingestion/garminSyncMCP.ts
// Primary: MCP Python client (token persistence, efficient queries)
// Fallback: npm garmin-connect package

export async function syncGarminSessionsToDatabaseMCP(
  startDate: string,
  endDate: string
): Promise<{ synced: number; errors: number }> {
  // Call Python script via subprocess
  const scriptPath = path.resolve(process.cwd(), 'scripts', 'sync-garmin-mcp.py');
  const { stdout } = await execAsync(`${pythonCmd} "${scriptPath}" "${startDate}" "${endDate}"`);
  
  const result: MCPResponse = JSON.parse(stdout);
  
  // Handle errors with proper type checking
  if (!result.success) {
    if (result.error === 'RATE_LIMITED') {
      return { synced: 0, errors: 1 };
    }
    throw new Error(result.message || result.error);
  }
  
  // Process activities with null safety
  for (const activity of result.activities || []) {
    if (!activity.activityId) continue; // Skip invalid activities
    
    // Type-safe detail processing
    if (activity.details) {
      try {
        const stream = adaptGarminToSessionStream(activity.details);
        // Process stream...
      } catch (err) {
        // Graceful degradation: continue with empty points
      }
    }
  }
}
```

```python
# scripts/sync-garmin-mcp.py
# Uses MCP client for token persistence and efficient queries

def sync_activities_by_date_range(start_date: str, end_date: str) -> dict:
    # Initialize client (uses token persistence)
    garmin = init_garmin_client(config)
    client = GarminClientWrapper(garmin)
    
    # Efficient date-range query (single API call)
    activities = client.safe_call('get_activities_by_date', start_date, end_date, '')
    
    # Fetch details with error handling
    for activity in activities:
        try:
            details = client.safe_call('get_activity', activity_id)
        except GarminRateLimitError:
            return {'success': False, 'error': 'RATE_LIMITED'}
        except Exception as e:
            logger.warning(f"Failed to fetch details: {e}")
            details = None
        
        formatted_activities.append({
            'activityId': activity_id,
            'details': details
        })
    
    return {'success': True, 'activities': formatted_activities}
```

**Key Principles:**
- **Token Persistence**: Save OAuth tokens to avoid repeated authentication
- **Efficient Queries**: Use date-range methods instead of pagination when available
- **Fallback Strategy**: Always provide npm client fallback if Python unavailable
- **Error Handling**: Custom exceptions with proper type checking
- **Null Safety**: Check for null/undefined before processing
- **Graceful Degradation**: Continue processing even if some activities fail

## 3. ValuationEngine Pattern (Mathematical Logic Layer)

This demonstrates the pattern for implementing complex mathematical calculations as pure functions:

```typescript
// src/modules/analyze/valuationEngine.ts
// Pure functions with no UI dependencies

export interface ValuationResult {
  adherenceScore: number; // 0-100%
  integrityRatio: number; // Normalized ratio
  blueprintProbability: number; // 0-85% (capped)
  coachVerdict: 'EXCELLENT' | 'ON TRACK' | 'MODERATE RISK' | 'HIGH RISK';
}

/**
 * Equation A: Smart Adherence Score
 * Formula: Sum(V_eff * I_comp) / Sum(V_plan)
 * Logic: Valid structural vetoes count as 0.8 adherence, not failure
 */
function calculateSmartAdherenceScore(
  sessions: PrototypeSessionDetail[]
): number {
  let totalEffectiveVolume = 0;
  let totalPlannedVolume = 0;

  sessions.forEach(session => {
    const volume = getEffectiveVolume(session);
    totalPlannedVolume += volume;

    // Smart adherence: Valid substitutions count as 0.8
    if (session.type === 'SUB' && session.agentFeedback?.structural.includes('RED')) {
      totalEffectiveVolume += volume * 0.8; // Valid veto = 80% adherence
    } else if (session.type === 'EXEC') {
      totalEffectiveVolume += volume; // Full adherence
    }
    // MISSED sessions contribute 0
  });

  return totalPlannedVolume > 0 
    ? (totalEffectiveVolume / totalPlannedVolume) * 100 
    : 0;
}

/**
 * Equation B: Integrity Ratio (Chassis vs Engine)
 * Formula: RollingAvg(Strength_Load) / RollingAvg(Run_Volume)
 * Normalization: (Tonnage/1000) / (Volume/10)
 */
function calculateIntegrityRatio(
  sessions: PrototypeSessionDetail[]
): number {
  const strengthLoads: number[] = [];
  const runVolumes: number[] = [];

  sessions.forEach(session => {
    if (session.type === 'STR') {
      const load = strengthTierToLoad(session.hiddenVariables?.strengthTier || 'NONE');
      strengthLoads.push(load);
    } else if (session.type === 'EXEC' && session.distance) {
      runVolumes.push(session.distance);
    }
  });

  // Calculate rolling averages (last 30 days)
  const avgStrength = strengthLoads.slice(-30).reduce((a, b) => a + b, 0) / Math.max(1, strengthLoads.length);
  const avgRunVolume = runVolumes.slice(-30).reduce((a, b) => a + b, 0) / Math.max(1, runVolumes.length);

  // Normalize units: (Tonnage/1000) / (Volume/10)
  const normalizedStrength = avgStrength / 1000;
  const normalizedVolume = avgRunVolume / 10;

  return normalizedVolume > 0 ? normalizedStrength / normalizedVolume : 0;
}

/**
 * Equation C: Blueprint Probability
 * Formula: Base_Prob + (Alpha * (Vol_Banked - Vol_Req)) - (Beta * Risk_Penalty)
 * Cap: Maximum 85% (never promise certainty)
 */
function calculateBlueprintProbability(
  sessions: PrototypeSessionDetail[],
  adherenceScore: number,
  integrityRatio: number
): number {
  const MAX_PROBABILITY = 85; // Cap at 85% - always 15% risk
  const BASE_PROB = 50;
  const ALPHA = 0.5;
  const BETA = 0.3;

  // Phase-aware volume requirement
  const phase = getCurrentPhase(new Date());
  const volReqMultiplier = 
    phase.phaseNumber === 1 ? 0.6 :
    phase.phaseNumber === 2 ? 0.8 :
    phase.phaseNumber === 3 ? 1.0 : 0.5;
  
  const VOL_REQ = 2000 * volReqMultiplier;

  // Calculate volume banked
  let volBanked = sessions.reduce((sum, s) => sum + getEffectiveVolume(s), 0);

  // Phase 3 penalty: If <50km/week, probability tanks
  const currentWeeklyVolume = volBanked / Math.max(1, sessions.length / 7);
  if (phase.phaseNumber === 3 && currentWeeklyVolume < 50) {
    return Math.max(0, BASE_PROB - 30);
  }

  // Calculate probability
  const volumeDelta = volBanked - VOL_REQ;
  const volumeContribution = ALPHA * (volumeDelta / VOL_REQ) * 100;
  
  let riskPenalty = 0;
  if (integrityRatio < 0.8) {
    riskPenalty += (0.8 - integrityRatio) * 20;
  }
  if (adherenceScore < 80) {
    riskPenalty += (80 - adherenceScore) * 0.5;
  }

  const probability = BASE_PROB + volumeContribution - (BETA * riskPenalty);
  return Math.max(0, Math.min(MAX_PROBABILITY, Math.round(probability)));
}

/**
 * Orchestrator: Calculate all equations and determine verdict
 */
export function calculateValuation(
  sessions: PrototypeSessionDetail[]
): ValuationResult {
  const adherenceScore = calculateSmartAdherenceScore(sessions);
  const integrityRatio = calculateIntegrityRatio(sessions);
  const blueprintProbability = calculateBlueprintProbability(
    sessions,
    adherenceScore,
    integrityRatio
  );

  const coachVerdict = determineCoachVerdict(adherenceScore, integrityRatio);

  return {
    adherenceScore,
    integrityRatio,
    blueprintProbability,
    coachVerdict
  };
}
```

**Key Principles:**
- **Pure Functions**: No side effects, deterministic input/output
- **Type Safety**: Strict interfaces for all inputs/outputs
- **Unit Normalization**: Always normalize units before ratio calculations
- **Risk Acknowledgment**: Cap probabilities at realistic maximums (85%)
- **Phase Awareness**: Calculations adapt to training phase requirements
- **Fallback Logic**: Handle edge cases (empty arrays, zero division)

## 4. Client-Side Decoupling Calculation Pattern

This demonstrates calculating efficiency factor (EF) from session metadata:

```typescript
// src/app/lab/logic/dataLoader.ts
// Client-side EF calculation with fallback chain

function calculateDecouplingFromMetadata(
  metadata: Record<string, unknown>
): number | null {
  // Fallback 1: Use pre-calculated decoupling
  const preCalculated = metadata?.decoupling as number | undefined;
  if (preCalculated !== undefined && preCalculated !== null) {
    return preCalculated;
  }

  // Fallback 2: Calculate from first/second half EF
  const firstHalfPace = metadata?.firstHalfPace as string | undefined;
  const firstHalfHR = metadata?.firstHalfHR as number | undefined;
  const secondHalfPace = metadata?.secondHalfPace as string | undefined;
  const secondHalfHR = metadata?.secondHalfHR as number | undefined;

  if (firstHalfPace && firstHalfHR && secondHalfPace && secondHalfHR) {
    const parsePace = (paceStr: string): number => {
      const match = paceStr.match(/(\d+):(\d+)/);
      if (match) {
        return parseInt(match[1], 10) + parseInt(match[2], 10) / 60;
      }
      return parseFloat(paceStr) || 0;
    };

    const efFirst = parsePace(firstHalfPace) / firstHalfHR;
    const efSecond = parsePace(secondHalfPace) / secondHalfHR;

    if (efFirst > 0) {
      const decoupling = ((efFirst - efSecond) / efFirst) * 100;
      return Math.max(0, decoupling);
    }
  }

  // Fallback 3: Estimated (less accurate)
  return 2.5; // Default estimate
}
```

**Key Principles:**
- **Multiple Fallbacks**: Always provide fallback chain for missing data
- **Pace Parsing**: Handle both "MM:SS" and decimal formats
- **Null Safety**: Check for undefined/null before calculations
- **Documentation**: Clearly document data dependencies and recommendations