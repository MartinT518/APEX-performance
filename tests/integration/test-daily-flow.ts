import { DailyCoach } from '../../src/modules/dailyCoach';
import { useMonitorStore } from '../../src/modules/monitor/monitorStore';
import { usePhenotypeStore } from '../../src/modules/monitor/phenotypeStore';
import { IWorkout } from '../../src/types/workout';

// Mock console.log to keep output clean, or let it flow
// console.log = jest.fn(); 

async function runIntegrationTest() {
    console.log("=== INTEGRATION TEST: Daily Coach Flow ===");

    // 1. SETUP: Initialize System
    console.log("\n[SETUP] Initializing detailed profile (High Rev)...");
    await DailyCoach.initialize();
    
    // Verify Profile Loaded
    const profile = usePhenotypeStore.getState().profile;
    if (!profile || !profile.is_high_rev) {
        throw new Error("❌ Setup Failed: Profile not loaded correctly.");
    }
    console.log("✅ Profile Loaded: " + profile.id);

    // 2. INPUT: Simulate User Input (Niggle > 3 -> Expect RED Structural)
    console.log("\n[INPUT] Simulating Structural Pain (Niggle = 4)...");
    useMonitorStore.getState().setNiggleScore(4);
    
    // Check Audit Status
    const auditStatus = await DailyCoach.performDailyAudit(60);
    console.log("Audit Status: " + auditStatus); // Expect CAUTION

    // 3. EXECUTE: Plan for today is a Threshold Run
    const todayWorkout: IWorkout = {
        id: 'planned_w1',
        date: '2025-01-01',
        type: 'RUN',
        primaryZone: 'Z4_THRESHOLD',
        durationMinutes: 60,
        structure: {
            mainSet: '3x10min Threshold'
        }
    };

    console.log(`\n[EXECUTE] Processing Day for workout: ${todayWorkout.type} (${todayWorkout.primaryZone})`);
    
    // Run the full coach logic
    const decision = await DailyCoach.generateDecision(todayWorkout);

    // 4. ASSERT: Substitution Logic
    console.log("\n[ASSERT] Verifying Decision...");
    
    // Expectation: Structural Agent votes RED -> Coach switches to BIKE
    if (decision.action === 'MODIFIED' && decision.finalWorkout.type === 'BIKE') {
        console.log("✅ SUCCESS: Workout substituted to BIKE due to Structural Risk.");
    } else {
        console.error("❌ FAILURE: Expected Substitution to BIKE.");
        console.error("Received:", JSON.stringify(decision, null, 2));
        process.exit(1);
    }
    
    console.log("\n=== TEST PASSED ===");
}

runIntegrationTest().catch(err => {
    console.error("❌ TEST CRASHED:", err);
    process.exit(1);
});
