
import { synthesizeCoachDecision } from '../src/modules/review/logic/substitutionMatrix';
import { IWorkout } from '../src/types/workout';
import { IAgentVote } from '../src/types/agents';

const test = (name: string, fn: () => void) => {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
  } catch (e) {
    console.error(`❌ FAIL: ${name}`, e);
    process.exit(1);
  }
};

console.log("--- MAKER CHECK: Review Module ---");

const MOCK_WORKOUT: IWorkout = {
    id: '1', date: '2025-01-01', type: 'RUN', 
    primaryZone: 'Z2_ENDURANCE', durationMinutes: 60, 
    structure: { warmUp: '10m', mainSet: '40m Z2', coolDown: '10m' }
};

// Red Flag Check 1: Substitution Logic (Structural Red -> Bike)
test("Structural Substitution", () => {
    const votes: IAgentVote[] = [{
        agentId: 'structural_agent', vote: 'RED', confidence: 1, reason: 'Pain', flaggedMetrics:[]
    }];
    
    const res = synthesizeCoachDecision(votes, MOCK_WORKOUT);
    
    if (res.action !== 'MODIFIED') throw new Error("Should be MODIFIED");
    if (res.finalWorkout.type !== 'BIKE') throw new Error(`Should switch to BIKE, got ${res.finalWorkout.type}`);
});

// Red Flag Check 2: Shutdown Logic (Multiple Reds)
test("Shutdown Logic", () => {
    const votes: IAgentVote[] = [
        { agentId: 'structural_agent', vote: 'RED', confidence: 1, reason: 'Pain', flaggedMetrics:[] },
        { agentId: 'metabolic_agent', vote: 'RED', confidence: 1, reason: 'Overreach', flaggedMetrics:[] }
    ];
    
    const res = synthesizeCoachDecision(votes, MOCK_WORKOUT);
    
    if (res.action !== 'SKIPPED') throw new Error("Should be SKIPPED");
    if (res.finalWorkout.type !== 'REST') throw new Error("Should be REST");
});

console.log("--- Review Check Complete ---");
