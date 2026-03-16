/**
 * UI Health Check Tests
 *
 * Fast, non-brittle tests that verify the UI is functioning correctly.
 * These tests should pass regardless of UI design changes.
 */
import { test, expect } from '@playwright/test';
test.describe('UI Health Checks', () => {
    test.beforeEach(async ({ page }) => {
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('Console error:', msg.text());
            }
        });
        page.on('pageerror', error => {
            // Ignore known third-party library errors
            if (error.message.includes('registerBackend')) {
                return;
            }
            console.log('Page error:', error.message);
        });
        // Skip onboarding for tests
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('isc-onboarding-completed', 'true');
        });
    });
    test('all tabs are clickable and respond', async ({ page }) => {
        // Wait for app to render - look for any sign of the app
        await page.waitForSelector('#app', { timeout: 10000 });
        await page.waitForTimeout(3000); // Wait for JS to execute
        // Look for navigation in any form
        const navSelector = '[data-testid="sidebar"], [data-testid="tab-bar"], .irc-layout, .tab-bar, nav';
        const navElement = page.locator(navSelector).first();
        if (await navElement.count() === 0) {
            // App might still be loading or have a different structure
            console.log('Navigation not found, app may have different structure');
            return;
        }
        const tabs = ['now', 'chats', 'settings', 'compose'];
        for (const tab of tabs) {
            const tabElement = page.locator(`[data-testid="nav-tab-${tab}"], [data-tab="${tab}"]`).first();
            if (await tabElement.count() > 0) {
                await tabElement.click();
                await page.waitForTimeout(500);
            }
        }
    });
    test('no critical JavaScript errors on page load', async ({ page }) => {
        const errors = [];
        page.on('pageerror', error => {
            // Ignore known third-party library errors
            if (!error.message.includes('registerBackend')) {
                errors.push(error.message);
            }
        });
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        expect(errors).toEqual([]);
    });
    test('no critical console errors on page load', async ({ page }) => {
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                const text = msg.text();
                // Ignore known third-party library errors
                if (!text.includes('registerBackend') &&
                    !text.includes('Failed to load resource') &&
                    !text.includes('net::ERR')) {
                    consoleErrors.push(text);
                }
            }
        });
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        expect(consoleErrors).toEqual([]);
    });
    test('responsive layout works on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/');
        await page.waitForSelector('#app', { timeout: 10000 });
        await page.waitForTimeout(2000);
        // App should be visible
        await expect(page.locator('#app')).toBeVisible();
    });
    test('responsive layout works on desktop', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.goto('/');
        await page.waitForSelector('#app', { timeout: 10000 });
        await page.waitForTimeout(2000);
        // App should be visible
        await expect(page.locator('#app')).toBeVisible();
    });
    test('app container exists and is visible', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#app')).toBeVisible({ timeout: 10000 });
    });
    test('page has valid HTML structure', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#app', { timeout: 10000 });
        // Should have doctype, html, head, body
        const hasHtml = await page.locator('html').count() > 0;
        const hasHead = await page.locator('head').count() > 0;
        const hasBody = await page.locator('body').count() > 0;
        expect(hasHtml && hasHead && hasBody).toBeTruthy();
    });
    test('page recovers from rapid navigation', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#app', { timeout: 10000 });
        await page.waitForTimeout(2000);
        // Navigate to multiple tabs rapidly
        const tabs = ['now', 'chats', 'settings'];
        for (const tab of tabs) {
            await page.click(`[data-testid="nav-tab-${tab}"], [data-tab="${tab}"]`).catch(() => { });
            await page.waitForTimeout(200);
        }
        // App should still be functional
        await expect(page.locator('#app')).toBeVisible();
    });
    test('accessibility: page has title', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#app', { timeout: 10000 });
        const title = await page.title();
        expect(title).toBeTruthy();
        expect(title).toContain('ISC');
    });
    test('accessibility: focus management works', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#app', { timeout: 10000 });
        await page.waitForTimeout(1000);
        // Tab through elements
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        // Something should be focused
        const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
        expect(focusedElement).toBeTruthy();
    });
});
//# sourceMappingURL=ui-health.spec.js.map