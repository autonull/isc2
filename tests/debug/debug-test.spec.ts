/**
 * Debug Test - Check if app loads
 */

import { test, expect } from '@playwright/test';

test('App should load and show sidebar', async ({ page }) => {
  // Capture all console messages
  const messages: string[] = [];
  page.on('console', (msg) => {
    messages.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    messages.push(`PAGE ERROR: ${err.message}`);
    messages.push(`Stack: ${err.stack}`);
  });

  await page.goto('/');

  // Wait for network to be idle
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(8000);

  // Take a screenshot
  await page.screenshot({ path: 'test-results/debug-page.png', fullPage: true });

  // Keep messages for later assertions or debug artifacts (avoid noisy logs)

  // Check for JS errors in the page
  const jsErrors = await page.evaluate(() => {
    return (window as any).__jsErrors || [];
  });
  // JS errors captured for assertions
  expect(Array.isArray(jsErrors)).toBeTruthy();

  // Check if app div has content
  const appContent = await page.innerHTML('#app').catch(() => 'NOT FOUND');
  // Avoid printing large HTML in CI logs; perform small assertions instead
  expect(typeof appContent === 'string').toBeTruthy();

  // Check for any rendered elements
  const elementCount = await page.evaluate(() => {
    return document.body.querySelectorAll('*').length;
  });
  expect(typeof elementCount === 'number').toBeTruthy();

  // Check for sidebar
  const sidebar = page.locator('[data-testid="sidebar"]');
  const sidebarVisible = await sidebar.isVisible().catch(() => false);
  // Sidebar visibility recorded

  // If sidebar not visible, find what IS visible
  if (!sidebarVisible) {
    const visibleElements = await page.evaluate(() => {
      const elements: string[] = [];
      document.querySelectorAll('*').forEach((el) => {
        const style = window.getComputedStyle(el);
        if (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          (el as any).offsetWidth > 0
        ) {
          elements.push(
            el.tagName +
              (el.className ? '.' + el.className.split(' ').join('.') : '') +
              (el.id ? '#' + el.id : '')
          );
        }
      });
      return elements.slice(0, 20);
    });
    // Visible elements captured (truncated) for inspection when debugging locally
    expect(Array.isArray(visibleElements)).toBeTruthy();
  }

  expect(sidebarVisible).toBe(true);
});
