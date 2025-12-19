/**
 * FR-A2: The Blueprint Engine (Probabilistic)
 * 
 * Generates long-term "Confidence Score" using probabilistic models.
 */

import type { PhaseDefinition, IntensityZone } from '@/types/workout';
import type { TonnageTier } from '@/modules/monitor/monitorStore';

interface IMonteCarloInput {
  currentLoad: number;
  injuryRiskScore: number; // 0-1
  goalMetric: number; // e.g. Target Time or Power
  daysRemaining: number;
}

interface IMonteCarloResult {
  successProbability: number; // 0-100%
  projectedMetrics: number[];
  confidenceScore: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface VolumeCalibrationResult {
  safetyPath: {
    volume: number; // Low volume (e.g., 100km/week)
    intensity: 'high';
    probability: number; // e.g., 12%
  };
  performancePath: {
    volume: number; // High volume (e.g., 140km/week)
    intensity: 'high';
    tonnageRequirement: string; // "2x Power Tier lifts per week"
    probability: number; // e.g., 82%
  };
  recommendation: string; // UI message for user
}

/**
 * Simulates season futures based on current adherence and risk.
 * Algorithm: dP/dt = Training_Load * exp(-Injury_Risk)
 */
import { linearRegression, linearRegressionLine } from 'simple-statistics';

/**
 * Simulates season futures based on current adherence and risk.
 * Algorithm: dP/dt = Training_Load * exp(-Injury_Risk)
 * Enhanced: Uses Linear Regression to determine trajectory.
 */
export const runMonteCarloSimulation = (input: IMonteCarloInput): IMonteCarloResult => {
  const { currentLoad, injuryRiskScore, goalMetric, daysRemaining } = input;
  const simulations = 1000;
  let successCount = 0;
  
  // Create a synthetic history for regression based on current load
  // In a real scenario, this would take the array of 'history' as input
  // For now, we project a line from 0 to currentLoad over 30 days
  const syntheticHistory = Array.from({ length: 30 }, (_, i) => [i, (currentLoad/30) * i]); // Linear ramp
  
  // Calculate Slope (Growth Rate)
  const regression = linearRegression(syntheticHistory);
  const predict = linearRegressionLine(regression);
  const projectedSlope = regression.m;

  for (let i = 0; i < simulations; i++) {
    // Random variance factor (0.9 to 1.1)
    const variance = 0.9 + (Math.random() * 0.2);
    
    // Risk event (Probability checks against risk score)
    const riskEventOccurred = Math.random() < (injuryRiskScore * 0.5); 
    
    let finalValue = currentLoad;
    
    if (riskEventOccurred) {
      // Injury setback: Lose progress
      finalValue = currentLoad * 0.5; 
    } else {
      // Growth model: Slope * Days Remaining * Variance
      // dP = Slope * Days
      const growth = projectedSlope * daysRemaining * variance;
      finalValue = currentLoad + growth;
    }

    if (finalValue > goalMetric) {
      successCount++;
    }
  }

  const probability = (successCount / simulations) * 100;
  
  let confidence: 'LOW' | 'MEDIUM' | 'HIGH' = "LOW";
  if (probability > 80) confidence = "HIGH";
  else if (probability > 50) confidence = "MEDIUM";

  return {
    successProbability: probability,
    projectedMetrics: [],
    confidenceScore: confidence
  };
};

/**
 * Gets the current training phase based on date
 * Based on TrainingBlueprint.pdf constraints
 */
export function getCurrentPhase(date: Date): PhaseDefinition {
  const dateStr = date.toISOString().split('T')[0];
  
  // Phase 1: Aerobic Base Supremacy (Oct 1, 2025 - Dec 31, 2025)
  if (dateStr >= '2025-10-01' && dateStr <= '2025-12-31') {
    return {
      phaseNumber: 1,
      name: 'Aerobic Base Supremacy',
      startDate: '2025-10-01',
      endDate: '2025-12-31',
      maxAllowedZone: 'Z2_ENDURANCE',
      maxMonthlyVolume: 450, // km/month
      maxWeeklyVolume: 112.5, // ~450/4
      hrCap: { min: 130, max: 145 } // Strict Z2/Base constraint
    };
  }
  
  // Phase 2: Power Conversion & Specific Endurance (Jan 1, 2026 - Apr 30, 2026)
  if (dateStr >= '2026-01-01' && dateStr <= '2026-04-30') {
    return {
      phaseNumber: 2,
      name: 'Power Conversion & Specific Endurance',
      startDate: '2026-01-01',
      endDate: '2026-04-30',
      maxAllowedZone: 'Z4_THRESHOLD',
      maxMonthlyVolume: 480, // km/month
      maxWeeklyVolume: 120, // ~480/4
      hrCap: { min: 146, max: 172 } // Threshold integration allowed
    };
  }
  
  // Phase 3: Final Sharpening & Peak Performance (May 1, 2026 - Aug 31, 2026)
  if (dateStr >= '2026-05-01' && dateStr <= '2026-08-31') {
    return {
      phaseNumber: 3,
      name: 'Final Sharpening & Peak Performance',
      startDate: '2026-05-01',
      endDate: '2026-08-31',
      maxAllowedZone: 'Z5_VO2MAX',
      maxMonthlyVolume: 640, // km/month
      maxWeeklyVolume: 160, // km/week (Rule A-1)
      requiresStructuralIntegrity: 80, // Minimum SIS for high volume
      hrCap: { min: 145, max: 188 } // VO2max sessions allowed
    };
  }
  
  // Phase 4: Execution & Recovery (Sep 1, 2026 - Oct 31, 2026)
  if (dateStr >= '2026-09-01' && dateStr <= '2026-10-31') {
    return {
      phaseNumber: 4,
      name: 'Execution & Recovery',
      startDate: '2026-09-01',
      endDate: '2026-10-31',
      maxAllowedZone: 'Z4_THRESHOLD',
      maxMonthlyVolume: 300, // km/month (Taper)
      maxWeeklyVolume: 75, // ~300/4
      hrCap: { min: 130, max: 168 } // Sharp but controlled
    };
  }
  
  // Default to Phase 1 if before Oct 2025 or after Oct 2026
  return {
    phaseNumber: 1,
    name: 'Aerobic Base Supremacy',
    startDate: '2025-10-01',
    endDate: '2025-12-31',
    maxAllowedZone: 'Z2_ENDURANCE',
    maxMonthlyVolume: 450,
    maxWeeklyVolume: 112.5,
    hrCap: { min: 130, max: 145 }
  };
}

/**
 * FR-R4: Intensity Veto (Anti-Trash Zone Logic)
 * Prevents Zone 3 "Grey Zone" infiltration during Base Phase
 */
export function applyIntensityVeto(
  suggestedZone: IntensityZone,
  currentDate: Date
): IntensityZone {
  const phase = getCurrentPhase(currentDate);
  
  // Anti-Trash Zone: If before Phase 2, cap at Zone 2
  if (currentDate < new Date('2026-01-01')) {
    const zoneOrder: IntensityZone[] = ['Z1_RECOVERY', 'Z2_ENDURANCE', 'Z3_TEMPO', 'Z4_THRESHOLD', 'Z5_VO2MAX'];
    const suggestedIndex = zoneOrder.indexOf(suggestedZone);
    const maxIndex = zoneOrder.indexOf(phase.maxAllowedZone);
    return zoneOrder[Math.min(suggestedIndex, maxIndex)] as IntensityZone;
  }
  
  // For Phase 2+, cap at phase max
  const zoneOrder: IntensityZone[] = ['Z1_RECOVERY', 'Z2_ENDURANCE', 'Z3_TEMPO', 'Z4_THRESHOLD', 'Z5_VO2MAX'];
  const suggestedIndex = zoneOrder.indexOf(suggestedZone);
  const maxIndex = zoneOrder.indexOf(phase.maxAllowedZone);
  return zoneOrder[Math.min(suggestedIndex, maxIndex)] as IntensityZone;
}

/**
 * Step 10 (REVISED): Monte Carlo Volume Calibration
 * Compares Safety Path vs Performance Path for Sub-2:30 goal
 */
export function runVolumeCalibrationSimulation(
  currentVolume: number,
  currentTonnageTier: TonnageTier | undefined,
  structuralIntegrityScore: number
): VolumeCalibrationResult {
  // Run two scenarios:
  // 1. Safety Path: Low volume (100km/week), high intensity
  const safetyPath = runMonteCarloSimulation({
    currentLoad: 100, // km/week
    injuryRiskScore: 0.3, // Lower risk with lower volume
    goalMetric: 150, // Sub-2:30 equivalent (arbitrary scale)
    daysRemaining: 280
  });
  
  // 2. Performance Path: High volume (140km/week), high intensity, requires Power tier
  const performancePath = runMonteCarloSimulation({
    currentLoad: 140, // km/week (required for Sub-2:30)
    injuryRiskScore: structuralIntegrityScore < 80 ? 0.7 : 0.3, // High risk if SIS < 80
    goalMetric: 150,
    daysRemaining: 280
  });
  
  const recommendation = currentTonnageTier !== 'power' && currentTonnageTier !== 'strength'
    ? "To hit Sub-2:30, your mechanical volume must reach 140km/week. This requires 2x 'Power' Tier lift sessions per week to protect the chassis."
    : "Performance path available. Maintain Power/Strength tier to support 140km/week volume.";
  
  return {
    safetyPath: {
      volume: 100,
      intensity: 'high',
      probability: safetyPath.successProbability
    },
    performancePath: {
      volume: 140,
      intensity: 'high',
      tonnageRequirement: "2x Power Tier lifts per week",
      probability: performancePath.successProbability
    },
    recommendation
  };
}
