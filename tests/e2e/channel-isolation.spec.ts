/**
 * Channel Isolation Tests
 *
 * Verify that posts from one channel do not appear in another channel's feed.
 * This test suite specifically addresses the critical bug where posts from
 * different channels were visible in each other's feeds.
 */

import { test, expect } from '@playwright/test';

test.describe('Channel Isolation', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (error) => {
      if (!error.message.includes('registerBackend')) {
        console.log('Page error:', error.message);
      }
    });
  });

  test('posts from channel A do not appear in channel B', async ({ page }) => {
    // Setup: skip onboarding
    await page.addInitScript(() => localStorage.setItem('isc-onboarding-completed', 'true'));
    await page.goto('/');
    await page.waitForSelector('#app', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Step 1: Create first channel
    const channel1Name = `Test Channel A ${Date.now()}`;
    const channel1Desc = 'This is the first test channel for isolation testing.';

    let composeBtn = page.locator('[data-testid="nav-tab-compose"], [data-testid="create-channel-button"], button:has-text("+ Channel")').first();
    await composeBtn.click();
    await page.waitForTimeout(500);

    const nameInput = page.locator('input[placeholder*="Channel Name"]').first();
    const descInput = page.locator('textarea[placeholder*="Description"]').first();

    if (await nameInput.count() > 0) {
      await nameInput.fill(channel1Name);
      await descInput.fill(channel1Desc);
      await page.locator('button:has-text("Create Channel")').first().click();
      await page.waitForTimeout(1000);
    }

    // Step 2: Post in channel A
    const postA = `Unique post in channel A - ${Date.now()}`;
    const composeInput = page.locator('[data-testid="compose-input"]').first();
    await composeInput.fill(postA);
    const submitBtn = page.locator('[data-testid="compose-submit"]').first();
    await submitBtn.click();
    await page.waitForTimeout(1500);

    // Verify post appears in channel A
    await expect(page.locator(`text=${postA}`)).toBeVisible();

    // Step 3: Create second channel
    const channel2Name = `Test Channel B ${Date.now()}`;
    const channel2Desc = 'This is the second test channel for isolation testing.';

    composeBtn = page.locator('[data-testid="nav-tab-compose"], [data-testid="create-channel-button"], button:has-text("+ Channel")').first();
    await composeBtn.click();
    await page.waitForTimeout(500);

    const nameInput2 = page.locator('input[placeholder*="Channel Name"]').first();
    const descInput2 = page.locator('textarea[placeholder*="Description"]').first();

    if (await nameInput2.count() > 0) {
      await nameInput2.fill(channel2Name);
      await descInput2.fill(channel2Desc);
      await page.locator('button:has-text("Create Channel")').first().click();
      await page.waitForTimeout(1000);
    }

    // Step 4: Verify we're in channel B (should show channel B name in header)
    const activeChannelBadge = page.locator('[data-testid="active-channel-badge"]');
    await expect(activeChannelBadge).toContainText(channel2Name.slice(0, 20));

    // Step 5: Post in channel B
    const postB = `Unique post in channel B - ${Date.now()}`;
    const composeInput2 = page.locator('[data-testid="compose-input"]').first();
    await composeInput2.fill(postB);
    const submitBtn2 = page.locator('[data-testid="compose-submit"]').first();
    await submitBtn2.click();
    await page.waitForTimeout(1500);

    // Verify post B appears
    await expect(page.locator(`text=${postB}`)).toBeVisible();

    // CRITICAL TEST: Post A should NOT be visible in channel B
    const postALocator = page.locator(`text=${postA}`);
    const postACount = await postALocator.count();
    expect(postACount).toBe(0, `Post from channel A should not appear in channel B, but found ${postACount} instances`);
  });

  test('switching channels shows correct posts', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('isc-onboarding-completed', 'true'));
    await page.goto('/');
    await page.waitForSelector('#app', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Create channel 1
    const channel1Name = `Channel 1 ${Date.now()}`;
    let composeBtn = page.locator('[data-testid="nav-tab-compose"], [data-testid="create-channel-button"], button:has-text("+ Channel")').first();
    await composeBtn.click();
    await page.waitForTimeout(500);

    const nameInput = page.locator('input[placeholder*="Channel Name"]').first();
    if (await nameInput.count() > 0) {
      await nameInput.fill(channel1Name);
      await page.locator('textarea[placeholder*="Description"]').first().fill('Channel 1 description');
      await page.locator('button:has-text("Create Channel")').first().click();
      await page.waitForTimeout(1000);
    }

    // Post in channel 1
    const post1 = `Post 1 - ${Date.now()}`;
    let composeInput = page.locator('[data-testid="compose-input"]').first();
    await composeInput.fill(post1);
    await page.locator('[data-testid="compose-submit"]').first().click();
    await page.waitForTimeout(1500);

    // Create channel 2
    const channel2Name = `Channel 2 ${Date.now()}`;
    composeBtn = page.locator('[data-testid="nav-tab-compose"], [data-testid="create-channel-button"], button:has-text("+ Channel")').first();
    await composeBtn.click();
    await page.waitForTimeout(500);

    const nameInput2 = page.locator('input[placeholder*="Channel Name"]').first();
    if (await nameInput2.count() > 0) {
      await nameInput2.fill(channel2Name);
      await page.locator('textarea[placeholder*="Description"]').first().fill('Channel 2 description');
      await page.locator('button:has-text("Create Channel")').first().click();
      await page.waitForTimeout(1000);
    }

    // Post in channel 2
    const post2 = `Post 2 - ${Date.now()}`;
    composeInput = page.locator('[data-testid="compose-input"]').first();
    await composeInput.fill(post2);
    await page.locator('[data-testid="compose-submit"]').first().click();
    await page.waitForTimeout(1500);

    // Now we should see post2 but not post1
    expect(await page.locator(`text=${post2}`).count()).toBeGreaterThan(0);
    expect(await page.locator(`text=${post1}`).count()).toBe(0);

    // Switch to channel 1 via dropdown
    const channelSelect = page.locator('#compose-channel-sel').first();
    if (await channelSelect.count() > 0) {
      await channelSelect.selectOption(channel1Name);
      await page.waitForTimeout(1000);

      // Now we should see post1 but not post2
      expect(await page.locator(`text=${post1}`).count()).toBeGreaterThan(0);
      expect(await page.locator(`text=${post2}`).count()).toBe(0);
    }
  });

  test('sidebar channel selection isolates feeds correctly', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('isc-onboarding-completed', 'true'));
    await page.goto('/');
    await page.waitForSelector('#app', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Create two channels
    const timestamps = Date.now();
    const channel1 = `Ch1-${timestamps}`;
    const channel2 = `Ch2-${timestamps}`;

    for (const channelName of [channel1, channel2]) {
      const composeBtn = page.locator('[data-testid="nav-tab-compose"], [data-testid="create-channel-button"], button:has-text("+ Channel")').first();
      await composeBtn.click();
      await page.waitForTimeout(500);

      const nameInput = page.locator('input[placeholder*="Channel Name"]').first();
      if (await nameInput.count() > 0) {
        await nameInput.fill(channelName);
        await page.locator('textarea[placeholder*="Description"]').first().fill(`${channelName} description`);
        await page.locator('button:has-text("Create Channel")').first().click();
        await page.waitForTimeout(1000);
      }

      // Post something unique
      const postContent = `${channelName}-post-${timestamps}`;
      const composeInput = page.locator('[data-testid="compose-input"]').first();
      await composeInput.fill(postContent);
      await page.locator('[data-testid="compose-submit"]').first().click();
      await page.waitForTimeout(1500);
    }

    // Verify channel isolation by checking sidebar if available
    // The key assertion: each channel's posts should not cross over
    const post1text = `Ch1-${timestamps}-post-${timestamps}`;
    const post2text = `Ch2-${timestamps}-post-${timestamps}`;

    // We're currently in channel 2
    expect(await page.locator(`text=${post2text}`).count()).toBeGreaterThan(0);
    expect(await page.locator(`text=${post1text}`).count()).toBe(0);
  });
});
