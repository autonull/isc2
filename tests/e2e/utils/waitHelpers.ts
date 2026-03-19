/**
 * Test Utilities - Wait Helpers
 *
 * Replace fixed timeouts with proper wait conditions for reliable tests.
 */

import type { Page } from '@playwright/test';

/**
 * Wait for app to be fully initialized
 * Replaces: waitForTimeout(2000-3000) after page.goto('/')
 */
export async function waitForAppReady(page: Page, timeout?: number): Promise<void> {
  await page.waitForSelector('[data-testid="sidebar"]', { timeout });
  await page.waitForFunction(() => {
    const app = document.getElementById('app');
    return app && app.children.length > 0;
  }, { timeout });
}

/**
 * Wait for navigation to complete
 * Replaces: waitForTimeout(500-1000) after tab clicks
 */
export async function waitForNavigation(page: Page, tabName: string, timeout?: number): Promise<void> {
  await page.waitForSelector(`[data-testid="nav-tab-${tabName}"][data-active="true"]`, { timeout });
  await page.waitForTimeout(300); // Minimal delay for animation
}

/**
 * Wait for posts to load
 * Replaces: waitForTimeout(2000-3000) after feed actions
 */
export async function waitForPostsLoaded(page: Page, minCount: number = 0, timeout?: number): Promise<void> {
  await page.waitForSelector('[data-testid="post-list"]', { timeout });
  if (minCount > 0) {
    await page.waitForFunction(
      (min) => document.querySelectorAll('[data-testid="post"]').length >= min,
      minCount,
      { timeout }
    );
  }
}

/**
 * Wait for channels to load
 * Replaces: waitForTimeout(1000-2000) after channel actions
 */
export async function waitForChannelsLoaded(page: Page, minCount: number = 0, timeout?: number): Promise<void> {
  await page.waitForSelector('[data-testid="sidebar-channel-list"]', { timeout });
  if (minCount > 0) {
    await page.waitForFunction(
      (min) => document.querySelectorAll('[data-channel-id]').length >= min,
      minCount,
      { timeout }
    );
  }
}

/**
 * Wait for matches to load in Now screen
 * Replaces: waitForTimeout(3000-5000) for discovery
 */
export async function waitForMatchesLoaded(page: Page, timeout?: number): Promise<void> {
  // Wait for either matches or empty state
  await page.waitForFunction(() => {
    const nowScreen = document.querySelector('[data-testid="now-screen"]');
    const matches = document.querySelector('[data-section="very-close"], [data-section="nearby"]');
    const empty = document.querySelector('[data-testid="now-empty-state"]');
    const loading = document.querySelector('[data-testid="loading-matches"]');
    return nowScreen || ((matches || empty) && !loading);
  }, { timeout });
}

/**
 * Wait for modal/dialog to appear
 * Replaces: waitForTimeout(500-1000) after modal triggers
 */
export async function waitForModal(page: Page, modalTestId: string, timeout?: number): Promise<void> {
  await page.waitForSelector(`[data-testid="${modalTestId}"]`, { timeout, state: 'visible' });
  await page.waitForTimeout(200); // Minimal delay for animation
}

/**
 * Wait for toast/notification to appear
 * Replaces: waitForTimeout(500-1000) after actions
 */
export async function waitForToast(page: Page, message: string, timeout?: number): Promise<void> {
  await page.waitForFunction(
    (msg) => document.body.textContent?.includes(msg),
    message,
    { timeout }
  );
}

/**
 * Wait for network idle with fallback
 * More reliable than page.waitForLoadState('networkidle') alone
 */
export async function waitForNetworkIdle(page: Page, timeout?: number): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
  await page.waitForTimeout(500); // Allow render after network
}

/**
 * Wait for element to be stable (not animating)
 * Replaces: waitForTimeout(200-500) for animation completion
 */
export async function waitForElementStable(
  page: Page,
  selector: string,
  timeout?: number
): Promise<void> {
  const element = await page.waitForSelector(selector, { timeout });
  await element.waitForElementState('stable', { timeout });
}

/**
 * Wait for text to appear anywhere on page
 * More flexible than specific selectors
 */
export async function waitForText(page: Page, text: string, timeout?: number): Promise<void> {
  await page.waitForFunction(
    (txt) => document.body.textContent?.includes(txt),
    text,
    { timeout }
  );
}

/**
 * Wait for onboarding to complete
 * Special helper for onboarding flow tests
 */
export async function waitForOnboardingComplete(page: Page, timeout?: number): Promise<void> {
  await page.waitForFunction(() => {
    return localStorage.getItem('isc-onboarding-completed') === 'true';
  }, { timeout });
  await page.waitForSelector('[data-testid="sidebar"]', { timeout });
}

/**
 * Complete onboarding flow
 * Helper for tests that need to skip onboarding
 */
export async function completeOnboarding(
  page: Page,
  options?: { name?: string; bio?: string; channel?: string }
): Promise<void> {
  const { name = 'Test User', bio = 'Testing ISC', channel = 'General' } = options || {};

  // Wait for onboarding modal
  await page.waitForSelector('[data-testid="onboarding-step-1"]', { timeout: 10000 });

  // Step 1: Name
  await page.fill('[data-testid="onboarding-name-input"]', name);
  await page.click('[data-testid="onboarding-next"]');

  // Step 2: Bio
  await page.waitForSelector('[data-testid="onboarding-step-2"]');
  await page.fill('[data-testid="onboarding-bio-input"]', bio);
  await page.click('[data-testid="onboarding-next"]');

  // Step 3: Channel
  await page.waitForSelector('[data-testid="onboarding-step-3"]');
    await page.fill('[data-testid="onboarding-channel-name-input"]', channel);
    await page.fill('[data-testid="onboarding-channel-desc-input"]', "Testing description");
    await page.click('[data-testid="onboarding-next"]');

  // Wait for completion
  await waitForOnboardingComplete(page);
}

/**
 * Skip onboarding via localStorage (for tests that don't need onboarding)
 * More explicit than inline evaluate
 */
export async function skipOnboarding(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem('isc-onboarding-completed', 'true');
  });
}
