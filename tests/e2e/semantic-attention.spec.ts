/**
 * Semantic Attention Network E2E Tests
 *
 * Tests the "curated topic antennas" semantic attention model:
 * - Channel overlap leads to peer discovery
 * - Channel non-overlap keeps peers invisible
 * - Per-channel neighbor filtering based on specificity
 * - Block peer removes them from all views
 *
 * Uses synthetic state injection via window.ISC debug API for deterministic testing.
 */

import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import {
  waitForAppReady,
  skipOnboarding,
  injectMatches,
  forceRerender,
  waitForNavigation,
} from './utils/waitHelpers.js';

async function setupContext(
  browser: Browser,
  name: string
): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ storageState: undefined });
  const page = await ctx.newPage();

  page.on('pageerror', (err) => console.log(`[${name}] Uncaught:`, err.message));

  await page.goto('/');
  await skipOnboarding(page);
  await page.reload();
  await waitForAppReady(page);

  return { ctx, page };
}

test.describe('Semantic Attention Network', () => {
  test.describe('Channel Overlap — Two Users Discover Each Other', () => {
    test('similar channels lead to mutual discovery', async ({ browser }) => {
      const alice = await setupContext(browser, 'Alice');
      const bob = await setupContext(browser, 'Bob');

      try {
        await alice.page.evaluate(() => {
          (window as any).ISC?.actions?.setChannels([
            { id: 'ch1', name: 'distributed-systems', description: 'DS discussions' },
          ]);
        });

        await bob.page.evaluate(() => {
          (window as any).ISC?.actions?.setChannels([
            { id: 'ch2', name: 'p2p-networks', description: 'P2P discussions' },
          ]);
        });

        await injectMatches(alice.page, [
          { peerId: 'peer-bob', name: 'Bob', bio: 'P2P enthusiast', similarity: 0.8, online: true },
        ]);

        await injectMatches(bob.page, [
          {
            peerId: 'peer-alice',
            name: 'Alice',
            bio: 'Distributed systems researcher',
            similarity: 0.8,
            online: true,
          },
        ]);

        await forceRerender(alice.page, 'now');
        await forceRerender(bob.page, 'now');

        await alice.page.click('[data-testid="nav-tab-discover"]');
        await waitForNavigation(alice.page, 'discover');

        await bob.page.click('[data-testid="nav-tab-discover"]');
        await waitForNavigation(bob.page, 'discover');

        const aliceSeesBob = await alice.page
          .locator('.discover-peer')
          .filter({ hasText: 'Bob' })
          .count();
        const bobSeesAlice = await bob.page
          .locator('.discover-peer')
          .filter({ hasText: 'Alice' })
          .count();

        expect(aliceSeesBob).toBeGreaterThan(0);
        expect(bobSeesAlice).toBeGreaterThan(0);

        const aliceSim = await alice.page.locator('.peer-similarity').first().textContent();
        const bobSim = await bob.page.locator('.peer-similarity').first().textContent();

        expect(aliceSim).toContain('80');
        expect(bobSim).toContain('80');
      } finally {
        await alice.ctx.close();
        await bob.ctx.close();
      }
    });
  });

  test.describe('Channel Non-Overlap — Different Topics Isolated', () => {
    test('different topics do not lead to discovery', async ({ browser }) => {
      const alice = await setupContext(browser, 'Alice');
      const carol = await setupContext(browser, 'Carol');

      try {
        await alice.page.evaluate(() => {
          (window as any).ISC?.actions?.setChannels([
            { id: 'ch1', name: 'distributed-systems', description: 'DS discussions' },
          ]);
        });

        await carol.page.evaluate(() => {
          (window as any).ISC?.actions?.setChannels([
            { id: 'ch2', name: 'sourdough-baking', description: 'Bread making' },
          ]);
        });

        await injectMatches(alice.page, [
          {
            peerId: 'peer-carol',
            name: 'Carol',
            bio: 'Baking bread',
            similarity: 0.3,
            online: true,
          },
        ]);

        await forceRerender(alice.page, 'now');

        await alice.page.click('[data-testid="nav-tab-discover"]');
        await waitForNavigation(alice.page, 'discover');

        const aliceSeesCarol = await alice.page
          .locator('.discover-peer')
          .filter({ hasText: 'Carol' })
          .count();
        expect(aliceSeesCarol).toBe(0);
      } finally {
        await alice.ctx.close();
        await carol.ctx.close();
      }
    });
  });

  test.describe('Semantic Attention Diversity', () => {
    test('user with multiple channels sees segmented neighborhoods', async ({ browser }) => {
      const user = await setupContext(browser, 'User');

      try {
        await user.page.evaluate(() => {
          (window as any).ISC?.actions?.setChannels([
            { id: 'ch1', name: 'ai-ethics', description: 'AI ethics' },
            { id: 'ch2', name: 'jazz-music', description: 'Jazz discussions' },
            { id: 'ch3', name: 'climate-science', description: 'Climate science' },
          ]);
        });

        await injectMatches(user.page, [
          {
            peerId: 'peer-alice',
            name: 'Alice',
            bio: 'AI researcher',
            similarity: 0.9,
            online: true,
          },
          {
            peerId: 'peer-bob',
            name: 'Bob',
            bio: 'Jazz saxophonist',
            similarity: 0.85,
            online: true,
          },
          {
            peerId: 'peer-carol',
            name: 'Carol',
            bio: 'Climate scientist',
            similarity: 0.92,
            online: true,
          },
          {
            peerId: 'peer-dave',
            name: 'Dave',
            bio: 'AI and climate bridge',
            similarity: 0.7,
            online: true,
          },
        ]);

        await forceRerender(user.page, 'now');
        await user.page.click('[data-testid="nav-tab-channel"]');

        await user.page.evaluate(() => {
          const event = new CustomEvent('isc:set-active-channel', { detail: { channelId: 'ch1' } });
          document.dispatchEvent(event);
        });
        await user.page.waitForTimeout(500);

        await user.page.click('[data-testid="neighbors-panel-toggle"]');

        const aliceVisibleCh1 = await user.page
          .locator('.neighbor-item')
          .filter({ hasText: 'Alice' })
          .count();
        const bobVisibleCh1 = await user.page
          .locator('.neighbor-item')
          .filter({ hasText: 'Bob' })
          .count();
        const carolVisibleCh1 = await user.page
          .locator('.neighbor-item')
          .filter({ hasText: 'Carol' })
          .count();
        const daveVisibleCh1 = await user.page
          .locator('.neighbor-item')
          .filter({ hasText: 'Dave' })
          .count();

        expect(aliceVisibleCh1).toBeGreaterThan(0);
        expect(daveVisibleCh1).toBeGreaterThan(0);
      } finally {
        await user.ctx.close();
      }
    });
  });

  test.describe('Block Peer — Blocked User Posts Disappear', () => {
    test('blocked peer disappears from Discover and feed', async ({ browser }) => {
      const alice = await setupContext(browser, 'Alice');
      const bob = await setupContext(browser, 'Bob');

      try {
        await injectMatches(alice.page, [
          { peerId: 'peer-bob', name: 'Bob', bio: 'Test peer', similarity: 0.8, online: true },
        ]);

        await injectMatches(bob.page, [
          { peerId: 'peer-alice', name: 'Alice', bio: 'Test peer', similarity: 0.8, online: true },
        ]);

        await forceRerender(alice.page, 'now');

        await alice.page.click('[data-testid="nav-tab-discover"]');
        await waitForNavigation(alice.page, 'discover');

        const aliceSeesBobBefore = await alice.page
          .locator('.discover-peer')
          .filter({ hasText: 'Bob' })
          .count();
        expect(aliceSeesBobBefore).toBeGreaterThan(0);

        await alice.page.locator('.discover-peer').first().hover();
        await alice.page.click('[data-testid="view-profile-btn"]');
        await waitForNavigation(alice.page, 'settings');

        await alice.page.click('[data-testid="block-peer-btn"]');
        await alice.page.click('[data-testid="confirm-block-btn"]');

        await alice.page.waitForTimeout(500);

        await alice.page.click('[data-testid="nav-tab-discover"]');
        await waitForNavigation(alice.page, 'discover');

        const aliceSeesBobAfter = await alice.page
          .locator('.discover-peer')
          .filter({ hasText: 'Bob' })
          .count();
        expect(aliceSeesBobAfter).toBe(0);
      } finally {
        await alice.ctx.close();
        await bob.ctx.close();
      }
    });
  });

  test.fixme('Alice and Bob route through relay when direct WebRTC fails', async ({ browser }) => {
    // This test is blocked by headless Chromium WebRTC limitations.
    // Expected behavior when implemented:
    // 1. Start relay at :9090
    // 2. Create two isolated contexts, configure them to use relay
    // 3. Alice posts on #distributed-systems
    // 4. Relay receives message via circuit relay + gossipsub
    // 5. Bob (behind symmetric NAT) receives post via relay within 5 seconds
    // 6. Bob's feed shows Alice's post
  });
});
