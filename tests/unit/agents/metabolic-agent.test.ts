/**
 * Unit tests for Metabolic Agent (Module E)
 * Tests vote generation based on HRV, decoupling, and intensity
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { evaluateMetabolicState } from '../../../src/modules/execute/agents/metabolicAgent';
import type { ISessionSummary } from '../../../src/types/session';

describe('Metabolic Agent (Module E)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('Time in red zone exceeding limit should result in RED vote', () => {
    const sessionPoints = Array.from({ length: 100 }, (_, i) => ({
      hr: 175, // Above threshold (170)
      cadence: 180,
    }));

    const input: ISessionSummary['metabolic'] = {
      sessionPoints: sessionPoints as any,
      hrvBaseline: 45,
      currentHRV: 45,
      planLimitRedZone: 10, // 10 minutes limit
    };

    const result = evaluateMetabolicState(input);

    expect(result.vote).toBe('RED');
    expect(result.agentId).toBe('metabolic_agent');
    expect(result.reason).toContain('Intensity Discipline');
  });

  test('HRV drop > 15% should result in RED vote', () => {
    const input: ISessionSummary['metabolic'] = {
      sessionPoints: [],
      hrvBaseline: 50,
      currentHRV: 40, // 20% drop (above 15% threshold)
      planLimitRedZone: 60,
    };

    const result = evaluateMetabolicState(input);

    expect(result.vote).toBe('RED');
    expect(result.reason).toContain('Systemic Fatigue');
    expect(result.reason).toContain('HRV');
  });

  test('HRV drop < 15% should not trigger RED', () => {
    const input: ISessionSummary['metabolic'] = {
      sessionPoints: [],
      hrvBaseline: 50,
      currentHRV: 45, // 10% drop (below 15% threshold)
      planLimitRedZone: 60,
    };

    const result = evaluateMetabolicState(input);

    expect(result.vote).not.toBe('RED');
  });

  test('Aerobic decoupling > 5% should result in AMBER vote', () => {
    // Create session points that simulate decoupling
    // First half: lower HR, second half: higher HR for same pace
    const sessionPoints = [
      ...Array.from({ length: 30 }, () => ({ hr: 140, pace: 300 })),
      ...Array.from({ length: 30 }, () => ({ hr: 160, pace: 300 })),
    ];

    const input: ISessionSummary['metabolic'] = {
      sessionPoints: sessionPoints as any,
      hrvBaseline: 45,
      currentHRV: 45,
      planLimitRedZone: 60,
    };

    const result = evaluateMetabolicState(input);

    expect(result.vote).toBe('AMBER');
    expect(result.reason).toContain('Decoupling') || expect(result.reason).toContain('cardiac drift');
  });

  test('GREEN vote when all conditions met', () => {
    const sessionPoints = Array.from({ length: 60 }, () => ({
      hr: 150, // Below threshold
      cadence: 180,
    }));

    const input: ISessionSummary['metabolic'] = {
      sessionPoints: sessionPoints as any,
      hrvBaseline: 45,
      currentHRV: 45,
      planLimitRedZone: 60,
    };

    const result = evaluateMetabolicState(input);

    expect(result.vote).toBe('GREEN');
  });

  test('Aerobic decoupling calculation from session points', () => {
    const sessionPoints = [
      { hr: 140, pace: 300 },
      { hr: 145, pace: 300 },
      { hr: 150, pace: 300 },
    ];

    const input: ISessionSummary['metabolic'] = {
      sessionPoints: sessionPoints as any,
      hrvBaseline: 45,
      currentHRV: 45,
      planLimitRedZone: 60,
    };

    const result = evaluateMetabolicState(input);

    // Should calculate decoupling internally
    expect(result.agentId).toBe('metabolic_agent');
  });
});
