/**
 * Visual Regression Tests
 *
 * Captures screenshots of key UI states and compares them across changes.
 * Run with: pnpm test:visual
 * 
 * To update baselines: pnpm test:visual --update-snapshots
 */

import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('isc-onboarding-completed', 'true'));
    page.on('pageerror', error => {
      // Ignore known third-party errors
      if (!error.message.includes('registerBackend')) {
        console.log('Page error:', error.message);
      }
    });
  });

  test.describe('Desktop Layout (1280x720)', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('isc-onboarding-completed', 'true'));
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/');
      await page.waitForSelector('#app', { timeout: 10000 });
      await page.waitForTimeout(2000); // Wait for animations
    });

    test('main layout', async ({ page }) => {
      await expect(page).toHaveScreenshot('desktop-main.png', {
        fullPage: true,
        maxDiffPixels: 500, // Allow minor differences
      });
    });

    test('now tab', async ({ page }) => {
      const nowTab = page.locator('[data-testid="nav-tab-now"], [data-tab="now"]').first();
      if (await nowTab.count() > 0) {
        await nowTab.click();
        await page.waitForTimeout(1000);
      }
      await expect(page).toHaveScreenshot('desktop-now-tab.png', {
        maxDiffPixels: 300,
      });
    });

    test('chats tab', async ({ page }) => {
      const chatsTab = page.locator('[data-testid="nav-tab-chats"], [data-tab="chats"]').first();
      if (await chatsTab.count() > 0) {
        await chatsTab.click();
        await page.waitForTimeout(1000);
      }
      await expect(page).toHaveScreenshot('desktop-chats-tab.png', {
        maxDiffPixels: 300,
      });
    });

    test('settings tab', async ({ page }) => {
      const settingsTab = page.locator('[data-testid="nav-tab-settings"], [data-tab="settings"]').first();
      if (await settingsTab.count() > 0) {
        await settingsTab.click();
        await page.waitForTimeout(1000);
      }
      await expect(page).toHaveScreenshot('desktop-settings-tab.png', {
        maxDiffPixels: 300,
      });
    });

    test('compose tab', async ({ page }) => {
      const composeTab = page.locator('[data-testid="nav-tab-compose"], [data-tab="compose"]').first();
      if (await composeTab.count() > 0) {
        await composeTab.click();
        await page.waitForTimeout(1000);
      }
      await expect(page).toHaveScreenshot('desktop-compose-tab.png', {
        maxDiffPixels: 300,
      });
    });
  });

  test.describe('Mobile Layout (375x667)', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('isc-onboarding-completed', 'true'));
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      await page.waitForSelector('#app', { timeout: 10000 });
      await page.waitForTimeout(2000);
    });

    test('main layout', async ({ page }) => {
      await expect(page).toHaveScreenshot('mobile-main.png', {
        fullPage: true,
        maxDiffPixels: 500,
      });
    });

    test('now tab', async ({ page }) => {
      const nowTab = page.locator('[data-testid="nav-tab-now"], [data-tab="now"]').first();
      if (await nowTab.count() > 0) {
        await nowTab.click();
        await page.waitForTimeout(1000);
      }
      await expect(page).toHaveScreenshot('mobile-now-tab.png', {
        maxDiffPixels: 300,
      });
    });

    test('bottom tab bar visible', async ({ page }) => {
      const tabBar = page.locator('[data-testid="tab-bar"], .tab-bar').first();
      if (await tabBar.count() > 0) {
        await expect(tabBar).toBeVisible();
        await expect(tabBar).toHaveScreenshot('mobile-tab-bar.png', {
          maxDiffPixels: 100,
        });
      }
    });
  });

  test.describe('Tablet Layout (768x1024)', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('isc-onboarding-completed', 'true'));
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');
      await page.waitForSelector('#app', { timeout: 10000 });
      await page.waitForTimeout(2000);
    });

    test('main layout', async ({ page }) => {
      await expect(page).toHaveScreenshot('tablet-main.png', {
        fullPage: true,
        maxDiffPixels: 500,
      });
    });
  });

  test.describe('Component States', () => {
    test('error boundary display', async ({ page }) => {
      // Trigger an error by evaluating invalid JS
      await page.goto('/');
      await page.waitForSelector('#app', { timeout: 10000 });
      
      // Force an error in a child component
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('isc-test-error'));
      });
      
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('error-state.png', {
        maxDiffPixels: 200,
      });
    });

    test('loading state', async ({ page }) => {
      await page.goto('/');
      // Capture during initial load
      await expect(page).toHaveScreenshot('loading-state.png', {
        maxDiffPixels: 300,
      });
    });
  });

  test.describe('Dark/Light Mode', () => {
    test('light mode (default)', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/');
      await page.waitForSelector('#app', { timeout: 10000 });
      await page.waitForTimeout(1000);
      
      await expect(page).toHaveScreenshot('light-mode.png', {
        maxDiffPixels: 300,
      });
    });

    test('dark mode', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/');
      await page.waitForSelector('#app', { timeout: 10000 });
      
      // Enable dark mode via CSS media query emulation
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.waitForTimeout(1000);
      
      await expect(page).toHaveScreenshot('dark-mode.png', {
        maxDiffPixels: 300,
      });
    });
  });
});
