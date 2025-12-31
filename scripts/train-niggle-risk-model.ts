/**
 * Training Script for Niggle Risk ML Model
 * 
 * Trains ML model on historical data (2018-2025) to predict training interruption risk.
 * 
 * Roadmap requirement: "Train a regressor on the correlation between Mechanical_Drift
 * and the probability of a Training Interruption (>3 days gap)"
 */

// Load environment variables from .env.local FIRST
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Verify Supabase env vars are set before importing supabase.ts
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 
                     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                     process.env.SUPABASE_ANON_KEY ||
                     process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing Supabase environment variables');
  console.error('   Please set in .env.local:');
  console.error('     - NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)');
  console.error('     - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  process.exit(1);
}

// Now safe to import
import { createServerClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { extractTrainingDataset } from '@/modules/analyze/ml/featureEngineering';

interface ModelWeights {
  [key: string]: number;
}

/**
 * Simple logistic regression training
 * 
 * Uses gradient descent to learn weights
 */
function trainLogisticRegression(
  samples: Array<{ features: Record<string, number>; label: number }>,
  learningRate: number = 0.01,
  iterations: number = 1000
): ModelWeights {
  const featureKeys = Object.keys(samples[0].features);
  const weights: ModelWeights = {};
  
  // Initialize weights to zero
  for (const key of featureKeys) {
    weights[key] = 0;
  }
  
  // Gradient descent
  for (let iter = 0; iter < iterations; iter++) {
    for (const sample of samples) {
      // Calculate prediction
      let score = 0;
      for (const key of featureKeys) {
        score += weights[key] * sample.features[key];
      }
      
      // Apply sigmoid
      const prediction = 1 / (1 + Math.exp(-score));
      
      // Calculate error
      const error = prediction - sample.label;
      
      // Update weights (gradient descent)
      for (const key of featureKeys) {
        weights[key] -= learningRate * error * sample.features[key];
      }
    }
  }
  
  return weights;
}

/**
 * Evaluates model accuracy
 */
function evaluateModel(
  weights: ModelWeights,
  samples: Array<{ features: Record<string, number>; label: number }>
): {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
} {
  let correct = 0;
  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  
  for (const sample of samples) {
    // Calculate prediction
    let score = 0;
    for (const [key, value] of Object.entries(sample.features)) {
      score += (weights[key] || 0) * value;
    }
    
    const prediction = 1 / (1 + Math.exp(-score));
    const predictedLabel = prediction > 0.5 ? 1 : 0;
    
    if (predictedLabel === sample.label) {
      correct++;
      if (predictedLabel === 1) truePositives++;
    } else {
      if (predictedLabel === 1) falsePositives++;
      else falseNegatives++;
    }
  }
  
  const accuracy = samples.length > 0 ? (correct / samples.length) * 100 : 0;
  const precision = (truePositives + falsePositives) > 0
    ? (truePositives / (truePositives + falsePositives)) * 100
    : 0;
  const recall = (truePositives + falseNegatives) > 0
    ? (truePositives / (truePositives + falseNegatives)) * 100
    : 0;
  const f1Score = (precision + recall) > 0
    ? (2 * precision * recall) / (precision + recall)
    : 0;
  
  return { accuracy, precision, recall, f1Score };
}

/**
 * Main training function
 */
async function main() {
  const supabase = await createServerClient();
  
  // Get user ID from command line or use authenticated user
  const args = process.argv.slice(2);
  let userId: string | undefined;
  
  if (args.length > 0 && args[0] === '--user-id') {
    userId = args[1];
  } else {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      logger.error('Not authenticated. Please log in or provide --user-id');
      process.exit(1);
    }
    userId = user.id;
  }
  
  if (!userId) {
    logger.error('No user ID provided');
    process.exit(1);
  }
  
  logger.info(`Training niggle risk model for user ${userId}`);
  
  // Default to last 3 years of data (or use command line args)
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = args.length >= 4
    ? args[2]
    : (() => {
        const start = new Date();
        start.setFullYear(start.getFullYear() - 3);
        return start.toISOString().split('T')[0];
      })();
  
  logger.info(`Extracting training dataset from ${startDate} to ${endDate}`);
  
  // Extract training dataset
  const allSamples = await extractTrainingDataset(userId, startDate, endDate);
  
  if (allSamples.length === 0) {
    logger.error('No training samples extracted. Check date range and data availability.');
    process.exit(1);
  }
  
  // Split into training (80%) and test (20%)
  const splitIndex = Math.floor(allSamples.length * 0.8);
  const trainingSamples = allSamples.slice(0, splitIndex);
  const testSamples = allSamples.slice(splitIndex);
  
  logger.info(`Training set: ${trainingSamples.length} samples`);
  logger.info(`Test set: ${testSamples.length} samples`);
  logger.info(`  Positive samples (injury): ${trainingSamples.filter(s => s.label === 1).length} training, ${testSamples.filter(s => s.label === 1).length} test`);
  
  // Train model
  logger.info('Training logistic regression model...');
  const weights = trainLogisticRegression(
    trainingSamples.map(s => ({ features: s.features as Record<string, number>, label: s.label })),
    0.01, // learning rate
    1000  // iterations
  );
  
  logger.info('Model weights:');
  for (const [key, value] of Object.entries(weights)) {
    logger.info(`  ${key}: ${value.toFixed(4)}`);
  }
  
  // Evaluate on test set
  logger.info('Evaluating model on test set...');
  const testMetrics = evaluateModel(weights, testSamples.map(s => ({ features: s.features as Record<string, number>, label: s.label })));
  
  logger.info(`Test Set Metrics:`);
  logger.info(`  Accuracy: ${testMetrics.accuracy.toFixed(1)}%`);
  logger.info(`  Precision: ${testMetrics.precision.toFixed(1)}%`);
  logger.info(`  Recall: ${testMetrics.recall.toFixed(1)}%`);
  logger.info(`  F1 Score: ${testMetrics.f1Score.toFixed(2)}`);
  
  // Compare to rule-based baseline
  // Rule-based: Always predict HIGH if niggle >5 or mechanical drift >0.1
  let ruleBasedCorrect = 0;
  for (const sample of testSamples) {
    const ruleBasedPrediction = 
      (sample.features.niggle_current > 5) ||
      (sample.features.mechanical_drift > 0.1) ||
      (sample.features.niggle_7d_avg > 5)
        ? 1 : 0;
    if (ruleBasedPrediction === sample.label) {
      ruleBasedCorrect++;
    }
  }
  const ruleBasedAccuracy = (ruleBasedCorrect / testSamples.length) * 100;
  
  logger.info(`Rule-based baseline accuracy: ${ruleBasedAccuracy.toFixed(1)}%`);
  logger.info(`ML improvement: ${(testMetrics.accuracy - ruleBasedAccuracy).toFixed(1)}%`);
  
  // Save model (in production, would save to file/database)
  logger.info('Model training complete. In production, save weights to:');
  logger.info('  - File: models/niggle-risk-model.json');
  logger.info('  - Database: ml_models table');
  logger.info('  - Cloud storage: S3/Cloud Storage');
  
  // For now, just log the weights (would be saved in production)
  logger.info('\nModel weights (JSON):');
  console.log(JSON.stringify(weights, null, 2));
  
  // Check if model meets requirement (>70% accuracy)
  if (testMetrics.accuracy >= 70) {
    logger.info(`✅ Model meets requirement: Accuracy (${testMetrics.accuracy.toFixed(1)}%) >= 70%`);
    process.exit(0);
  } else {
    logger.warn(`⚠️ Model does not meet requirement: Accuracy (${testMetrics.accuracy.toFixed(1)}%) < 70%`);
    logger.warn('Consider:');
    logger.warn('  - More training data');
    logger.warn('  - Feature engineering improvements');
    logger.warn('  - Different model architecture (random forest, neural network)');
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    logger.error('Training failed:', error);
    process.exit(1);
  });
}

export { trainLogisticRegression, evaluateModel };
