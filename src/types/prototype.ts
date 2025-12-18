/**
 * Type adapters to bridge prototype types with database types
 * Maps between the prototype's SessionDetail interface and database SessionWithVotes
 */

import type { SessionWithVotes } from '@/app/history/logic/sessionLoader';
import type { IWorkout } from '@/types/workout';

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
  // POST-MORTEM SPECIFIC FIELDS
  integrity?: 'VALID' | 'SUSPECT';
  agentFeedback?: {
    structural: string;
    metabolic: string;
  };
  hiddenVariables?: {
    niggle: number;
    strengthTier: string;
    giDistress?: number;
  };
  // Enhanced training data
  pace?: string; // e.g., "3:45/km"
  distance?: number; // in km
  trainingType?: string; // e.g., "Threshold", "Zone 2", "Intervals"
  compliance?: 'COMPLIANT' | 'SUBSTITUTED' | 'MISSED'; // Compliance with plan
}

/**
 * Convert database SessionWithVotes to prototype SessionDetail format
 */
export function sessionWithVotesToPrototype(
  session: SessionWithVotes,
  dailyMonitoring: SessionWithVotes['dailyMonitoring'] | null
): PrototypeSessionDetail {
  // Determine session type from sport_type
  let type: PrototypeSessionDetail['type'] = 'EXEC';
  if (session.sport_type === 'STRENGTH') {
    type = 'STR';
  } else if (session.sport_type === 'CYCLING') {
    type = 'SUB'; // Substitution
  } else if (session.sport_type === 'RUNNING') {
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
  
  const agentFeedback = (structuralVote || metabolicVote) ? {
    structural: structuralVote?.reasoning || 'No structural feedback',
    metabolic: metabolicVote?.reasoning || 'No metabolic feedback'
  } : undefined;

  // Extract hidden variables from daily monitoring
  const hiddenVariables = dailyMonitoring ? {
    niggle: dailyMonitoring.niggle_score || 0,
    strengthTier: dailyMonitoring.strength_tier || 'NONE',
    // GI distress not directly stored in database - would need separate field
    giDistress: undefined
  } : undefined;

  // Calculate load (use duration as proxy, or extract from metadata)
  // For history, we can use actual load value if available in metadata
  const metadataLoad = metadata?.load as number | undefined;
  const load: PrototypeSessionDetail['load'] = metadataLoad !== undefined 
    ? metadataLoad 
    : session.duration_minutes > 120 ? 'EXTREME' as const :
      session.duration_minutes > 60 ? 'MED' as const :
      'LOW' as const;

  // Extract pace, distance, and training type from metadata
  // Garmin stores distance in meters, convert to km
  const distanceMeters = metadata?.distance as number | undefined || 
                        metadata?.distanceInMeters as number | undefined ||
                        (metadata?.summaryDTO?.distance as number | undefined);
  const distance = distanceMeters ? distanceMeters / 1000 : 
                   (metadata?.distanceKm as number | undefined);
  
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

  // Determine compliance
  const compliance: PrototypeSessionDetail['compliance'] = 
    type === 'SUB' ? 'SUBSTITUTED' :
    type === 'EXEC' ? 'COMPLIANT' :
    'MISSED';

  // Extract activity name from multiple possible sources
  const activityName = metadata?.activityName as string | undefined ||
                      metadata?.name as string | undefined ||
                      metadata?.summaryDTO?.activityName as string | undefined ||
                      `${session.sport_type} Session`;

  // Extract objective/description from multiple sources
  const objective = metadata?.objective as string | undefined ||
                   metadata?.primaryGoal as string | undefined ||
                   metadata?.description as string | undefined ||
                   metadata?.notes as string | undefined ||
                   'Training session completed';

  // Build protocol from metadata if available (for past sessions, this might be in metadata)
  const protocol = metadata?.protocol ? {
    warmup: (metadata.protocol as any).warmup || '10 min Easy',
    main: Array.isArray((metadata.protocol as any).main) 
      ? (metadata.protocol as any).main 
      : [(metadata.protocol as any).main || 'Main set'],
    cooldown: (metadata.protocol as any).cooldown || '10 min Flush'
  } : undefined;

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
    hiddenVariables,
    pace,
    distance,
    trainingType,
    compliance
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
  } else if (workout.type === 'RECOVERY') {
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

