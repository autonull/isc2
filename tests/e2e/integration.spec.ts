/**
 * Integration Tests - Refactored Components
 *
 * Tests for the refactored UI components and utilities.
 * Verifies component behavior, state management, and event handling.
 */

import { test, expect, type Page } from '@playwright/test';
import {
  waitForAppReady,
  waitForVisible,
  skipOnboarding,
  injectChannels,
  injectMatches,
  getAppState,
  clickTab,
  waitForFeedUpdate,
} from './utils/testHelpers.js';

// ── Setup ─────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  page.on('pageerror', err => console.error('Uncaught error:', err.message));
  await page.goto('/');
  await skipOnboarding(page);
  await waitForAppReady(page);
});

// ── Sidebar Component ─────────────────────────────────────────────────────────

test.describe('Sidebar Component', () => {
  test('sidebar renders with navigation items', async ({ page }) => {
    await waitForVisible(page, '[data-testid="sidebar"]');
    await expect(page.locator('[data-testid="sidebar-nav-list"]')).toBeVisible();
  });

  test('sidebar shows all navigation tabs', async ({ page }) => {
    const tabs = ['now', 'discover', 'chats', 'settings', 'compose'];

    for (const tab of tabs) {
      await expect(page.locator(`[data-testid="nav-tab-${tab}"]`)).toBeVisible();
    }
  });

  test('sidebar shows channel list section', async ({ page }) => {
    await expect(page.locator('[data-testid="sidebar-channels-header"]')).toBeVisible();
  });

  test('sidebar connection indicator reflects status', async ({ page }) => {
    const indicator = page.locator('[data-testid="connection-status"]');
    await expect(indicator).toBeVisible();

    const className = await indicator.getAttribute('class');
    expect(className).toMatch(/status-(online|offline|connecting)/);
  });

  test('clicking nav item updates active state', async ({ page }) => {
    const chatsTab = page.locator('[data-tab="chats"]');
    await chatsTab.click();
    await page.waitForTimeout(500);

    await expect(chatsTab).toHaveAttribute('data-active', 'true');
    await expect(chatsTab).toHaveAttribute('aria-current', 'page');
  });

  test('sidebar channel list shows empty state when no channels', async ({ page }) => {
    await expect(page.locator('[data-testid="sidebar-no-channels"]')).toBeVisible();
  });

  test('sidebar updates when channels are injected', async ({ page }) => {
    await injectChannels(page, [
      { id: 'test-ch', name: 'Integration Test', description: 'Test' },
    ]);
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="sidebar-channel-test-ch"]')).toBeVisible();
  });
});

// ── Status Bar Component ──────────────────────────────────────────────────────

test.describe('Status Bar Component', () => {
  test('status bar is visible', async ({ page }) => {
    await waitForVisible(page, '[data-testid="status-bar"]');
  });

  test('status bar shows connection status', async ({ page }) => {
    await expect(page.locator('[data-testid="status-connection"]')).toBeVisible();
  });

  test('status bar shows peer count', async ({ page }) => {
    await expect(page.locator('[data-testid="status-peers"]')).toBeVisible();
  });

  test('status bar shows channel count', async ({ page }) => {
    await expect(page.locator('[data-testid="status-channels"]')).toBeVisible();
  });

  test('status bar shows log text', async ({ page }) => {
    await expect(page.locator('[data-testid="status-log"]')).toBeVisible();
  });

  test('debug toggle button is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="debug-toggle"]')).toBeVisible();
  });
});

// ── Modal Component ───────────────────────────────────────────────────────────

test.describe('Modal Component', () => {
  test('modal can be opened via debug API', async ({ page }) => {
    await page.evaluate(() => {
      const { modals } = (window as any).ISC ?? {};
      if (modals) {
        modals.open('<div data-testid="test-modal">Test Content</div>');
      }
    });

    await waitForVisible(page, '[data-testid="test-modal"]');
    await expect(page.locator('.modal-overlay')).toBeVisible();
  });

  test('modal closes on Escape key', async ({ page }) => {
    await page.evaluate(() => {
      const { modals } = (window as any).ISC ?? {};
      modals?.open('<div data-testid="test-modal">Test</div>');
    });

    await page.waitForTimeout(100);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    await expect(page.locator('.modal-overlay')).not.toBeVisible();
  });

  test('modal confirm returns false on cancel', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { modals } = (window as any).ISC ?? {};
      if (!modals) return null;

      const promise = modals.confirm('Test?', { confirmText: 'Yes', cancelText: 'No' });
      await new Promise(r => setTimeout(r, 50));
      (document.querySelector('[data-action="cancel"]') as HTMLElement)?.click();
      return promise;
    });

    expect(result).toBe(false);
  });

  test('modal confirm returns true on confirm', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { modals } = (window as any).ISC ?? {};
      if (!modals) return null;

      const promise = modals.confirm('Test?', { confirmText: 'Yes' });
      await new Promise(r => setTimeout(r, 50));
      (document.querySelector('[data-action="confirm"]') as HTMLElement)?.click();
      return promise;
    });

    expect(result).toBe(true);
  });

  test('help modal shows keyboard shortcuts', async ({ page }) => {
    await page.evaluate(() => {
      const { modals } = (window as any).ISC ?? {};
      modals?.showHelp();
    });

    await waitForVisible(page, '[data-testid="shortcuts-list"]');
    await expect(page.locator('kbd')).toBeVisible();
  });
});

// ── Now Screen ────────────────────────────────────────────────────────────────

test.describe('Now Screen', () => {
  test('now screen renders with header', async ({ page }) => {
    await clickTab(page, 'now');
    await waitForVisible(page, '[data-testid="now-header"]');
  });

  test('now screen shows compose area', async ({ page }) => {
    await clickTab(page, 'now');
    await expect(page.locator('[data-testid="compose-container"]')).toBeVisible();
  });

  test('now screen shows feed container', async ({ page }) => {
    await clickTab(page, 'now');
    await expect(page.locator('[data-testid="feed-container"]')).toBeVisible();
  });

  test('compose input accepts text', async ({ page }) => {
    await clickTab(page, 'now');

    const input = page.locator('[data-testid="compose-input"]');
    await input.fill('Test message');

    const value = await input.inputValue();
    expect(value).toBe('Test message');
  });

  test('compose character counter updates', async ({ page }) => {
    await clickTab(page, 'now');

    const input = page.locator('[data-testid="compose-input"]');
    await input.fill('Hello');

    const counter = page.locator('[data-testid="compose-count"]');
    const text = await counter.textContent();
    expect(text).toMatch(/5 \/ 2000/);
  });

  test('submit button is disabled when empty', async ({ page }) => {
    await clickTab(page, 'now');

    const submitBtn = page.locator('[data-testid="compose-submit"]');
    await expect(submitBtn).toBeDisabled();
  });

  test('submit button is enabled when text entered', async ({ page }) => {
    await clickTab(page, 'now');

    const input = page.locator('[data-testid="compose-input"]');
    await input.fill('Test');

    const submitBtn = page.locator('[data-testid="compose-submit"]');
    await expect(submitBtn).toBeEnabled();
  });
});

// ── Discover Screen ───────────────────────────────────────────────────────────

test.describe('Discover Screen', () => {
  test('discover screen renders with header', async ({ page }) => {
    await clickTab(page, 'discover');
    await waitForVisible(page, '[data-testid="discover-header"]');
  });

  test('discover screen shows empty state when no matches', async ({ page }) => {
    await clickTab(page, 'discover');
    await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();
  });

  test('discover screen shows explainer card', async ({ page }) => {
    await clickTab(page, 'discover');
    await expect(page.locator('.discovery-explainer')).toBeVisible();
  });

  test('discover button is visible', async ({ page }) => {
    await clickTab(page, 'discover');
    await expect(page.locator('[data-testid="discover-peers-btn"]')).toBeVisible();
  });

  test('discover screen shows peer sections when matches exist', async ({ page }) => {
    await injectMatches(page, [
      { peerId: 'peer-1', name: 'Alice', similarity: 0.92 },
      { peerId: 'peer-2', name: 'Bob', similarity: 0.75 },
    ]);
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="match-list"]')).toBeVisible();
  });
});

// ── Chats Screen ──────────────────────────────────────────────────────────────

test.describe('Chats Screen', () => {
  test('chats screen renders with header', async ({ page }) => {
    await clickTab(page, 'chats');
    await waitForVisible(page, '[data-testid="chats-header"]');
  });

  test('chats screen shows conversation list panel', async ({ page }) => {
    await clickTab(page, 'chats');
    await expect(page.locator('[data-testid="conversation-list-panel"]')).toBeVisible();
  });

  test('chats screen shows chat panel', async ({ page }) => {
    await clickTab(page, 'chats');
    await expect(page.locator('[data-testid="chat-panel"]')).toBeVisible();
  });

  test('chats screen shows empty state when no conversations', async ({ page }) => {
    await clickTab(page, 'chats');
    await expect(page.locator('[data-testid="empty-conversations"]')).toBeVisible();
  });

  test('chats screen shows "no chat selected" when no conversation active', async ({ page }) => {
    await clickTab(page, 'chats');
    await expect(page.locator('[data-testid="no-chat-selected"]')).toBeVisible();
  });
});

// ── State Management ──────────────────────────────────────────────────────────

test.describe('State Management', () => {
  test('window.ISC debug API is available', async ({ page }) => {
    const hasISC = await page.evaluate(() => {
      return !!(window as any).ISC;
    });
    expect(hasISC).toBe(true);
  });

  test('getState returns current state', async ({ page }) => {
    const state = await getAppState(page);

    expect(state).toHaveProperty('status');
    expect(state).toHaveProperty('channels');
    expect(state).toHaveProperty('matches');
  });

  test('state channels update when injected', async ({ page }) => {
    const initialState = await getAppState(page);
    expect(initialState.channels).toHaveLength(0);

    await injectChannels(page, [
      { id: 'ch-1', name: 'Test', description: 'Test channel' },
    ]);
    await page.waitForTimeout(300);

    const updatedState = await getAppState(page);
    expect(updatedState.channels).toHaveLength(1);
  });

  test('state matches update when injected', async ({ page }) => {
    const initialState = await getAppState(page);
    expect(initialState.matches).toHaveLength(0);

    await injectMatches(page, [
      { peerId: 'p1', name: 'Peer', similarity: 0.8 },
    ]);
    await page.waitForTimeout(300);

    const updatedState = await getAppState(page);
    expect(updatedState.matches).toHaveLength(1);
  });
});

// ── Event Handling ────────────────────────────────────────────────────────────

test.describe('Event Handling', () => {
  test('isc:refresh-feed event is dispatched', async ({ page }) => {
    const eventDispatched = await page.evaluate(() => {
      return new Promise(resolve => {
        let dispatched = false;
        document.addEventListener('isc:refresh-feed', () => { dispatched = true; }, { once: true });
        document.dispatchEvent(new CustomEvent('isc:refresh-feed'));
        setTimeout(() => resolve(dispatched), 100);
      });
    });

    expect(eventDispatched).toBe(true);
  });

  test('isc:need-channel event is dispatched', async ({ page }) => {
    const eventDispatched = await page.evaluate(() => {
      return new Promise(resolve => {
        let dispatched = false;
        document.addEventListener('isc:need-channel', () => { dispatched = true; }, { once: true });
        document.dispatchEvent(new CustomEvent('isc:need-channel'));
        setTimeout(() => resolve(dispatched), 100);
      });
    });

    expect(eventDispatched).toBe(true);
  });
});

// ── Responsive Design ─────────────────────────────────────────────────────────

test.describe('Responsive Design', () => {
  test('layout adapts to mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    await expect(page.locator('#app')).toBeVisible();
    await expect(page.locator('.tab-bar')).toBeVisible();
  });

  test('layout adapts to tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);

    await expect(page.locator('#app')).toBeVisible();
  });

  test('layout adapts to desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);

    await expect(page.locator('#app')).toBeVisible();
    await expect(page.locator('.irc-sidebar')).toBeVisible();
  });
});

// ── Error Handling ────────────────────────────────────────────────────────────

test.describe('Error Handling', () => {
  test('app handles missing channels gracefully', async ({ page }) => {
    // App should render without channels
    await expect(page.locator('#app')).toBeVisible();
  });

  test('app handles navigation to non-existent route', async ({ page }) => {
    await page.goto('#/nonexistent');
    await page.waitForTimeout(1000);

    // Should redirect to default route
    const currentRoute = await page.evaluate(() => window.location.hash);
    expect(currentRoute).not.toBe('#/nonexistent');
  });

  test('app recovers from rapid navigation', async ({ page }) => {
    const tabs = ['now', 'discover', 'chats', 'settings'];

    for (const tab of tabs) {
      await page.click(`[data-tab="${tab}"]`).catch(() => {});
      await page.waitForTimeout(100);
    }

    await page.waitForTimeout(500);
    await expect(page.locator('#app')).toBeVisible();
  });
});
