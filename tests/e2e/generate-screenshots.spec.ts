import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Screenshot Generation', () => {
  test('Generate full UI snapshots', async ({ page }) => {
    const screenshotDir = path.join(process.cwd(), 'screenshots', 'generated');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    // Skip onboarding
    await page.addInitScript(() => {
      localStorage.setItem('isc-onboarding-completed', 'true');
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    // Wait fully for the Preact UI to render
    await page.waitForSelector('#app', { state: 'attached' });
    await page.waitForTimeout(3000); // Give IndexedDB time to initialize identity

    // Screenshot: Main Feed (Now)
    await page.screenshot({ path: path.join(screenshotDir, '1_now_tab.png'), fullPage: true });

    // Navigate to Compose/Create Channel modal and screenshot
    const composeBtn = page.locator('[data-testid="create-channel-button"], button:has-text("+ Post"), button:has-text("+ New Channel")').first();
    if (await composeBtn.count() > 0) {
      await composeBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(screenshotDir, '2_compose_modal.png'), fullPage: true });

      // Close modal
      const closeBtn = page.locator('button:has-text("Cancel"), button:has-text("✕")').first();
      if (await closeBtn.count() > 0) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // Navigate to Discover
    const discoverTab = page.locator('[data-testid="nav-tab-discover"]').first();
    if (await discoverTab.count() > 0) {
      await discoverTab.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(screenshotDir, '3_discover_tab.png'), fullPage: true });
    }

    // Navigate to Settings
    const settingsTab = page.locator('[data-testid="nav-tab-settings"]').first();
    if (await settingsTab.count() > 0) {
      await settingsTab.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(screenshotDir, '4_settings_tab.png'), fullPage: true });
    }

    console.log(`\n✅ Screenshots generated successfully in: ${screenshotDir}`);
  });
});
