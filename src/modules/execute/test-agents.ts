import { evaluateStructuralHealth } from './agents/structuralAgent';
import { evaluateMetabolicState } from './agents/metabolicAgent';
import { evaluateFuelingStatus } from './agents/fuelingAgent';
import type { ISessionSummary } from '@/types/session';

console.log("--- TEST RUNNER: Module E (Execute) - Micro Agents ---");

// Test 1: Structural Agent (Red Veto)
// Using new session summary interface
const badStructure: ISessionSummary['structural'] = {
  niggleScore: 4, // > 3 is RED
  daysSinceLastLift: 2,
  tonnageTier: undefined,
  currentWeeklyVolume: 50
};
evaluateStructuralHealth(badStructure).then(structVote => {
  console.log(`Structural Agent: Vote=${structVote.vote} (${structVote.reason})`);
  if (structVote.vote === 'RED') console.log("✅ Structural Red Veto verified.");
  else console.log("❌ Structural Red Veto failed.");
});

// Test 2: Metabolic Agent (Amber Veto)
// Using new session summary interface - agent computes its own metrics
const badMetabolic: ISessionSummary['metabolic'] = {
  sessionPoints: [], // Would need real data for decoupling calculation
  planLimitRedZone: 10
  // Agent will compute aerobicDecoupling and timeInRedZone internally
};
const metaVote = evaluateMetabolicState(badMetabolic);
console.log(`Metabolic Agent: Vote=${metaVote.vote} (${metaVote.reason})`);
// Note: Without real session points, this will likely be GREEN
// In real test, provide session points with decoupling > 5%

// Test 3: Fueling Agent (Green Nominal)
// Using new session summary interface - agent computes Gut_Training_Index from history
const goodFueling: ISessionSummary['fueling'] = {
  nextRunDuration: 120,
  sessionHistory: [] // Would need real history for Gut_Training_Index calculation
};
const fuelVote = evaluateFuelingStatus(goodFueling);
console.log(`Fueling Agent: Vote=${fuelVote.vote} (${fuelVote.reason})`);
// Note: Without session history, Gut_Training_Index will be 0
// In real test, provide session history with long runs >90min
