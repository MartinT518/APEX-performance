
import { calculateEWMA, calculateRollingAverage } from '../src/modules/analyze/baselineEngine';
import { runMonteCarloSimulation } from '../src/modules/analyze/blueprintEngine';

const test = (name: string, fn: () => void) => {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
  } catch (e) {
    console.error(`❌ FAIL: ${name}`, e);
    process.exit(1);
  }
};

console.log("--- MAKER CHECK: Analyze Module ---");

// Red Flag Check 1: Baseline Math Precision
test("EWMA Precision", () => {
    // 100 prev, 110 today, 7 days
    // alpha = 2/8 = 0.25
    // 110*0.25 + 100*0.75 = 27.5 + 75 = 102.5
    const res = calculateEWMA(110, 100, 7);
    if (Math.abs(res - 102.5) > 0.001) throw new Error(`EWMA mismatch: got ${res}, expected 102.5`);
});

// Red Flag Check 2: Blueprint Stability
test("Monte Carlo Stability", () => {
    const res = runMonteCarloSimulation({
        currentLoad: 100,
        injuryRiskScore: 0,
        goalMetric: 120,
        daysRemaining: 100
    });
    
    // Check return structure strictly
    if (typeof res.successProbability !== 'number') throw new Error("Probability type error");
    if (res.successProbability < 0 || res.successProbability > 100) throw new Error("Probability bounds error");
    if (!['LOW', 'MEDIUM', 'HIGH'].includes(res.confidenceScore)) throw new Error("Invalid confidence score enum");
});

console.log("--- Analyze Check Complete ---");
