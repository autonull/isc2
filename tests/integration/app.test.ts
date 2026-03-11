import { test, expect } from '@playwright/test';

test.describe('Browser App', () => {
  test('should load the app', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ISC/);
  });
});
