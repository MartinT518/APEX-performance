/**
 * Niggle Risk Classifier
 * 
 * Hybrid classifier (ML + Rule-based) that predicts training interruption risk
 * based on mechanical drift (GCT/Vertical Ratio).
 * 
 * Roadmap requirement: "High-risk flags are raised before Structural Agent triggers a manual Veto"
 * 
 * Uses ML model when available, falls back to rule-based classifier.
 */

import type { DurabilityMetrics } from './durabilityCalculator';
import { predictNiggleRiskHybrid, predictNiggleRisk } from './ml/niggleRiskModel';
import { extractFeaturesForDate } from './ml/featureEngineering';
import { logger } from '@/lib/logger';

export interface NiggleRiskScore {
  riskScore: number; // 0-1 (0 = low risk, 1 = high risk)
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  factors: string[]; // List of risk factors detected
  recommendation: string;
}

/**
 * Calculates mechanical drift from durability metrics
 * 
 * Mechanical drift = combination of form decay indicators
 */
function calculateMechanicalDrift(durabilityMetrics: DurabilityMetrics): number {
  let drift = 0;
  let factors = 0;
  
  // GCT increase (form decay)
  if (durabilityMetrics.form_decay !== null) {
    drift += Math.max(0, durabilityMetrics.form_decay); // Only positive (increase) counts
    factors++;
  }
  
  // Vertical ratio increase (less efficient form)
  // Note: Vertical ratio is already in durability metrics, but we need to track trend
  // For now, we'll use form_decay as proxy
  
  // Cadence drift (fatigue indicator)
  if (durabilityMetrics.cadence_drift !== null && durabilityMetrics.cadence_drift < 0) {
    drift += Math.abs(durabilityMetrics.cadence_drift); // Only negative (decrease) counts
    factors++;
  }
  
  // Average drift (normalize by number of factors)
  return factors > 0 ? drift / factors : 0;
}

/**
 * Classifies niggle risk using ML model (with fallback to rule-based)
 * 
 * @param durabilityMetrics - Durability metrics from recent sessions
 * @param recentNiggleTrend - Array of recent niggle scores (last 7 days)
 * @param userId - User ID for feature extraction (optional, for ML prediction)
 * @param targetDate - Target date for feature extraction (optional, defaults to today)
 * @returns Risk score and classification
 */
export async function classifyNiggleRiskML(
  durabilityMetrics: DurabilityMetrics,
  recentNiggleTrend: number[] = [],
  userId?: string,
  targetDate?: string
): Promise<NiggleRiskScore> {
  // Try ML prediction if user ID provided
  if (userId && targetDate) {
    try {
      const features = await extractFeaturesForDate(userId, targetDate);
      if (features) {
        const mlPrediction = await predictNiggleRiskHybrid(
          features,
          durabilityMetrics,
          recentNiggleTrend
        );
        
        // Convert ML prediction to NiggleRiskScore format
        let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
        let recommendation: string;
        
        if (mlPrediction.riskScore >= 0.7) {
          riskLevel = 'HIGH';
          recommendation = 'High risk of training interruption. ML model predicts injury risk. Consider rest or reduced load.';
        } else if (mlPrediction.riskScore >= 0.4) {
          riskLevel = 'MEDIUM';
          recommendation = 'Moderate risk detected by ML model. Monitor closely and consider load reduction.';
        } else {
          riskLevel = 'LOW';
          recommendation = 'Low risk. Continue training as planned.';
        }
        
        return {
          riskScore: mlPrediction.riskScore,
          riskLevel,
          factors: mlPrediction.factors,
          recommendation
        };
      }
    } catch (error) {
      logger.warn('ML prediction failed, falling back to rule-based:', error);
    }
  }
  
  // Fallback to rule-based
  return classifyNiggleRisk(durabilityMetrics, recentNiggleTrend);
}

/**
 * Classifies niggle risk based on mechanical drift (rule-based)
 * 
 * @param durabilityMetrics - Durability metrics from recent sessions
 * @param recentNiggleTrend - Array of recent niggle scores (last 7 days)
 * @returns Risk score and classification
 */
export function classifyNiggleRisk(
  durabilityMetrics: DurabilityMetrics,
  recentNiggleTrend: number[] = []
): NiggleRiskScore {
  const mechanicalDrift = calculateMechanicalDrift(durabilityMetrics);
  const factors: string[] = [];
  let riskScore = 0;
  
  // Factor 1: Mechanical drift (GCT increase, cadence decrease)
  if (mechanicalDrift > 0.10) {
    riskScore += 0.4; // High weight for mechanical drift
    factors.push(`Mechanical drift: ${(mechanicalDrift * 100).toFixed(1)}%`);
  } else if (mechanicalDrift > 0.05) {
    riskScore += 0.2;
    factors.push(`Moderate mechanical drift: ${(mechanicalDrift * 100).toFixed(1)}%`);
  }
  
  // Factor 2: Recent niggle trend (increasing pain)
  if (recentNiggleTrend.length >= 3) {
    const recentAvg = recentNiggleTrend.slice(-3).reduce((a, b) => a + b, 0) / 3;
    if (recentAvg > 5) {
      riskScore += 0.3;
      factors.push(`High recent niggle: ${recentAvg.toFixed(1)}/10`);
    } else if (recentAvg > 3) {
      riskScore += 0.15;
      factors.push(`Moderate recent niggle: ${recentAvg.toFixed(1)}/10`);
    }
    
    // Check if trend is increasing
    if (recentNiggleTrend.length >= 2) {
      const trend = recentNiggleTrend[recentNiggleTrend.length - 1] - recentNiggleTrend[0];
      if (trend > 1) {
        riskScore += 0.2;
        factors.push(`Increasing niggle trend: +${trend.toFixed(1)}`);
      }
    }
  }
  
  // Factor 3: Decoupling (HR drift indicates fatigue)
  if (durabilityMetrics.decoupling !== null && durabilityMetrics.decoupling > 0.05) {
    riskScore += 0.1;
    factors.push(`HR decoupling: ${(durabilityMetrics.decoupling * 100).toFixed(1)}%`);
  }
  
  // Clamp risk score to 0-1
  riskScore = Math.min(1, Math.max(0, riskScore));
  
  // Classify risk level
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  let recommendation: string;
  
  if (riskScore >= 0.7) {
    riskLevel = 'HIGH';
    recommendation = 'High risk of training interruption. Consider rest or reduced load. Structural Agent may trigger veto.';
  } else if (riskScore >= 0.4) {
    riskLevel = 'MEDIUM';
    recommendation = 'Moderate risk detected. Monitor closely and consider load reduction.';
  } else {
    riskLevel = 'LOW';
    recommendation = 'Low risk. Continue training as planned.';
  }
  
  return {
    riskScore,
    riskLevel,
    factors,
    recommendation
  };
}

/**
 * Checks if risk is high enough to flag before Structural Agent veto
 * 
 * Roadmap requirement: "High-risk flags are raised before the Structural Agent triggers a manual Veto"
 */
export function shouldFlagHighRisk(riskScore: NiggleRiskScore): boolean {
  return riskScore.riskLevel === 'HIGH' || riskScore.riskScore >= 0.7;
}
