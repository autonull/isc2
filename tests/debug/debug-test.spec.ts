/**
 * Debug Test - Check if app loads
 */

import { test, expect } from '@playwright/test';

test('App should load and show sidebar', async ({ page }) => {
  // Capture console errors
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    errors.push(err.message);
  });

  await page.goto('/');
  
  // Wait for any content
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);
  
  // Take a screenshot to see what's on the page
  await page.screenshot({ path: 'test-results/debug-page.png', fullPage: true });
  
  console.log('Console errors:', errors);
  
  // Get page content
  const content = await page.content();
  console.log('Page has app container:', content.includes('id="app"'));
  console.log('Page has script tags:', content.includes('script'));
  
  // Check for JavaScript bundle loading
  const jsLoaded = await page.evaluate(() => {
    return typeof window !== 'undefined';
  });
  console.log('JS loaded:', jsLoaded);
  
  // Try to find any data-testid elements
  const testIds = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-testid]')).map(el => el.getAttribute('data-testid'));
  });
  console.log('Found data-testid elements:', testIds);
  
  // Check for sidebar
  const sidebar = page.locator('[data-testid="sidebar"]');
  const sidebarVisible = await sidebar.isVisible().catch(() => false);
  
  console.log('Sidebar visible:', sidebarVisible);
  
  expect(sidebarVisible).toBe(true);
});
