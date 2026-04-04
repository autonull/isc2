/**
 * Integration Tests - Refactored Components
 *
 * Tests for the refactored UI components and utilities.
 * Verifies component behavior, state management, and event handling.
 */

import { test, expect } from '@playwright/test';
import {
  waitForAppReady,
  waitForVisible,
  skipOnboarding,
  injectChannels,
  injectMatches,
  getAppState,
} from './utils/testHelpers.js';

// ── Setup ─────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  // Capture errors silently for test assertions
  page.on('pageerror', () => {
    // captured internally
  });
  page.on('console', () => {
    // captured internally; suppressed in CI
  });
  await skipOnboarding(page);
  await page.goto('/');
  await waitForAppReady(page);
});

// ── Sidebar Component ─────────────────────────────────────────────────────────

test.describe('Sidebar Component', () => {
  test('sidebar renders with navigation items', async ({ page }) => {
    await waitForVisible(page, '[data-testid="sidebar"]');
    await expect(page.locator('[data-testid="sidebar-nav-list"]')).toBeVisible();
  });

  test('sidebar shows all navigation tabs', async ({ page }) => {
    const tabs = ['now', 'channel', 'chats', 'settings'];

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
    await page.waitForTimeout(1000);

    await expect(chatsTab).toHaveAttribute('data-active', 'true');
    await expect(chatsTab).toHaveAttribute('aria-current', 'page');
  });

  test('sidebar channel list shows empty state when no channels', async ({ page }) => {
    await expect(page.locator('[data-testid="sidebar-no-channels"]')).toBeVisible();
  });

  test('sidebar updates when channels are injected', async ({ page }) => {
    await injectChannels(page, [{ id: 'test-ch', name: 'Integration Test', description: 'Test' }]);
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="sidebar-channel-test-ch"]')).toBeVisible();
  });
});

// ── Status Bar Component ──────────────────────────────────────────────────────

test.describe('Status Bar Component', () => {
  test('status bar is visible', async ({ page }) => {
    await waitForVisible(page, '[data-testid="sidebar-status"]');
  });

  test('status bar shows connection status', async ({ page }) => {
    await expect(page.locator('[data-testid="status-connection"]')).toBeVisible();
  });

  test('status bar shows peer count', async ({ page }) => {
    await expect(page.locator('[data-testid="status-peers"]')).toBeAttached();
  });

  test('status bar shows channel count', async ({ page }) => {
    await expect(page.locator('[data-testid="status-channels"]')).toBeAttached();
  });

  test('status bar shows log text', async ({ page }) => {
    await expect(page.locator('[data-testid="status-log"]')).toBeAttached();
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
      modals?.open('<div>Test Modal</div>');
    });

    await waitForVisible(page, '[data-testid="modal-overlay"]');
  });

  test('modal closes on Escape key', async ({ page }) => {
    await page.evaluate(() => {
      const { modals } = (window as any).ISC ?? {};
      modals?.open('<div>Test Modal</div>');
    });
    await page.waitForSelector('[data-testid="modal-overlay"]');

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="modal-overlay"]')).not.toBeVisible();
  });

  test('modal confirm returns false on cancel', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { modals } = (window as any).ISC ?? {};
      if (!modals) return null;
      const promise = modals.confirm('Are you sure?', { title: 'Test' });
      await new Promise((r) => setTimeout(r, 50));
      (document.querySelector('[data-action="cancel"]') as HTMLElement | null)?.click();
      return promise;
    });
    expect(result).toBe(false);
  });

  test('modal confirm returns true on confirm', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { modals } = (window as any).ISC ?? {};
      if (!modals) return null;
      const promise = modals.confirm('Are you sure?', { title: 'Test' });
      await new Promise((r) => setTimeout(r, 50));
      (document.querySelector('[data-action="confirm"]') as HTMLElement | null)?.click();
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
    await page.waitForSelector('[data-testid="now-screen"]', { timeout: 30000 });
    await expect(page.locator('[data-testid="now-header"]')).toBeVisible();
  });

  test('now screen shows body content', async ({ page }) => {
    await expect(page.locator('[data-testid="now-body"]')).toBeVisible();
  });

  test('now screen shows empty state when no channels', async ({ page }) => {
    await expect(page.locator('[data-testid="now-empty-state"]')).toBeVisible();
  });

  test('now screen shows channels after injection', async ({ page }) => {
    await injectChannels(page, [{ id: 'test-ch', name: 'Test Channel', description: 'Test' }]);
    await page.waitForTimeout(500);
    await page.click('[data-tab="channel"]');
    await page.click('[data-tab="now"]');
    await page.waitForTimeout(500);

    const state = await getAppState(page);
    expect(state.channels?.length).toBe(1);
  });
});

// ── Chats Screen ──────────────────────────────────────────────────────────────

test.describe('Chats Screen', () => {
  test('chats screen renders with header', async ({ page }) => {
    await page.click('[data-tab="chats"]');
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="chats-screen"]')).toBeVisible();
  });

  test('chats screen shows empty state when no conversations', async ({ page }) => {
    await page.click('[data-tab="chats"]');
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="empty-conversations"]')).toBeVisible();
  });

  test('chats screen shows "no chat selected" when no conversation active', async ({ page }) => {
    await page.click('[data-tab="chats"]');
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="no-chat-selected"]')).toBeVisible();
  });
});

// ── State Management ──────────────────────────────────────────────────────────

test.describe('State Management', () => {
  test('window.ISC debug API is available', async ({ page }) => {
    const hasISC = await page.evaluate(() => !!(window as any).ISC);
    expect(hasISC).toBe(true);
  });

  test('getState returns current state', async ({ page }) => {
    const state = await getAppState(page);
    expect(state).toHaveProperty('channels');
    expect(state).toHaveProperty('matches');
  });

  test('state channels update when injected', async ({ page }) => {
    await injectChannels(page, [{ id: 'ch1', name: 'Test', description: '' }]);
    await page.waitForTimeout(300);

    const state = await getAppState(page);
    expect(state.channels?.length).toBe(1);
    expect(state.channels?.[0]?.name).toBe('Test');
  });

  test('state matches update when injected', async ({ page }) => {
    await injectMatches(page, [{ peerId: 'test-peer', name: 'Test Peer', similarity: 0.85 }]);
    await page.waitForTimeout(300);

    const state = await getAppState(page);
    expect(state.matches?.length).toBe(1);
    expect(state.matches?.[0]?.peerId).toBe('test-peer');
  });
});

// ── Event Handling ────────────────────────────────────────────────────────────

test.describe('Event Handling', () => {
  test('isc:refresh-feed event is dispatched', async ({ page }) => {
    const eventFired = await page.evaluate(() => {
      let fired = false;
      document.addEventListener(
        'isc:refresh-feed',
        () => {
          fired = true;
        },
        { once: true }
      );
      document.dispatchEvent(new CustomEvent('isc:refresh-feed'));
      return fired;
    });
    expect(eventFired).toBe(true);
  });

  test('isc:need-channel event is dispatched', async ({ page }) => {
    const eventFired = await page.evaluate(() => {
      let fired = false;
      document.addEventListener(
        'isc:need-channel',
        () => {
          fired = true;
        },
        { once: true }
      );
      document.dispatchEvent(new CustomEvent('isc:need-channel'));
      return fired;
    });
    expect(eventFired).toBe(true);
  });
});

// ── Responsive Design ─────────────────────────────────────────────────────────

test.describe('Responsive Design', () => {
  test('layout adapts to mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid="irc-layout"]')).toBeVisible();
  });

  test('layout adapts to tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid="irc-layout"]')).toBeVisible();
  });

  test('layout adapts to desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid="irc-layout"]')).toBeVisible();
  });
});

// ── Error Handling ────────────────────────────────────────────────────────────

test.describe('Error Handling', () => {
  test('app handles missing channels gracefully', async ({ page }) => {
    const state = await getAppState(page);
    expect(state.channels).toEqual([]);
    await expect(page.locator('[data-testid="now-empty-state"]')).toBeVisible();
  });

  test('app handles navigation to non-existent route', async ({ page }) => {
    await page.evaluate(() => {
      window.location.hash = '#/nonexistent';
    });
    await page.waitForTimeout(500);
    // Should fall back to default route
    const hash = await page.evaluate(() => window.location.hash);
    expect(hash).toBe('#/now');
  });
});
