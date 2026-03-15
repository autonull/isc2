/**
 * Test Helpers for ISC Browser App
 * 
 * Common utilities for setting up tests, creating mock data, and assertions.
 */

import { test, expect, type Page } from '@playwright/test';
import { generateMockDataset, type MockDataset } from './dev/mockData.js';

/**
 * Test fixtures that can be reused across tests
 */
export const fixtures = {
  /** Valid channel data */
  validChannel: {
    name: 'Test Channel',
    description: 'A test channel for testing purposes',
    spread: 50,
  },

  /** Invalid channel data (too short name) */
  invalidChannelShort: {
    name: 'Ab',
    description: 'Description is fine',
    spread: 50,
  },

  /** Invalid channel data (no description) */
  invalidChannelNoDesc: {
    name: 'Valid Name',
    description: '',
    spread: 50,
  },

  /** Valid post content */
  validPost: 'This is a test post with sufficient content.',

  /** Invalid post content (too short) */
  invalidPostShort: 'Too short',

  /** User credentials */
  testUser: {
    name: 'Test User',
    email: 'test@example.com',
  },
};

/**
 * Wait for the app to be fully loaded
 */
export async function waitForAppLoad(page: Page, timeout = 10000): Promise<void> {
  await page.waitForSelector('[data-testid="sidebar"]', { timeout });
  await page.waitForTimeout(500); // Extra buffer for animations
}

/**
 * Wait for a specific screen to be visible
 */
export async function waitForScreen(page: Page, screenName: string, timeout = 5000): Promise<void> {
  const selector = `[data-testid="${screenName}-screen"]`;
  await page.waitForSelector(selector, { timeout, state: 'visible' });
}

/**
 * Navigate to a screen using the sidebar
 */
export async function navigateToScreen(page: Page, screenName: string): Promise<void> {
  const tabSelector = `[data-testid="nav-tab-${screenName}"]`;
  await page.click(tabSelector);
  await waitForScreen(page, screenName);
}

/**
 * Create a channel via the UI
 */
export async function createChannel(
  page: Page,
  options: { name?: string; description?: string; spread?: number } = {}
): Promise<{ name: string; description: string }> {
  const name = options.name || `Test Channel ${Date.now()}`;
  const description = options.description || 'A test channel for demonstration';
  const spread = options.spread || 50;

  // Navigate to compose screen
  await navigateToScreen(page, 'compose');

  // Fill in the form
  await page.fill('input[name="name"]', name);
  await page.fill('textarea[name="description"]', description);
  
  // Adjust spread slider if needed
  if (spread !== 50) {
    const slider = page.locator('input[type="range"]');
    await slider.evaluate((el, value) => {
      (el as HTMLInputElement).value = String(value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, spread);
  }

  // Submit
  await page.click('button[type="submit"]');
  
  // Wait for success
  await page.waitForSelector('[data-testid="channel-created"]', { timeout: 5000 });

  return { name, description };
}

/**
 * Create a post via the UI
 */
export async function createPost(
  page: Page,
  content: string,
  channelId?: string
): Promise<string> {
  // Navigate to now screen (or channel screen if channelId provided)
  if (channelId) {
    await page.goto(`/channel/${channelId}`);
  } else {
    await navigateToScreen(page, 'now');
  }

  // Find compose box
  const composeBox = page.locator('[data-testid="compose-post"]');
  await composeBox.click();
  
  // Type content
  await composeBox.fill(content);
  
  // Submit
  await page.click('[data-testid="submit-post"]');
  
  // Wait for post to appear
  await page.waitForSelector('[data-testid="post"]', { timeout: 5000 });

  return content;
}

/**
 * Get all posts currently visible in the feed
 */
export async function getVisiblePosts(page: Page): Promise<Array<{ id: string; content: string }>> {
  const posts = page.locator('[data-testid="post"]');
  const count = await posts.count();
  
  const result = [];
  for (let i = 0; i < count; i++) {
    const post = posts.nth(i);
    const id = await post.getAttribute('data-post-id');
    const content = await post.locator('[data-testid="post-content"]').textContent();
    result.push({ id: id || '', content: content || '' });
  }
  
  return result;
}

/**
 * Get all channels in the sidebar
 */
export async function getSidebarChannels(page: Page): Promise<Array<{ id: string; name: string }>> {
  const channels = page.locator('[data-testid="channel-item"]');
  const count = await channels.count();
  
  const result = [];
  for (let i = 0; i < count; i++) {
    const channel = channels.nth(i);
    const id = await channel.getAttribute('data-channel-id');
    const name = await channel.textContent();
    result.push({ id: id || '', name: name || '' });
  }
  
  return result;
}

/**
 * Toggle a setting and verify it changed
 */
export async function toggleSetting(
  page: Page,
  settingName: string,
  expectedState: boolean
): Promise<void> {
  const toggle = page.locator(`[data-testid="setting-${settingName}"]`);
  await toggle.click();
  
  // Verify state
  const isActive = await toggle.getAttribute('data-active') === 'true';
  expect(isActive).toBe(expectedState);
}

/**
 * Take a screenshot with consistent naming
 */
export async function takeScreenshot(
  page: Page,
  name: string,
  options: { fullPage?: boolean; clip?: { x: number; y: number; width: number; height: number } } = {}
): Promise<string> {
  const path = `test-results/screenshots/${name}-${Date.now()}.png`;
  await page.screenshot({ path, fullPage: options.fullPage, clip: options.clip });
  return path;
}

/**
 * Start video recording of the page
 */
export async function startRecording(page: Page): Promise<void> {
  // Playwright video is automatic when configured
  // This is a placeholder for any additional setup
}

/**
 * Stop video recording and save
 */
export async function stopRecording(page: Page, name: string): Promise<string> {
  const video = page.video();
  if (video) {
    const path = `test-results/videos/${name}-${Date.now()}.webm`;
    await video.saveAs(path);
    return path;
  }
  return '';
}

/**
 * Setup test with mock data injected into the page
 */
export async function setupWithMockData(
  page: Page,
  dataset?: MockDataset
): Promise<MockDataset> {
  const data = dataset || generateMockDataset({
    channelCount: 5,
    postsPerChannel: 3,
    commentsPerPost: 2,
  });

  // Inject mock data into window object
  await page.evaluate((mockData) => {
    (window as any).__MOCK_DATA__ = mockData;
  }, data);

  return data;
}

/**
 * Clear all app data (IndexedDB, localStorage)
 */
export async function clearAppData(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    // IndexedDB clearing would require more complex code
  });
}

/**
 * Wait for a toast/notification to appear
 */
export async function waitForToast(page: Page, message?: string): Promise<void> {
  const selector = message
    ? `[data-testid="toast"]:has-text("${message}")`
    : '[data-testid="toast"]';
  await page.waitForSelector(selector, { timeout: 5000, state: 'visible' });
}

/**
 * Dismiss any visible toasts
 */
export async function dismissToasts(page: Page): Promise<void> {
  const toasts = page.locator('[data-testid="toast"]');
  const count = await toasts.count();
  for (let i = 0; i < count; i++) {
    await toasts.nth(i).click(); // Or find dismiss button
  }
}

/**
 * Assert that an element is visible
 */
export async function assertVisible(page: Page, selector: string): Promise<void> {
  await expect(page.locator(selector)).toBeVisible();
}

/**
 * Assert that an element is not visible
 */
export async function assertNotVisible(page: Page, selector: string): Promise<void> {
  await expect(page.locator(selector)).not.toBeVisible();
}

/**
 * Assert that text is present
 */
export async function assertText(page: Page, selector: string, expectedText: string): Promise<void> {
  await expect(page.locator(selector)).toContainText(expectedText);
}

/**
 * Assert that a field has a specific value
 */
export async function assertValue(page: Page, selector: string, expectedValue: string): Promise<void> {
  await expect(page.locator(selector)).toHaveValue(expectedValue);
}

/**
 * Run a test with standard setup
 */
export function testWithSetup(
  name: string,
  fn: (page: Page) => Promise<void>
): void {
  test(name, async ({ page }) => {
    // Navigate to app
    await page.goto('/');
    await waitForAppLoad(page);
    
    // Run test
    await fn(page);
  });
}

/**
 * Describe a feature with standard setup
 */
export function describeFeature(
  name: string,
  fn: () => void
): void {
  test.describe(name, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await waitForAppLoad(page);
    });
    
    fn();
  });
}

/**
 * Mock the channel manager for testing
 */
export function createMockChannelManager(overrides?: any) {
  return {
    createChannel: async () => ({ id: 'test-1', name: 'Test', description: '', spread: 50, relations: [], createdAt: Date.now(), updatedAt: Date.now(), active: true }),
    getChannel: async () => null,
    getAllChannels: async () => [],
    updateChannel: async () => null,
    deleteChannel: async () => {},
    activateChannel: async () => {},
    deactivateChannel: async () => {},
    forkChannel: async () => null,
    archiveChannel: async () => {},
    computeChannelDistributions: async () => [],
    activateChannelWithEmbedding: async () => {},
    getActiveChannelCount: () => 0,
    isActive: () => false,
    ...overrides,
  };
}

/**
 * Mock the post service for testing
 */
export function createMockPostService(overrides?: any) {
  return {
    create: async () => ({ id: 'post-1', content: '', channelID: '', author: '', timestamp: Date.now(), signature: '' }),
    get: async () => null,
    getAll: async () => [],
    like: async () => {},
    repost: async () => {},
    reply: async () => ({ id: 'reply-1', content: '', postId: '', author: '', timestamp: Date.now() }),
    ...overrides,
  };
}

/**
 * Generate a unique test identifier
 */
export function testId(prefix = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
}
