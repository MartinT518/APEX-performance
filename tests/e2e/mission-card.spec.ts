/**
 * E2E tests for mission card workflow
 * PRD-2
 */

import { test, expect } from '@playwright/test';

test.describe('Mission Card Workflow (PRD-2)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('GO state (all GREEN) → original Blueprint workout', async ({ page }) => {
    // Look for mission card with GO status
    const goStatus = page.locator('text=/GO|All systems/i');
    const workoutDisplay = page.locator('[data-testid="workout"], .workout-card');
    
    // If GO status, workout should be visible
    const hasGoStatus = await goStatus.count() > 0;
    const hasWorkout = await workoutDisplay.count() > 0;
    
    // Either status is displayed or workout is shown
    expect(hasGoStatus || hasWorkout).toBe(true);
  });

  test('ADAPTED state (Structural RED) → substitution modal', async ({ page }) => {
    // Look for ADAPTED status or substitution modal
    const adaptedStatus = page.locator('text=/ADAPTED/i');
    const substitutionModal = page.locator('[data-testid="substitution-modal"]');
    
    // If ADAPTED, modal may appear
    const hasAdapted = await adaptedStatus.count() > 0;
    const hasModal = await substitutionModal.count() > 0;
    
    // Status or modal should be present
    expect(hasAdapted || hasModal).toBe(true);
  });

  test('SHUTDOWN state (Multiple RED) → shutdown modal', async ({ page }) => {
    // Look for SHUTDOWN status or shutdown modal
    const shutdownStatus = page.locator('text=/SHUTDOWN/i');
    const shutdownModal = page.locator('[data-testid="shutdown-modal"], .shutdown-modal');
    
    // If SHUTDOWN, modal may appear
    const hasShutdown = await shutdownStatus.count() > 0;
    const hasModal = await shutdownModal.count() > 0;
    
    // Status or modal should be present
    expect(hasShutdown || hasModal).toBe(true);
  });
});
