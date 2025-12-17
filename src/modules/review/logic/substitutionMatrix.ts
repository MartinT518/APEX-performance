import { IAgentVote } from '@/types/agents';
import { IWorkout, ISubstitutionResult, WorkoutType, IntensityZone } from '@/types/workout';

/**
 * FR-R1: The Substitution Matrix
 * 
 * deterministic logic that arbitrates between Agent Votes and the Plan.
 */
export const synthesizeCoachDecision = (
  votes: IAgentVote[],
  originalWorkout: IWorkout
): ISubstitutionResult => {
  const reds = votes.filter(v => v.vote === 'RED');
  const ambers = votes.filter(v => v.vote === 'AMBER');
  const modifications: string[] = [];
  let finalWorkout = { ...originalWorkout };
  let action: ISubstitutionResult['action'] = 'EXECUTED_AS_PLANNED';
  let reasoning = "All systems nominal.";

  // 1. SHUTDOWN (>1 RED or RED+Multiple AMBERs) - Simplified for Single Red Priority
  if (reds.length > 1) {
    return {
      action: 'SKIPPED',
      originalWorkout,
      finalWorkout: modifyToRest(finalWorkout),
      reasoning: "Multiple Red Flags detected. System Shutdown initiated for safety.",
      modifications: ["Complete Rest"]
    };
  }

  // 2. SINGLE RED: Specific Substitutions
  if (reds.length === 1) {
    const redVote = reds[0];
    action = 'MODIFIED';
    
    switch (redVote.agentId) {
      case 'structural_agent':
        // RED Structural = SUBSTITUTE (Impact -> Non-Impact)
        if (originalWorkout.type === 'RUN' || originalWorkout.type === 'STRENGTH') {
          finalWorkout.type = 'BIKE';
          reasoning = "Structural Risk (Pain) detected. Switching to Non-Impact.";
          modifications.push("Switched to BIKE");
        } else {
          // Already non-impact -> Reduce Intensity
          finalWorkout = modifyIntensity(finalWorkout, 'Z2_ENDURANCE');
          reasoning = "Structural Risk in non-impact session. Reducing intensity.";
          modifications.push("Downgraded to Z2");
        }
        break;

      case 'metabolic_agent':
        // RED Metabolic = DOWNGRADE (Intensity -> Recovery)
        finalWorkout = modifyIntensity(finalWorkout, 'Z1_RECOVERY');
        reasoning = "Metabolic limit check failed (Intensity Violation). Downgrading to Recovery.";
        modifications.push("Downgraded to Z1 Recovery");
        break;

      case 'fueling_agent':
        // We defined Fueling Red? Let's assume yes, or treat as extreme Amber.
        // Assuming Red Fueling = "Bonk Imminent" -> CAP Duration
        finalWorkout.durationMinutes = Math.min(finalWorkout.durationMinutes, 60);
        reasoning = "Fueling deficit critical. Capping duration.";
        modifications.push("Capped duration at 60min");
        break;
    }
    return { action, originalWorkout, finalWorkout, reasoning, modifications };
  }

  // 3. AMBER: Caps and Downgrades
  if (ambers.length > 0) {
    action = 'MODIFIED';
    const reasons = ambers.map(v => v.reason);
    reasoning = `Cautionary flags: ${reasons.join(' | ')}`;

    ambers.forEach(vote => {
      if (vote.agentId === 'structural_agent') {
        // AMBER Structural (No Lift) -> CAP Intensity (No Z4/Z5)
        if (['Z4_THRESHOLD', 'Z5_VO2MAX'].includes(finalWorkout.primaryZone)) {
          finalWorkout = modifyIntensity(finalWorkout, 'Z3_TEMPO');
          modifications.push("Capped Intensity at Z3 (Strength Deficiency)");
        }
      }
      if (vote.agentId === 'metabolic_agent') {
        // AMBER Metabolic (Decoupling) -> CAP Duration
        finalWorkout.durationMinutes = Math.min(finalWorkout.durationMinutes, 90);
        modifications.push("Capped Duration at 90min (Decoupling)");
      }
      if (vote.agentId === 'fueling_agent') {
        // AMBER Fueling (Gut) -> CAP Duration
        finalWorkout.durationMinutes = Math.min(finalWorkout.durationMinutes, 90);
        modifications.push("Capped Duration at 90min (Gut Training)");
      }
    });

    if (modifications.length === 0) {
      // If ambers didn't trigger specific rules (e.g. Z2 run with amber structural is fine)
      action = 'EXECUTED_AS_PLANNED';
    }

    return { action, originalWorkout, finalWorkout, reasoning, modifications };
  }

  return { action, originalWorkout, finalWorkout, reasoning, modifications };
};

// --- Helpers ---

const modifyToRest = (w: IWorkout): IWorkout => ({
  ...w,
  type: 'REST',
  primaryZone: 'Z1_RECOVERY',
  durationMinutes: 0,
  structure: {
    mainSet: "Complete Rest"
  },
  notes: "System Shutdown."
});

const modifyIntensity = (w: IWorkout, zone: IntensityZone): IWorkout => ({
  ...w,
  primaryZone: zone,
  structure: {
    ...w.structure,
    mainSet: `Modified to ${zone}`
  }
});
