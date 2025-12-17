import { synthesizeCoachDecision } from './logic/substitutionMatrix';
import { IAgentVote } from '@/types/agents';
import { IWorkout } from '@/types/workout';

console.log("--- TEST RUNNER: Module R (Review) - The Coach ---");

// Base Workout: Threshold Run
const baseWorkout: IWorkout = {
  id: 'w1',
  date: '2025-01-01',
  type: 'RUN',
  primaryZone: 'Z4_THRESHOLD',
  durationMinutes: 60,
  structure: { warmup: '10m', mainSet: '3x10m Z4', cooldown: '10m' }
};

// Scenario 1: Red Structural (Pain) -> Expect Bike Switch
const voteS1: IAgentVote = {
  agentId: 'structural_agent',
  vote: 'RED',
  confidence: 1.0,
  reason: 'Niggle > 3',
  flaggedMetrics: []
};

const resultS1 = synthesizeCoachDecision([voteS1], baseWorkout);
console.log(`\nSCENARIO 1 (Red Structure + Run): Action=${resultS1.action}`);
console.log(`Type: ${baseWorkout.type} -> ${resultS1.finalWorkout.type}`);
if (resultS1.finalWorkout.type === 'BIKE') console.log("✅ SUBSTITUTION Verified.");
else console.log("❌ SUBSTITUTION Failed.");

// Scenario 2: Red Metabolic (Fatigue) -> Expect Downgrade
const voteS2: IAgentVote = {
  agentId: 'metabolic_agent',
  vote: 'RED',
  confidence: 0.9,
  reason: 'Intensity Violation',
  flaggedMetrics: []
};

const resultS2 = synthesizeCoachDecision([voteS2], baseWorkout);
console.log(`\nSCENARIO 2 (Red Metabolic + Threshold): Action=${resultS2.action}`);
console.log(`Zone: ${baseWorkout.primaryZone} -> ${resultS2.finalWorkout.primaryZone}`);
if (resultS2.finalWorkout.primaryZone === 'Z1_RECOVERY') console.log("✅ DOWNGRADE Verified.");
else console.log("❌ DOWNGRADE Failed.");

// Scenario 3: Multiple Reds -> Expect Shutdown
const resultS3 = synthesizeCoachDecision([voteS1, voteS2], baseWorkout);
console.log(`\nSCENARIO 3 (Multiple Reds): Action=${resultS3.action}`);
if (resultS3.action === 'SKIPPED' && resultS3.finalWorkout.type === 'REST') console.log("✅ SHUTDOWN Verified.");
else console.log("❌ SHUTDOWN Failed.");

// Scenario 4: Amber Fueling -> Expect Cap
const voteS4: IAgentVote = {
  agentId: 'fueling_agent',
  vote: 'AMBER',
  confidence: 0.8,
  reason: 'Gut Untrained',
  flaggedMetrics: []
};
const longRun: IWorkout = { ...baseWorkout, durationMinutes: 120, primaryZone: 'Z2_ENDURANCE' };
const resultS4 = synthesizeCoachDecision([voteS4], longRun);
console.log(`\nSCENARIO 4 (Amber Fueling + Long Run): Action=${resultS4.action}`);
console.log(`Duration: 120 -> ${resultS4.finalWorkout.durationMinutes}`);
if (resultS4.finalWorkout.durationMinutes === 90) console.log("✅ CAP Verified.");
else console.log("❌ CAP Failed.");
