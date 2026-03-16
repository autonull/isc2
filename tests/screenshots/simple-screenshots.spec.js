/**
 * ISC Web UI - Simple Screenshot Capture
 */
import { test } from '@playwright/test';
test.describe('ISC Screenshots', () => {
    test('Capture all screens', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);
        // 1. Now Screen (default)
        console.log('📸 Capturing Now screen...');
        await page.screenshot({ path: 'screenshots/now-screen.png', fullPage: true });
        // 2. Click Discover
        console.log('📸 Capturing Discover screen...');
        await page.click('text=📡');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'screenshots/discover-screen.png', fullPage: true });
        // 3. Click Compose  
        console.log('📸 Capturing Compose screen...');
        await page.click('[data-tab="compose"]');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'screenshots/compose-screen.png', fullPage: true });
        // 4. Click Settings
        console.log('📸 Capturing Settings screen...');
        await page.click('[data-tab="settings"]');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'screenshots/settings-screen.png', fullPage: true });
        // 5. Press ? for keyboard help
        console.log('📸 Capturing Keyboard help...');
        await page.keyboard.press('?');
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'screenshots/keyboard-help.png', fullPage: true });
        // 6. Close modal and capture sidebar focus
        console.log('📸 Capturing Navigation...');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'screenshots/navigation.png', fullPage: false });
        console.log('✅ All screenshots captured!');
    });
});
//# sourceMappingURL=simple-screenshots.spec.js.map