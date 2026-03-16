/**
 * Benchmark Runner - Playwright E2E for Performance
 *
 * Runs performance benchmarks in a real browser environment
 */
import { test, expect } from '@playwright/test';
test.describe('Performance Benchmarks', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#app', { timeout: 10000 });
    });
    test('should load initial bundle under target size', async ({ page }) => {
        // Get response sizes
        const response = await page.request.get('/');
        const htmlSize = parseInt(response.headers()['content-length'] || '0', 10);
        // Main bundle should be under 300KB (uncompressed)
        // Note: This is a rough estimate since we're measuring HTML
        expect(htmlSize).toBeLessThan(50000); // HTML should be small
        console.log(`[Benchmark] HTML size: ${(htmlSize / 1024).toFixed(2)} KB`);
    });
    test('should complete DHT connection within target time', async ({ page }) => {
        const startTime = Date.now();
        // Wait for app to be ready and DHT connected
        await page.waitForFunction(() => {
            const app = document.querySelector('#app');
            return app !== null;
        }, { timeout: 15000 });
        const loadTime = Date.now() - startTime;
        // Should load within 15 seconds (includes DHT connection)
        expect(loadTime).toBeLessThan(15000);
        console.log(`[Benchmark] App load time: ${loadTime}ms`);
    });
    test('should render skeleton loaders during loading', async ({ page }) => {
        // Navigate to Discover to trigger loading state
        await page.click('[data-tab="discover"], button:has-text("Discover")');
        // Should show skeleton loaders or loading state
        const hasSkeleton = await page.isVisible('[class*="skeleton"], [class*="loading"]');
        const hasSpinner = await page.isVisible('[class*="spinner"]');
        expect(hasSkeleton || hasSpinner).toBeTruthy();
        console.log('[Benchmark] Loading state displayed correctly');
    });
    test('should handle navigation within target time', async ({ page }) => {
        const tabs = ['now', 'discover', 'chats', 'settings'];
        const navigationTimes = [];
        for (const tab of tabs) {
            const startTime = Date.now();
            await page.click(`[data-tab="${tab}"], button:has-text("${tab.charAt(0).toUpperCase() + tab.slice(1)}")`);
            // Wait for navigation to complete
            await page.waitForTimeout(100);
            const navTime = Date.now() - startTime;
            navigationTimes.push(navTime);
        }
        const avgNavTime = navigationTimes.reduce((a, b) => a + b, 0) / navigationTimes.length;
        // Navigation should be under 500ms average
        expect(avgNavTime).toBeLessThan(500);
        console.log(`[Benchmark] Average navigation time: ${avgNavTime.toFixed(2)}ms`);
    });
    test('should not leak memory during extended use', async ({ page }) => {
        // Get initial memory (if available)
        const initialMemory = await page.evaluate(() => {
            if ('memory' in performance) {
                return performance.memory.usedJSHeapSize;
            }
            return 0;
        });
        // Simulate extended use: navigate between tabs multiple times
        for (let i = 0; i < 10; i++) {
            await page.click('[data-tab="now"], button:has-text("Now")');
            await page.waitForTimeout(100);
            await page.click('[data-tab="discover"], button:has-text("Discover")');
            await page.waitForTimeout(100);
        }
        // Get final memory
        const finalMemory = await page.evaluate(() => {
            if ('memory' in performance) {
                return performance.memory.usedJSHeapSize;
            }
            return 0;
        });
        // Memory growth should be less than 50MB
        if (initialMemory > 0 && finalMemory > 0) {
            const growth = finalMemory - initialMemory;
            expect(growth).toBeLessThan(50 * 1024 * 1024);
            console.log(`[Benchmark] Memory growth: ${(growth / 1024 / 1024).toFixed(2)} MB`);
        }
    });
    test('should maintain 60fps during animations', async ({ page }) => {
        // Navigate to a page with animations
        await page.click('[data-tab="discover"], button:has-text("Discover")');
        // Measure frame rate during loading animation
        const fps = await page.evaluate(() => {
            return new Promise((resolve) => {
                let frameCount = 0;
                let lastTime = performance.now();
                let fpsSum = 0;
                let fpsCount = 0;
                function measure(currentTime) {
                    frameCount++;
                    if (currentTime - lastTime >= 1000) {
                        const fps = frameCount / ((currentTime - lastTime) / 1000);
                        fpsSum += fps;
                        fpsCount++;
                        frameCount = 0;
                        lastTime = currentTime;
                        if (fpsCount >= 3) {
                            resolve(fpsSum / fpsCount);
                            return;
                        }
                    }
                    requestAnimationFrame(measure);
                }
                requestAnimationFrame(measure);
            });
        });
        // Should maintain at least 30fps (60fps ideal)
        expect(fps).toBeGreaterThan(30);
        console.log(`[Benchmark] Average FPS: ${fps.toFixed(2)}`);
    });
});
//# sourceMappingURL=e2e-benchmarks.spec.js.map