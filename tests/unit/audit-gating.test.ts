/**
 * Unit tests for audit gating logic
 * Tests blocking behavior for required inputs
 * FR-2.1 to FR-2.7
 */

import { describe, test, expect } from 'vitest';
import { checkAuditGating } from '../../src/modules/dailyCoach/logic/auditGating';

describe('Audit Gating (FR-2)', () => {
  test('FR-2.1: All inputs present should not require audit', () => {
    const allPresent = {
      niggleScore: 2,
      strengthSessionDone: true,
      strengthTier: 'Hypertrophy',
      lastRunDuration: 60,
      daysSinceLastLift: 2,
      fuelingTarget: null,
      fuelingCarbsPerHour: null,
      fuelingGiDistress: null,
    };
    const result = checkAuditGating(allPresent);
    
    expect(result.auditRequired).toBe(false);
    expect(result.missingInputs.length).toBe(0);
  });

  test('FR-2.1: Missing niggle should require audit', () => {
    const missingNiggle = {
      niggleScore: null,
      strengthSessionDone: true,
      strengthTier: 'Hypertrophy',
      lastRunDuration: 60,
      daysSinceLastLift: 2,
      fuelingTarget: null,
      fuelingCarbsPerHour: null,
      fuelingGiDistress: null,
    };
    const result = checkAuditGating(missingNiggle);
    
    expect(result.auditRequired).toBe(true);
    expect(result.missingInputs).toContain('Niggle score');
    expect(result.auditType).toBe('NIGGLE');
  });

  test('FR-2.2: Missing strength (when daysSinceLastLift >= 7) should require audit', () => {
    const missingStrength = {
      niggleScore: 2,
      strengthSessionDone: null,
      strengthTier: null,
      lastRunDuration: 60,
      daysSinceLastLift: 7,
      fuelingTarget: null,
      fuelingCarbsPerHour: null,
      fuelingGiDistress: null,
    };
    const result = checkAuditGating(missingStrength);
    
    expect(result.auditRequired).toBe(true);
    expect(result.missingInputs).toContain('Strength status');
    expect(result.auditType).toBe('STRENGTH');
  });

  test('FR-2.2: Strength not required if daysSinceLastLift < 7', () => {
    const recentLift = {
      niggleScore: 2,
      strengthSessionDone: null,
      strengthTier: null,
      lastRunDuration: 60,
      daysSinceLastLift: 3,
      fuelingTarget: null,
      fuelingCarbsPerHour: null,
      fuelingGiDistress: null,
    };
    const result = checkAuditGating(recentLift);
    
    expect(result.auditRequired).toBe(false);
    expect(result.missingInputs).not.toContain('Strength status');
  });

  test('FR-2.3: Long run (>90min) without fueling should require audit', () => {
    const longRunNoFueling = {
      niggleScore: 2,
      strengthSessionDone: true,
      strengthTier: 'Hypertrophy',
      lastRunDuration: 120,
      daysSinceLastLift: 2,
      fuelingTarget: null,
      fuelingCarbsPerHour: null,
      fuelingGiDistress: null,
    };
    const result = checkAuditGating(longRunNoFueling);
    
    expect(result.auditRequired).toBe(true);
    expect(result.missingInputs).toContain('Fueling carbs per hour');
    expect(result.missingInputs).toContain('Fueling GI distress');
    expect(result.auditType).toBe('FUELING');
  });

  test('FR-2.3: Long run with partial fueling (missing carbs) should require audit', () => {
    const longRunPartialFueling1 = {
      niggleScore: 2,
      strengthSessionDone: true,
      strengthTier: 'Hypertrophy',
      lastRunDuration: 120,
      daysSinceLastLift: 2,
      fuelingTarget: null,
      fuelingCarbsPerHour: null,
      fuelingGiDistress: 3,
    };
    const result = checkAuditGating(longRunPartialFueling1);
    
    expect(result.auditRequired).toBe(true);
    expect(result.missingInputs).toContain('Fueling carbs per hour');
  });

  test('FR-2.3: Long run with partial fueling (missing GI distress) should require audit', () => {
    const longRunPartialFueling2 = {
      niggleScore: 2,
      strengthSessionDone: true,
      strengthTier: 'Hypertrophy',
      lastRunDuration: 120,
      daysSinceLastLift: 2,
      fuelingTarget: null,
      fuelingCarbsPerHour: 60,
      fuelingGiDistress: null,
    };
    const result = checkAuditGating(longRunPartialFueling2);
    
    expect(result.auditRequired).toBe(true);
    expect(result.missingInputs).toContain('Fueling GI distress');
  });

  test('FR-2.3: Long run with complete fueling should not require audit', () => {
    const longRunWithFueling = {
      niggleScore: 2,
      strengthSessionDone: true,
      strengthTier: 'Hypertrophy',
      lastRunDuration: 120,
      daysSinceLastLift: 2,
      fuelingTarget: null,
      fuelingCarbsPerHour: 60,
      fuelingGiDistress: 3,
    };
    const result = checkAuditGating(longRunWithFueling);
    
    expect(result.auditRequired).toBe(false);
  });

  test('FR-2.3: High fueling target (>90) without fueling should require audit', () => {
    const highTargetNoFueling = {
      niggleScore: 2,
      strengthSessionDone: true,
      strengthTier: 'Hypertrophy',
      lastRunDuration: 60,
      daysSinceLastLift: 2,
      fuelingTarget: 95,
      fuelingCarbsPerHour: null,
      fuelingGiDistress: null,
    };
    const result = checkAuditGating(highTargetNoFueling);
    
    expect(result.auditRequired).toBe(true);
    expect(result.auditType).toBe('FUELING');
  });

  test('FR-2.3: Short run (<90min) with low target should not require fueling audit', () => {
    const shortRun = {
      niggleScore: 2,
      strengthSessionDone: true,
      strengthTier: 'Hypertrophy',
      lastRunDuration: 60,
      daysSinceLastLift: 2,
      fuelingTarget: 60,
      fuelingCarbsPerHour: null,
      fuelingGiDistress: null,
    };
    const result = checkAuditGating(shortRun);
    
    expect(result.auditRequired).toBe(false);
  });

  test('FR-2.3: Historical long run without fueling should require audit', () => {
    const historicalLongRun = {
      niggleScore: 2,
      strengthSessionDone: true,
      strengthTier: 'Hypertrophy',
      lastRunDuration: 60,
      daysSinceLastLift: 2,
      fuelingTarget: null,
      fuelingCarbsPerHour: null,
      fuelingGiDistress: null,
      hasHistoricalLongRunWithoutFueling: true,
    };
    const result = checkAuditGating(historicalLongRun);
    
    expect(result.auditRequired).toBe(true);
    expect(result.auditType).toBe('FUELING');
  });

  test('Multiple missing inputs should all be flagged', () => {
    const multipleMissing = {
      niggleScore: null,
      strengthSessionDone: null,
      strengthTier: null,
      lastRunDuration: 120,
      daysSinceLastLift: 7,
      fuelingTarget: null,
      fuelingCarbsPerHour: null,
      fuelingGiDistress: null,
    };
    const result = checkAuditGating(multipleMissing);
    
    expect(result.auditRequired).toBe(true);
    expect(result.missingInputs.length).toBeGreaterThanOrEqual(4);
    expect(result.auditType).toBe('NIGGLE'); // First missing input determines type
  });
});
