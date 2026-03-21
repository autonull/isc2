/**
 * N2/N3: Navigation & New Features E2E Tests
 *
 * Tests for navigation helpers and recently implemented features:
 * - Reply threads (E1)
 * - Like persistence (E5)
 * - Peer profile modal (H1)
 * - Block/unblock peers (J1)
 * - Advanced settings (I1)
 * - Keyboard navigation (L3)
 * - Lazy loading (M1)
 */

import { test, expect } from '@playwright/test';
import { createNavigationHelper } from '../utils/navigation';

test.describe('Navigation Helper', () => {
  test('should navigate to all main screens', async ({ page }) => {
    const nav = createNavigationHelper(page);
    
    // Test each main route
    await nav.goTo('/now');
    await nav.assertRoute('/now');
    await expect(page.locator('[data-testid="now-screen"]')).toBeVisible();

    await nav.goTo('/discover');
    await nav.assertRoute('/discover');
    await expect(page.locator('[data-testid="discover-screen"]')).toBeVisible();

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

    await nav.navigateViaSidebar('/discover');
    await nav.assertRoute('/discover');
    await nav.waitForNavActive('/discover');
  });

  test('should track active navigation state', async ({ page }) => {
    const nav = createNavigationHelper(page);
    
    await nav.goTo('/now');
    expect(await nav.isNavActive('/now')).toBe(true);
    expect(await nav.isNavActive('/discover')).toBe(false);
  });
});

test.describe('Feed Features', () => {
  test('should render posts with lazy loading', async ({ page }) => {
    await page.goto('#/now');
    
    // Wait for feed to load
    await expect(page.locator('[data-testid="feed-container"]')).toBeVisible();
    
    // Check for lazy loading attribute on posts
    const posts = page.locator('[data-component="post"]');
    const count = await posts.count();
    
    if (count > 0) {
      // At least some posts should have lazy loading
      const firstPost = posts.first();
      await expect(firstPost).toHaveAttribute('data-lazy', 'true');
    }
  });

  test('should support keyboard navigation in feed', async ({ page }) => {
    await page.goto('#/now');
    
    const feed = page.locator('#now-feed');
    await expect(feed).toBeVisible();
    
    // Focus first post
    const posts = feed.locator('.post-card[tabindex="0"]');
    const firstPost = posts.first();
    await firstPost.focus();
    
    // Press ArrowDown to navigate
    await page.keyboard.press('ArrowDown');
    
    // Second post should be focused
    const allPosts = await posts.all();
    if (allPosts.length > 1) {
      const secondPostFocused = await allPosts[1].evaluate(
        (el) => el === document.activeElement
      );
      expect(secondPostFocused).toBe(true);
    }
  });
});

test.describe('Settings Features', () => {
  test('should show Advanced section', async ({ page }) => {
    await page.goto('#/settings');
    
    // Check for Advanced section
    const advancedSection = page.locator('[data-testid="advanced-section"]');
    await expect(advancedSection).toBeVisible();
    
    // Check for demo mode toggle
    await expect(page.locator('[data-testid="demo-mode-toggle"]')).toBeVisible();
    
    // Check for chaos toggle
    await expect(page.locator('[data-testid="chaos-toggle"]')).toBeVisible();
    
    // Check for ThoughtTwin toggle
    await expect(page.locator('[data-testid="thoughttwin-toggle"]')).toBeVisible();
  });

  test('should show Moderation section', async ({ page }) => {
    await page.goto('#/settings');
    
    // Check for moderation section
    const moderationSection = page.locator('[data-testid="moderation-section"]');
    await expect(moderationSection).toBeVisible();
    
    // Should have blocked peers list (may be empty)
    await expect(page.locator('[data-testid="blocked-peers-list"]')).toBeVisible();
  });

  test('should show Share section', async ({ page }) => {
    await page.goto('#/settings');
    
    // Check for share section
    const shareSection = page.locator('[data-testid="share-section"]');
    await expect(shareSection).toBeVisible();
    
    // Check for invite link display
    await expect(page.locator('[data-testid="invite-link"]')).toBeVisible();
    
    // Check for share buttons
    await expect(page.locator('[data-testid="share-twitter"]')).toBeVisible();
    await expect(page.locator('[data-testid="share-mastodon"]')).toBeVisible();
    await expect(page.locator('[data-testid="share-email"]')).toBeVisible();
  });
});

test.describe('Accessibility Features', () => {
  test('should have ARIA live region', async ({ page }) => {
    await page.goto('#/now');
    
    // Check for ARIA live region
    const liveRegion = page.locator('#aria-live-region');
    await expect(liveRegion).toBeVisible();
    await expect(liveRegion).toHaveAttribute('role', 'status');
    await expect(liveRegion).toHaveAttribute('aria-live', 'polite');
  });

  test('should have proper focus management on navigation', async ({ page }) => {
    const nav = createNavigationHelper(page);
    
    await nav.goTo('/now');
    
    // Main content should receive focus
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeFocused();
  });

  test('should have visible focus rings', async ({ page }) => {
    await page.goto('#/settings');
    
    // Tab to first focusable element
    await page.keyboard.press('Tab');
    
    // Focused element should have visible focus
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });
});

test.describe('Peer Profile Modal', () => {
  test('should be accessible from discover screen', async ({ page }) => {
    await page.goto('#/discover');
    
    // Wait for discover content
    await expect(page.locator('[data-testid="discover-content"]')).toBeVisible();
    
    // Click on a match card if available
    const matchCards = page.locator('[data-component="match-card"]');
    const count = await matchCards.count();
    
    if (count > 0) {
      await matchCards.first().click();
      
      // Peer profile modal should appear
      await expect(page.locator('[data-testid="peer-profile-modal"]')).toBeVisible();
      
      // Should have block button
      await expect(page.locator('[data-action="block"]')).toBeVisible();
      
      // Close modal
      await page.locator('[data-testid="modal-close"]').click();
      await expect(page.locator('[data-testid="peer-profile-modal"]')).not.toBeVisible();
    }
  });
});

test.describe('Chat More Menu', () => {
  test('should show file transfer options', async ({ page }) => {
    await page.goto('#/chats');
    
    // Wait for chat panel
    await expect(page.locator('[data-testid="chat-panel"]')).toBeVisible();
    
    // Click more button if visible
    const moreBtn = page.locator('[data-testid="chat-more-btn"]');
    const isVisible = await moreBtn.isVisible();
    
    if (isVisible) {
      await moreBtn.click();
      
      // Should show send file option
      await expect(page.locator('[data-testid="send-file-action"]')).toBeVisible();
      await expect(page.locator('[data-testid="send-photo-action"]')).toBeVisible();
      
      // Close modal
      await page.locator('[data-action="cancel"]').click();
    }
  });
});
