
import { evaluateStructuralHealth } from '../src/modules/execute/agents/structuralAgent';
import { evaluateFuelingStatus } from '../src/modules/execute/agents/fuelingAgent';

const test = (name: string, fn: () => void) => {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
  } catch (e) {
    console.error(`❌ FAIL: ${name}`, e);
    process.exit(1);
  }
};

console.log("--- MAKER CHECK: Execute Module ---");

// Red Flag Check 1: Structural Veto (Pain)
test("Structural RED Veto", () => {
    // Logic: Niggle > 3 -> RED
    const res = evaluateStructuralHealth({ niggleScore: 4, daysSinceLastLift: 0 });
    if (res.vote !== 'RED') throw new Error(`Expected RED for niggle 4, got ${res.vote}`);
    if (!res.reason.includes("Pain")) throw new Error("Reason must mention Pain");
});

// Red Flag Check 2: Structural Amber (Lift)
test("Structural AMBER Veto", () => {
    // Logic: DaysSinceLift > 5 -> AMBER
    const res = evaluateStructuralHealth({ niggleScore: 0, daysSinceLastLift: 6 });
    if (res.vote !== 'AMBER') throw new Error(`Expected AMBER for lack of lift, got ${res.vote}`);
});

// Red Flag Check 3: Fueling Veto (The Gut)
test("Fueling RED Veto", () => {
    // Logic: Duration > 150 (2.5h) AND Gut < 3 -> RED
    const res = evaluateFuelingStatus({ gutTrainingIndex: 2, nextRunDuration: 151 });
    if (res.vote !== 'RED') throw new Error(`Expected RED for 151min run with low gut index, got ${res.vote}`);
});

test("Fueling PASS", () => {
    // Logic: Duration 151 but Gut Index 3 -> GREEN
    const res = evaluateFuelingStatus({ gutTrainingIndex: 3, nextRunDuration: 151 });
    if (res.vote !== 'GREEN') throw new Error(`Expected GREEN for trained gut, got ${res.vote}`);
});

// Red Flag Check 4: Metabolic HRV Baseline Check
test("Metabolic HRV RED Veto", async () => {
    const { evaluateMetabolicState } = await import('../src/modules/execute/agents/metabolicAgent');
    // Logic: HRV < Baseline - 15% -> RED
    // Baseline: 50, Current: 40 -> Drop = 20% (>15%)
    const res = evaluateMetabolicState({ 
        aerobicDecoupling: 2.0,
        timeInRedZone: 0,
        planLimitRedZone: 10,
        hrvBaseline: 50,
        currentHRV: 40
    });
    if (res.vote !== 'RED') throw new Error(`Expected RED for HRV drop >15%, got ${res.vote}`);
    if (!res.reason.includes("Systemic Fatigue")) throw new Error("Reason must mention Systemic Fatigue");
});

test("Metabolic HRV GREEN", async () => {
    const { evaluateMetabolicState } = await import('../src/modules/execute/agents/metabolicAgent');
    // Logic: HRV drop < 15% -> Should not trigger RED
    // Baseline: 50, Current: 45 -> Drop = 10% (<15%)
    const res = evaluateMetabolicState({ 
        aerobicDecoupling: 2.0,
        timeInRedZone: 0,
        planLimitRedZone: 10,
        hrvBaseline: 50,
        currentHRV: 45
    });
    if (res.vote === 'RED') throw new Error(`Expected GREEN/AMBER for HRV drop <15%, got ${res.vote}`);
});

console.log("--- Execute Check Complete ---");
