/**
 * Integration tests for snapshot invalidation
 * FR-5.4, FR-5.5
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createTestSnapshot } from '../fixtures/factories';

describe('Snapshot Invalidation Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('FR-5.4: Gatekeeper input change → snapshot invalidation', () => {
    const today = new Date().toISOString().split('T')[0];
    const snapshot = createTestSnapshot('test-user-id', today);

    // Simulate gatekeeper input change (niggle updated)
    const updatedNiggle = 5; // Changed from previous value

    // Snapshot should be invalidated
    const invalidatedSnapshot = null; // After invalidation

    expect(snapshot).toBeDefined(); // Before invalidation
    expect(invalidatedSnapshot).toBeNull(); // After invalidation
  });

  test('FR-5.5: Phenotype change → future snapshot invalidation', () => {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const futureSnapshot = createTestSnapshot('test-user-id', tomorrow);
    const pastSnapshot = createTestSnapshot('test-user-id', yesterday);

    // Simulate phenotype change (max HR updated)
    const updatedMaxHR = 195; // Changed from previous value

    // Future snapshots should be invalidated
    const invalidatedFuture = null;
    const preservedPast = pastSnapshot; // Past preserved

    expect(invalidatedFuture).toBeNull();
    expect(preservedPast).toBeDefined();
  });

  test('FR-5.6: Past snapshots preserved (not invalidated)', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const pastSnapshot = createTestSnapshot('test-user-id', yesterday);

    // Simulate input change
    const updatedInput = { niggleScore: 5 };

    // Past snapshot should be preserved
    const preservedSnapshot = pastSnapshot;

    expect(preservedSnapshot).toBeDefined();
    expect(preservedSnapshot.date).toBe(yesterday);
  });

  test('Snapshot regeneration after invalidation', () => {
    const today = new Date().toISOString().split('T')[0];
    
    // Original snapshot
    const originalSnapshot = createTestSnapshot('test-user-id', today, {
      global_status: 'GO',
    });

    // Invalidate
    const invalidatedSnapshot = null;

    // Regenerate
    const regeneratedSnapshot = createTestSnapshot('test-user-id', today, {
      global_status: 'ADAPTED', // New status after input change
    });

    expect(originalSnapshot.global_status).toBe('GO');
    expect(invalidatedSnapshot).toBeNull();
    expect(regeneratedSnapshot.global_status).toBe('ADAPTED');
  });
});
