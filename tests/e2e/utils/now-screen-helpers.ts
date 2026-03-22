/**
 * Now Screen Test Helpers
 *
 * Resilient helpers for testing the now screen redesign.
 * These helpers focus on behavior outcomes, not implementation details.
 */

import { Page, expect } from '@playwright/test';

/**
 * Get compose bar element
 * Resilient to: CSS class names, div structure, positioning changes
 */
export async function getComposeBar(page: Page) {
  const selector = '[data-testid="compose-bar"]';
  const element = page.locator(selector);
  if ((await element.count()) === 0) {
    throw new Error('Compose bar not found');
  }
  return element.first();
}

/**
 * Get compose input element
 * Resilient to: placeholder text changes, styling changes
 */
export async function getComposeInput(page: Page) {
  const selector = '[data-testid="compose-input"]';
  const element = page.locator(selector);
  if ((await element.count()) === 0) {
    throw new Error('Compose input not found');
  }
  return element.first();
}

/**
 * Post a message from the compose bar
 * Returns true if successful, false otherwise
 * Resilient to: UI position, styling, animation timing
 */
export async function postMessage(page: Page, message: string): Promise<boolean> {
  try {
    const input = await getComposeInput(page);
    const submitBtn = page.locator('[data-testid="compose-submit"]').first();

    await input.fill(message);
    await submitBtn.click();
    await page.waitForTimeout(1500); // Wait for post to appear

    // Verify message is in feed
    const msgLocator = page.locator(`text=${message}`);
    return (await msgLocator.count()) > 0;
  } catch {
    return false;
  }
}

/**
 * Get the floating toolbar
 * Resilient to: CSS changes, positioning changes
 */
export async function getFloatingToolbar(page: Page) {
  const selector = '[data-testid="floating-toolbar"]';
  const element = page.locator(selector);
  if ((await element.count()) === 0) {
    throw new Error('Floating toolbar not found');
  }
  return element.first();
}

/**
 * Check if compose bar is collapsed (minimal height)
 * Resilient to: exact pixel values, CSS class names
 */
export async function isComposeBarCollapsed(page: Page): Promise<boolean> {
  const composeBar = await getComposeBar(page);
  const height = await composeBar.evaluate((el) => el.offsetHeight);
  // Collapsed is roughly 40px, expanded is roughly 100+px
  return height < 60;
}

/**
 * Scroll feed down by a specific amount
 * Resilient to: scroll container implementation
 */
export async function scrollFeedDown(page: Page, distance: number = 200): Promise<void> {
  const feed = page.locator('[data-testid="feed-container"]').first();
  if ((await feed.count()) === 0) {
    throw new Error('Feed container not found');
  }

  await feed.evaluate((el, dist) => {
    el.scrollTop += dist;
  }, distance);

  await page.waitForTimeout(300); // Wait for any animations
}

/**
 * Scroll feed back to top
 * Resilient to: scroll container implementation
 */
export async function scrollFeedToTop(page: Page): Promise<void> {
  const feed = page.locator('[data-testid="feed-container"]').first();
  if ((await feed.count()) === 0) {
    throw new Error('Feed container not found');
  }

  await feed.evaluate((el) => {
    el.scrollTop = 0;
  });

  await page.waitForTimeout(300);
}

/**
 * Change view mode using the toolbar dropdown
 * Resilient to: dropdown styling, option text changes
 * Returns: true if successful
 */
export async function changeViewMode(page: Page, mode: 'list' | 'grid' | 'space'): Promise<boolean> {
  try {
    const select = page.locator('[data-testid="view-mode-select"]').first();
    if ((await select.count()) === 0) {
      return false;
    }

    await select.selectOption(mode);
    await page.waitForTimeout(1000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Change sort order using the toolbar dropdown
 * Resilient to: dropdown styling, option text changes
 */
export async function changeSortOrder(
  page: Page,
  order: 'recency' | 'similarity' | 'activity'
): Promise<boolean> {
  try {
    const select = page.locator('[data-testid="sort-order-select"]').first();
    if ((await select.count()) === 0) {
      return false;
    }

    await select.selectOption(order);
    await page.waitForTimeout(500);
    return true;
  } catch {
    return false;
  }
}

/**
 * Toggle a precision setting using toolbar buttons
 * Resilient to: button styling, icon changes
 */
export async function setPrecision(page: Page, level: 'strict' | 'balanced' | 'broad'): Promise<boolean> {
  try {
    const btn = page.locator(`button[data-precision="${level}"]`).first();
    if ((await btn.count()) === 0) {
      return false;
    }

    await btn.click();
    await page.waitForTimeout(1000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Open advanced settings modal
 * Resilient to: modal implementation, dialog vs popover
 */
export async function openAdvancedSettings(page: Page): Promise<boolean> {
  try {
    const btn = page.locator('[data-testid="more-options-btn"]').first();
    if ((await btn.count()) === 0) {
      return false;
    }

    await btn.click();
    await page.waitForTimeout(500);

    // Verify modal is visible
    const modal = page.locator('.modal, [role="dialog"]').first();
    return (await modal.count()) > 0 && (await modal.isVisible());
  } catch {
    return false;
  }
}

/**
 * Close advanced settings modal
 * Resilient to: modal styling, button text changes
 */
export async function closeAdvancedSettings(page: Page): Promise<boolean> {
  try {
    const closeBtn = page.locator('button:has-text("Close"), [data-action="close"]').first();
    if ((await closeBtn.count()) === 0) {
      return false;
    }

    await closeBtn.click();
    await page.waitForTimeout(300);
    return true;
  } catch {
    return false;
  }
}

/**
 * Toggle a filter checkbox in advanced settings
 * Resilient to: filter names, styling
 */
export async function toggleFilter(page: Page, filterLabel: string): Promise<boolean> {
  try {
    const modal = page.locator('.modal, [role="dialog"]').first();
    const checkbox = modal.locator(`label:has-text("${filterLabel}") input[type="checkbox"]`).first();

    if ((await checkbox.count()) === 0) {
      return false;
    }

    const initialState = await checkbox.isChecked();
    await checkbox.click();
    await page.waitForTimeout(300);
    const newState = await checkbox.isChecked();

    return newState !== initialState;
  } catch {
    return false;
  }
}

/**
 * Get network status text
 * Resilient to: styling, DOM structure
 */
export async function getNetworkStatus(page: Page): Promise<string | null> {
  try {
    const badge = page.locator('[data-testid="network-status-badge"]').first();
    if ((await badge.count()) === 0) {
      return null;
    }
    return await badge.textContent();
  } catch {
    return null;
  }
}

/**
 * Get current post count visible in feed
 * Resilient to: post card DOM structure, CSS classes
 */
export async function getVisiblePostCount(page: Page): Promise<number> {
  return page.locator('[data-testid="post-card"], .post-card, article').count();
}

/**
 * Click reply button on first post
 * Resilient to: post structure, icon changes
 */
export async function replyToFirstPost(page: Page): Promise<boolean> {
  try {
    const replyBtn = page.locator('[data-action="reply"]').first();
    if ((await replyBtn.count()) === 0) {
      return false;
    }

    await replyBtn.click();
    await page.waitForTimeout(500);

    // Verify reply context appears
    const context = page.locator('[data-testid="compose-reply-context"]');
    return (await context.count()) > 0;
  } catch {
    return false;
  }
}

/**
 * Clear reply context (cancel reply)
 * Resilient to: button styling, icon changes
 */
export async function cancelReply(page: Page): Promise<boolean> {
  try {
    const context = page.locator('[data-testid="compose-reply-context"]').first();
    if ((await context.count()) === 0) {
      return false;
    }

    const clearBtn = context.locator('button').first();
    if ((await clearBtn.count()) === 0) {
      return false;
    }

    await clearBtn.click();
    await page.waitForTimeout(300);

    // Verify context is hidden
    return !(await context.isVisible());
  } catch {
    return false;
  }
}

/**
 * Switch channel via compose bar channel selector
 * Resilient to: dropdown styling, option formatting
 */
export async function switchChannel(page: Page, channelName: string): Promise<boolean> {
  try {
    const selector = page.locator('[data-testid="compose-channel-sel"], #compose-channel-sel').first();
    if ((await selector.count()) === 0) {
      return false;
    }

    await selector.selectOption(channelName);
    await page.waitForTimeout(500);
    return true;
  } catch {
    return false;
  }
}

/**
 * Assert that no errors are visible on page
 * Resilient to: error styling, error message text
 */
export async function assertNoErrors(page: Page): Promise<void> {
  const errorCount = await page.locator('[data-testid="error"], .error, .error-message').count();
  expect(errorCount).toBe(0);
}

/**
 * Assert compose bar is visible
 * Resilient to: positioning, styling
 */
export async function assertComposeBarVisible(page: Page): Promise<void> {
  const composeBar = await getComposeBar(page);
  await expect(composeBar).toBeVisible();
}

/**
 * Assert floating toolbar is visible
 * Resilient to: positioning, styling
 */
export async function assertToolbarVisible(page: Page): Promise<void> {
  const toolbar = await getFloatingToolbar(page);
  await expect(toolbar).toBeVisible();
}
