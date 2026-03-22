/**
 * Feed Testing Helpers
 *
 * Utilities for testing feed behavior and channel isolation in e2e tests.
 */

import { Page } from '@playwright/test';

/**
 * Get all posts currently visible in the feed
 */
export async function getFeedPosts(page: Page): Promise<string[]> {
  const postElements = await page.locator('[data-testid="post-card"]').all();
  const posts: string[] = [];

  for (const el of postElements) {
    const content = await el.locator('[data-testid="post-content"]').textContent();
    if (content) {
      posts.push(content.trim());
    }
  }

  return posts;
}

/**
 * Get the currently active channel name from the header badge
 */
export async function getActiveChannelName(page: Page): Promise<string | null> {
  const badge = page.locator('[data-testid="active-channel-badge"]');
  if (await badge.count() === 0) {
    return null; // No active channel (For You feed)
  }
  const text = await badge.textContent();
  return text ? text.replace('#', '').trim() : null;
}

/**
 * Expect a specific post to be visible in the current feed
 */
export async function expectPostInFeed(page: Page, postContent: string) {
  const posts = await getFeedPosts(page);
  if (!posts.some((p) => p.includes(postContent))) {
    throw new Error(
      `Post "${postContent}" not found in feed.\nFeed contains: ${posts.join('\n')}`
    );
  }
}

/**
 * Expect a specific post to NOT be visible in the current feed
 */
export async function expectPostNotInFeed(page: Page, postContent: string) {
  const posts = await getFeedPosts(page);
  if (posts.some((p) => p.includes(postContent))) {
    throw new Error(
      `Post "${postContent}" should not be in feed but was found.\nFeed contains: ${posts.join('\n')}`
    );
  }
}

/**
 * Switch to a channel by name using the compose channel selector
 */
export async function switchToChannel(page: Page, channelName: string) {
  const select = page.locator('#compose-channel-sel').first();
  if (await select.count() === 0) {
    throw new Error('Channel selector not found');
  }
  await select.selectOption(channelName);
  await page.waitForTimeout(500);
}

/**
 * Create a new channel with a unique name and description
 */
export async function createChannel(
  page: Page,
  name: string,
  description: string = 'Test channel'
) {
  const composeBtn = page
    .locator('[data-testid="nav-tab-compose"], [data-testid="create-channel-button"], button:has-text("+ Channel")')
    .first();
  await composeBtn.click();
  await page.waitForTimeout(500);

  const nameInput = page.locator('input[placeholder*="Channel Name"]').first();
  if (await nameInput.count() === 0) {
    throw new Error('Channel creation form not found');
  }

  await nameInput.fill(name);
  await page.locator('textarea[placeholder*="Description"]').first().fill(description);
  await page.locator('button:has-text("Create Channel")').first().click();
  await page.waitForTimeout(1000);
}

/**
 * Post a message in the current channel
 */
export async function postMessage(page: Page, content: string) {
  const input = page.locator('[data-testid="compose-input"]').first();
  if (await input.count() === 0) {
    throw new Error('Compose input not found');
  }
  await input.fill(content);
  const submitBtn = page.locator('[data-testid="compose-submit"]').first();
  await submitBtn.click();
  await page.waitForTimeout(1500);
}

/**
 * Get the post count displayed in the feed
 */
export async function getVisiblePostCount(page: Page): Promise<number> {
  const countEl = page.locator('[data-testid="post-count"]').first();
  if (await countEl.count() === 0) {
    return 0;
  }
  const text = await countEl.textContent();
  const match = text?.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}
