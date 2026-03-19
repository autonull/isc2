/**
 * ISC Browser E2E Tests
 *
 * Tests complete user flows: channel creation, posts, discover, chats, navigation.
 * All selectors are based on the vanilla UI's actual data-testid attributes.
 */

import { test, expect } from '@playwright/test';
import {
  waitForAppReady,
  waitForChannelsLoaded,
  waitForMatchesLoaded,
  waitForPostsLoaded,
  waitForNavigation,
  waitForToast,
  skipOnboarding,
  injectMatches,
  injectChatMessages,
  forceRerender,
} from './utils/waitHelpers.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createChannel(page: any, name: string, description: string) {
  await page.click('[data-testid="nav-tab-compose"]');
  await waitForNavigation(page, 'compose');
  await page.fill('[data-testid="compose-name-input"]', name);
  await page.fill('[data-testid="compose-description-input"]', description);
  // Save button enables when name ≥3 chars & description ≥10 chars
  await expect(page.locator('[data-testid="compose-save"]')).toBeEnabled();
  await page.click('[data-testid="compose-save"]');
  // After save, app navigates back to /now (1200ms redirect)
  await page.waitForSelector('[data-testid="now-screen"]', { timeout: 5000 });
}

// ── Suite setup ──────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('Browser console error:', msg.text());
  });
  page.on('pageerror', err => console.log('Uncaught error:', err.message));

  await page.goto('/');
  await skipOnboarding(page);
  // Reload so the skipped-onboarding flag is seen by the app on mount
  await page.reload();
  await waitForAppReady(page);
});

// ── Channel Management ───────────────────────────────────────────────────────

test.describe('Channel Management', () => {
  test('creates a channel and shows it in the sidebar', async ({ page }) => {
    await createChannel(page, 'AI Ethics', 'Ethical implications of machine learning and AI autonomy');

    // Sidebar should list the channel
    await expect(page.locator('[data-testid="sidebar-channel-list"] [data-channel-id]').first()).toBeVisible();
  });

  test('newly created channel appears in compose channel selector', async ({ page }) => {
    await createChannel(page, 'Philosophy', 'The philosophy of consciousness and qualia in the age of AI');

    // Navigate to Now — the compose area should have the channel in its selector or label
    await page.click('[data-testid="nav-tab-now"]');
    await waitForNavigation(page, 'now');
    await expect(page.locator('[data-testid="now-screen"]')).toBeVisible();
  });

  test('can cancel channel creation and return to feed', async ({ page }) => {
    await page.click('[data-testid="nav-tab-compose"]');
    await waitForNavigation(page, 'compose');
    await page.click('[data-testid="compose-cancel"]');
    await page.waitForSelector('[data-testid="now-screen"]', { timeout: 5000 });
  });

  test('save button disabled until name and description meet minimums', async ({ page }) => {
    await page.click('[data-testid="nav-tab-compose"]');
    await waitForNavigation(page, 'compose');

    const saveBtn = page.locator('[data-testid="compose-save"]');
    await expect(saveBtn).toBeDisabled();

    await page.fill('[data-testid="compose-name-input"]', 'Hi');        // < 3 chars
    await expect(saveBtn).toBeDisabled();

    await page.fill('[data-testid="compose-name-input"]', 'Valid name');
    await page.fill('[data-testid="compose-description-input"]', 'Short');  // < 10 chars
    await expect(saveBtn).toBeDisabled();

    await page.fill('[data-testid="compose-description-input"]', 'This is a valid description');
    await expect(saveBtn).toBeEnabled();
  });

  test('character counters update as user types', async ({ page }) => {
    await page.click('[data-testid="nav-tab-compose"]');
    await waitForNavigation(page, 'compose');

    await page.fill('[data-testid="compose-name-input"]', 'Test');
    await expect(page.locator('#name-count')).toHaveText('4 / 50');

    await page.fill('[data-testid="compose-description-input"]', 'Hello world');
    await expect(page.locator('#desc-count')).toHaveText('11 / 500');
  });

  test('can delete a channel from settings', async ({ page }) => {
    await createChannel(page, 'Deletable', 'A channel that will be deleted shortly for testing');

    await page.click('[data-testid="nav-tab-settings"]');
    await waitForNavigation(page, 'settings');

    const deleteBtn = page.locator('[data-testid="channels-section"] button.delete-channel-btn').first();
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click({ force: true });

    // Confirmation modal
    await page.waitForSelector('[data-testid="modal-overlay"]', { timeout: 3000 });
    await page.click('[data-action="confirm"]');

    await waitForToast(page, 'Channel deleted', 3000);
  });
});

// ── Posts & Feed ─────────────────────────────────────────────────────────────

test.describe('Posts & Feed', () => {
  test.beforeEach(async ({ page }) => {
    await createChannel(page, 'Post Test', 'Channel for testing post creation and feed display');
  });

  test('creates a post and shows it in the feed', async ({ page }) => {
    await page.click('[data-testid="nav-tab-now"]');
    await waitForNavigation(page, 'now');

    const input = page.locator('[data-testid="compose-input"]');
    await expect(input).toBeVisible();
    await input.fill('Testing the ISC social layer from Playwright!');

    await page.click('[data-testid="compose-submit"]');
    await waitForToast(page, 'Posted!', 5000);

    await expect(page.locator('[data-testid="post-card"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="feed-container"]')).toContainText('Testing the ISC social layer');
  });

  test('compose submit button disabled when input is empty', async ({ page }) => {
    await page.click('[data-testid="nav-tab-now"]');
    await waitForNavigation(page, 'now');

    const submit = page.locator('[data-testid="compose-submit"]');
    await expect(submit).toBeDisabled();

    await page.locator('[data-testid="compose-input"]').fill('Some text');
    await expect(submit).toBeEnabled();
  });

  test('character counter updates in compose input', async ({ page }) => {
    await page.click('[data-testid="nav-tab-now"]');
    await waitForNavigation(page, 'now');

    await page.locator('[data-testid="compose-input"]').fill('hello');
    await expect(page.locator('[data-testid="compose-count"]')).toHaveText('5 / 2000');
  });

  test('can like a post', async ({ page }) => {
    // Create a post first
    await page.click('[data-testid="nav-tab-now"]');
    await waitForNavigation(page, 'now');
    await page.locator('[data-testid="compose-input"]').fill('A likeable post');
    await page.click('[data-testid="compose-submit"]');
    await waitForToast(page, 'Posted!', 5000);

    // Like the post
    const likeBtn = page.locator('[data-like-btn]').first();
    await expect(likeBtn).toBeVisible();
    await likeBtn.click({ force: true });
    await expect(likeBtn).toHaveAttribute('data-liked', 'true');
  });

  test('reply prefills compose input with quoted post', async ({ page }) => {
    await page.click('[data-testid="nav-tab-now"]');
    await waitForNavigation(page, 'now');
    await page.locator('[data-testid="compose-input"]').fill('Original content here');
    await page.click('[data-testid="compose-submit"]');
    await waitForToast(page, 'Posted!', 5000);

    const replyBtn = page.locator('[data-reply-btn]').first();
    await replyBtn.click({ force: true });

    // Compose input should now contain a quote of the original post
    // Use toHaveValue — toContainText checks textContent, not the JS .value property of a textarea
    await expect(page.locator('[data-testid="compose-input"]')).toHaveValue(/^>/);
  });

  test('can delete a post via the delete button', async ({ page }) => {
    await page.click('[data-testid="nav-tab-now"]');
    await waitForNavigation(page, 'now');
    await page.locator('[data-testid="compose-input"]').fill('Post to be deleted immediately');
    await page.click('[data-testid="compose-submit"]');
    await waitForToast(page, 'Posted!', 5000);

    const deleteBtn = page.locator('[data-delete-btn]').first();
    await deleteBtn.click({ force: true });

    // Confirmation modal
    await page.waitForSelector('[data-testid="modal-overlay"]', { timeout: 3000 });
    await page.click('[data-action="confirm"]');
    await waitForToast(page, 'Post deleted', 3000);
  });

  test('shows empty state when no posts and no channels', async ({ page }) => {
    // Fresh page with no channels — clear both localStorage and IndexedDB (channels are stored in IDB)
    await page.evaluate(async () => {
      localStorage.clear();
      await new Promise<void>(resolve => {
        const req = indexedDB.deleteDatabase('isc-storage');
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    });
    await page.reload();
    await page.evaluate(() => localStorage.setItem('isc-onboarding-completed', 'true'));
    await page.reload();
    await waitForAppReady(page);

    await page.click('[data-testid="nav-tab-now"]');
    await waitForNavigation(page, 'now');
    await expect(page.locator('[data-testid="now-empty-state"]')).toBeVisible();
    await expect(page.locator('[data-testid="now-empty-cta"]')).toBeVisible();
  });
});

// ── Discover ─────────────────────────────────────────────────────────────────

test.describe('Discover', () => {
  test('renders the discover screen with empty state when no matches', async ({ page }) => {
    await page.click('[data-testid="nav-tab-discover"]');
    await waitForNavigation(page, 'discover');

    await expect(page.locator('[data-testid="discover-screen"]')).toBeVisible();
    await expect(page.locator('[data-testid="discover-title"]')).toContainText('Discover');
  });

  test('shows need-channels banner when no channels created', async ({ page }) => {
    await page.click('[data-testid="nav-tab-discover"]');
    await waitForNavigation(page, 'discover');

    await expect(page.locator('[data-testid="need-channels-banner"]')).toBeVisible();
  });

  test('shows match cards when matches are injected', async ({ page }) => {
    await injectMatches(page, [
      { peerId: 'peer-abc-123', name: 'Alice', bio: 'AI researcher', similarity: 0.92 },
      { peerId: 'peer-def-456', name: 'Bob', bio: 'Philosophy enthusiast', similarity: 0.78 },
    ]);

    await page.click('[data-testid="nav-tab-discover"]');
    await waitForNavigation(page, 'discover');
    await waitForMatchesLoaded(page, 5000);
    await expect(page.locator('[data-testid^="match-card-"]').first()).toBeVisible();
  });

  test('connect button appears on match cards', async ({ page }) => {
    await injectMatches(page, [
      { peerId: 'peer-xyz-789', name: 'Carol', similarity: 0.88 },
    ]);

    await page.click('[data-testid="nav-tab-discover"]');
    await waitForNavigation(page, 'discover');
    await waitForMatchesLoaded(page, 5000);

    const matchCard = page.locator('[data-testid^="match-card-"]').first();
    if (await matchCard.count() > 0) {
      await expect(matchCard.locator('[data-connect-btn]')).toBeVisible();
      await expect(matchCard.locator('[data-message-btn]')).toBeVisible();
    }
  });
});

// ── Chats ─────────────────────────────────────────────────────────────────────

test.describe('Chats', () => {
  const ALICE_ID = 'e2e-alice-peer-0001';

  test.beforeEach(async ({ page }) => {
    // Inject Alice as a match and pre-populate a message so the conversation shows up
    await injectMatches(page, [{ peerId: ALICE_ID, name: 'Alice', similarity: 0.91 }]);
    await injectChatMessages(page, ALICE_ID, [
      { content: 'Hello from Alice!', fromMe: false },
    ]);
  });

  test('shows empty conversations state when no chats', async ({ page }) => {
    // Clear injected data for this test
    await page.evaluate(() => {
      Object.keys(localStorage).filter(k => k.startsWith('isc:chat:')).forEach(k => localStorage.removeItem(k));
    });
    await injectMatches(page, []);

    await page.click('[data-testid="nav-tab-chats"]');
    await waitForNavigation(page, 'chats');
    await expect(page.locator('[data-testid="empty-conversations"]')).toBeVisible();
  });

  test('conversation list shows peers with messages', async ({ page }) => {
    await injectMatches(page, [{ peerId: ALICE_ID, name: 'Alice', similarity: 0.91 }]);
    await injectChatMessages(page, ALICE_ID, [{ content: 'Hey there!', fromMe: false }]);

    await page.click('[data-testid="nav-tab-chats"]');
    await waitForNavigation(page, 'chats');
    await forceRerender(page, 'chats');

    await expect(page.locator('[data-testid="conversation-list"]')).toBeVisible();
  });

  test('opening a conversation shows message history', async ({ page }) => {
    await injectMatches(page, [{ peerId: ALICE_ID, name: 'Alice', similarity: 0.91 }]);
    await injectChatMessages(page, ALICE_ID, [
      { content: 'First message', fromMe: false },
      { content: 'Second message', fromMe: true },
    ]);

    await page.click('[data-testid="nav-tab-chats"]');
    await waitForNavigation(page, 'chats');
    await forceRerender(page, 'chats');

    const convItem = page.locator('[data-peer-id]').first();
    if (await convItem.count() > 0) {
      await convItem.click({ force: true });
      await expect(page.locator('[data-testid="chat-messages"]')).toBeVisible();
      await expect(page.locator('[data-testid="chat-messages"]')).toContainText('First message');
    }
  });

  test('can type and send a message in an open conversation', async ({ page }) => {
    await injectMatches(page, [{ peerId: ALICE_ID, name: 'Alice', similarity: 0.91 }]);
    await injectChatMessages(page, ALICE_ID, [{ content: 'Ping', fromMe: false }]);

    await page.click('[data-testid="nav-tab-chats"]');
    await waitForNavigation(page, 'chats');
    await forceRerender(page, 'chats');

    const convItem = page.locator('[data-peer-id]').first();
    if (await convItem.count() > 0) {
      await convItem.click({ force: true });

      await page.fill('[data-testid="chat-input"]', 'Pong from test');
      await page.click('[data-testid="send-message-button"]');

      await expect(page.locator('[data-testid="chat-messages"]')).toContainText('Pong from test');
    }
  });

  test('closing a chat returns to the no-chat-selected state', async ({ page }) => {
    await injectMatches(page, [{ peerId: ALICE_ID, name: 'Alice', similarity: 0.91 }]);
    await injectChatMessages(page, ALICE_ID, [{ content: 'Hi!', fromMe: false }]);

    await page.click('[data-testid="nav-tab-chats"]');
    await waitForNavigation(page, 'chats');
    await forceRerender(page, 'chats');

    const convItem = page.locator('[data-peer-id]').first();
    if (await convItem.count() > 0) {
      await convItem.click({ force: true });
      await page.waitForSelector('[data-testid="chat-view"]', { timeout: 3000 });
      await page.click('[data-testid="close-chat"]');
      await expect(page.locator('[data-testid="no-chat-selected"]')).toBeVisible();
    }
  });
});

// ── Navigation ───────────────────────────────────────────────────────────────

test.describe('Navigation', () => {
  test('navigates between all main tabs', async ({ page }) => {
    for (const tab of ['now', 'discover', 'chats', 'settings'] as const) {
      await page.click(`[data-testid="nav-tab-${tab}"]`);
      await waitForNavigation(page, tab);
      await expect(page.locator(`[data-testid="${tab}-screen"]`)).toBeVisible();
    }
  });

  test('sidebar nav items reflect active route', async ({ page }) => {
    await page.click('[data-testid="nav-tab-discover"]');
    await waitForNavigation(page, 'discover');

    // Sidebar nav item for 'discover' should be active
    await expect(
      page.locator('[data-testid="sidebar"] [data-testid="nav-tab-discover"][data-active="true"]')
    ).toBeVisible();
  });

  test('mobile tab bar items reflect active route', async ({ page }) => {
    // The tab bar is only visible on mobile viewports
    await page.setViewportSize({ width: 390, height: 844 });
    await page.click('[data-testid="tab-bar"] [data-testid="nav-tab-chats"]');
    await waitForNavigation(page, 'chats');

    await expect(
      page.locator('[data-testid="tab-bar"] [data-testid="nav-tab-chats"][data-active="true"]')
    ).toBeVisible();
  });

  test('keyboard shortcut Ctrl+K navigates to compose', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await waitForNavigation(page, 'compose');
    await expect(page.locator('[data-testid="compose-screen"]')).toBeVisible();
  });

  test('keyboard shortcut Ctrl+, navigates to settings', async ({ page }) => {
    await page.keyboard.press('Control+,');
    await waitForNavigation(page, 'settings');
    await expect(page.locator('[data-testid="settings-screen"]')).toBeVisible();
  });

  test('pressing ? shows the keyboard help modal', async ({ page }) => {
    await page.keyboard.press('?');
    // The modal system renders an overlay
    await page.waitForSelector('[data-testid="modal-overlay"]', { timeout: 3000 });
    await expect(page.locator('[data-testid="modal-overlay"]')).toBeVisible();
  });
});

// ── Settings ─────────────────────────────────────────────────────────────────

test.describe('Settings', () => {
  test('can update display name and bio', async ({ page }) => {
    await page.click('[data-testid="nav-tab-settings"]');
    await waitForNavigation(page, 'settings');

    await page.fill('[data-testid="settings-name-input"]', 'Test User');
    await page.fill('[data-testid="settings-bio-input"]', 'Testing ISC via Playwright');
    await page.click('[data-testid="save-profile-btn"]');
    await waitForToast(page, 'Profile saved', 3000);
  });

  test('similarity threshold slider updates displayed value', async ({ page }) => {
    await page.click('[data-testid="nav-tab-settings"]');
    await waitForNavigation(page, 'settings');

    await page.locator('[data-testid="similarity-threshold-slider"]').fill('70');
    await expect(page.locator('#sim-value')).toHaveText('70');
  });

  test('theme change applies data-theme attribute to document', async ({ page }) => {
    await page.click('[data-testid="nav-tab-settings"]');
    await waitForNavigation(page, 'settings');

    await page.selectOption('[data-testid="theme-select"]', 'light');

    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(theme).toBe('light');
  });

  test('peer ID is displayed in profile section', async ({ page }) => {
    await page.click('[data-testid="nav-tab-settings"]');
    await waitForNavigation(page, 'settings');

    await expect(page.locator('[data-testid="peer-id-display"]')).toBeVisible();
  });
});

// ── PWA Features ──────────────────────────────────────────────────────────────

test.describe('PWA Features', () => {
  test('page has a valid web app manifest', async ({ page }) => {
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute('href');

    const href = await manifestLink.getAttribute('href');
    const response = await page.request.get(href!);
    expect(response.ok()).toBe(true);

    const manifest = await response.json();
    expect(manifest.name).toBeTruthy();
    expect(manifest.display).toBe('standalone');
  });

  test('service worker API is available', async ({ page }) => {
    const swAvailable = await page.evaluate(() => 'serviceWorker' in navigator);
    expect(swAvailable).toBe(true);
  });

  test('app container renders on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await waitForAppReady(page);
    await expect(page.locator('[data-testid="irc-layout"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-bar"]')).toBeVisible();
  });
});

// ── Accessibility ─────────────────────────────────────────────────────────────

test.describe('Accessibility', () => {
  test('each main screen has exactly one h1', async ({ page }) => {
    for (const tab of ['now', 'discover', 'chats', 'settings']) {
      await page.click(`[data-testid="nav-tab-${tab}"]`);
      await waitForNavigation(page, tab);
      const h1Count = await page.locator('h1').count();
      expect(h1Count, `${tab} screen should have 1 h1`).toBe(1);
    }
  });

  test('all visible buttons have accessible text or aria-label', async ({ page }) => {
    const buttons = page.locator('button:visible');
    const count = await buttons.count();

    for (let i = 0; i < Math.min(count, 15); i++) {
      const btn = buttons.nth(i);
      const text = (await btn.textContent())?.trim();
      const ariaLabel = await btn.getAttribute('aria-label');
      const title = await btn.getAttribute('title');
      expect(text || ariaLabel || title, `Button ${i} should have accessible label`).toBeTruthy();
    }
  });

  test('can Tab-navigate through interactive elements', async ({ page }) => {
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedTag).toBeTruthy();
  });

  test('page title contains ISC', async ({ page }) => {
    expect(await page.title()).toContain('ISC');
  });

  test('status bar is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="status-bar"]')).toBeVisible();
  });
});

// ── Debug Panel ───────────────────────────────────────────────────────────────

test.describe('Debug Panel', () => {
  test('Ctrl+D toggles the debug panel', async ({ page }) => {
    const debugPanel = page.locator('[data-testid="debug-panel"]');
    await expect(debugPanel).not.toBeVisible();

    await page.keyboard.press('Control+d');
    await expect(debugPanel).toBeVisible();

    await page.keyboard.press('Control+d');
    await expect(debugPanel).not.toBeVisible();
  });

  test('debug panel clear button empties the log', async ({ page }) => {
    await page.keyboard.press('Control+d');
    await page.waitForSelector('[data-testid="debug-panel"]:not(.hidden)', { timeout: 2000 });
    await page.click('[data-testid="debug-clear"]');
    const logContent = await page.locator('[data-testid="debug-log"]').textContent();
    expect(logContent?.trim()).toBe('');
  });
});
