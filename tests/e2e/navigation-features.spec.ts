/**
 * Navigation & New Features E2E Tests
 */

import { test, expect } from '@playwright/test';
import { createNavigationHelper } from '../utils/navigation';

test.describe('Navigation Helper', () => {
  test('should navigate to all main screens', async ({ page }) => {
    const nav = createNavigationHelper(page);

    await nav.goTo('/now');
    await nav.assertRoute('/now');
    await expect(page.locator('[data-testid="now-screen"]')).toBeVisible();

    await nav.goTo('/chats');
    await nav.assertRoute('/chats');
    await expect(page.locator('[data-testid="chats-screen"]')).toBeVisible();

    await nav.goTo('/settings');
    await nav.assertRoute('/settings');
    await expect(page.locator('[data-testid="settings-screen"]')).toBeVisible();
  });

  test('should navigate via sidebar', async ({ page }) => {
    const nav = createNavigationHelper(page);

    await nav.navigateViaSidebar('/now');
    await nav.assertRoute('/now');
    await nav.waitForNavActive('/now');
  });

  test('should track active navigation state', async ({ page }) => {
    const nav = createNavigationHelper(page);

    await nav.goTo('/now');
    expect(await nav.isNavActive('/now')).toBe(true);
  });
});

test.describe('Feed Features', () => {
  test('should render posts with lazy loading', async ({ page }) => {
    await page.goto('#/now');
    await expect(page.locator('[data-testid="feed-container"]')).toBeVisible();

    const posts = page.locator('[data-component="post"]');
    const count = await posts.count();

    if (count > 0) {
      await expect(posts.first()).toHaveAttribute('data-lazy', 'true');
    }
  });

  test('should support keyboard navigation in feed', async ({ page }) => {
    await page.goto('#/now');
    const feed = page.locator('#now-feed');
    await expect(feed).toBeVisible();

    const posts = feed.locator('.post-card[tabindex="0"]');
    await posts.first().focus();
    await page.keyboard.press('ArrowDown');

    const allPosts = await posts.all();
    if (allPosts.length > 1) {
      const secondPostFocused = await allPosts[1].evaluate((el) => el === document.activeElement);
      expect(secondPostFocused).toBe(true);
    }
  });
});

test.describe('Settings Features', () => {
  test('should show Advanced section', async ({ page }) => {
    await page.goto('#/settings');
    await expect(page.locator('[data-testid="advanced-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="demo-mode-toggle"]')).toBeVisible();
    await expect(page.locator('[data-testid="chaos-toggle"]')).toBeVisible();
    await expect(page.locator('[data-testid="thoughttwin-toggle"]')).toBeVisible();
  });

  test('should show Moderation section', async ({ page }) => {
    await page.goto('#/settings');
    await expect(page.locator('[data-testid="moderation-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="blocked-peers-list"]')).toBeVisible();
  });

  test('should show Share section', async ({ page }) => {
    await page.goto('#/settings');
    await expect(page.locator('[data-testid="share-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="invite-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="share-twitter"]')).toBeVisible();
    await expect(page.locator('[data-testid="share-mastodon"]')).toBeVisible();
    await expect(page.locator('[data-testid="share-email"]')).toBeVisible();
  });
});

test.describe('Accessibility Features', () => {
  test('should have ARIA live region', async ({ page }) => {
    await page.goto('#/now');
    const liveRegion = page.locator('#aria-live-region');
    await expect(liveRegion).toBeVisible();
    await expect(liveRegion).toHaveAttribute('role', 'status');
    await expect(liveRegion).toHaveAttribute('aria-live', 'polite');
  });

  test('should have proper focus management on navigation', async ({ page }) => {
    const nav = createNavigationHelper(page);
    await nav.goTo('/now');
    await expect(page.locator('#main-content')).toBeFocused();
  });

  test('should have visible focus rings', async ({ page }) => {
    await page.goto('#/settings');
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
  });
});

// Peer profile modal is now accessible via message sender taps in the Channel screen.
// No separate Discover screen — test removed per Phase 3.3.

test.describe('Chat More Menu', () => {
  test('should show file transfer options', async ({ page }) => {
    await page.goto('#/chats');
    await expect(page.locator('[data-testid="chat-panel"]')).toBeVisible();

    const moreBtn = page.locator('[data-testid="chat-more-btn"]');
    if (await moreBtn.isVisible()) {
      await moreBtn.click();
      await expect(page.locator('[data-testid="send-file-action"]')).toBeVisible();
      await expect(page.locator('[data-testid="send-photo-action"]')).toBeVisible();
      await page.locator('[data-action="cancel"]').click();
    }
  });
});
