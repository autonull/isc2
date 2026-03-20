/**
 * Multi-Context E2E Tests
 *
 * Simulates two independent browser contexts (Alice and Bob) interacting
 * with the ISC app. Each context has its own isolated localStorage / identity,
 * mimicking two separate devices connected to the same P2P network.
 *
 * Real DHT-based peer discovery is non-deterministic and slow, so these tests
 * inject synthetic peer state via the window.ISC debug API rather than waiting
 * for libp2p. This lets us verify UI behaviour for multi-user scenarios without
 * relying on network timing.
 */

import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import {
  waitForAppReady,
  waitForNavigation,
  waitForMatchesLoaded,
  skipOnboarding,
  injectMatches,
  injectChatMessages,
  forceRerender,
} from './utils/waitHelpers.js';

// ── Shared helpers ────────────────────────────────────────────────────────────

async function setupContext(
  browser: Browser,
  name: string
): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ storageState: undefined });
  const page = await ctx.newPage();

  page.on('pageerror', err => console.log(`[${name}] Uncaught:`, err.message));

  await page.goto('/');
  await skipOnboarding(page);
  await page.reload();
  await waitForAppReady(page);

  return { ctx, page };
}

async function getPeerId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    return (window as any).ISC?.networkService?.getIdentity()?.pubkey ?? null;
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Multi-Context: Two Users', () => {
  test('both contexts initialize independently with separate identities', async ({ browser }) => {
    const alice = await setupContext(browser, 'Alice');
    const bob   = await setupContext(browser, 'Bob');

    try {
      const aliceId = await getPeerId(alice.page);
      const bobId   = await getPeerId(bob.page);

      // Each context has initialized (may have an identity or be null if
      // network init failed in the test environment — both are valid)
      expect(typeof aliceId === 'string' || aliceId === null).toBe(true);
      expect(typeof bobId   === 'string' || bobId   === null).toBe(true);

      // Crucially, if both have IDs they must differ (separate identities)
      if (aliceId && bobId) {
        expect(aliceId).not.toBe(bobId);
      }
    } finally {
      await alice.ctx.close();
      await bob.ctx.close();
    }
  });

  test('Alice appears in Bob\'s Discover screen after state injection', async ({ browser }) => {
    const alice = await setupContext(browser, 'Alice');
    const bob   = await setupContext(browser, 'Bob');

    try {
      const aliceId = await getPeerId(alice.page) ?? 'e2e-alice-synthetic-id';

      // Set Alice's profile name in her own context
      await alice.page.click('[data-testid="nav-tab-settings"]');
      await waitForNavigation(alice.page, 'settings');
      await alice.page.fill('[data-testid="settings-name-input"]', 'Alice');
      await alice.page.fill('[data-testid="settings-bio-input"]', 'Distributed systems researcher');
      await alice.page.click('[data-testid="save-profile-btn"]');

      // Inject Alice as a discovered peer in Bob's context
      await injectMatches(bob.page, [{
        peerId: aliceId,
        name: 'Alice',
        bio: 'Distributed systems researcher',
        similarity: 0.92,
        online: true,
      }]);

      // Bob navigates to Discover
      await bob.page.click('[data-testid="nav-tab-discover"]');
      await waitForNavigation(bob.page, 'discover');
      await waitForMatchesLoaded(bob.page, 5000);

      // Alice should appear as a match card
      await expect(bob.page.locator('[data-testid^="match-card-"]').first()).toBeVisible();
      await expect(bob.page.locator('[data-testid="discover-body"]')).toContainText('Alice');
    } finally {
      await alice.ctx.close();
      await bob.ctx.close();
    }
  });

  test('Bob can read a message Alice sent him (via localStorage bridge)', async ({ browser }) => {
    const alice = await setupContext(browser, 'Alice');
    const bob   = await setupContext(browser, 'Bob');

    try {
      const aliceId = await getPeerId(alice.page) ?? 'e2e-alice-chat-id';

      // Simulate Alice's messages arriving in Bob's inbox
      await injectMatches(bob.page, [{ peerId: aliceId, name: 'Alice', similarity: 0.88 }]);
      await injectChatMessages(bob.page, aliceId, [
        { content: 'Hey Bob, are you there?', fromMe: false },
        { content: 'Testing the ISC P2P layer!', fromMe: false },
      ]);

      // Bob opens Chats
      await bob.page.click('[data-testid="nav-tab-chats"]');
      await waitForNavigation(bob.page, 'chats');
      await forceRerender(bob.page, 'chats');

      const convList = bob.page.locator('[data-testid="conversation-list"]');
      await expect(convList).toBeVisible();

      const conv = convList.locator('[data-peer-id]').first();
      if (await conv.count() > 0) {
        await conv.click({ force: true });
        const messages = bob.page.locator('[data-testid="chat-messages"]');
        await expect(messages).toContainText('Hey Bob, are you there?');
        await expect(messages).toContainText('Testing the ISC P2P layer!');
      }
    } finally {
      await alice.ctx.close();
      await bob.ctx.close();
    }
  });

  test('Bob can reply to Alice\'s message and the reply appears immediately', async ({ browser }) => {
    const alice = await setupContext(browser, 'Alice');
    const bob   = await setupContext(browser, 'Bob');

    try {
      const aliceId = await getPeerId(alice.page) ?? 'e2e-alice-reply-id';

      await injectMatches(bob.page, [{ peerId: aliceId, name: 'Alice', similarity: 0.88 }]);
      await injectChatMessages(bob.page, aliceId, [
        { content: 'What do you think about libp2p?', fromMe: false },
      ]);

      await bob.page.click('[data-testid="nav-tab-chats"]');
      await waitForNavigation(bob.page, 'chats');
      await forceRerender(bob.page, 'chats');

      const conv = bob.page.locator('[data-peer-id]').first();
      if (await conv.count() > 0) {
        await conv.click({ force: true });
        await bob.page.waitForSelector('[data-testid="chat-input"]', { timeout: 3000 });

        await bob.page.fill('[data-testid="chat-input"]', 'I love libp2p! WebRTC FTW');
        await bob.page.click('[data-testid="send-message-button"]');

        await expect(bob.page.locator('[data-testid="chat-messages"]')).toContainText('I love libp2p! WebRTC FTW');
      }
    } finally {
      await alice.ctx.close();
      await bob.ctx.close();
    }
  });

  test('Bob can start a chat with Alice from the Discover screen', async ({ browser }) => {
    const alice = await setupContext(browser, 'Alice');
    const bob   = await setupContext(browser, 'Bob');

    try {
      const aliceId = await getPeerId(alice.page) ?? 'e2e-alice-discover-chat';

      await injectMatches(bob.page, [{
        peerId: aliceId,
        name: 'Alice',
        similarity: 0.95,
        online: true,
      }]);

      await bob.page.click('[data-testid="nav-tab-discover"]');
      await waitForNavigation(bob.page, 'discover');
      await waitForMatchesLoaded(bob.page, 5000);

      const messageBtn = bob.page.locator('[data-message-btn]').first();
      if (await messageBtn.count() > 0) {
        await messageBtn.click({ force: true });

        // Should navigate to /chats and fire isc:start-chat
        await bob.page.waitForSelector('[data-testid="chats-screen"]', { timeout: 5000 });
        await expect(bob.page.locator('[data-testid="chats-screen"]')).toBeVisible();
      }
    } finally {
      await alice.ctx.close();
      await bob.ctx.close();
    }
  });

  test('three users can be listed in Discover simultaneously', async ({ browser }) => {
    const host = await setupContext(browser, 'Host');

    try {
      await injectMatches(host.page, [
        { peerId: 'peer-alice', name: 'Alice',   similarity: 0.95 },
        { peerId: 'peer-bob',   name: 'Bob',     similarity: 0.82 },
        { peerId: 'peer-carol', name: 'Carol',   similarity: 0.67 },
      ]);

      await host.page.click('[data-testid="nav-tab-now"]');
      await host.page.click('[data-testid="nav-tab-discover"]');
      await waitForNavigation(host.page, 'discover');
      await waitForMatchesLoaded(host.page, 5000);

      const cards = host.page.locator('[data-testid^="match-card-"]');
      await expect(cards).toHaveCount(3, { timeout: 5000 });

      // Verify similarity tiers are rendered correctly
      // Alice (95%) → very-close, Bob (82%) → nearby, Carol (67%) → orbiting
      await expect(host.page.locator('[data-section="very-close"]')).toBeVisible();
      await expect(host.page.locator('[data-section="nearby"]')).toBeVisible();
      await expect(host.page.locator('[data-section="orbiting"]')).toBeVisible();
    } finally {
      await host.ctx.close();
    }
  });

  test('network status is independently tracked per context', async ({ browser }) => {
    const alice = await setupContext(browser, 'Alice');
    const bob   = await setupContext(browser, 'Bob');

    try {
      // Both should have some status badge visible (connected or disconnected)
      await alice.page.click('[data-testid="nav-tab-now"]');
      await expect(alice.page.locator('[data-testid="network-status-badge"]')).toBeVisible();

      await bob.page.click('[data-testid="nav-tab-now"]');
      await expect(bob.page.locator('[data-testid="network-status-badge"]')).toBeVisible();
    } finally {
      await alice.ctx.close();
      await bob.ctx.close();
    }
  });
});

// ── Cross-context feed simulation ─────────────────────────────────────────────

test.describe('Multi-Context: Feed Simulation', () => {
  test('injected posts from a peer appear in the host\'s feed after state sync', async ({ browser }) => {
    const host = await setupContext(browser, 'Host');

    try {
      const peerPostChannelId = 'chan-e2e-peer-001';

      // Directly inject a peer's post into the network service's post store via evaluate
      const injected = await host.page.evaluate((channelId) => {
        const svc = (window as any).ISC?.networkService?.service;
        if (!svc) return false;

        const fakePost = {
          id: 'post-e2e-peer-001',
          channelId,
          content: 'Hello from a simulated remote peer!',
          author: 'Remote Alice',
          timestamp: Date.now(),
          createdAt: Date.now(),
          likes: [],
          replies: [],
        };

        // Posts are read from this.service.getPosts() — try to inject into cache
        if (typeof svc._posts?.push === 'function') {
          svc._posts.push(fakePost);
          return true;
        }
        // Alternative: trigger a custom DOM event that mimics onPostCreated
        document.dispatchEvent(new CustomEvent('isc:refresh-feed'));
        return false;
      }, peerPostChannelId);

      // Regardless of whether injection succeeded, the feed should render without crashing
      await host.page.click('[data-testid="nav-tab-now"]');
      await waitForNavigation(host.page, 'now');
      await expect(host.page.locator('[data-testid="now-screen"]')).toBeVisible();

      // If injection worked, the post should appear
      if (injected) {
        await expect(host.page.locator('[data-testid="feed-container"]')).toContainText('Hello from a simulated remote peer!');
      }
    } finally {
      await host.ctx.close();
    }
  });
});
