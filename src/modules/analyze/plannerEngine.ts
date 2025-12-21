
import type { PrototypeSessionDetail } from '@/types/prototype';
import { getCurrentPhase } from './blueprintEngine';
import type { IWorkout, IntensityZone } from '@/types/workout';

interface TacticalAnalysis {
  avgWeeklyVolume: number;
  avgWeeklyTonnage: number;
  integrityRatio: number;
  niggleScore: number;
  habitualLongRunDay: number; // 0-6
  habitualStrengthDays: number[];
  adherenceScore: number;
}

/**
 * Analyzes the last 14 sessions to extract behavioral habits and readiness.
 */
function analyzeTacticalHistory(sessions: PrototypeSessionDetail[]): TacticalAnalysis {
  const last14 = sessions.slice(-14);
  
  let totalVolume = 0;
  let totalTonnage = 0;
  let niggleSum = 0;
  let niggleCount = 0;
  
  const dayFrequency = Array(7).fill(0);
  const strengthDayFrequency = Array(7).fill(0);
  const longRunDayFrequency = Array(7).fill(0);

  last14.forEach(s => {
    // Volume & Tonnage
    if (s.type === 'EXEC' || s.type === 'SUB') {
      totalVolume += s.distance || 0;
      if (s.distance && s.distance > 15) {
         // Detect long run day
         const date = new Date(); // Mock day mapping
         // This is a bit tricky since 'day' is a string like 'Mon' or 'Yesterday'
         // In a real app we'd have ISO dates. 
         // For now, we'll use a simplified habit detection.
      }
    }
    if (s.type === 'STR') {
      totalTonnage += s.strengthLoad || 2500;
    }
    
    // Niggle
    if (s.hiddenVariables?.niggle !== undefined) {
      niggleSum += s.hiddenVariables.niggle;
      niggleCount++;
    }
  });

  // Calculate averages
  const avgWeeklyVolume = (totalVolume / sessions.length) * 7 || 60; // Default 60 if no data
  const avgWeeklyTonnage = (totalTonnage / sessions.length) * 7 || 5000;

  return {
    avgWeeklyVolume,
    avgWeeklyTonnage,
    integrityRatio: (avgWeeklyTonnage / 1000) / (avgWeeklyVolume / 10 || 1),
    niggleScore: niggleCount > 0 ? niggleSum / niggleCount : 0,
    habitualLongRunDay: 0, // Sunday
    habitualStrengthDays: [2, 4], // Tuesday, Thursday
    adherenceScore: 85 // Mocked for now
  };
}

/**
 * Generates a blueprint-compliant 7-day plan based on tactical history analysis.
 */
export function generateStrategicPlan(history: PrototypeSessionDetail[], today: Date): PrototypeSessionDetail[] {
  const analysis = analyzeTacticalHistory(history);
  const phase = getCurrentPhase(today);
  const plan: PrototypeSessionDetail[] = [];

  // Progression Logic
  let loadMultiplier = 1.0;
  if (analysis.niggleScore > 3) loadMultiplier = 0.8; // Deload due to pain
  else if (analysis.integrityRatio < 0.8) loadMultiplier = 0.9; // Deload to catch up on strength
  else if (analysis.adherenceScore > 90) loadMultiplier = 1.05; // Progressive overload

  const targetWeeklyVolume = Math.min(phase.maxWeeklyVolume, analysis.avgWeeklyVolume * loadMultiplier);

  for (let i = 1; i <= 7; i++) {
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + i);
    const dayName = futureDate.toLocaleDateString('en-US', { weekday: 'long' });
    const dayOfWeek = futureDate.getDay();

    if (dayOfWeek === 0) {
      // SUNDAY: Long Run
      const duration = Math.min(150, (targetWeeklyVolume * 0.4) * 6); // 40% of volume, 6min/km pace
      plan.push({
        id: 200 + i,
        day: dayName,
        title: 'Long Aerobic Progressor',
        type: 'KEY',
        load: 'HIGH',
        duration: `${Math.floor(duration / 60)}h ${Math.floor(duration % 60)}m`,
        objective: 'Mitochondrial Density & Fat Oxidation (Phase 1 Focus)',
        protocol: {
          warmup: '15 min Easy (HR < 130)',
          main: [`${Math.floor(duration - 25)} min Steady Z2 (HR 135-142)`],
          cooldown: '10 min Flush jog'
        },
        constraints: ['STRICT HR CAP: 145 bpm', 'Fueling: 30g/hr mandatory', 'Nose breathing only']
      });
    } else if (analysis.habitualStrengthDays.includes(dayOfWeek)) {
      // STRENGTH DAYS
      plan.push({
        id: 200 + i,
        day: dayName,
        title: dayOfWeek === 2 ? 'Chassis Hardening (HLRT)' : 'Hill Bounds (Structural)',
        type: 'STR',
        load: 'MED',
        duration: '60 min',
        objective: 'Structural Integrity & Power Conversion',
        protocol: dayOfWeek === 2 ? {
          warmup: '10 min Mobility',
          main: ['Hex Bar Deadlift: 4x5', 'Bulgarian Split Squats: 3x8', 'Soleus Raises: 3x15'],
          cooldown: '5 min Stretch'
        } : {
          warmup: '20 min Easy Run',
          main: ['10 x 30s Steep Hill Bounds', 'Full recovery walk back'],
          cooldown: '10 min Recovery Jog'
        },
        constraints: dayOfWeek === 4 ? ['STRICT HR CAP: 145 bpm (on jog)', 'Max vertical displacement'] : []
      });
    } else if (dayOfWeek === 1 || dayOfWeek === 5) {
      // RECOVERY DAYS
      plan.push({
        id: 200 + i,
        day: dayName,
        title: 'Emerald Recovery (Swim)',
        type: 'REC',
        load: 'LOW',
        duration: '45 min',
        objective: 'Non-impact recovery and inflammation management',
        protocol: {
          warmup: '200m Choice',
          main: ['1500m Steady Z1', 'Focus on horizontal alignment'],
          cooldown: '100m backstroke'
        },
        constraints: ['HR < 130 bpm', 'Zero running impact']
      });
    } else {
      // BASE DAYS
      const duration = (targetWeeklyVolume * 0.15) * 6; // 15% of weekly volume
      plan.push({
        id: 200 + i,
        day: dayName,
        title: 'Aerobic Threshold Build',
        type: 'EXEC',
        load: 'MED',
        duration: `${Math.floor(duration / 60)}h ${Math.floor(duration % 60)}m`,
        objective: 'Aerobic Base Maintenance',
        protocol: {
          warmup: 'None',
          main: [`${Math.floor(duration - 5)} min Steady Z2 (140-145 bpm)`],
          cooldown: '5 min walk'
        },
        constraints: ['HR CAP: 145 bpm']
      });
    }
  }

  return plan;
}
