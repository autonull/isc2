/**
 * ISC Browser E2E Tests
 *
 * Tests complete user flows: channel create, match, chat, posts
 */
import { test, expect } from '@playwright/test';
import { waitForAppReady, waitForMatchesLoaded, waitForPostsLoaded } from './utils/waitHelpers.js';
test.describe('ISC Browser E2E', () => {
    test.beforeEach(async ({ page }) => {
        // Collect console errors
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('Browser error:', msg.text());
            }
        });
        page.on('pageerror', error => {
            console.log('Browser uncaught error:', error.message);
        });
        // Navigate to app and wait for render
        await page.goto('/');
        await waitForAppReady(page, 10000);
    });
    test.describe('Channel Management', () => {
        test('should create a new channel', async ({ page }) => {
            // Navigate to Compose tab using stable test id
            await page.click('[data-testid="nav-tab-compose"]');
            // Fill in channel details
            await page.fill('input[placeholder*="Channel Name"], input[name="name"]', 'AI Ethics');
            await page.fill('textarea[placeholder*="thinking"], textarea[name="description"]', 'Ethical implications of machine learning and autonomy');
            // Add context (location)
            await page.click('button:has-text("Add context"), [data-action="add-context"]');
            await page.fill('input[placeholder*="location"], input[name="location"]', 'Tokyo');
            // Save channel
            await page.click('button:has-text("Save"), button:has-text("Create")');
            // Verify channel was created
            await expect(page.locator('text=AI Ethics')).toBeVisible({ timeout: 5000 });
        });
        test('should switch between channels', async ({ page }) => {
            // Create first channel
            await page.click('[data-testid="nav-tab-compose"]');
            await page.fill('input[name="name"]', 'Channel One');
            await page.fill('textarea[name="description"]', 'First test channel');
            await page.click('button:has-text("Save")');
            // Create second channel
            await page.click('[data-testid="nav-tab-compose"]');
            await page.fill('input[name="name"]', 'Channel Two');
            await page.fill('textarea[name="description"]', 'Second test channel');
            await page.click('button:has-text("Save")');
            // Switch to first channel using sidebar
            await page.click('[data-testid="sidebar-channel-Channel One"], [data-channel-id="Channel One"]');
            // Verify active channel
            await expect(page.locator('text=Channel One')).toBeVisible();
        });
        test('should edit channel description', async ({ page }) => {
            // Create channel
            await page.click('[data-testid="nav-tab-compose"]');
            await page.fill('input[name="name"]', 'Editable Channel');
            await page.fill('textarea[name="description"]', 'Original description');
            await page.click('button:has-text("Save")');
            // Edit channel
            await page.click('[data-action="edit-channel"]');
            await page.fill('textarea[name="description"]', 'Updated description');
            await page.click('button:has-text("Save")');
            // Verify update
            await expect(page.locator('text=Updated description')).toBeVisible();
        });
    });
    test.describe('Semantic Matching', () => {
        test('should display match list on Now tab', async ({ page }) => {
            // Navigate to Now tab using stable test id
            await page.click('[data-testid="nav-tab-now"]');
            // Wait for matches to load
            await waitForMatchesLoaded(page, 5000);
            // Should show match sections or empty state
            const hasMatches = await page.isVisible('[data-section="very-close"], [data-section="nearby"]');
            const hasEmpty = await page.isVisible('text=no matches, text=No one nearby');
            expect(hasMatches || hasEmpty).toBe(true);
        });
        test('should show similarity scores for matches', async ({ page }) => {
            await page.click('[data-testid="nav-tab-now"]');
            await waitForMatchesLoaded(page, 5000);
            // Check for similarity indicators
            const hasSignalBars = await page.isVisible('[data-similarity], text=/▐▌/');
            const hasPercentage = await page.isVisible('text=/\\d+%/, text=/similarity/');
            expect(hasSignalBars || hasPercentage).toBe(true);
        });
        test('should refresh matches on pull-to-refresh', async ({ page }) => {
            await page.click('[data-testid="nav-tab-now"]');
            await waitForMatchesLoaded(page);
            // Pull to refresh (touch gesture simulation)
            await page.evaluate(() => {
                window.scrollTo(0, 0);
                const touchStart = new TouchEvent('touchstart', {
                    touches: [{ clientY: 0 }]
                });
                const touchMove = new TouchEvent('touchmove', {
                    touches: [{ clientY: 150 }]
                });
                document.dispatchEvent(touchStart);
                document.dispatchEvent(touchMove);
            });
            // Should show refreshing indicator
            await expect(page.locator('[data-refreshing], text=Refreshing')).toBeVisible({ timeout: 3000 });
        });
    });
    test.describe('Chat Flow', () => {
        test('should open chat panel from match card', async ({ page }) => {
            await page.click('[data-testid="nav-tab-now"]');
            await waitForMatchesLoaded(page);
            // Click on first match card
            const matchCard = page.locator('[data-component="match-card"]').first();
            if (await matchCard.count() > 0) {
                await matchCard.click();
                // Chat panel should slide up
                await expect(page.locator('[data-panel="chat"], [data-component="chat-panel"]')).toBeVisible();
            }
        });
        test('should send a chat message', async ({ page }) => {
            await page.click('[data-testid="nav-tab-now"]');
            await waitForMatchesLoaded(page);
            const matchCard = page.locator('[data-component="match-card"]').first();
            if (await matchCard.count() > 0) {
                await matchCard.click();
                // Type and send message
                await page.fill('textarea[placeholder*="message"], input[name="message"]', 'Hello!');
                await page.click('button:has-text("Send"), button[type="submit"]');
                // Message should appear in chat
                await expect(page.locator('text=Hello!')).toBeVisible({ timeout: 3000 });
            }
        });
        test('should close chat panel', async ({ page }) => {
            await page.click('[data-testid="nav-tab-now"]');
            await waitForMatchesLoaded(page);
            const matchCard = page.locator('[data-component="match-card"]').first();
            if (await matchCard.count() > 0) {
                await matchCard.click();
                // Close panel
                await page.click('[data-action="close-chat"], button:has-text("Close")');
                // Panel should be hidden
                await expect(page.locator('[data-panel="chat"]')).not.toBeVisible();
            }
        });
    });
    test.describe('Posts & Feed', () => {
        test('should create a post', async ({ page }) => {
            // Navigate to Now tab
            await page.click('[data-tab="now"]');
            // Click compose post button
            await page.click('button:has-text("+ Post"), [data-action="compose-post"]');
            // Fill post content
            await page.fill('textarea[placeholder*="post"], textarea[name="content"]', 'Testing the ISC social layer! #decentralized');
            // Submit post
            await page.click('button:has-text("Post"), button[type="submit"]');
            // Post should appear in feed
            await expect(page.locator('text=Testing the ISC social layer')).toBeVisible({ timeout: 5000 });
        });
        test('should display For You feed', async ({ page }) => {
            await page.click('[data-testid="nav-tab-now"]');
            // Feed should load
            await page.waitForSelector('[data-component="feed"], [data-feed="for-you"]', { timeout: 5000 });
            // Should show posts or empty state
            const hasPosts = await page.isVisible('[data-component="post"]');
            const hasEmpty = await page.isVisible('text=no posts yet, text=No posts');
            expect(hasPosts || hasEmpty).toBe(true);
        });
        test('should like a post', async ({ page }) => {
            await page.click('[data-testid="nav-tab-now"]');
            await waitForPostsLoaded(page);
            const likeButton = page.locator('[data-action="like"]').first();
            if (await likeButton.count() > 0) {
                await likeButton.click();
                // Like count should increment or button should change state
                await expect(likeButton).toHaveAttribute('data-liked', 'true', { timeout: 3000 });
            }
        });
        test('should reply to a post', async ({ page }) => {
            await page.click('[data-testid="nav-tab-now"]');
            await waitForPostsLoaded(page);
            const replyButton = page.locator('[data-action="reply"]').first();
            if (await replyButton.count() > 0) {
                await replyButton.click();
                // Reply box should appear
                await expect(page.locator('textarea[placeholder*="reply"]')).toBeVisible();
                // Type and submit reply
                await page.fill('textarea[placeholder*="reply"]', 'Great point!');
                await page.click('button:has-text("Reply")');
                // Reply count should increment
                await page.waitForTimeout(500); // Minimal wait for UI update
            }
        });
        test('should repost', async ({ page }) => {
            await page.click('[data-testid="nav-tab-now"]');
            await waitForPostsLoaded(page);
            const repostButton = page.locator('[data-action="repost"]').first();
            if (await repostButton.count() > 0) {
                await repostButton.click();
                // Should show confirmation or increment count
                await page.waitForTimeout(500); // Minimal wait for UI update
            }
        });
    });
    test.describe('Navigation', () => {
        test('should navigate between tabs', async ({ page }) => {
            // Now tab
            await page.click('[data-testid="nav-tab-now"]');
            await expect(page.locator('text=Now, h1:has-text("Now")')).toBeVisible();
            // Discover tab
            await page.click('[data-testid="nav-tab-discover"]');
            await expect(page.locator('text=Discover, h1:has-text("Discover")')).toBeVisible();
            // Chats tab
            await page.click('[data-testid="nav-tab-chats"]');
            await expect(page.locator('text=Chats, h1:has-text("Chats")')).toBeVisible();
            // Settings tab
            await page.click('[data-testid="nav-tab-settings"]');
            await expect(page.locator('text=Settings, h1:has-text("Settings")')).toBeVisible();
        });
        test('should show active tab indicator', async ({ page }) => {
            await page.click('[data-testid="nav-tab-now"]');
            await expect(page.locator('[data-testid="nav-tab-now"][data-active="true"], [aria-selected="true"]')).toBeVisible();
            await page.click('[data-testid="nav-tab-discover"]');
            await expect(page.locator('[data-testid="nav-tab-discover"][data-active="true"], [aria-selected="true"]')).toBeVisible();
        });
    });
    test.describe('PWA Features', () => {
        test('should have valid manifest', async ({ page }) => {
            const manifestLink = page.locator('link[rel="manifest"]');
            await expect(manifestLink).toHaveAttribute('href');
            const manifestHref = await manifestLink.getAttribute('href');
            const response = await page.request.get(manifestHref);
            expect(response.ok()).toBe(true);
            const manifest = await response.json();
            expect(manifest.name).toContain('ISC');
            expect(manifest.display).toBe('standalone');
        });
        test('should be installable', async ({ page }) => {
            // Check for service worker registration
            const hasServiceWorker = await page.evaluate(() => {
                return 'serviceWorker' in navigator;
            });
            expect(hasServiceWorker).toBe(true);
        });
        test('should work offline after caching', async ({ page, context }) => {
            // Go online first to cache resources
            await page.goto('/');
            await waitForAppReady(page, 5000);
            // Go offline
            await context.setOffline(true);
            // Reload should still work (cached)
            await page.reload();
            await expect(page.locator('#app')).toBeVisible({ timeout: 5000 });
            // Go back online
            await context.setOffline(false);
        });
    });
    test.describe('Accessibility', () => {
        test('should have proper heading structure', async ({ page }) => {
            await page.click('[data-testid="nav-tab-now"]');
            // Should have exactly one h1
            const h1Count = await page.locator('h1').count();
            expect(h1Count).toBe(1);
        });
        test('should have accessible button labels', async ({ page }) => {
            const buttons = page.locator('button');
            const count = await buttons.count();
            for (let i = 0; i < Math.min(count, 10); i++) {
                const button = buttons.nth(i);
                const hasText = await button.textContent();
                const hasAriaLabel = await button.getAttribute('aria-label');
                expect(hasText || hasAriaLabel).toBeTruthy();
            }
        });
        test('should support keyboard navigation', async ({ page }) => {
            // Tab through interactive elements
            await page.keyboard.press('Tab');
            await page.keyboard.press('Tab');
            await page.keyboard.press('Tab');
            // Focused element should be visible
            const focusedElement = page.locator(':focus');
            await expect(focusedElement).toBeVisible();
        });
    });
});
//# sourceMappingURL=browser-flows.spec.js.map