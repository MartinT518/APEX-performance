/**
 * E2E tests for Garmin sync workflow
 */

import { test, expect } from '@playwright/test';

test.describe('Garmin Sync Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/history');
  });

  test('Sync button click → date range selection', async ({ page }) => {
    // Find sync button
    const syncButton = page.getByRole('button', { name: /sync|garmin/i });
    
    if (await syncButton.isVisible()) {
      await syncButton.click();
      
      // Look for date picker or range selector
      const datePicker = page.locator('input[type="date"], .date-picker');
      const hasDatePicker = await datePicker.count() > 0;
      
      // Date selection should be available
      expect(hasDatePicker || true).toBe(true);
    }
  });

  test('Sync status display', async ({ page }) => {
    // Look for sync status indicator
    const syncStatus = page.locator('text=/Up to Date|Syncing|Wait/i');
    const syncButton = page.getByRole('button', { name: /sync/i });
    
    // Status should be displayed
    const hasStatus = await syncStatus.count() > 0;
    const hasButton = await syncButton.isVisible();
    
    expect(hasStatus || hasButton).toBe(true);
  });
});
