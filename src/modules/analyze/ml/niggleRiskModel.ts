/**
 * ML Model Interface for Niggle Risk Prediction
 * 
 * Provides interface for loading and using trained ML model.
 * Falls back to rule-based classifier if model not available.
 */

import { logger } from '@/lib/logger';
import type { FeatureVector } from './featureEngineering';
import { classifyNiggleRisk } from '../niggleRiskClassifier';
import type { DurabilityMetrics } from '../durabilityCalculator';

export interface ModelPrediction {
  riskScore: number; // 0-1 probability
  confidence: number; // 0-1 confidence in prediction
  method: 'ML' | 'RULE_BASED' | 'HYBRID';
  factors: string[];
}

/**
 * Simple logistic regression model (placeholder for actual trained model)
 * 
 * In production, this would load a trained model from file/database
 * For now, uses a simple linear combination of features
 */
class SimpleNiggleRiskModel {
  private weights: Record<keyof FeatureVector, number>;
  
  constructor() {
    // Initialize with heuristic weights (would be learned from training)
    this.weights = {
      mechanical_drift: 0.3,
      gct_trend: 0.15,
      vertical_ratio_trend: 0.15,
      cadence_drift: 0.1,
      weekly_volume: 0.05,
      volume_change_7d: 0.1,
      volume_change_28d: 0.05,
      hrv_7d_avg: -0.1, // Negative: higher HRV = lower risk
      hrv_trend: -0.05,
      hrv_z_score: -0.1,
      niggle_current: 0.2,
      niggle_7d_avg: 0.15,
      niggle_trend: 0.1,
      niggle_high_days: 0.2,
      days_since_last_lift: -0.05, // Negative: recent lift = lower risk
      training_consistency: -0.05
    };
  }
  
  /**
   * Predicts niggle risk from features using logistic regression
   * 
   * Formula: P = 1 / (1 + exp(-(w0 + w1*x1 + w2*x2 + ...)))
   */
  predict(features: FeatureVector): number {
    // Linear combination
    let score = 0;
    for (const [key, value] of Object.entries(features) as [keyof FeatureVector, number][]) {
      score += this.weights[key] * value;
    }
    
    // Apply sigmoid to get probability
    const probability = 1 / (1 + Math.exp(-score));
    
    return Math.max(0, Math.min(1, probability));
  }
  
  /**
   * Loads model from file/database (placeholder)
   */
  static async load(): Promise<SimpleNiggleRiskModel | null> {
    // In production, would load from:
    // - File: fs.readFileSync('models/niggle-risk-model.json')
    // - Database: SELECT model_data FROM ml_models WHERE name = 'niggle_risk'
    // - S3/Cloud storage
    
    // For now, return a new instance with default weights
    return new SimpleNiggleRiskModel();
  }
}

// Singleton model instance (lazy loaded)
let modelInstance: SimpleNiggleRiskModel | null = null;

/**
 * Predicts niggle risk using ML model (with fallback to rule-based)
 */
export async function predictNiggleRisk(
  features: FeatureVector,
  durabilityMetrics?: DurabilityMetrics,
  recentNiggleTrend?: number[]
): Promise<ModelPrediction> {
  try {
    // Try to load ML model
    if (!modelInstance) {
      modelInstance = await SimpleNiggleRiskModel.load();
    }
    
    if (modelInstance) {
      const mlRiskScore = modelInstance.predict(features);
      
      // Calculate confidence based on feature completeness
      const featureCount = Object.values(features).filter(v => v !== 0 && !isNaN(v)).length;
      const confidence = Math.min(1, featureCount / Object.keys(features).length);
      
      return {
        riskScore: mlRiskScore,
        confidence,
        method: 'ML',
        factors: [
          `ML prediction: ${(mlRiskScore * 100).toFixed(1)}% risk`,
          `Mechanical drift: ${features.mechanical_drift.toFixed(2)}`,
          `Niggle trend: ${features.niggle_trend.toFixed(1)}`
        ]
      };
    }
  } catch (error) {
    logger.warn('ML model prediction failed, falling back to rule-based:', error);
  }
  
  // Fallback to rule-based classifier
  if (durabilityMetrics && recentNiggleTrend) {
    const ruleBased = classifyNiggleRisk(durabilityMetrics, recentNiggleTrend);
    return {
      riskScore: ruleBased.riskScore,
      confidence: 0.7, // Rule-based has lower confidence
      method: 'RULE_BASED',
      factors: ruleBased.factors
    };
  }
  
  // Last resort: use features directly
  const fallbackScore = Math.min(1, 
    (features.mechanical_drift * 0.4) +
    (features.niggle_current / 10 * 0.3) +
    (features.niggle_7d_avg / 10 * 0.2) +
    (features.hrv_z_score < -1 ? 0.1 : 0)
  );
  
  return {
    riskScore: fallbackScore,
    confidence: 0.5,
    method: 'RULE_BASED',
    factors: ['Fallback calculation']
  };
}

/**
 * Hybrid prediction: Combines ML and rule-based for better accuracy
 */
export async function predictNiggleRiskHybrid(
  features: FeatureVector,
  durabilityMetrics: DurabilityMetrics,
  recentNiggleTrend: number[]
): Promise<ModelPrediction> {
  const mlPrediction = await predictNiggleRisk(features);
  const ruleBased = classifyNiggleRisk(durabilityMetrics, recentNiggleTrend);
  
  // Weighted combination: 70% ML, 30% rule-based (if ML available)
  let finalScore: number;
  let method: 'ML' | 'RULE_BASED' | 'HYBRID';
  
  if (mlPrediction.method === 'ML' && mlPrediction.confidence > 0.6) {
    finalScore = (mlPrediction.riskScore * 0.7) + (ruleBased.riskScore * 0.3);
    method = 'HYBRID';
  } else {
    finalScore = ruleBased.riskScore;
    method = 'RULE_BASED';
  }
  
  return {
    riskScore: finalScore,
    confidence: Math.max(mlPrediction.confidence, 0.7),
    method,
    factors: [
      ...mlPrediction.factors,
      ...ruleBased.factors.map(f => `Rule: ${f}`)
    ]
  };
}
