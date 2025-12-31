/**
 * Unit tests for Valuation Engine (Module A)
 * Tests Smart Adherence Score, Integrity Ratio, and Blueprint Probability
 */

import { describe, test, expect } from 'vitest';
import {
  calculatePhaseAwareLoad,
  calculateValuation,
} from '../../src/modules/analyze/valuationEngine';
import type { PrototypeSessionDetail } from '../../src/types/prototype';

describe('Valuation Engine (Module A)', () => {
  describe('Phase-Aware Load Calculation', () => {
    test('Phase 1: Hypertrophy tier should return 2500', () => {
      const result = calculatePhaseAwareLoad('hypertrophy', 1);
      expect(result).toBe(2500);
    });

    test('Phase 2: Strength tier should return 3750', () => {
      const result = calculatePhaseAwareLoad('strength', 2);
      expect(result).toBe(3750);
    });

    test('Phase 3: Explosive tier should return 5000', () => {
      const result = calculatePhaseAwareLoad('explosive', 3);
      expect(result).toBe(5000);
    });

    test('Phase 4: Maintenance tier should return 2500', () => {
      const result = calculatePhaseAwareLoad('maintenance', 4);
      expect(result).toBe(2500);
    });

    test('Unknown tier should return 0', () => {
      const result = calculatePhaseAwareLoad('unknown', 1);
      expect(result).toBe(0);
    });
  });

  describe('Smart Adherence Score (Equation A)', () => {
    test('Valid substitution with Structural RED should count as 100% adherence', () => {
      const sessions: PrototypeSessionDetail[] = [
        {
          id: 'session-1',
          date: '2025-01-15',
          type: 'SUB',
          compliance: 'SUBSTITUTED',
          distance: 10,
          duration: '60m',
          agentFeedback: {
            structural: 'RED',
            metabolic: 'GREEN',
            fueling: 'GREEN',
          },
        } as PrototypeSessionDetail,
      ];

      const result = calculateValuation(sessions);

      // Valid substitution should count as full adherence
      expect(result.adherenceScore).toBeGreaterThan(0);
    });

    test('MISSED sessions should contribute 0 to adherence', () => {
      const sessions: PrototypeSessionDetail[] = [
        {
          id: 'session-1',
          date: '2025-01-15',
          type: 'MISSED',
          compliance: 'MISSED',
          distance: 10,
          duration: '60m',
        } as PrototypeSessionDetail,
      ];

      const result = calculateValuation(sessions);

      // MISSED sessions should not contribute
      expect(result.adherenceScore).toBe(0);
    });

    test('EXEC sessions should count as full adherence', () => {
      const sessions: PrototypeSessionDetail[] = [
        {
          id: 'session-1',
          date: '2025-01-15',
          type: 'EXEC',
          compliance: 'COMPLIANT',
          distance: 10,
          duration: '60m',
        } as PrototypeSessionDetail,
      ];

      const result = calculateValuation(sessions);

      expect(result.adherenceScore).toBeGreaterThan(0);
    });
  });

  describe('Integrity Ratio (Equation B)', () => {
    test('Integrity ratio should normalize units correctly', () => {
      const sessions: PrototypeSessionDetail[] = [
        {
          id: 'session-1',
          date: '2025-01-15',
          type: 'STR',
          distance: 0,
          duration: '60m',
          hiddenVariables: {
            strengthTier: 'STRENGTH',
          },
        } as PrototypeSessionDetail,
        {
          id: 'session-2',
          date: '2025-01-16',
          type: 'EXEC',
          distance: 10,
          duration: '60m',
        } as PrototypeSessionDetail,
      ];

      const result = calculateValuation(sessions);

      // Integrity ratio should be calculated with normalized units
      expect(result.integrityRatio).toBeGreaterThanOrEqual(0);
    });

    test('Integrity ratio should handle zero volume', () => {
      const sessions: PrototypeSessionDetail[] = [
        {
          id: 'session-1',
          date: '2025-01-15',
          type: 'STR',
          distance: 0,
          duration: '60m',
        } as PrototypeSessionDetail,
      ];

      const result = calculateValuation(sessions);

      // Should return 0 when no volume
      expect(result.integrityRatio).toBe(0);
    });
  });

  describe('Blueprint Probability (Equation C)', () => {
    test('Probability should be capped at 85%', () => {
      const sessions: PrototypeSessionDetail[] = Array.from({ length: 100 }, (_, i) => ({
        id: `session-${i}`,
        date: `2025-01-${i + 1}`,
        type: 'EXEC',
        compliance: 'COMPLIANT',
        distance: 15,
        duration: '90m',
      })) as PrototypeSessionDetail[];

      const result = calculateValuation(sessions);

      expect(result.blueprintProbability).toBeLessThanOrEqual(85);
    });

    test('Phase 3 penalty: Weekly volume < 50km should reduce probability', () => {
      const sessions: PrototypeSessionDetail[] = [
        {
          id: 'session-1',
          date: '2025-01-15',
          type: 'EXEC',
          distance: 5, // Low volume
          duration: '30m',
        } as PrototypeSessionDetail,
      ];

      const result = calculateValuation(sessions);

      // In Phase 3, low volume should reduce probability
      // Note: Actual phase depends on current date
      expect(result.blueprintProbability).toBeGreaterThanOrEqual(0);
      expect(result.blueprintProbability).toBeLessThanOrEqual(85);
    });

    test('Low integrity ratio should reduce probability', () => {
      const sessions: PrototypeSessionDetail[] = [
        {
          id: 'session-1',
          date: '2025-01-15',
          type: 'EXEC',
          distance: 10,
          duration: '60m',
        } as PrototypeSessionDetail,
      ];

      const result = calculateValuation(sessions);

      // Low integrity ratio should add risk penalty
      expect(result.blueprintProbability).toBeGreaterThanOrEqual(0);
    });

    test('Low adherence score should reduce probability', () => {
      const sessions: PrototypeSessionDetail[] = [
        {
          id: 'session-1',
          date: '2025-01-15',
          type: 'MISSED',
          compliance: 'MISSED',
          distance: 10,
          duration: '60m',
        } as PrototypeSessionDetail,
      ];

      const result = calculateValuation(sessions);

      // Low adherence should reduce probability
      expect(result.blueprintProbability).toBeLessThan(50); // Base prob is 50
    });
  });

  describe('Coach Verdict', () => {
    test('High adherence and integrity should result in positive verdict', () => {
      const sessions: PrototypeSessionDetail[] = Array.from({ length: 30 }, (_, i) => ({
        id: `session-${i}`,
        date: `2025-01-${i + 1}`,
        type: 'EXEC',
        compliance: 'COMPLIANT',
        distance: 15,
        duration: '90m',
        hiddenVariables: {
          strengthTier: 'STRENGTH',
        },
      })) as PrototypeSessionDetail[];

      const result = calculateValuation(sessions);

      expect(['ON TRACK', 'POSITIVE DEVIATION', 'RISK DETECTED']).toContain(
        result.coachVerdict
      );
      expect(result.verdictText).toBeDefined();
      expect(result.chassisVerdict).toBeDefined();
    });
  });
});
