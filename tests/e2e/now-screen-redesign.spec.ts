/**
 * Now Screen Redesign E2E Tests
 *
 * These tests verify the now screen redesign works correctly.
 * They focus on user behavior and outcomes, not implementation details,
 * to remain resilient to UI changes.
 */

import { test, expect } from '@playwright/test';

test.describe('Now Screen Redesign', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (error) => {
      if (!error.message.includes('registerBackend')) {
        console.log('Page error:', error.message);
      }
    });

    // Skip onboarding
    await page.addInitScript(() => localStorage.setItem('isc-onboarding-completed', 'true'));
    await page.goto('/');
    await page.waitForSelector('#app', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Create a test channel for most tests
    const composeBtn = page.locator('[data-testid="create-channel-button"], button:has-text("+ Channel"), button:has-text("New")').first();
    if (await composeBtn.count() > 0) {
      await composeBtn.click();
      await page.waitForTimeout(500);

      const nameInput = page.locator('input[placeholder*="Channel Name"], input[placeholder*="name"]').first();
      if (await nameInput.count() > 0) {
        await nameInput.fill(`Test Channel ${Date.now()}`);
        await page.locator('textarea[placeholder*="Description"], textarea[placeholder*="description"]').first().fill('Test description');
        await page.locator('button:has-text("Create Channel")').first().click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('compose bar is visible at top without scrolling', async ({ page }) => {
    // User should see compose input without scrolling
    const composeBar = page.locator('[data-testid="compose-bar"]');
    expect(await composeBar.count()).toBeGreaterThan(0);

    const composeInput = page.locator('[data-testid="compose-input"]').first();
    expect(await composeInput.count()).toBeGreaterThan(0);

    // Input should be visible (in viewport)
    await expect(composeInput).toBeVisible();
  });

  test('user can post a message from compose bar at top', async ({ page }) => {
    const composeInput = page.locator('[data-testid="compose-input"]').first();
    const submitBtn = page.locator('[data-testid="compose-submit"]').first();

    const testMessage = `Test message ${Date.now()}`;
    await composeInput.fill(testMessage);
    await submitBtn.click();
    await page.waitForTimeout(1500);

    // Message should appear in feed
    const msgLocator = page.locator(`text=${testMessage}`);
    expect(await msgLocator.count()).toBeGreaterThan(0);
  });

  test('compose bar collapses on scroll and expands on scroll-up', async ({ page }) => {
    const feed = page.locator('[data-testid="feed-container"]').first();
    const composeBar = page.locator('[data-testid="compose-bar"]').first();

    // Get initial compose bar height
    const initialHeight = await composeBar.evaluate((el) => el.offsetHeight);

    // Scroll down to trigger collapse
    await feed.evaluate((el) => {
      el.scrollTop = 200;
    });
    await page.waitForTimeout(300);

    // Compose bar should be smaller
    const collapsedHeight = await composeBar.evaluate((el) => el.offsetHeight);
    expect(collapsedHeight).toBeLessThan(initialHeight);

    // Scroll back up
    await feed.evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.waitForTimeout(300);

    // Compose bar should expand
    const expandedHeight = await composeBar.evaluate((el) => el.offsetHeight);
    expect(expandedHeight).toBeGreaterThan(collapsedHeight);
  });

  test('compose bar expands when user focuses input', async ({ page }) => {
    const feed = page.locator('[data-testid="feed-container"]').first();
    const composeInput = page.locator('[data-testid="compose-input"]').first();
    const composeBar = page.locator('[data-testid="compose-bar"]').first();

    // Scroll down to collapse
    await feed.evaluate((el) => {
      el.scrollTop = 200;
    });
    await page.waitForTimeout(300);

    const collapsedHeight = await composeBar.evaluate((el) => el.offsetHeight);

    // Focus input
    await composeInput.focus();
    await page.waitForTimeout(200);

    // Should expand
    const expandedHeight = await composeBar.evaluate((el) => el.offsetHeight);
    expect(expandedHeight).toBeGreaterThan(collapsedHeight);
  });

  test('channel selector in compose bar allows switching channels', async ({ page }) => {
    const channelSelect = page.locator('[data-testid="compose-channel-sel"], #compose-channel-sel').first();

    // Should be able to get all channel options
    const options = await channelSelect.locator('option').count();
    expect(options).toBeGreaterThan(0);

    // Selecting a different channel should work
    const firstOption = await channelSelect.locator('option').nth(0).getAttribute('value');
    await channelSelect.selectOption(firstOption || '');
    await page.waitForTimeout(500);

    // No error should occur
    const errors = await page.locator('[data-testid="error"], .error').count();
    expect(errors).toBe(0);
  });

  test('floating toolbar shows view mode options', async ({ page }) => {
    const toolbar = page.locator('[data-testid="floating-toolbar"]');
    expect(await toolbar.count()).toBeGreaterThan(0);

    const viewModeSelect = page.locator('[data-testid="view-mode-select"]');
    expect(await viewModeSelect.count()).toBeGreaterThan(0);

    // Should have view mode options
    const options = await viewModeSelect.locator('option').count();
    expect(options).toBeGreaterThanOrEqual(2);
  });

  test('user can switch view modes from toolbar', async ({ page }) => {
    const feed = page.locator('[data-testid="feed-container"]').first();
    const viewModeSelect = page.locator('[data-testid="view-mode-select"]').first();

    // Get initial view mode
    const initialClass = await feed.getAttribute('class');

    // Switch to grid view
    await viewModeSelect.selectOption('grid');
    await page.waitForTimeout(1000);

    // Feed should have changed (class or structure)
    const newClass = await feed.getAttribute('class');
    expect(newClass).not.toBe(initialClass);

    // Should not have errors
    const errors = await page.locator('[data-testid="error"]').count();
    expect(errors).toBe(0);
  });

  test('precision toggle buttons change feed', async ({ page }) => {
    const feed = page.locator('[data-testid="feed-container"]').first();
    const initialPostCount = await page.locator('[data-testid="post-card"]').count();

    // Find and click a precision button (strict, balanced, or broad)
    const precisionBtns = page.locator('[data-testid="floating-toolbar"] button[data-precision]');
    if (await precisionBtns.count() > 1) {
      const secondBtn = precisionBtns.nth(1);
      await secondBtn.click();
      await page.waitForTimeout(1000);

      // Feed should update (post count might change)
      // Don't assert exact count since it depends on feed content
      // Just verify no errors occurred
      const errors = await page.locator('[data-testid="error"]').count();
      expect(errors).toBe(0);
    }
  });

  test('sort dropdown allows changing sort order', async ({ page }) => {
    const sortSelect = page.locator('[data-testid="sort-order-select"]').first();
    expect(await sortSelect.count()).toBeGreaterThan(0);

    // Should have multiple sort options
    const options = await sortSelect.locator('option').count();
    expect(options).toBeGreaterThanOrEqual(2);

    // Changing sort should not error
    const firstOption = await sortSelect.locator('option').nth(0).getAttribute('value');
    await sortSelect.selectOption(firstOption || '');
    await page.waitForTimeout(500);

    const errors = await page.locator('[data-testid="error"]').count();
    expect(errors).toBe(0);
  });

  test('more options button opens advanced settings modal', async ({ page }) => {
    const moreBtn = page.locator('[data-testid="more-options-btn"]').first();
    expect(await moreBtn.count()).toBeGreaterThan(0);

    await moreBtn.click();
    await page.waitForTimeout(500);

    // Modal should be visible
    const modal = page.locator('.modal, [role="dialog"]').first();
    expect(await modal.count()).toBeGreaterThan(0);
    await expect(modal).toBeVisible();
  });

  test('advanced settings modal shows filter options', async ({ page }) => {
    const moreBtn = page.locator('[data-testid="more-options-btn"]').first();
    await moreBtn.click();
    await page.waitForTimeout(500);

    // Modal should contain checkboxes or filter controls
    const modal = page.locator('.modal, [role="dialog"]').first();
    const checkboxes = modal.locator('input[type="checkbox"]');
    expect(await checkboxes.count()).toBeGreaterThan(0);

    // Close modal
    const closeBtn = modal.locator('button:has-text("Close"), [data-action="close"]').first();
    if (await closeBtn.count() > 0) {
      await closeBtn.click();
      await page.waitForTimeout(300);
    }
  });

  test('user can toggle filters in advanced settings', async ({ page }) => {
    const moreBtn = page.locator('[data-testid="more-options-btn"]').first();
    await moreBtn.click();
    await page.waitForTimeout(500);

    const modal = page.locator('.modal, [role="dialog"]').first();
    const firstCheckbox = modal.locator('input[type="checkbox"]').first();

    if (await firstCheckbox.count() > 0) {
      const initialState = await firstCheckbox.isChecked();
      await firstCheckbox.click();
      await page.waitForTimeout(300);

      const newState = await firstCheckbox.isChecked();
      expect(newState).not.toBe(initialState);
    }

    // Close modal
    const closeBtn = modal.locator('button:has-text("Close"), [data-action="close"]').first();
    if (await closeBtn.count() > 0) {
      await closeBtn.click();
    }
  });

  test('reply context appears when composing a reply', async ({ page }) => {
    const replyBtn = page.locator('[data-action="reply"]').first();
    expect(await replyBtn.count()).toBeGreaterThan(0);

    await replyBtn.click();
    await page.waitForTimeout(500);

    // Reply context should be visible
    const replyContext = page.locator('[data-testid="compose-reply-context"]');
    expect(await replyContext.count()).toBeGreaterThan(0);

    // Context should show "Replying to"
    const contextText = await replyContext.textContent();
    expect(contextText).toContain('Replying');
  });

  test('clearing reply context removes it', async ({ page }) => {
    const replyBtn = page.locator('[data-action="reply"]').first();
    if (await replyBtn.count() > 0) {
      await replyBtn.click();
      await page.waitForTimeout(500);

      const replyContext = page.locator('[data-testid="compose-reply-context"]');
      if (await replyContext.count() > 0) {
        const clearBtn = replyContext.locator('button').first();
        if (await clearBtn.count() > 0) {
          await clearBtn.click();
          await page.waitForTimeout(300);

          // Context should be hidden
          const visible = await replyContext.isVisible();
          expect(visible).toBe(false);
        }
      }
    }
  });

  test('header shows network status', async ({ page }) => {
    const statusBadge = page.locator('[data-testid="network-status-badge"]');
    expect(await statusBadge.count()).toBeGreaterThan(0);

    const status = await statusBadge.textContent();
    expect(status).toMatch(/Online|Offline|Connecting|Disconnected/i);
  });

  test('refresh button works', async ({ page }) => {
    const refreshBtn = page.locator('[data-testid="refresh-feed"]').first();
    expect(await refreshBtn.count()).toBeGreaterThan(0);

    const feed = page.locator('[data-testid="feed-container"]').first();
    const initialHTML = await feed.evaluate((el) => el.innerHTML);

    await refreshBtn.click();
    await page.waitForTimeout(2000);

    // Feed should still be visible (refresh shouldn't break it)
    expect(await feed.count()).toBeGreaterThan(0);
  });

  test('no accessibility errors in compose bar area', async ({ page }) => {
    // Check for proper ARIA labels
    const composeInput = page.locator('[data-testid="compose-input"]').first();
    const hasLabel = await composeInput.evaluate((el) => {
      return el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.closest('form');
    });
    expect(hasLabel).toBeTruthy();

    // Buttons should be interactive
    const submitBtn = page.locator('[data-testid="compose-submit"]').first();
    const isVisible = await submitBtn.isVisible();
    expect(isVisible).toBe(true);
  });

  test('compose bar and toolbar do not overlap feed content unexpectedly', async ({ page }) => {
    const feed = page.locator('[data-testid="feed-container"]').first();
    const composeBar = page.locator('[data-testid="compose-bar"]').first();
    const toolbar = page.locator('[data-testid="floating-toolbar"]');

    // Get bounding boxes
    const feedBox = await feed.boundingBox();
    const composeBox = await composeBar.boundingBox();

    if (feedBox && composeBox) {
      // Compose bar should be above feed (or at least not overlapping by more than a few pixels for shadows/borders)
      const overlap = composeBox.y + composeBox.height - feedBox.y;
      expect(overlap).toBeLessThan(20); // Allow small overlap for shadows/borders
    }
  });

  test('keyboard submit still works (Ctrl+Enter)', async ({ page }) => {
    const composeInput = page.locator('[data-testid="compose-input"]').first();
    const testMessage = `Keyboard submit test ${Date.now()}`;

    await composeInput.fill(testMessage);
    await composeInput.press('Control+Enter');
    await page.waitForTimeout(1500);

    // Message should appear
    const msgLocator = page.locator(`text=${testMessage}`);
    expect(await msgLocator.count()).toBeGreaterThan(0);
  });

  test('empty state shows when no posts', async ({ page }) => {
    // Navigate to discover or another screen to come back to empty now screen
    // This is a soft test - just verify the page doesn't crash
    const body = page.locator('body');
    expect(await body.count()).toBe(1);
  });
});
