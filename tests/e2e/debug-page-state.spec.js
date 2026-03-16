/**
 * Debug Test - Capture actual page state
 */
import { test, expect } from '@playwright/test';
test.describe('DEBUG: Capture page state', () => {
    test('capture full page HTML and JS state', async ({ page }) => {
        const errors = [];
        const logs = [];
        // Capture ALL console messages
        page.on('console', msg => {
            const text = msg.text();
            logs.push(`[${msg.type()}] ${text}`);
            if (msg.type() === 'error') {
                errors.push(text);
                console.error('CONSOLE ERROR:', text);
            }
        });
        // Capture ALL page errors
        page.on('pageerror', error => {
            errors.push(error.message);
            console.error('PAGE ERROR:', error.message);
        });
        // Capture failed requests
        page.on('requestfailed', request => {
            const err = request.failure();
            errors.push(`Request failed: ${request.url()} - ${err?.errorText}`);
            console.error('REQUEST FAILED:', request.url(), err?.errorText);
        });
        // Log all responses
        page.on('response', res => {
            const url = res.url();
            const status = res.status();
            const headers = res.headers();
            if (url.includes('index.tsx') || url.includes('App.tsx')) {
                console.log(`RESPONSE: ${status} ${url}`);
                console.log(`  Content-Type: ${headers['content-type']}`);
            }
            if (status >= 400) {
                console.log(`ERROR RESPONSE: ${status} ${url}`);
            }
        });
        await page.goto('/', { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(15000); // Wait even longer
        // Get full HTML
        const html = await page.content();
        console.log('\n=== FULL HTML (first 2000 chars) ===\n');
        console.log(html.substring(0, 2000));
        console.log('\n=== END HTML ===\n');
        // Check if app div has content
        const appInner = await page.locator('#app').innerHTML();
        console.log('\n=== APP INNER HTML ===\n');
        console.log(appInner || '(empty)');
        console.log('\n=== END APP INNER ===\n');
        // Check for any elements inside app
        const childCount = await page.locator('#app > *').count();
        console.log(`\nChild elements in #app: ${childCount}\n`);
        // Report errors
        console.log('\n=== ALL LOGS ===\n');
        logs.forEach(l => console.log(l));
        console.log('\n=== END LOGS ===\n');
        console.log('\n=== ERRORS ===\n');
        if (errors.length > 0) {
            errors.forEach(e => console.log('ERROR:', e));
        }
        else {
            console.log('No errors captured');
        }
        console.log('\n=== END ERRORS ===\n');
        // Take full screenshot
        await page.screenshot({ path: 'test-results/debug-full-page.png', fullPage: true });
        expect(childCount).toBeGreaterThan(0);
    });
});
//# sourceMappingURL=debug-page-state.spec.js.map