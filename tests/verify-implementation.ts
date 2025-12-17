
import { calculateEWMA } from '../src/modules/analyze/baselineEngine';
import { detectCadenceLock } from '../src/modules/kill/logic/cadenceLock';
import { evaluateFuelingStatus } from '../src/modules/execute/agents/fuelingAgent';
import { ISessionDataPoint } from '../src/types/session';

// Helper to log test pass/fail
const test = (name: string, fn: () => boolean) => {
  try {
    if (fn()) console.log(`✅ PASS: ${name}`);
    else console.error(`❌ FAIL: ${name}`);
  } catch (e) {
    console.error(`❌ FAIL: ${name} (Exception: ${e})`);
  }
};

async function runTests() {
  console.log("--- Starting APEX Verification ---");

  // 1. Verify Analyze Module (EWMA)
  test("EWMA Calculation (Rolling Stats)", () => {
    // 100, 100 -> Should be 100
    const val1 = calculateEWMA(100, 100, 7);
    if (Math.abs(val1 - 100) > 0.1) return false;

    // 0, 100 over 7 days -> Alpha = 2/8 = 0.25. 
    // New = (100 * 0.25) + (0 * 0.75) = 25
    const val2 = calculateEWMA(100, 0, 7);
    return Math.abs(val2 - 25) < 0.1;
  });

  // 2. Verify Cadence Lock (Kill Module)
  test("Cadence Lock Detection (High Correlation)", () => {
    // Generate locked data (HR = Cadence) for 6 minutes (360 points)
    const lockedStream: ISessionDataPoint[] = [];
    for (let i = 0; i < 360; i++) {
        const noise = Math.random() * 2;
        lockedStream.push({
            timestamp: i,
            heartRate: 170 + noise, // correlated
            cadence: 170 + noise,   // correlated
            speed: 3
        });
    }
    
    const diagnostics = detectCadenceLock(lockedStream);
    // Should be SUSPECT
    if (diagnostics.status !== 'SUSPECT') return false;
    // Should flag most points
    if (diagnostics.flaggedIndices.length < 300) return false;
    
    return true;
  });

  test("Cadence Lock Detection (Normal Data)", () => {
    // Generate valid data (HR rising, Cadence steady)
    const validStream: ISessionDataPoint[] = [];
    for (let i = 0; i < 360; i++) {
        validStream.push({
            timestamp: i,
            heartRate: 140 + (i / 10), // 140 -> 176
            cadence: 180 + (Math.random() * 2), // Steady 180
            speed: 3
        });
    }
    
    const diagnostics = detectCadenceLock(validStream);
    return diagnostics.status === 'VALID';
  });

  // 3. Verify Fueling Agent (Execute Module)
  test("Fueling Agent (>2.5h with Low Index -> RED)", () => {
    const output = evaluateFuelingStatus({
        gutTrainingIndex: 1, // Low
        nextRunDuration: 180 // 3 hours
    });
    
    if (output.vote !== 'RED') return false;
    if (!output.modifications && !output.reason.includes("Conditioning Critical")) return false;
    return true;
  });

  test("Fueling Agent (<2.5h with Low Index -> GREEN or AMBER?)", () => {
    // FR-C only specified RED for >2.5h, or AMBER? 
    // The code we replaced removed AMBER check for 90min.
    // Let's check 2 hours (120 min) with low index. Should be GREEN in current logic (only RED is strictly enforced by new rule).
    // Or did we remove the Amber Logic? Yes, we replaced the whole function. 
    // So current logic is ONLY Red if > 150min. 120min should be GREEN.
    const output = evaluateFuelingStatus({
        gutTrainingIndex: 1,
        nextRunDuration: 120
    });
    return output.vote === 'GREEN';
  });

  console.log("--- Verification Complete ---");
}

runTests();
