
import { runMonteCarloSimulation } from '../src/modules/analyze/blueprintEngine';
import { detectClipping } from '../src/modules/kill/logic/integrity';
import { ISessionDataPoint } from '../src/types/session';

const test = (name: string, fn: () => void) => {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
  } catch (e) {
    console.error(`❌ FAIL: ${name}`, e);
    process.exit(1);
  }
};

console.log("--- PART 6 CHECK: Math & Signal ---");

// Check 1: Linear Regression Integration
test("Blueprint Engine (Linear Regression)", () => {
    // Should run without error return a valid result
    const res = runMonteCarloSimulation({
        currentLoad: 100,
        injuryRiskScore: 0.1,
        goalMetric: 150,
        daysRemaining: 60
    });
    
    if (typeof res.successProbability !== 'number') throw new Error("Invalid probability");
    if (res.successProbability < 0 || res.successProbability > 100) throw new Error("Probability out of bounds");
});

// Check 2: Clipping Detection
test("Signal Processing (Clipping)", () => {
    // Generate stuck stream: 150bpm for 130 seconds
    const stuckStream: ISessionDataPoint[] = [];
    for (let i = 0; i < 130; i++) {
        stuckStream.push({
            timestamp: i,
            heartRate: 150, // STUCK
            cadence: 180,
            speed: 3
        });
    }
    
    const res = detectClipping(stuckStream);
    if (res.status !== 'SUSPECT') throw new Error("Failed to detect clipping");
    if (!res.reason?.includes("stuck at 150bpm")) throw new Error("Reason mismatch");
});


test("Signal Processing (Normal)", () => {
    // Variable stream
    const normalStream: ISessionDataPoint[] = [];
    for (let i = 0; i < 130; i++) {
        normalStream.push({
            timestamp: i,
            heartRate: 150 + (i%2), // 150, 151, 150...
            cadence: 180,
            speed: 3
        });
    }
     const res = detectClipping(normalStream);
    if (res.status !== 'VALID') throw new Error("Flagged normal data as clipping");
});

console.log("--- PART 6 Verified ---");
