/**
 * Unit tests for status resolver
 * Tests vote combinations mapping to GO/ADAPTED/SHUTDOWN
 * FR-1.1 to FR-1.5
 */

import { describe, test, expect } from 'vitest';
import { resolveDailyStatus } from '../../src/modules/review/logic/statusResolver';
import type { IAgentVote } from '../../src/types/agents';

// Test data helpers
function createVote(agentId: string, vote: 'GREEN' | 'AMBER' | 'RED', reason: string): IAgentVote {
  return {
    agentId,
    vote,
    confidence: 0.9,
    reason,
    flaggedMetrics: [],
    score: vote === 'GREEN' ? 90 : vote === 'AMBER' ? 70 : 50,
  };
}

describe('Status Resolver (FR-1)', () => {
  test('FR-1.1: All GREEN votes should result in GO status', () => {
    const allGreen = [
      createVote('structural_agent', 'GREEN', 'Chassis nominal'),
      createVote('metabolic_agent', 'GREEN', 'Engine nominal'),
      createVote('fueling_agent', 'GREEN', 'Fueling nominal'),
    ];
    const result = resolveDailyStatus({ votes: allGreen, niggleScore: 2 });
    
    expect(result.global_status).toBe('GO');
    expect(result.reason).toContain('Chassis and Engine are Green');
    expect(result.substitutions_suggested).toBe(false);
  });

  test('FR-1.2: Single Structural RED should result in ADAPTED', () => {
    const structuralRed = [
      createVote('structural_agent', 'RED', 'Pain > 3'),
      createVote('metabolic_agent', 'GREEN', 'Engine nominal'),
      createVote('fueling_agent', 'GREEN', 'Fueling nominal'),
    ];
    const result = resolveDailyStatus({ votes: structuralRed, niggleScore: 4 });
    
    expect(result.global_status).toBe('ADAPTED');
    expect(result.reason).toContain('Structural Agent Veto');
    expect(result.substitutions_suggested).toBe(true);
    expect(result.reason).toContain('4/10');
  });

  test('FR-1.2: Single Metabolic RED should result in ADAPTED', () => {
    const metabolicRed = [
      createVote('structural_agent', 'GREEN', 'Chassis nominal'),
      createVote('metabolic_agent', 'RED', 'Fatigue detected'),
      createVote('fueling_agent', 'GREEN', 'Fueling nominal'),
    ];
    const result = resolveDailyStatus({ votes: metabolicRed, niggleScore: 1 });
    
    expect(result.global_status).toBe('ADAPTED');
    expect(result.reason).toContain('Metabolic Agent Veto');
    expect(result.substitutions_suggested).toBe(false);
  });

  test('FR-1.2: Single Fueling RED should result in ADAPTED', () => {
    const fuelingRed = [
      createVote('structural_agent', 'GREEN', 'Chassis nominal'),
      createVote('metabolic_agent', 'GREEN', 'Engine nominal'),
      createVote('fueling_agent', 'RED', 'Gut training insufficient'),
    ];
    const result = resolveDailyStatus({ votes: fuelingRed, niggleScore: 0 });
    
    expect(result.global_status).toBe('ADAPTED');
    expect(result.reason).toContain('Fueling Agent Veto');
  });

  test('FR-1.2: Multiple RED votes should result in SHUTDOWN', () => {
    const multipleReds = [
      createVote('structural_agent', 'RED', 'Pain > 3'),
      createVote('metabolic_agent', 'RED', 'Fatigue detected'),
      createVote('fueling_agent', 'GREEN', 'Fueling nominal'),
    ];
    const result = resolveDailyStatus({ votes: multipleReds, niggleScore: 5 });
    
    expect(result.global_status).toBe('SHUTDOWN');
    expect(result.reason).toContain('System Shutdown');
    expect(result.reason).toContain('Multiple critical flags');
  });

  test('FR-1.2: Structural RED + Metabolic RED should result in SHUTDOWN', () => {
    const structuralAndMetabolicRed = [
      createVote('structural_agent', 'RED', 'Pain > 3'),
      createVote('metabolic_agent', 'RED', 'Fatigue detected'),
      createVote('fueling_agent', 'GREEN', 'Fueling nominal'),
    ];
    const result = resolveDailyStatus({ votes: structuralAndMetabolicRed, niggleScore: 4 });
    
    expect(result.global_status).toBe('SHUTDOWN');
  });

  test('FR-1.2: Z-score shutdown condition (HRV Z < -1.5 AND Sleep Debt > 4h) should trigger SHUTDOWN', () => {
    const zScoreShutdown = [
      createVote('structural_agent', 'GREEN', 'Chassis nominal'),
      createVote('metabolic_agent', 'GREEN', 'Engine nominal'),
      createVote('fueling_agent', 'GREEN', 'Fueling nominal'),
    ];
    const result = resolveDailyStatus({
      votes: zScoreShutdown,
      niggleScore: 2,
      zScoreContext: {
        hrvZScore: -1.8, // Below -1.5
        sleepDebtHours: 5.5, // Above 4h
      },
    });
    
    expect(result.global_status).toBe('SHUTDOWN');
    expect(result.reason).toContain('HRV Z-Score');
    expect(result.reason).toContain('Sleep Debt');
    expect(result.reason).toContain('-1.8');
    expect(result.reason).toContain('5.5');
  });

  test('FR-1.2: Z-score shutdown requires BOTH conditions - HRV Z < -1.5 but Sleep Debt <= 4h should be GO', () => {
    const zScoreNoShutdown = [
      createVote('structural_agent', 'GREEN', 'Chassis nominal'),
      createVote('metabolic_agent', 'GREEN', 'Engine nominal'),
      createVote('fueling_agent', 'GREEN', 'Fueling nominal'),
    ];
    const result = resolveDailyStatus({
      votes: zScoreNoShutdown,
      niggleScore: 2,
      zScoreContext: {
        hrvZScore: -1.8, // Below -1.5
        sleepDebtHours: 3.5, // Below 4h
      },
    });
    
    expect(result.global_status).toBe('GO');
  });

  test('FR-1.2: Z-score shutdown requires BOTH conditions - Sleep Debt > 4h but HRV Z >= -1.5 should be GO', () => {
    const zScoreNoShutdown = [
      createVote('structural_agent', 'GREEN', 'Chassis nominal'),
      createVote('metabolic_agent', 'GREEN', 'Engine nominal'),
      createVote('fueling_agent', 'GREEN', 'Fueling nominal'),
    ];
    const result = resolveDailyStatus({
      votes: zScoreNoShutdown,
      niggleScore: 2,
      zScoreContext: {
        hrvZScore: -1.2, // Above -1.5
        sleepDebtHours: 5.5, // Above 4h
      },
    });
    
    expect(result.global_status).toBe('GO');
  });

  test('AMBER votes only should result in GO', () => {
    const allAmber = [
      createVote('structural_agent', 'AMBER', 'Days since lift > 5'),
      createVote('metabolic_agent', 'AMBER', 'Slight decoupling'),
      createVote('fueling_agent', 'GREEN', 'Fueling nominal'),
    ];
    const result = resolveDailyStatus({ votes: allAmber, niggleScore: 2 });
    
    expect(result.global_status).toBe('GO');
    expect(result.reason).toContain('cautionary flags');
  });

  test('Votes display format should be correct', () => {
    const structuralRed = [
      createVote('structural_agent', 'RED', 'Pain > 3'),
      createVote('metabolic_agent', 'GREEN', 'Engine nominal'),
      createVote('fueling_agent', 'GREEN', 'Fueling nominal'),
    ];
    const result = resolveDailyStatus({ votes: structuralRed, niggleScore: 4 });
    
    expect(result.votes.structural.vote).toBe('RED');
    expect(result.votes.structural.color).toBe('red');
    expect(result.votes.structural.label).toBe('Veto');
    expect(result.votes.metabolic.vote).toBe('GREEN');
    expect(result.votes.metabolic.color).toBe('green');
  });

  test('FR-1.4: Confidence score should be capped at 0.85', () => {
    const allGreen = [
      createVote('structural_agent', 'GREEN', 'Chassis nominal'),
      createVote('metabolic_agent', 'GREEN', 'Engine nominal'),
      createVote('fueling_agent', 'GREEN', 'Fueling nominal'),
    ];
    const result = resolveDailyStatus({ votes: allGreen, niggleScore: 2 });
    
    expect(result.confidenceScore).toBeLessThanOrEqual(0.85);
    expect(result.confidenceScore).toBe(0.85);
  });

  test('FR-1.5: Substitutions_suggested should be true when Structural Agent RED', () => {
    const structuralRed = [
      createVote('structural_agent', 'RED', 'Pain > 3'),
      createVote('metabolic_agent', 'GREEN', 'Engine nominal'),
      createVote('fueling_agent', 'GREEN', 'Fueling nominal'),
    ];
    const result = resolveDailyStatus({ votes: structuralRed, niggleScore: 4 });
    
    expect(result.substitutions_suggested).toBe(true);
  });
});
