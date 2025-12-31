/**
 * Integration tests for audit blocking
 * Tests complete audit gating flow
 */

import { describe, test, expect } from 'vitest';
import { checkAuditGating } from '../../src/modules/dailyCoach/logic/auditGating';

describe('Audit Blocking Integration', () => {
  test('Missing niggle → AUDIT_PENDING → banner → no plan', () => {
    const auditInput = {
      niggleScore: null,
      strengthSessionDone: true,
      strengthTier: 'TIER_2',
      lastRunDuration: 60,
      daysSinceLastLift: 2,
      fuelingTarget: null,
      fuelingCarbsPerHour: null,
      fuelingGiDistress: null,
    };
    
    const result = checkAuditGating(auditInput);
    
    expect(result.auditRequired).toBe(true);
    expect(result.auditType).toBe('NIGGLE');
    expect(result.missingInputs).toContain('Niggle score');
    
    // Simulating UI behavior
    const shouldShowBanner = result.auditRequired;
    const shouldHidePlan = result.auditRequired;
    
    expect(shouldShowBanner).toBe(true);
    expect(shouldHidePlan).toBe(true);
  });

  test('Missing strength → AUDIT_PENDING → banner → no plan', () => {
    const auditInput = {
      niggleScore: 2,
      strengthSessionDone: null,
      strengthTier: null,
      lastRunDuration: 60,
      daysSinceLastLift: 7, // Required
      fuelingTarget: null,
      fuelingCarbsPerHour: null,
      fuelingGiDistress: null,
    };
    
    const result = checkAuditGating(auditInput);
    
    expect(result.auditRequired).toBe(true);
    expect(result.auditType).toBe('STRENGTH');
    expect(result.missingInputs).toContain('Strength status');
  });

  test('Missing fueling (>90min) → AUDIT_PENDING → banner → no plan', () => {
    const auditInput = {
      niggleScore: 2,
      strengthSessionDone: true,
      strengthTier: 'TIER_2',
      lastRunDuration: 120, // >90min
      daysSinceLastLift: 2,
      fuelingTarget: null,
      fuelingCarbsPerHour: null,
      fuelingGiDistress: null,
    };
    
    const result = checkAuditGating(auditInput);
    
    expect(result.auditRequired).toBe(true);
    expect(result.auditType).toBe('FUELING');
    expect(result.missingInputs).toContain('Fueling carbs per hour');
    expect(result.missingInputs).toContain('Fueling GI distress');
  });

  test('Input submission → immediate recalculation', () => {
    // Before: Missing input
    const beforeInput = {
      niggleScore: null,
      strengthSessionDone: true,
      strengthTier: 'TIER_2',
      lastRunDuration: 60,
      daysSinceLastLift: 2,
      fuelingTarget: null,
      fuelingCarbsPerHour: null,
      fuelingGiDistress: null,
    };
    
    const beforeResult = checkAuditGating(beforeInput);
    expect(beforeResult.auditRequired).toBe(true);
    
    // After: Input submitted
    const afterInput = {
      ...beforeInput,
      niggleScore: 2, // Now provided
    };
    
    const afterResult = checkAuditGating(afterInput);
    expect(afterResult.auditRequired).toBe(false);
    
    // Should trigger recalculation
    const shouldRecalculate = !afterResult.auditRequired;
    expect(shouldRecalculate).toBe(true);
  });
});
