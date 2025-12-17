
import { detectCadenceLock } from '../src/modules/kill/logic/cadenceLock';
import { validateHighRevPhysiology } from '../src/modules/kill/logic/highRevFilter';
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

console.log("--- MAKER CHECK: Kill Module ---");

// Red Flag Check 1: Empty Stream Safety
test("Empty Stream Handling", () => {
    // Should not crash, should return valid
    const res = detectCadenceLock([]);
    if (res.status !== 'VALID') throw new Error("Empty stream should be VALID");
    if (res.flaggedIndices.length !== 0) throw new Error("Empty stream flagged indices");
});

// Red Flag Check 2: High Rev Filter Logic (Strict Bounds)
test("High Rev Filter Bounds", () => {
    const stream: ISessionDataPoint[] = [{
        timestamp: 1,
        heartRate: 200, // Very High
        speed: 10
    }];
    
    // Normal phenotype -> Should flag
    const resNormal = validateHighRevPhysiology(stream, { 
        id:'1', user_id:'1', is_high_rev: false, 
        config: { max_hr_override: 190, anaerobic_floor_hr:160, structural_weakness:[], lift_days_required:3, niggle_threshold:3 } 
    });
    if (resNormal.status !== 'VALID' && resNormal.flaggedIndices.length === 0) throw new Error("Normal phy should flag 200bpm");
    // Actually, logic says if HR > AvgMax (195 in logic) -> SUSPECT if not high rev.
    // 200 > 195. Should be flagged.
    if (resNormal.flaggedIndices.length === 0) throw new Error("Should have flagged normal user at 200bpm");

    // High Rev phenotype -> Should PASS (if < override)
    const resHighRev = validateHighRevPhysiology(stream, { 
        id:'1', user_id:'1', is_high_rev: true, 
        config: { max_hr_override: 205, anaerobic_floor_hr:160, structural_weakness:[], lift_days_required:3, niggle_threshold:3 } 
    });
    if (resHighRev.flaggedIndices.length !== 0) throw new Error("High Rev phy should allow 200bpm");
});

console.log("--- Kill Check Complete ---");
