/**
 * Test Utilities for E2E Tests
 *
 * Shared helpers for page interactions, state injection, and assertions.
 * Re-exports from waitHelpers.ts for backwards compatibility.
 */

import type { Page } from '@playwright/test';
export {
  waitForAppReady,
  waitForNavigation,
  waitForPostsLoaded,
  waitForChannelsLoaded,
  waitForMatchesLoaded,
  waitForModal,
  waitForToast,
  waitForNetworkIdle,
  waitForElementStable,
  waitForText,
  waitForOnboardingComplete,
  completeOnboarding,
  skipOnboarding,
  injectMatches,
  forceRerender,
  injectChatMessages,
} from './waitHelpers.js';

/**
 * Inject mock channels into app state
 */
export async function injectChannels(page: Page, channels: Array<{ id: string; name: string; description?: string }>) {
  await page.evaluate((data) => {
    const { actions } = (window as any).ISC ?? {};
    if (actions) {
      actions.setChannels?.(data);
    }
  }, channels);
}

/**
 * Get the current active route
 */
export async function getCurrentRoute(page: Page): Promise<string> {
  return page.evaluate(() => window.location.hash.replace('#/', ''));
}

/**
 * Click a tab and wait for navigation
 */
export async function clickTab(page: Page, tabId: string) {
  await page.click(`[data-tab="${tabId}"]`);
  await waitForNavigation(page, tabId);
}

/**
 * Wait for an element to be visible with custom timeout
 */
export async function waitForVisible(page: Page, selector: string, timeout = 5000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

/**
 * Assert that an element exists and is visible
 */
export async function expectVisible(page: Page, selector: string) {
  await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
}

/**
 * Assert that an element does not exist
 */
export async function expectNotVisible(page: Page, selector: string) {
  await page.waitForSelector(selector, { state: 'hidden', timeout: 3000 });
}

/**
 * Fill an input and submit
 */
export async function fillAndSubmit(page: Page, inputSelector: string, value: string, submitSelector?: string) {
  await page.fill(inputSelector, value);
  if (submitSelector) {
    await page.click(submitSelector);
  } else {
    await page.press(inputSelector, 'Enter');
  }
}

/**
 * Get text content of an element
 */
export async function getElementText(page: Page, selector: string): Promise<string> {
  return page.locator(selector).textContent() ?? '';
}

/**
 * Dismiss all toasts
 */
export async function dismissToasts(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll('.toast').forEach(t => t.remove());
  });
}

/**
 * Get app state
 */
export async function getAppState(page: Page) {
  return page.evaluate(() => {
    const { getState } = (window as any).ISC ?? {};
    return getState?.() ?? {};
  });
}

/**
 * Set app state
 */
export async function setAppState(page: Page, state: Record<string, unknown>) {
  await page.evaluate((data) => {
    const { actions } = (window as any).ISC ?? {};
    if (actions) {
      Object.entries(data).forEach(([key, value]) => {
        actions[`set${key.charAt(0).toUpperCase() + key.slice(1)}`]?.(value);
      });
    }
  }, state);
}

/**
 * Wait for feed to update
 */
export async function waitForFeedUpdate(page: Page, timeout = 5000) {
  await page.waitForFunction(
    () => document.querySelector('[data-component="feed"]') !== null,
    { timeout }
  );
}

/**
 * Get all post cards
 */
export async function getPostCards(page: Page) {
  return page.locator('[data-testid="post-card"]').all();
}

/**
 * Wait for posts to appear in feed
 */
export async function waitForPosts(page: Page, count = 1, timeout = 5000) {
  await page.waitForFunction(
    (minCount) => document.querySelectorAll('[data-testid="post-card"]').length >= minCount,
    count,
    { timeout }
  );
}
