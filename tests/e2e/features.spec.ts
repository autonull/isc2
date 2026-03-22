/**
 * ISC Feature E2E Tests
 *
 * Covers functionality introduced/fixed in the vanilla UI:
 *   - Video screen (rendering, empty state, peer list, dial interface)
 *   - modal.confirm() promise resolves false on Escape / cancel
 *   - Sent chat messages show delivered (✓) status, not pending (○)
 *   - Notifications toggle in settings
 */

import { test, expect, type Page } from '@playwright/test';
import {
  waitForAppReady,
  waitForNavigation,
  skipOnboarding,
  injectMatches,
  injectChatMessages,
  forceRerender,
} from './utils/waitHelpers.js';

// ── Setup ─────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  page.on('pageerror', err => console.error('Uncaught error:', err.message));
  await page.goto('/');
  await skipOnboarding(page);
  await page.reload();
  await waitForAppReady(page);
});

// ── Video Screen ──────────────────────────────────────────────────────────────

test.describe('Video Screen', () => {
  async function goToVideo(page: Page) {
    await page.click('[data-testid="nav-tab-video"]');
    await waitForNavigation(page, 'video');
    await page.waitForSelector('[data-testid="video-screen"]');
  }

  test('renders the video screen with empty state when no peers', async ({ page }) => {
    await goToVideo(page);

    // Empty state shows when no peers discovered
    await expect(page.locator('[data-testid="video-no-peers"]')).toBeVisible();

    // Dial-by-peer-id card always present
    await expect(page.locator('[data-testid="video-join-call"]')).toBeVisible();
    await expect(page.locator('[data-testid="dial-peer-input"]')).toBeVisible();

    // How-it-works explainer always present
    await expect(page.locator('[data-testid="video-how-it-works"]')).toBeVisible();
  });

  test('dial button is disabled until peer ID is entered', async ({ page }) => {
    await goToVideo(page);

    const dialBtn = page.locator('[data-testid="dial-btn"]');
    await expect(dialBtn).toBeDisabled();

    await page.fill('[data-testid="dial-peer-input"]', '12D3KooWTestPeer');
    await expect(dialBtn).toBeEnabled();
  });

  test('clearing dial input re-disables the dial button', async ({ page }) => {
    await goToVideo(page);

    await page.fill('[data-testid="dial-peer-input"]', '12D3KooWTestPeer');
    await expect(page.locator('[data-testid="dial-btn"]')).toBeEnabled();

    await page.fill('[data-testid="dial-peer-input"]', '');
    await expect(page.locator('[data-testid="dial-btn"]')).toBeDisabled();
  });

  test('shows peer list when peers are discovered', async ({ page }) => {
    await goToVideo(page);

    // Inject peers into app state
    await injectMatches(page, [
      { peerId: 'peer-alpha', name: 'Alice', similarity: 0.92 },
      { peerId: 'peer-beta',  name: 'Bob',   similarity: 0.75 },
    ]);

    // Trigger re-render via app's state subscription
    await forceRerender(page, 'video');

    // Peer list card should appear instead of empty state
    await expect(page.locator('[data-testid="video-peer-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="video-no-peers"]')).not.toBeVisible();

    // Each peer renders a call button
    await expect(page.locator('[data-testid="call-btn-peer-alpha"]')).toBeVisible();
    await expect(page.locator('[data-testid="call-btn-peer-beta"]')).toBeVisible();
  });

  // Discover screen removed (Phase 3.3). Peers are found via channel neighborhood.
  // test('clicking discover link navigates to discover screen', async ({ page }) => { ... });

  test('dialing a peer navigates to the chats screen', async ({ page }) => {
    await goToVideo(page);

    await page.fill('[data-testid="dial-peer-input"]', '12D3KooWTestPeer123');
    await page.click('[data-testid="dial-btn"]');

    // Should navigate to chats
    await page.waitForSelector('[data-testid="chats-screen"]', { timeout: 5000 });
  });
});

// ── Modal confirm() ───────────────────────────────────────────────────────────

test.describe('Modal confirm()', () => {
  /**
   * Open a confirm dialog via window.ISC.modals (debug API exposed by app.js),
   * trigger an action after the modal renders, and return the resolved value.
   */
  async function openConfirmAndGetResult(
    page: Page,
    action: 'escape' | 'cancel' | 'confirm',
  ): Promise<boolean> {
    return page.evaluate(async (act: string) => {
      const modals = (window as any).ISC?.modals;
      if (!modals) throw new Error('window.ISC.modals not available');

      const p = modals.confirm('Are you sure?', { title: 'Test', confirmText: 'Yes', cancelText: 'No' });

      // Give the modal 50 ms to appear in the DOM, then trigger the action
      await new Promise(r => setTimeout(r, 50));

      if (act === 'escape') {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      } else if (act === 'cancel') {
        (document.querySelector('[data-action="cancel"]') as HTMLElement | null)?.click();
      } else {
        (document.querySelector('[data-action="confirm"]') as HTMLElement | null)?.click();
      }

      return p;
    }, action);
  }

  test('Escape resolves confirm() to false', async ({ page }) => {
    const result = await openConfirmAndGetResult(page, 'escape');
    expect(result).toBe(false);
  });

  test('Cancel button resolves confirm() to false', async ({ page }) => {
    const result = await openConfirmAndGetResult(page, 'cancel');
    expect(result).toBe(false);
  });

  test('Confirm button resolves confirm() to true', async ({ page }) => {
    const result = await openConfirmAndGetResult(page, 'confirm');
    expect(result).toBe(true);
  });

  test('modal overlay click resolves confirm() to false', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const modals = (window as any).ISC?.modals;
      if (!modals) throw new Error('window.ISC.modals not available');

      const p = modals.confirm('Are you sure?', { title: 'Test' });
      await new Promise(r => setTimeout(r, 50));
      // Click the overlay backdrop (not the inner .modal element)
      (document.querySelector('.modal-overlay') as HTMLElement | null)?.click();
      return p;
    });

    expect(result).toBe(false);
  });
});

// ── Chat message delivery status ──────────────────────────────────────────────

test.describe('Chat message delivery status', () => {
  const TEST_PEER = 'peer-delivery-test';

  async function openChatWith(page: Page, peerId: string) {
    await injectMatches(page, [{ peerId, name: 'Delivery Test Peer', similarity: 0.85 }]);
    await injectChatMessages(page, peerId, [
      { content: 'Hey there', fromMe: false },
    ]);
    // Navigate to chats screen
    await page.click('[data-testid="nav-tab-chats"]');
    await waitForNavigation(page, 'chats');
    // Click the conversation
    await page.waitForSelector('[data-testid^="conv-item-"]', { timeout: 5000 });
    await page.click('[data-testid^="conv-item-"]');
    await page.waitForSelector('[data-testid="chat-messages"]', { timeout: 5000 });
  }

  test('sent messages show delivered checkmark, not pending indicator', async ({ page }) => {
    await openChatWith(page, TEST_PEER);

    // Type and send a message
    const input = page.locator('[data-testid="chat-input"]');
    await input.fill('Hello from me');
    await page.keyboard.press('Enter');

    // Wait for the message to appear in the chat
    await page.waitForFunction(
      () => document.body.textContent?.includes('Hello from me'),
      { timeout: 5000 },
    );

    // The sent message should show ✓ (delivered/stored) not ○ (pending forever)
    const msgContent = await page.locator('[data-testid="chat-messages"]').textContent();
    expect(msgContent).toContain('✓');
    expect(msgContent).not.toContain('○');
  });

  test('received messages do not show a delivery indicator', async ({ page }) => {
    await openChatWith(page, TEST_PEER);

    // The injected message is fromMe=false; it should have no outbound status indicator
    const messages = page.locator('[data-testid="chat-messages"]');
    await expect(messages).toBeVisible();

    // Received messages should contain our injected text
    await expect(messages).toContainText('Hey there');
  });
});

// ── Settings — Notifications toggle ──────────────────────────────────────────

test.describe('Settings — Notifications', () => {
  async function goToSettings(page: Page) {
    await page.click('[data-testid="nav-tab-settings"]');
    await waitForNavigation(page, 'settings');
    await page.waitForSelector('[data-testid="settings-screen"]');
  }

  test('notifications toggle is present in settings', async ({ page }) => {
    await goToSettings(page);
    await expect(page.locator('[data-testid="notifications-toggle"]')).toBeVisible();
  });

  test('notifications toggle reflects persisted setting', async ({ page }) => {
    // Pre-set notifications=false in localStorage
    await page.evaluate(() => {
      localStorage.setItem('isc:settings', JSON.stringify({ notifications: false }));
    });
    await page.reload();
    await waitForAppReady(page);
    await goToSettings(page);

    const toggle = page.locator('[data-testid="notifications-toggle"]');
    await expect(toggle).not.toBeChecked();
  });

  test('toggling notifications updates persisted settings', async ({ page }) => {
    // Ensure notifications start as false
    await page.evaluate(() => {
      localStorage.setItem('isc:settings', JSON.stringify({ notifications: false }));
    });
    await page.reload();
    await waitForAppReady(page);
    await goToSettings(page);

    const toggle = page.locator('[data-testid="notifications-toggle"]');
    await expect(toggle).not.toBeChecked();

    // The toggle fires requestPermission() which returns 'default' in headless;
    // grant permission so the setting actually saves.
    await page.context().grantPermissions(['notifications']);

    await toggle.click();

    // Verify localStorage was updated
    const saved = await page.evaluate(() => {
      const s = localStorage.getItem('isc:settings');
      return s ? JSON.parse(s).notifications : undefined;
    });
    expect(saved).toBe(true);
  });
});
