import { evaluateStructuralHealth } from './agents/structuralAgent';
import { evaluateMetabolicState } from './agents/metabolicAgent';
import { evaluateFuelingStatus } from './agents/fuelingAgent';
import { IStructuralInput, IMetabolicInput, IFuelingInput } from '@/types/agents';

console.log("--- TEST RUNNER: Module E (Execute) - Micro Agents ---");

// Test 1: Structural Agent (Red Veto)
const badStructure: IStructuralInput = {
  niggleScore: 4, // > 3 is RED
  daysSinceLastLift: 2
};
const structVote = evaluateStructuralHealth(badStructure);
console.log(`Structural Agent: Vote=${structVote.vote} (${structVote.reason})`);
if (structVote.vote === 'RED') console.log("✅ Structural Red Veto verified.");
else console.log("❌ Structural Red Veto failed.");

// Test 2: Metabolic Agent (Amber Veto)
const badMetabolic: IMetabolicInput = {
  aerobicDecoupling: 6.0, // > 5.0 is AMBER
  timeInRedZone: 0,
  planLimitRedZone: 10
};
const metaVote = evaluateMetabolicState(badMetabolic);
console.log(`Metabolic Agent: Vote=${metaVote.vote} (${metaVote.reason})`);
if (metaVote.vote === 'AMBER') console.log("✅ Metabolic Amber Veto verified.");
else console.log("❌ Metabolic Amber Veto failed.");

// Test 3: Fueling Agent (Green Nominal)
const goodFueling: IFuelingInput = {
  gutTrainingIndex: 5, // Plenty of practice
  nextRunDuration: 120
};
const fuelVote = evaluateFuelingStatus(goodFueling);
console.log(`Fueling Agent: Vote=${fuelVote.vote} (${fuelVote.reason})`);
if (fuelVote.vote === 'GREEN') console.log("✅ Fueling Green (Nominal) verified.");
else console.log("❌ Fueling Green failed.");
