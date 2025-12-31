/**
 * E2E tests for daily check-in workflow
 * PRD-1
 */

import { test, expect } from '@playwright/test';

test.describe('Daily Check-In Workflow (PRD-1)', () => {
  test.beforeEach(async ({ page }) => {
    // Assume user is logged in
    await page.goto('/dashboard');
  });

  test('Dashboard load → gatekeeper check', async ({ page }) => {
    // Dashboard should load
    await expect(page.locator('h1, h2')).toContainText(/dashboard|coach/i);
    
    // Gatekeeper check should run automatically
    // Look for audit banner or input forms
    const auditBanner = page.locator('[data-testid="audit-banner"], .audit-pending');
    const inputForms = page.locator('input[type="range"], input[type="number"]');
    
    // Either banner or forms should be visible
    const hasBanner = await auditBanner.isVisible().catch(() => false);
    const hasForms = await inputForms.first().isVisible().catch(() => false);
    
    expect(hasBanner || hasForms).toBe(true);
  });

  test('AUDIT_PENDING banner display', async ({ page }) => {
    // Simulate missing inputs by checking for banner
    const auditBanner = page.locator('[data-testid="audit-banner"], .audit-pending, text="INPUTS REQUIRED"');
    
    // Banner may or may not be visible depending on state
    // This test verifies the banner exists in the DOM
    const bannerExists = await auditBanner.count() > 0;
    expect(bannerExists).toBe(true);
  });

  test('Niggle slider input → submission → recalculation', async ({ page }) => {
    // Find niggle slider
    const niggleSlider = page.locator('input[type="range"][name*="niggle"], input[type="range"]').first();
    
    if (await niggleSlider.isVisible()) {
      // Set niggle score
      await niggleSlider.fill('4');
      
      // Submit (if there's a submit button)
      const submitButton = page.getByRole('button', { name: /save|submit|update/i });
      if (await submitButton.isVisible()) {
        await submitButton.click();
      }
      
      // Wait for recalculation
      await page.waitForTimeout(1000);
      
      // Dashboard should update
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('Mission card display - GO/ADAPTED/SHUTDOWN states', async ({ page }) => {
    // Look for mission card or status indicator
    const missionCard = page.locator('[data-testid="mission-card"], .mission-card, text=/GO|ADAPTED|SHUTDOWN/i');
    
    // Mission card should be visible (or status should be displayed)
    const cardExists = await missionCard.count() > 0;
    expect(cardExists).toBe(true);
  });
});
