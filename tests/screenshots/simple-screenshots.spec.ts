/**
 * ISC Web UI - Simple Screenshot Capture
 */

import { test } from '@playwright/test';

test.describe('ISC Screenshots', () => {
  test('Capture all screens', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // 1. Now Screen (default) - capturing
    await page.screenshot({ path: 'screenshots/now-screen.png', fullPage: true });

    // 2. Click Discover - capturing
    await page.click('text=📡');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/discover-screen.png', fullPage: true });

    // 3. Click Compose - capturing
    await page.click('[data-tab="compose"]');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/compose-screen.png', fullPage: true });

    // 4. Click Settings - capturing
    await page.click('[data-tab="settings"]');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/settings-screen.png', fullPage: true });

    // 5. Press ? for keyboard help - capturing
    await page.keyboard.press('?');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/keyboard-help.png', fullPage: true });

    // 6. Close modal and capture sidebar focus - capturing
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/navigation.png', fullPage: false });

    // All screenshots captured
  });
});
