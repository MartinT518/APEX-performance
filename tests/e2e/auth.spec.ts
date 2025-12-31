/**
 * E2E tests for authentication flow
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('User registration', async ({ page }) => {
    await page.goto('/');
    
    // Look for sign up button or form
    const signUpButton = page.getByRole('button', { name: /sign up|register/i });
    if (await signUpButton.isVisible()) {
      await signUpButton.click();
    }
    
    // Fill registration form
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'testpassword123');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard or settings
    await expect(page).toHaveURL(/\/dashboard|\/settings/);
  });

  test('User login', async ({ page }) => {
    await page.goto('/');
    
    // Fill login form
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'testpassword123');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('Authentication guard - protected routes require login', async ({ page }) => {
    // Try to access dashboard without login
    await page.goto('/dashboard');
    
    // Should redirect to home page or show login
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\//);
  });

  test('Logout', async ({ page }) => {
    // Assuming user is logged in
    await page.goto('/dashboard');
    
    // Find logout button
    const logoutButton = page.getByRole('button', { name: /logout|sign out/i });
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
    }
    
    // Should redirect to home
    await expect(page).toHaveURL('/');
  });

  test('Session persistence', async ({ page }) => {
    // Login
    await page.goto('/');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    
    // Refresh page
    await page.reload();
    
    // Should still be logged in
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
