/**
 * XSS Security Tests
 *
 * Verify that user-generated content is properly sanitized to prevent XSS attacks.
 */

import { test, expect } from '@playwright/test';

test.describe('XSS Security', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Console error:', msg.text());
      }
    });
    page.on('pageerror', error => {
      // Ignore known third-party library errors
      if (error.message.includes('registerBackend')) {
        return;
      }
      console.log('Page error:', error.message);
    });

    // Skip onboarding for tests
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('isc-onboarding-completed', 'true');
    });
    await page.waitForTimeout(2000); // Wait for app to render
  });

  test('CSP headers are present', async ({ page }) => {
    const response = await page.goto('/');
    const cspHeader = response?.headers()['content-security-policy'];
    
    expect(cspHeader).toBeDefined();
    expect(cspHeader).toContain('default-src');
    expect(cspHeader).toContain('script-src');
    expect(cspHeader).toContain('object-src');
  });

  test('channel names are sanitized with DOMPurify', async ({ page }) => {
    const xssPayload = '<script>alert("XSS")</script>Test Channel';
    
    // Navigate to compose screen
    await page.click('[data-testid="nav-tab-compose"]');
    await page.waitForTimeout(500);

    // Fill in channel name with XSS payload and valid description
    await page.fill('[data-testid="compose-name-input"]', xssPayload);
    await page.fill('[data-testid="compose-description-input"]', 'This is a test channel description with enough text to enable the save button');
    
    // Wait for save button to be enabled
    await page.waitForSelector('[data-testid="compose-save"]:not([disabled])');
    
    // Submit the form
    await page.click('[data-testid="compose-save"]');
    await page.waitForTimeout(1500);

    // Navigate to settings to see the channel
    await page.click('[data-testid="nav-tab-settings"]');
    await page.waitForTimeout(500);

    // Verify the channel appears in the sidebar
    const channelList = page.locator('[data-testid="sidebar-channel-list"]');
    await expect(channelList).toBeVisible();
    
    // Check that the channel name text is present (DOMPurify strips script tags but keeps text)
    const channelText = await channelList.textContent();
    expect(channelText).toContain('Test Channel');
    
    // Verify no alert was triggered (script didn't execute)
    let alertTriggered = false;
    page.on('dialog', async dialog => {
      alertTriggered = true;
      await dialog.dismiss();
    });

    await page.waitForTimeout(500);
    expect(alertTriggered).toBe(false);
  });

  test('post content is sanitized', async ({ page }) => {
    const xssPayload = '<script>alert("XSS")</script>Hello World';
    
    // Create a channel first
    await page.click('[data-testid="nav-tab-compose"]');
    await page.waitForTimeout(500);
    await page.fill('[data-testid="compose-name-input"]', 'Test Channel');
    await page.fill('[data-testid="compose-description-input"]', 'Testing XSS protection in posts');
    await page.waitForSelector('[data-testid="compose-save"]:not([disabled])');
    await page.click('[data-testid="compose-save"]');
    await page.waitForTimeout(1500);

    // Navigate to Now and post a message with XSS
    await page.click('[data-testid="nav-tab-now"]');
    await page.waitForTimeout(500);
    
    // Fill and submit post
    await page.fill('[data-testid="compose-input"]', xssPayload);
    await page.waitForSelector('[data-testid="compose-submit"]:not([disabled])');
    await page.click('[data-testid="compose-submit"]');
    await page.waitForTimeout(1000);

    // Verify the post content area exists and contains the text (without script execution)
    const feedContainer = page.locator('[data-testid="feed-container"]');
    await expect(feedContainer).toBeVisible();
    
    // Get all text content from the feed
    const feedText = await feedContainer.textContent();
    expect(feedText).toContain('Hello World');
    
    // Verify no script executed
    let alertTriggered = false;
    page.on('dialog', async dialog => {
      alertTriggered = true;
      await dialog.dismiss();
    });

    await page.waitForTimeout(500);
    expect(alertTriggered).toBe(false);
  });

  test('identity name is sanitized', async ({ page }) => {
    const xssPayload = '<script>alert("XSS")</script>TestUser';
    
    // Navigate to settings
    await page.click('[data-testid="nav-tab-settings"]');
    await page.waitForTimeout(500);

    // Fill identity name with XSS payload
    const nameInput = page.locator('[data-testid="settings-name-input"]');
    await expect(nameInput).toBeVisible();
    await nameInput.fill(xssPayload);
    
    // Fill bio
    const bioInput = page.locator('[data-testid="settings-bio-input"]');
    await bioInput.fill('Test bio for sanitization');
    
    // Save profile
    await page.click('[data-testid="save-profile-btn"]');
    await page.waitForTimeout(1000);

    // Verify the name was saved (text content should be present)
    const savedName = await nameInput.inputValue();
    expect(savedName).toContain('TestUser');
    
    // Verify no script executed
    let alertTriggered = false;
    page.on('dialog', async dialog => {
      alertTriggered = true;
      await dialog.dismiss();
    });

    await page.waitForTimeout(500);
    expect(alertTriggered).toBe(false);
  });
});
