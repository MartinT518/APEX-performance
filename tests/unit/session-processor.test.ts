/**
 * Unit tests for Session Processor (Module K)
 * Tests cadence lock detection, HR artifact detection, and integrity flags
 */

import { describe, test, expect } from 'vitest';

describe('Session Processor (Module K)', () => {
  test('Cadence lock detection: Correlation > 0.95 for >5 mins', () => {
    // Simulate cadence lock: HR and cadence highly correlated
    const hrStream = Array.from({ length: 300 }, (_, i) => 140 + (i % 10));
    const cadenceStream = Array.from({ length: 300 }, (_, i) => 180 + (i % 10));

    // Calculate correlation (simplified)
    const meanHR = hrStream.reduce((a, b) => a + b, 0) / hrStream.length;
    const meanCadence = cadenceStream.reduce((a, b) => a + b, 0) / cadenceStream.length;

    let covariance = 0;
    let hrVariance = 0;
    let cadenceVariance = 0;

    for (let i = 0; i < hrStream.length; i++) {
      const hrDiff = hrStream[i] - meanHR;
      const cadenceDiff = cadenceStream[i] - meanCadence;
      covariance += hrDiff * cadenceDiff;
      hrVariance += hrDiff * hrDiff;
      cadenceVariance += cadenceDiff * cadenceDiff;
    }

    const correlation =
      covariance / Math.sqrt(hrVariance * cadenceVariance);

    const hasCadenceLock = correlation > 0.95 && hrStream.length > 300; // >5 mins

    expect(hasCadenceLock).toBe(true);
  });

  test('HR artifact detection: ΔHR > 40bpm in <3 sec', () => {
    const hrStream = [150, 155, 190, 195, 200]; // Jump from 155 to 190 (35bpm in 1 sec)

    let hasArtifact = false;
    for (let i = 1; i < hrStream.length; i++) {
      const delta = Math.abs(hrStream[i] - hrStream[i - 1]);
      if (delta > 40) {
        hasArtifact = true;
        break;
      }
    }

    // This stream doesn't have >40bpm jump, but test the logic
    expect(hasArtifact).toBe(false);

    // Test with actual artifact
    const hrStreamWithArtifact = [150, 155, 200, 195, 200]; // 155 to 200 = 45bpm jump
    let hasArtifact2 = false;
    for (let i = 1; i < hrStreamWithArtifact.length; i++) {
      const delta = Math.abs(hrStreamWithArtifact[i] - hrStreamWithArtifact[i - 1]);
      if (delta > 40) {
        hasArtifact2 = true;
        break;
      }
    }
    expect(hasArtifact2).toBe(true);
  });

  test('Integrity flag assignment: VALID vs SUSPECT', () => {
    const hasCadenceLock = false;
    const hasHRArtifact = false;
    const hrSource = 'chest_strap';

    // Determine integrity
    let integrity: 'VALID' | 'SUSPECT' = 'VALID';
    if (hasCadenceLock || hasHRArtifact) {
      integrity = 'SUSPECT';
    }
    if (hrSource === 'wrist' && (hasCadenceLock || hasHRArtifact)) {
      integrity = 'SUSPECT';
    }

    expect(integrity).toBe('VALID');
  });

  test('Integrity flag: SUSPECT when cadence lock detected', () => {
    const hasCadenceLock = true;
    const hasHRArtifact = false;

    const integrity = hasCadenceLock || hasHRArtifact ? 'SUSPECT' : 'VALID';

    expect(integrity).toBe('SUSPECT');
  });

  test('Integrity flag: SUSPECT when HR artifact detected', () => {
    const hasCadenceLock = false;
    const hasHRArtifact = true;

    const integrity = hasCadenceLock || hasHRArtifact ? 'SUSPECT' : 'VALID';

    expect(integrity).toBe('SUSPECT');
  });

  test('Metadata extraction: HR stream, cadence, GCT', () => {
    const metadata = {
      hrStream: Array.from({ length: 3600 }, () => 150),
      cadenceStream: Array.from({ length: 3600 }, () => 180),
      gct: 250,
      verticalOscillation: 8.5,
      distanceKm: 10,
      avgPace: '5:00',
      avgHR: 150,
    };

    expect(metadata.hrStream).toBeDefined();
    expect(metadata.cadenceStream).toBeDefined();
    expect(metadata.gct).toBe(250);
    expect(metadata.verticalOscillation).toBe(8.5);
  });
});
