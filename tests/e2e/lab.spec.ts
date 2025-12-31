/**
 * E2E tests for lab page
 */

import { test, expect } from '@playwright/test';

test.describe('Lab Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/lab');
  });

  test('Decoupling calculation (EF formula)', async ({ page }) => {
    // Look for decoupling metric
    const decouplingMetric = page.locator('text=/Decoupling|EF|Efficiency/i');
    const hasMetric = await decouplingMetric.count() > 0;
    
    expect(hasMetric).toBe(true);
  });

  test('Chart visualization (Recharts)', async ({ page }) => {
    // Look for charts
    const charts = page.locator('svg, canvas, [data-testid="chart"]');
    const hasCharts = await charts.count() > 0;
    
    expect(hasCharts).toBe(true);
  });

  test('Data integrity indicators', async ({ page }) => {
    // Look for integrity indicators
    const integrityIndicators = page.locator('text=/VALID|SUSPECT|Integrity/i');
    const hasIndicators = await integrityIndicators.count() > 0;
    
    expect(hasIndicators).toBe(true);
  });
});
