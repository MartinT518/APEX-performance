
import { useMonitorStore } from '../src/modules/monitor/monitorStore';

// Mock storage for Zustand persist
// (Zustand persist requires a storage engine if likely running in node/dom mix, 
// but usually defaults to localStorage which fails in Node. Need to mock it or ensure it handles it.)
// For this strict test, we just want to verify the Logic inside the actions.
// We can suppress persist or mock it. 
// However, assuming vanilla store behavior for logic check.

const test = (name: string, fn: () => void) => {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
  } catch (e) {
    console.error(`❌ FAIL: ${name}`, e);
    process.exit(1);
  }
};

console.log("--- MAKER CHECK: Monitor Module ---");

// Red Flag Check 1: Null Safety on Initialization
test("Initial State Null Checks", () => {
    const state = useMonitorStore.getState();
    if (state.todayEntries.niggleScore !== null) throw new Error("niggleScore should be null init");
    if (state.todayEntries.strengthSession !== null) throw new Error("strengthSession should be null init");
    if (state.todayEntries.fuelingLog !== null) throw new Error("fuelingLog should be null init");
});

// Red Flag Check 2: Strict Data Integrity
test("Fueling Log strict assignment", () => {
    // Action
    useMonitorStore.getState().logFueling(60, 5);
    
    // Verification
    const state = useMonitorStore.getState();
    if (state.todayEntries.fuelingLog?.carbsPerHour !== 60) throw new Error("Carbs/hr mismatch");
    if (state.todayEntries.fuelingLog?.giDistress !== 5) throw new Error("GI Distress mismatch");
    
    // Type Safety Check (Static Analysis via compilation, but runtime check here)
    if (typeof state.todayEntries.fuelingLog.carbsPerHour !== 'number') throw new Error("Type violation");
});

// Red Flag Check 3: Reset Logic
test("Reset Daily Entries", () => {
    useMonitorStore.getState().resetDailyEntries();
    const state = useMonitorStore.getState();
    if (state.todayEntries.fuelingLog !== null) throw new Error("Reset failed to clear fuelingLog");
    if (state.todayEntries.niggleScore !== null) throw new Error("Reset failed to clear niggleScore");
});

// Red Flag Check 4: Days Since Lift Tracking
test("Days Since Lift Tracking", () => {
    // Reset first
    useMonitorStore.getState().resetDailyEntries();
    
    // Log a strength session
    useMonitorStore.getState().logStrengthSession(true, 'strength');
    
    // Should be 0 days since lift
    const daysSince = useMonitorStore.getState().getDaysSinceLastLift();
    if (daysSince !== 0) throw new Error(`Expected 0 days since lift, got ${daysSince}`);
    
    // Check lastLiftDate is set
    const state = useMonitorStore.getState();
    if (!state.lastLiftDate) throw new Error("lastLiftDate should be set after logging strength session");
});

// Red Flag Check 5: Strength Intensity Tier
test("Strength Intensity Tier Selection", () => {
    useMonitorStore.getState().resetDailyEntries();
    
    // Log with tier
    useMonitorStore.getState().logStrengthSession(true, 'hypertrophy');
    
    const state = useMonitorStore.getState();
    if (state.todayEntries.strengthSession?.tonnageTier !== 'hypertrophy') {
        throw new Error(`Expected hypertrophy tier, got ${state.todayEntries.strengthSession?.tonnageTier}`);
    }
});

console.log("--- Monitor Check Complete ---");
