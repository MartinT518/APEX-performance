/**
 * Unit tests for Fueling Agent (Module E)
 * Tests vote generation based on gut training index and run duration
 */

import { describe, test, expect } from 'vitest';
import { evaluateFuelingStatus } from '../../../src/modules/execute/agents/fuelingAgent';
import type { ISessionSummary } from '../../../src/types/session';
import type { PrototypeSessionDetail } from '../../../src/types/prototype';

describe('Fueling Agent (Module E)', () => {
  test('Next run > 2.5h with insufficient gut training should result in RED vote', () => {
    const sessionHistory: PrototypeSessionDetail[] = [
      {
        id: 'session-1',
        date: '2025-01-15',
        duration: '90m',
        distance: 15,
        type: 'EXEC',
        metadata: {},
      },
    ];

    const input: ISessionSummary['fueling'] = {
      nextRunDuration: 160, // > 150min (2.5h)
      sessionHistory,
    };

    const result = evaluateFuelingStatus(input);

    expect(result.vote).toBe('RED');
    expect(result.agentId).toBe('fueling_agent');
    expect(result.reason).toContain('Gut Conditioning');
  });

  test('Next run > 2.5h with sufficient gut training should result in GREEN', () => {
    const sessionHistory: PrototypeSessionDetail[] = [
      {
        id: 'session-1',
        date: '2025-01-15',
        duration: '2h 0m',
        distance: 20,
        type: 'EXEC',
        metadata: { carbsPerHour: 60 },
      },
      {
        id: 'session-2',
        date: '2025-01-20',
        duration: '2h 15m',
        distance: 22,
        type: 'EXEC',
        metadata: { carbsPerHour: 70 },
      },
      {
        id: 'session-3',
        date: '2025-01-25',
        duration: '2h 30m',
        distance: 25,
        type: 'EXEC',
        metadata: { carbsPerHour: 65 },
      },
      {
        id: 'session-4',
        date: '2025-01-30',
        duration: '2h 0m',
        distance: 20,
        type: 'EXEC',
        metadata: { carbsPerHour: 60 },
      },
    ];

    const input: ISessionSummary['fueling'] = {
      nextRunDuration: 160,
      sessionHistory,
    };

    const result = evaluateFuelingStatus(input);

    expect(result.vote).toBe('GREEN');
  });

  test('Next run < 2.5h should result in GREEN regardless of gut training', () => {
    const input: ISessionSummary['fueling'] = {
      nextRunDuration: 120, // < 150min
      sessionHistory: [],
    };

    const result = evaluateFuelingStatus(input);

    expect(result.vote).toBe('GREEN');
  });

  test('Gut training index calculation from session history', () => {
    const sessionHistory: PrototypeSessionDetail[] = [
      {
        id: 'session-1',
        date: '2025-01-15',
        duration: '2h 0m',
        distance: 20,
        type: 'EXEC',
        metadata: { carbsPerHour: 60 },
      },
      {
        id: 'session-2',
        date: '2025-01-20',
        duration: '1h 30m', // < 90min, should not count
        distance: 15,
        type: 'EXEC',
        metadata: { carbsPerHour: 50 },
      },
      {
        id: 'session-3',
        date: '2025-01-25',
        duration: '2h 15m',
        distance: 22,
        type: 'EXEC',
        metadata: { carbsPerHour: 70 },
      },
    ];

    const input: ISessionSummary['fueling'] = {
      nextRunDuration: 160,
      sessionHistory,
    };

    const result = evaluateFuelingStatus(input);

    // Should calculate gut training index from history
    expect(result.agentId).toBe('fueling_agent');
  });

  test('Gut training index requires >60g/hr carbs', () => {
    const sessionHistory: PrototypeSessionDetail[] = [
      {
        id: 'session-1',
        date: '2025-01-15',
        duration: '2h 0m',
        distance: 20,
        type: 'EXEC',
        metadata: { carbsPerHour: 50 }, // < 60g/hr, should not count
      },
      {
        id: 'session-2',
        date: '2025-01-20',
        duration: '2h 0m',
        distance: 20,
        type: 'EXEC',
        metadata: { carbsPerHour: 65 }, // >= 60g/hr, should count
      },
    ];

    const input: ISessionSummary['fueling'] = {
      nextRunDuration: 160,
      sessionHistory,
    };

    const result = evaluateFuelingStatus(input);

    // Only 1 session with adequate fueling, need 3
    expect(result.vote).toBe('RED');
  });
});
