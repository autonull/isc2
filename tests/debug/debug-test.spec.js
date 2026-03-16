/**
 * Debug Test - Check if app loads
 */
import { test, expect } from '@playwright/test';
test('App should load and show sidebar', async ({ page }) => {
    // Capture all console messages
    const messages = [];
    page.on('console', msg => {
        messages.push(`${msg.type()}: ${msg.text()}`);
    });
    page.on('pageerror', err => {
        messages.push(`PAGE ERROR: ${err.message}`);
        messages.push(`Stack: ${err.stack}`);
    });
    await page.goto('/');
    // Wait for network to be idle
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(8000);
    // Take a screenshot
    await page.screenshot({ path: 'test-results/debug-page.png', fullPage: true });
    // Get all messages
    console.log('All console messages:', messages);
    // Check for JS errors in the page
    const jsErrors = await page.evaluate(() => {
        return window.__jsErrors || [];
    });
    console.log('JS errors from page:', jsErrors);
    // Check if app div has content
    const appContent = await page.innerHTML('#app').catch(() => 'NOT FOUND');
    console.log('App innerHTML length:', appContent.length);
    console.log('App innerHTML (first 200 chars):', appContent.substring(0, 200));
    // Check for any rendered elements
    const elementCount = await page.evaluate(() => {
        return document.body.querySelectorAll('*').length;
    });
    console.log('Total elements on page:', elementCount);
    // Check for sidebar
    const sidebar = page.locator('[data-testid="sidebar"]');
    const sidebarVisible = await sidebar.isVisible().catch(() => false);
    console.log('Sidebar visible:', sidebarVisible);
    // If sidebar not visible, find what IS visible
    if (!sidebarVisible) {
        const visibleElements = await page.evaluate(() => {
            const elements = [];
            document.querySelectorAll('*').forEach(el => {
                const style = window.getComputedStyle(el);
                if (style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0) {
                    elements.push(el.tagName + (el.className ? '.' + el.className.split(' ').join('.') : '') + (el.id ? '#' + el.id : ''));
                }
            });
            return elements.slice(0, 20);
        });
        console.log('Visible elements:', visibleElements);
    }
    expect(sidebarVisible).toBe(true);
});
//# sourceMappingURL=debug-test.spec.js.map