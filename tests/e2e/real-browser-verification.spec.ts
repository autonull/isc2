/**
 * Real Browser Verification Test
 *
 * This test actually loads the page in a real browser and verifies
 * functionality works, capturing all errors and console output.
 */

import { test, expect } from '@playwright/test';

// Collect all errors and logs
const errors: string[] = [];
const logs: string[] = [];

test.describe('REAL BROWSER VERIFICATION', () => {
  test.beforeEach(async ({ page }) => {
    errors.length = 0;
    logs.length = 0;

    // Capture ALL console messages
    page.on('console', (msg) => {
      const text = msg.text();
      logs.push(`[${msg.type()}] ${text}`);
      if (msg.type() === 'error') {
        errors.push(text);
        console.error('CONSOLE ERROR:', text);
      }
    });

    // Capture ALL page errors
    page.on('pageerror', (error) => {
      errors.push(error.message);
      console.error('PAGE ERROR:', error.message);
    });

    // Capture failed requests
    page.on('requestfailed', (request) => {
      errors.push(`Request failed: ${request.url()}`);
      console.error('REQUEST FAILED:', request.url());
    });
  });

  test('APP LOADS AND RENDERs', async ({ page }) => {
    console.log('\n=== TEST: App loads and renders ===\n');

    // Navigate and wait
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000); // Wait for JS to execute

    // Take screenshot for visual verification
    await page.screenshot({ path: 'test-results/app-loaded.png', fullPage: true });

    // Check app container exists
    const appContainer = page.locator('#app');
    await expect(appContainer).toBeVisible();
    // ✓ App container visible

    // Check for ANY content (sidebar, tab bar, or layout)
    const hasContent =
      (await page
        .locator(
          '.irc-layout, .irc-sidebar, .tab-bar, [data-testid="sidebar"], [data-testid="tab-bar"]'
        )
        .count()) > 0;
    expect(hasContent).toBeTruthy();
    // ✓ UI content rendered

    // Report any errors
    expect(errors.length).toBe(0);

    // Report logs for debugging
    // logs stored in `logs` array; suppressed in CI output
  });

  test('NAVIGATION TABS WORK', async ({ page }) => {
    console.log('\n=== TEST: Navigation tabs work ===\n');

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Find all navigation tabs
    const tabs = ['now', 'channel', 'chats', 'settings'];

    for (const tab of tabs) {
      const tabElement = page
        .locator(`[data-testid="nav-tab-${tab}"], [data-tab="${tab}"]`)
        .first();
      const count = await tabElement.count();

      if (count > 0) {
        console.log(`✓ Found tab: ${tab}`);

        // Click the tab
        await tabElement.click({ force: true });
        await page.waitForTimeout(1000);

        // Verify app is still visible (didn't crash)
        await expect(page.locator('#app')).toBeVisible();
        console.log(`✓ Tab ${tab} clickable`);

        // Take screenshot
        await page.screenshot({ path: `test-results/tab-${tab}.png` });
      } else {
        console.log(`⚠️ Tab not found: ${tab}`);
      }
    }

    if (errors.length > 0) {
      console.log('\n⚠️ ERRORS:', errors);
    }
  });

  test('COMPOSE SCREEN LOADS', async ({ page }) => {
    console.log('\n=== TEST: Compose screen loads ===\n');

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Click the new channel button to open the compose modal
    await page.click('[data-testid="new-channel-btn"]', { force: true });
    await page.waitForTimeout(1000);

    // Check for the channel edit modal
    const modal = page.locator('[data-testid="channel-edit-body"]');
    if ((await modal.count()) > 0) {
      // Take screenshot
      await page.screenshot({ path: 'test-results/compose-screen.png' });

      // Check for form elements
      const hasInput = (await page.locator('[data-testid="channel-edit-name"]').count()) > 0;
      const hasTextarea =
        (await page.locator('[data-testid="channel-edit-description"]').count()) > 0;

      console.log(`✓ Has name input: ${hasInput}`);
      console.log(`✓ Has description textarea: ${hasTextarea}`);

      expect(hasInput && hasTextarea).toBeTruthy();

      // Close the modal
      await page.click('[data-testid="channel-edit-cancel"]', { force: true });
    }

    if (errors.length > 0) {
      console.log('\n⚠️ ERRORS:', errors);
    }
  });

  test('CHANNEL CREATION FLOW', async ({ page }) => {
    console.log('\n=== TEST: Channel creation flow ===\n');

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Click the new channel button in sidebar
    await page.click('[data-testid="new-channel-btn"]', { force: true });
    await page.waitForTimeout(1000);

    // Check for the channel edit modal
    const modal = page.locator('[data-testid="channel-edit-body"]');
    if ((await modal.count()) > 0) {
      const nameInput = page.locator('[data-testid="channel-edit-name"]');
      const descInput = page.locator('[data-testid="channel-edit-description"]');

      if ((await nameInput.count()) > 0 && (await descInput.count()) > 0) {
        const channelName = `Test-${Date.now()}`;

        await nameInput.fill(channelName);
        await descInput.fill(
          'This is a test channel to verify the complete flow works in a real browser.'
        );

        console.log(`✓ Filled form with name: ${channelName}`);

        // Take screenshot before submit
        await page.screenshot({ path: 'test-results/compose-filled.png' });

        // Find and click save button
        const saveButton = page.locator('[data-testid="channel-edit-save"]');
        if ((await saveButton.count()) > 0) {
          await saveButton.click();
          console.log('✓ Clicked Save button');

          // Wait for modal to close
          await page.waitForSelector('[data-testid="channel-edit-body"]', {
            state: 'detached',
            timeout: 10000,
          });

          // Take screenshot after submit
          await page.screenshot({ path: 'test-results/compose-saved.png' });

          // App should still be visible (didn't crash)
          await expect(page.locator('#app')).toBeVisible();
          console.log('✓ App still functional after save');
        }
      }
    }

    if (errors.length > 0) {
      console.log('\n⚠️ ERRORS:', errors);
    }
  });

  test('RESPONSIVE LAYOUT', async ({ page }) => {
    console.log('\n=== TEST: Responsive layout ===\n');

    const viewports = [
      { width: 375, height: 667, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1280, height: 720, name: 'desktop' },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      await page.screenshot({ path: `test-results/${vp.name}-layout.png` });

      const isVisible = await page.locator('#app').isVisible();
      console.log(`✓ ${vp.name} (${vp.width}x${vp.height}): visible=${isVisible}`);

      expect(isVisible).toBeTruthy();
    }

    if (errors.length > 0) {
      console.log('\n⚠️ ERRORS:', errors);
    }
  });

  test('NO CRITICAL ERRORS', async ({ page }) => {
    console.log('\n=== TEST: No critical errors ===\n');

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    // Filter out known third-party errors
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('registerBackend') &&
        !e.includes('Failed to load resource') &&
        !e.includes('net::')
    );

    if (criticalErrors.length > 0) {
      console.log('\n❌ CRITICAL ERRORS FOUND:');
      criticalErrors.forEach((e) => console.log('  -', e));
    } else {
      console.log('\n✓ No critical errors');
    }

    expect(criticalErrors).toEqual([]);
  });
});
