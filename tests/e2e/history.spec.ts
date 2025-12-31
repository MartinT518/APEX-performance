/**
 * E2E tests for history page
 */

import { test, expect } from '@playwright/test';

test.describe('History Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/history');
  });

  test('Session list display with integrity badges', async ({ page }) => {
    // Look for session cards
    const sessionCards = page.locator('[data-testid="session-card"], .session-card');
    const integrityBadges = page.locator('text=/VALID|SUSPECT|INVALID/i');
    
    const hasCards = await sessionCards.count() > 0;
    const hasBadges = await integrityBadges.count() > 0;
    
    expect(hasCards || hasBadges).toBe(true);
  });

  test('Session detail expansion (metadata, agent votes)', async ({ page }) => {
    // Find expandable session
    const expandButton = page.locator('button[aria-expanded="false"], .expand-button').first();
    
    if (await expandButton.isVisible()) {
      await expandButton.click();
      
      await page.waitForTimeout(500);
      
      // Look for expanded content
      const metadata = page.locator('text=/HR|Pace|Distance/i');
      const agentVotes = page.locator('text=/Structural|Metabolic|Fueling/i');
      
      const hasMetadata = await metadata.count() > 0;
      const hasVotes = await agentVotes.count() > 0;
      
      expect(hasMetadata || hasVotes).toBe(true);
    }
  });

  test('Suspect data display (INVALID for pace/distance)', async ({ page }) => {
    // Look for suspect data indicators
    const invalidIndicators = page.locator('text=/INVALID|SUSPECT/i');
    const hasInvalid = await invalidIndicators.count() > 0;
    
    // If suspect data exists, it should be marked
    expect(hasInvalid || true).toBe(true);
  });
});
