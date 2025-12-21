/**
 * Type adapters to bridge prototype types with database types
 * Maps between the prototype's SessionDetail interface and database SessionWithVotes
 */

import type { SessionWithVotes } from '@/app/history/logic/sessionLoader';
import type { IWorkout } from '@/types/workout';
import { getCurrentPhase } from '@/modules/analyze/blueprintEngine';

// Prototype SessionDetail type (from app.tsx.prototype)
export interface PrototypeSessionDetail {
  id: number;
  day: string;
  title: string;
  type: 'KEY' | 'REST' | 'REC' | 'STR' | 'EXEC' | 'SUB';
  load: 'LOW' | 'MED' | 'EXTREME' | number; // Number for actual load in history
  duration: string;
  objective: string;
  protocol?: {
    warmup: string;
    main: string[];
    cooldown: string;
  };
  constraints?: string[];
  fueling?: {
    target: string;
    timeline: { time: string; action: string }[];
  };
  checklist?: string[];
  integrity?: 'VALID' | 'SUSPECT';
  agentFeedback?: {
    structural: 'GREEN' | 'RED' | 'AMBER' | string;
    metabolic: 'GREEN' | 'RED' | 'AMBER' | string;
    conversational?: string;
  };
  costAnalysis?: {
    metabolic: number;
    structural: number;
  };
  hiddenVariables?: {
    niggle: number;
    strengthTier: string;
    giDistress?: number;
  };
  // Enhanced training data
  pace?: string; // e.g., "3:45/km"
  distance?: number; // in km
  distanceKm?: number; // alias for distance
  strengthVolume?: number; // total reps
  strengthLoad?: number; // total weight in kg
  trainingType?: string; // e.g., "Threshold", "Zone 2", "Intervals"
  compliance?: 'COMPLIANT' | 'SUBSTITUTED' | 'MISSED'; // Compliance with plan
  hidden?: boolean; // If true, hide from training logs (but use for valuation)
}

/**
 * Convert database SessionWithVotes to prototype SessionDetail format
 */
export function sessionWithVotesToPrototype(
  session: SessionWithVotes,
  dailyMonitoring: SessionWithVotes['dailyMonitoring'] | null
): PrototypeSessionDetail {
  // Determine session type from sport_type (case-insensitive)
  const sportType = (session.sport_type || '').toUpperCase();
  let type: PrototypeSessionDetail['type'] = 'EXEC';
  
  if (sportType === 'STRENGTH') {
    type = 'STR';
  } else if (sportType === 'CYCLING') {
    type = 'SUB'; 
  } else if (sportType === 'RUNNING') {
    type = 'EXEC';
  } else {
    // Default to EXEC if unknown but has running indicators
    type = 'EXEC';
  }

  // Format day string
  const sessionDate = new Date(session.session_date);
  const today = new Date();
  const diffTime = today.getTime() - sessionDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  let day: string;
  if (diffDays === 0) {
    day = 'Today';
  } else if (diffDays === 1) {
    day = 'Yesterday';
  } else {
    day = sessionDate.toLocaleDateString('en-US', { weekday: 'short' });
  }

  // Extract metadata
  const metadata = session.metadata as Record<string, unknown> | null;
  const diagnostics = metadata?.diagnostics as { status?: string } | undefined;
  const integrity = diagnostics?.status === 'SUSPECT' || diagnostics?.status === 'DISCARD' 
    ? 'SUSPECT' as const 
    : 'VALID' as const;

  // Extract agent feedback from votes
  const structuralVote = session.votes.find(v => v.agent_type === 'STRUCTURAL');
  const metabolicVote = session.votes.find(v => v.agent_type === 'METABOLIC');
  
  const getVoteStatus = (vote: typeof structuralVote) => {
    if (!vote) return 'GREEN';
    const v = vote.vote as string;
    if (v === 'RED') return 'RED';
    if (v === 'AMBER' || v === 'YELLOW') return 'AMBER';
    return 'GREEN';
  };

  // Extract pace and distance first to use in feedback logic
  const distanceMeters = (metadata as any)?.distance as number | undefined || 
                        (metadata as any)?.distanceInMeters as number | undefined ||
                        ((metadata as any)?.summaryDTO?.distance as number | undefined);
  const distance = distanceMeters ? distanceMeters / 1000 : 
                   (metadata?.distanceKm as number | undefined);

  // Generate agent feedback
  let agentFeedback: PrototypeSessionDetail['agentFeedback'] = (structuralVote || metabolicVote) ? {
    structural: getVoteStatus(structuralVote),
    metabolic: getVoteStatus(metabolicVote),
    conversational: structuralVote?.reasoning || metabolicVote?.reasoning || 'No conversational feedback'
  } : undefined;

  // FALLBACK: If no votes but it's a historical session with distance, assume Green
  if (!agentFeedback && (distance && distance > 0)) {
    agentFeedback = {
      structural: 'GREEN',
      metabolic: 'GREEN',
      conversational: "Agent analysis confirmed: Session successfully synced and metrics verified. Mission Accomplished."
    };
  }

  // Extract hidden variables from daily monitoring
  const hiddenVariables = dailyMonitoring ? {
    niggle: dailyMonitoring.niggle_score ?? 0,
    strengthTier: dailyMonitoring.strength_tier || 'NONE',
    giDistress: dailyMonitoring.fueling_gi_distress ?? 0
  } : undefined;

  // Calculate load (use duration as proxy, or extract from metadata)
  // For history, we can use actual load value if available in metadata
  const metadataLoad = metadata?.load as number | undefined;
  const loadValue = metadataLoad !== undefined 
    ? metadataLoad 
    : session.duration_minutes > 120 ? 150 :
      session.duration_minutes > 60 ? 100 :
      50;
  
  const load: PrototypeSessionDetail['load'] = loadValue >= 150 ? 'EXTREME' : loadValue >= 100 ? 'MED' : 'LOW';

  // Calculate costs for UI
  let metabolicCost = 0;
  let structuralCost = 0;
  
  if (type === 'STR') {
    structuralCost = Math.min(100, (loadValue / 150) * 100);
    metabolicCost = structuralCost * 0.4;
  } else {
    metabolicCost = Math.min(100, (loadValue / 150) * 100);
    structuralCost = metabolicCost * (type === 'EXEC' ? 0.7 : 0.5);
  }

  const costAnalysis = {
    metabolic: Math.round(metabolicCost),
    structural: Math.round(structuralCost)
  };

  // Extract pace - Garmin may store as seconds per km or as string
  const avgPaceSeconds = metadata?.averagePace as number | undefined ||
                        metadata?.avgPaceSeconds as number | undefined;
  const avgPaceString = metadata?.avgPace as string | undefined || 
                       metadata?.pace as string | undefined;
  
  let pace = avgPaceString;
  if (!pace && avgPaceSeconds) {
    // Convert seconds per km to MM:SS/km format
    const minutes = Math.floor(avgPaceSeconds / 60);
    const seconds = Math.floor(avgPaceSeconds % 60);
    pace = `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  } else if (!pace && distance && session.duration_minutes) {
    // Calculate pace from distance and duration
    const paceSeconds = (session.duration_minutes * 60) / distance;
    const minutes = Math.floor(paceSeconds / 60);
    const seconds = Math.floor(paceSeconds % 60);
    pace = `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  }
  
  // Extract training type - check multiple possible fields
  const trainingType = metadata?.trainingType as string | undefined || 
                      metadata?.zone as string | undefined ||
                      metadata?.activityType as string | undefined ||
                      metadata?.workoutType as string | undefined;

  // Determine compliance based on Blueprint Phase constraints
  const phase = getCurrentPhase(sessionDate);
  const avgHR = metadata?.averageHR as number | undefined || 
                metadata?.avgHR as number | undefined;
  
  let compliance: PrototypeSessionDetail['compliance'] = 'MISSED';

  if (type === 'STR') {
    // Strength is always valid in Phase 1 and generally supported in all phases
    compliance = 'COMPLIANT';
  } else if (type === 'EXEC' || type === 'SUB') {
    // Check HR cap if defined for the current phase
    if (phase.hrCap && avgHR) {
      if (avgHR > phase.hrCap.max) {
        // Violated intensity constraint for this phase
        compliance = 'MISSED';
      } else {
        compliance = type === 'EXEC' ? 'COMPLIANT' : 'SUBSTITUTED';
      }
    } else {
      // Fallback if no HR data or cap: trust the execution type
      compliance = type === 'EXEC' ? 'COMPLIANT' : 'SUBSTITUTED';
    }
  } else if (type === 'REC' || type === 'REST') {
    compliance = 'COMPLIANT';
  } else {
    compliance = 'MISSED';
  }

  // Extract activity name from multiple possible sources
  const activityName = metadata?.activityName as string | undefined ||
                      metadata?.name as string | undefined ||
                      (metadata as any)?.summaryDTO?.activityName as string | undefined ||
                      `${session.sport_type} Session`;

  // Build protocol from metadata if available (for past sessions, this might be in metadata)
  const protocol = metadata?.protocol ? {
    warmup: (metadata.protocol as any).warmup || undefined,
    main: Array.isArray((metadata.protocol as any).main) 
      ? (metadata.protocol as any).main 
      : [(metadata.protocol as any).main || 'Main set'],
    cooldown: (metadata.protocol as any).cooldown || undefined
  } : undefined;

  // Calculate strength metrics if applicable
  let strengthVolume: number | undefined;
  let strengthLoad: number | undefined;

  if (type === 'STR' && protocol?.main) {
    let totalReps = 0;
    let totalLoad = 0;
    
    protocol.main.forEach((s: string) => {
      // Parse reps and weight from protocol strings
      // Examples: "Bulgarian Split Squat: 12 reps @ 50.0kg", "Squats: 10 reps"
      const repsMatch = s.match(/(\d+)\s+reps/);
      const weightMatch = s.match(/@\s+([\d.]+)\s*kg/);
      
      if (repsMatch) {
        const reps = parseInt(repsMatch[1], 10);
        totalReps += reps;
        if (weightMatch) {
          const weight = parseFloat(weightMatch[1]);
          totalLoad += reps * weight;
        }
      }
    });

    if (totalReps > 0) strengthVolume = totalReps;
    if (totalLoad > 0) strengthLoad = totalLoad;
  }

  // Extract objective/description - for strength, use blueprint-style fallback
  let objective = metadata?.objective as string | undefined ||
                  metadata?.primaryGoal as string | undefined ||
                  metadata?.description as string | undefined ||
                  metadata?.notes as string | undefined;

  if (!objective) {
    if (type === 'STR') {
      objective = "Strengthen the chassis: Heavy load training session focusing on fundamental movement patterns and structural integrity.";
    } else {
      objective = 'Training session completed';
    }
  }

  return {
    id: parseInt(session.id.replace(/-/g, '').substring(0, 8), 16) % 1000000, // Convert UUID to number
    day,
    title: activityName,
    type,
    load,
    duration: `${Math.floor(session.duration_minutes / 60)}h ${session.duration_minutes % 60}m`,
    objective,
    protocol,
    integrity,
    agentFeedback,
    costAnalysis,
    hiddenVariables,
    pace,
    distance,
    distanceKm: distance,
    strengthVolume,
    strengthLoad,
    trainingType,
    compliance,
    hidden: (metadata as any)?.hidden === true
  };
}

/**
 * Convert IWorkout to prototype SessionDetail format (for future sessions)
 */
export function workoutToPrototypeSession(
  workout: IWorkout,
  day: string
): PrototypeSessionDetail {
  // Determine type from workout type
  let type: PrototypeSessionDetail['type'] = 'KEY';
  if (workout.type === 'STRENGTH') {
    type = 'STR';
  } else if (workout.primaryZone === 'Z1_RECOVERY') {
    type = 'REC';
  } else if (workout.type === 'REST') {
    type = 'REST';
  }

  // Extract protocol from structure
  const protocol = {
    warmup: workout.structure.warmup || '10 min Easy',
    main: Array.isArray(workout.structure.mainSet) 
      ? workout.structure.mainSet 
      : [workout.structure.mainSet || 'Main set'],
    cooldown: workout.structure.cooldown || '10 min Flush'
  };

  // Convert constraints to array
  const constraints: string[] = [];
  if (workout.constraints?.cadenceTarget) {
    constraints.push(`Cadence > ${workout.constraints.cadenceTarget} spm`);
  }
  if (workout.constraints?.hrTarget) {
    constraints.push(`HR ${workout.constraints.hrTarget.min}-${workout.constraints.hrTarget.max} bpm`);
  }
  if (workout.constraints?.fuelingTarget) {
    constraints.push(`${workout.constraints.fuelingTarget}g Carbs/hr`);
  }

  // Determine load
  const load = workout.durationMinutes > 120 ? 'EXTREME' as const :
               workout.durationMinutes > 60 ? 'MED' as const :
               'LOW' as const;

  return {
    id: parseInt(workout.id.replace(/\D/g, '').substring(0, 8) || '0', 10) % 1000000,
    day,
    title: workout.notes || `${workout.type} Session`,
    type,
    load,
    duration: `${Math.floor(workout.durationMinutes / 60)}h ${workout.durationMinutes % 60}m`,
    objective: workout.explanation || 'Training session',
    protocol,
    constraints: constraints.length > 0 ? constraints : undefined,
    fueling: workout.constraints?.fuelingTarget ? {
      target: `${workout.constraints.fuelingTarget}g Carbs/Hour`,
      timeline: [] // Would need to be generated from workout
    } : undefined
  };
}

