/**
 * Test Utilities - Wait Helpers
 *
 * Replace fixed timeouts with proper wait conditions for reliable tests.
 */

import type { Page } from '@playwright/test';

/**
 * Wait for app to be fully initialized.
 * The irc-layout is injected by buildLayout() after the splash screen hides,
 * so its presence means the app is ready.
 */
export async function waitForAppReady(page: Page, timeout?: number): Promise<void> {
  await page.waitForSelector('[data-testid="irc-layout"]', { timeout });
  await page.waitForSelector('[data-testid="sidebar"]', { state: 'attached', timeout });
}

/**
 * Wait for navigation to a named tab to complete.
 * Uses the screen-level testid which is reliably present when the screen renders.
 */
export async function waitForNavigation(page: Page, tabName: string, timeout?: number): Promise<void> {
  // Map tab names to their screen testids
  const screenMap: Record<string, string> = {
    now: 'now-screen',
    channel: 'channel-screen',
    chats: 'chats-screen',
    settings: 'settings-screen',
    // compose maps to channel edit modal
    compose: 'channel-edit-body',
  };
  const screenTestId = screenMap[tabName];
  if (screenTestId) {
    await page.waitForSelector(`[data-testid="${screenTestId}"]`, { timeout });
  } else {
    // Fallback: wait for nav-tab element to have data-active="true"
    await page.waitForSelector(`[data-testid="nav-tab-${tabName}"][data-active="true"]`, { timeout });
  }
}

/**
 * Wait for the feed to be rendered (posts or empty state visible).
 * The feed container is always present; posts are [data-testid="post-card"].
 */
export async function waitForPostsLoaded(page: Page, minCount: number = 0, timeout?: number): Promise<void> {
  await page.waitForSelector('[data-testid="feed-container"]', { timeout });
  if (minCount > 0) {
    await page.waitForFunction(
      (min) => document.querySelectorAll('[data-testid="post-card"]').length >= min,
      minCount,
      { timeout }
    );
  }
}

/**
 * Wait for channels to appear in the sidebar.
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
 * Wait for the Discover or Now screen to finish loading matches (or empty state).
 */
export async function waitForMatchesLoaded(page: Page, timeout?: number): Promise<void> {
  // Wait for either match cards or any empty state (no pending loading indicator)
  await page.waitForFunction(() => {
    const matches = document.querySelector('[data-testid^="match-card-"]');
    const empty   = document.querySelector('[data-testid="empty-state"]');
    const nowEmpty = document.querySelector('[data-testid="now-empty-state"]');
    return !!(matches || empty || nowEmpty);
  }, { timeout });
}

/**
 * Wait for a modal to appear.
 */
export async function waitForModal(page: Page, modalTestId: string, timeout?: number): Promise<void> {
  await page.waitForSelector(`[data-testid="${modalTestId}"]`, { timeout, state: 'visible' });
}

/**
 * Wait for a toast message containing text.
 */
export async function waitForToast(page: Page, message: string, timeout?: number): Promise<void> {
  await page.waitForFunction(
    (msg) => document.body.textContent?.includes(msg),
    message,
    { timeout }
  );
}

/**
 * Wait for network idle with fallback.
 */
export async function waitForNetworkIdle(page: Page, timeout?: number): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Wait for element to be stable (not animating).
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
 * Wait for text to appear anywhere on page.
 */
export async function waitForText(page: Page, text: string, timeout?: number): Promise<void> {
  await page.waitForFunction(
    (txt) => document.body.textContent?.includes(txt),
    text,
    { timeout }
  );
}

/**
 * Wait for onboarding to be dismissed.
 */
export async function waitForOnboardingComplete(page: Page, timeout?: number): Promise<void> {
  await page.waitForFunction(() => {
    return localStorage.getItem('isc-onboarding-completed') === 'true';
  }, { timeout });
  await page.waitForSelector('[data-testid="irc-layout"]', { timeout });
}

/**
 * Complete the ISC onboarding flow.
 * The onboarding is a single modal with a "Get Started" button.
 * Any profile/channel creation is done post-onboarding via the Settings
 * and Compose screens.
 */
export async function completeOnboarding(page: Page): Promise<void> {
  // Wait for the onboarding modal to appear
  const modal = page.locator('[data-testid="onboarding-content"]');
  if (await modal.isVisible({ timeout: 5000 }).catch(() => false)) {
    await page.click('[data-testid="onboarding-complete"]');
  }
  await waitForOnboardingComplete(page);
}

/**
 * Skip onboarding via localStorage injection (fast path for tests that don't
 * need to test the onboarding flow itself).
 */
export async function skipOnboarding(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem('isc-onboarding-completed', 'true');
  });
}

/**
 * Inject synthetic peer matches into the app state via the window.ISC debug API.
 * Useful for multi-context tests where you want to simulate discovered peers
 * without waiting for real DHT discovery.
 *
 * discoveryService.getMatches() reads from state, so this immediately affects
 * the Discover and Chats screens on their next render.
 */
export async function injectMatches(
  page: Page,
  matches: Array<{
    peerId: string;
    name?: string;
    bio?: string;
    similarity?: number;
    online?: boolean;
  }>
): Promise<void> {
  await page.evaluate((peers) => {
    const normalised = peers.map(p => ({
      peerId: p.peerId,
      identity: { name: p.name ?? 'Test Peer', bio: p.bio ?? '' },
      similarity: p.similarity ?? 0.8,
      matchedTopics: [],
      online: p.online ?? false,
    }));
    // window.ISC.actions is exposed by the debug API in app.js
    (window as any).ISC?.actions?.setMatches(normalised);
  }, matches);
}

/**
 * Force a re-render of the current screen by navigating away and back.
 * Useful after injecting state when the screen needs to re-read data.
 */
export async function forceRerender(page: Page, currentTab: string): Promise<void> {
  const otherTab = currentTab === 'now' ? 'settings' : 'now';
  await page.click(`[data-testid="nav-tab-${otherTab}"]`);
  await page.click(`[data-testid="nav-tab-${currentTab}"]`);
  await waitForNavigation(page, currentTab);
}

/**
 * Inject synthetic chat messages into localStorage for a given peer,
 * simulating messages received from that peer.
 */
export async function injectChatMessages(
  page: Page,
  peerId: string,
  messages: Array<{ content: string; fromMe?: boolean; timestamp?: number }>
): Promise<void> {
  await page.evaluate(({ pid, msgs }) => {
    const key = `isc:chat:${pid}`;
    const stored = msgs.map((m, i) => ({
      id: `injected-${Date.now()}-${i}`,
      peerId: pid,
      content: m.content,
      timestamp: m.timestamp ?? Date.now() - (msgs.length - i) * 1000,
      fromMe: m.fromMe ?? false,
      delivered: true,
    }));
    localStorage.setItem(key, JSON.stringify(stored));
  }, { pid: peerId, msgs: messages });
}
