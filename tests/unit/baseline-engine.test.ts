/**
 * Unit tests for Baseline Engine (Module A)
 * Tests EWMA calculations, baseline updates, and phase detection
 */

import { describe, test, expect } from 'vitest';
import {
  calculateEWMA,
  calculateRollingAverage,
  calculateACWR,
  updateBaselines,
} from '../../src/modules/analyze/baselineEngine';

describe('Baseline Engine (Module A)', () => {
  test('EWMA calculation with 7-day window for HRV', () => {
    const todayValue = 45;
    const previousEMA = 42;
    const windowDays = 7;

    const result = calculateEWMA(todayValue, previousEMA, windowDays);

    // Alpha = 2 / (7 + 1) = 0.25
    // EMA = (45 * 0.25) + (42 * 0.75) = 11.25 + 31.5 = 42.75
    expect(result).toBeCloseTo(42.75, 2);
  });

  test('EWMA calculation with 28-day window for Tonnage', () => {
    const todayValue = 3000;
    const previousEMA = 2800;
    const windowDays = 28;

    const result = calculateEWMA(todayValue, previousEMA, windowDays);

    // Alpha = 2 / (28 + 1) = 0.069
    // EMA = (3000 * 0.069) + (2800 * 0.931) ≈ 207 + 2606.8 = 2813.8
    expect(result).toBeGreaterThan(2800);
    expect(result).toBeLessThan(3000);
  });

  test('EWMA with null previous EMA should return today value', () => {
    const todayValue = 45;
    const previousEMA = null;
    const windowDays = 7;

    const result = calculateEWMA(todayValue, previousEMA, windowDays);

    expect(result).toBe(todayValue);
  });

  test('Rolling average calculation', () => {
    const values = [40, 42, 45, 43, 44];
    const result = calculateRollingAverage(values);

    // Average = (40 + 42 + 45 + 43 + 44) / 5 = 214 / 5 = 42.8
    expect(result).toBe(42.8);
  });

  test('Rolling average with empty array should return 0', () => {
    const values: number[] = [];
    const result = calculateRollingAverage(values);

    expect(result).toBe(0);
  });

  test('ACWR calculation', () => {
    const acuteLoad = 100; // 7-day
    const chronicLoad = 80; // 28-day

    const result = calculateACWR(acuteLoad, chronicLoad);

    // ACWR = 100 / 80 = 1.25
    expect(result).toBe(1.25);
  });

  test('ACWR with zero chronic load should return 0', () => {
    const acuteLoad = 100;
    const chronicLoad = 0;

    const result = calculateACWR(acuteLoad, chronicLoad);

    expect(result).toBe(0);
  });

  test('Baseline update for HRV (7-day EWMA)', () => {
    const input = {
      currentHRV: 45,
      currentTonnage: 3000,
      prevHRVBaseline: 42,
      prevTonnageBaseline: 2800,
    };

    const result = updateBaselines(input);

    expect(result.hrvBaseline).toBeGreaterThan(42);
    expect(result.hrvBaseline).toBeLessThan(45);
    expect(result.tonnageBaseline).toBeGreaterThan(2800);
    expect(result.tonnageBaseline).toBeLessThan(3000);
  });

  test('Baseline update with null previous baselines', () => {
    const input = {
      currentHRV: 45,
      currentTonnage: 3000,
      prevHRVBaseline: null as any,
      prevTonnageBaseline: null as any,
    };

    const result = updateBaselines(input);

    // Should use current values as baselines
    expect(result.hrvBaseline).toBe(45);
    expect(result.tonnageBaseline).toBe(3000);
  });
});
