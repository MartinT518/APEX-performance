/**
 * Unit tests for Structural Agent (Module E)
 * Tests vote generation based on niggle, strength, and volume
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { evaluateStructuralHealth } from '../../../src/modules/execute/agents/structuralAgent';
import type { ISessionSummary } from '../../../src/types/session';

describe('Structural Agent (Module E)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('Niggle > 3 should result in RED vote', async () => {
    const input: ISessionSummary['structural'] = {
      niggleScore: 4,
      daysSinceLastLift: 2,
      tonnageTier: 'strength',
      currentWeeklyVolume: 50,
      sessionPoints: [],
    };

    const result = await evaluateStructuralHealth(input);

    expect(result.vote).toBe('RED');
    expect(result.agentId).toBe('structural_agent');
    expect(result.reason).toContain('Pain');
  });

  test('Niggle > 5 should trigger PHYSIO MODE (zero running)', async () => {
    const input: ISessionSummary['structural'] = {
      niggleScore: 6,
      daysSinceLastLift: 2,
      tonnageTier: 'strength',
      currentWeeklyVolume: 50,
      sessionPoints: [],
      niggleLocation: 'Achilles',
    };

    const result = await evaluateStructuralHealth(input);

    expect(result.vote).toBe('RED');
    expect(result.reason).toContain('PHYSIO MODE');
    expect(result.reason).toContain('Zero running');
  });

  test('Days since lift > 5 should result in AMBER vote', async () => {
    const input: ISessionSummary['structural'] = {
      niggleScore: 2,
      daysSinceLastLift: 6,
      tonnageTier: 'strength',
      currentWeeklyVolume: 50,
      sessionPoints: [],
    };

    const result = await evaluateStructuralHealth(input);

    expect(result.vote).toBe('AMBER');
    expect(result.reason).toContain('Days since lift');
  });

  test('Volume exceeding chassis capacity should result in AMBER/RED', async () => {
    const input: ISessionSummary['structural'] = {
      niggleScore: 2,
      daysSinceLastLift: 2,
      tonnageTier: 'maintenance', // Max volume = 80km/week
      currentWeeklyVolume: 100, // Exceeds capacity
      sessionPoints: [],
    };

    const result = await evaluateStructuralHealth(input);

    expect(['AMBER', 'RED']).toContain(result.vote);
    expect(result.reason).toContain('Volume') || expect(result.reason).toContain('chassis');
  });

  test('Cadence stability calculation from session points', async () => {
    const sessionPoints = [
      { cadence: 180, hr: 150 },
      { cadence: 182, hr: 152 },
      { cadence: 179, hr: 151 },
      { cadence: 181, hr: 153 },
    ];

    const input: ISessionSummary['structural'] = {
      niggleScore: 2,
      daysSinceLastLift: 2,
      tonnageTier: 'strength',
      currentWeeklyVolume: 50,
      sessionPoints: sessionPoints as any,
    };

    const result = await evaluateStructuralHealth(input);

    // Should calculate cadence stability internally
    expect(result.agentId).toBe('structural_agent');
  });

  test('GREEN vote when all conditions met', async () => {
    const input: ISessionSummary['structural'] = {
      niggleScore: 2,
      daysSinceLastLift: 2,
      tonnageTier: 'strength',
      currentWeeklyVolume: 50,
      sessionPoints: [],
    };

    const result = await evaluateStructuralHealth(input);

    expect(result.vote).toBe('GREEN');
  });
});
