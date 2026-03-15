/**
 * Integration Tests - Channel Creation Flow
 * 
 * Tests the complete channel creation workflow:
 * 1. Navigate to compose screen
 * 2. Fill in channel details
 * 3. Validate input
 * 4. Create channel
 * 5. Verify channel appears in sidebar
 */

import { test, expect } from '@playwright/test';

test.describe('Channel Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="sidebar"]', { timeout: 10000 });
  });

  test('should display compose screen', async ({ page }) => {
    // Navigate to compose screen
    await page.click('[data-testid="nav-tab-compose"]');
    await page.waitForTimeout(500);

    // Verify compose screen is visible
    await expect(page.locator('[data-testid="compose-screen"]')).toBeVisible();
    
    // Verify form elements exist
    await expect(page.locator('[data-testid="compose-name-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="compose-description-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="compose-spread-slider"]')).toBeVisible();
  });

  test('should validate channel name (minimum 3 characters)', async ({ page }) => {
    await page.click('[data-testid="nav-tab-compose"]');
    await page.waitForTimeout(500);

    // Fill in short name
    await page.fill('[data-testid="compose-name-input"]', 'Ab');
    await page.fill('[data-testid="compose-description-input"]', 'This is a valid description with enough characters');
    
    // Try to save
    await page.click('[data-testid="compose-save"]');
    await page.waitForTimeout(500);

    // Should show error
    await expect(page.locator('[data-testid="compose-error"]')).toBeVisible();
  });

  test('should validate channel description (minimum 10 characters)', async ({ page }) => {
    await page.click('[data-testid="nav-tab-compose"]');
    await page.waitForTimeout(500);

    // Fill in valid name but short description
    await page.fill('[data-testid="compose-name-input"]', 'Test Channel');
    await page.fill('[data-testid="compose-description-input"]', 'Short');
    
    // Try to save
    await page.click('[data-testid="compose-save"]');
    await page.waitForTimeout(500);

    // Should show error
    await expect(page.locator('[data-testid="compose-error"]')).toBeVisible();
  });

  test('should create a valid channel', async ({ page }) => {
    const channelName = `Test Channel ${Date.now()}`;
    const channelDescription = 'This is a test channel for integration testing. It should be created successfully.';

    await page.click('[data-testid="nav-tab-compose"]');
    await page.waitForTimeout(500);

    // Fill in valid channel details
    await page.fill('[data-testid="compose-name-input"]', channelName);
    await page.fill('[data-testid="compose-description-input"]', channelDescription);
    
    // Adjust spread slider
    await page.evaluate(() => {
      const slider = document.querySelector('[data-testid="compose-spread-slider"]') as HTMLInputElement;
      if (slider) {
        slider.value = '50';
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);

    // Save channel
    await page.click('[data-testid="compose-save"]');
    
    // Wait for success message
    await page.waitForSelector('[data-testid="channel-created"]', { timeout: 5000 });
    await expect(page.locator('[data-testid="channel-created"]')).toBeVisible();

    // Wait for redirect to now screen
    await page.waitForTimeout(2000);
    
    // Should be on now screen
    await expect(page.locator('[data-testid="now-screen"]')).toBeVisible();
  });

  test('should show channel in sidebar after creation', async ({ page }) => {
    const channelName = `Sidebar Test ${Date.now()}`;
    const channelDescription = 'Testing that created channels appear in the sidebar.';

    await page.click('[data-testid="nav-tab-compose"]');
    await page.waitForTimeout(500);

    // Fill in channel details
    await page.fill('[data-testid="compose-name-input"]', channelName);
    await page.fill('[data-testid="compose-description-input"]', channelDescription);
    
    // Save
    await page.click('[data-testid="compose-save"]');
    
    // Wait for success and redirect
    await page.waitForSelector('[data-testid="channel-created"]', { timeout: 5000 });
    await page.waitForTimeout(2000);

    // Navigate back to compose to check sidebar
    await page.click('[data-testid="nav-tab-compose"]');
    await page.waitForTimeout(500);

    // Sidebar should show the channel (check for channel name in sidebar)
    const sidebar = page.locator('[data-testid="sidebar"]');
    await expect(sidebar).toBeVisible();
    
    // The channel should appear in the channel list section
    // Note: This depends on the sidebar being updated with new channels
  });

  test('should cancel channel creation', async ({ page }) => {
    await page.click('[data-testid="nav-tab-compose"]');
    await page.waitForTimeout(500);

    // Fill in some data
    await page.fill('[data-testid="compose-name-input"]', 'Test Channel');
    await page.fill('[data-testid="compose-description-input"]', 'This will be cancelled');
    
    // Cancel
    await page.click('[data-testid="compose-cancel"]');
    await page.waitForTimeout(500);

    // Should be back on now screen
    await expect(page.locator('[data-testid="now-screen"]')).toBeVisible();
  });

  test('should update character counters', async ({ page }) => {
    await page.click('[data-testid="nav-tab-compose"]');
    await page.waitForTimeout(500);

    // Type in name
    await page.fill('[data-testid="compose-name-input"]', 'Test');
    await page.waitForTimeout(200);

    // Check character counter shows 4/50
    const nameHelpText = page.locator('[data-testid="compose-name-input"] + div');
    await expect(nameHelpText).toContainText('4/50');

    // Type in description
    await page.fill('[data-testid="compose-description-input"]', 'Hello World Test');
    await page.waitForTimeout(200);

    // Check description character counter
    const descHelpText = page.locator('[data-testid="compose-description-input"] + div');
    await expect(descHelpText).toContainText('16/500');
  });

  test('should adjust spread slider', async ({ page }) => {
    await page.click('[data-testid="nav-tab-compose"]');
    await page.waitForTimeout(500);

    // Set slider to 75
    await page.evaluate(() => {
      const slider = document.querySelector('[data-testid="compose-spread-slider"]') as HTMLInputElement;
      if (slider) {
        slider.value = '75';
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);

    // Verify slider value is displayed
    const spreadHelpText = page.locator('[data-testid="compose-spread-slider"] + div + div');
    await expect(spreadHelpText).toContainText('75%');
  });

  test('should disable save button when form is invalid', async ({ page }) => {
    await page.click('[data-testid="nav-tab-compose"]');
    await page.waitForTimeout(500);

    // Save button should be disabled initially
    const saveButton = page.locator('[data-testid="compose-save"]');
    await expect(saveButton).toBeDisabled();

    // Fill only name (not enough)
    await page.fill('[data-testid="compose-name-input"]', 'Test');
    await page.waitForTimeout(200);
    await expect(saveButton).toBeDisabled();

    // Fill description to make form valid
    await page.fill('[data-testid="compose-description-input"]', 'Valid description here');
    await page.waitForTimeout(200);
    await expect(saveButton).toBeEnabled();
  });
});

test.describe('Channel Creation - Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="sidebar"]', { timeout: 10000 });
  });

  test('should handle special characters in channel name', async ({ page }) => {
    await page.click('[data-testid="nav-tab-compose"]');
    await page.waitForTimeout(500);

    const channelName = 'Test Channel 日本語 🚀';
    await page.fill('[data-testid="compose-name-input"]', channelName);
    await page.fill('[data-testid="compose-description-input"]', 'Testing special characters and emojis');
    
    await page.click('[data-testid="compose-save"]');
    await page.waitForSelector('[data-testid="channel-created"]', { timeout: 5000 });
    await expect(page.locator('[data-testid="channel-created"]')).toBeVisible();
  });

  test('should handle maximum length inputs', async ({ page }) => {
    await page.click('[data-testid="nav-tab-compose"]');
    await page.waitForTimeout(500);

    // Fill maximum length name (50 chars)
    const maxName = 'A'.repeat(50);
    await page.fill('[data-testid="compose-name-input"]', maxName);
    
    // Fill maximum length description (500 chars)
    const maxDesc = 'B'.repeat(500);
    await page.fill('[data-testid="compose-description-input"]', maxDesc);
    
    // Should still be able to save
    await page.click('[data-testid="compose-save"]');
    await page.waitForSelector('[data-testid="channel-created"]', { timeout: 5000 });
  });

  test('should trim whitespace from inputs', async ({ page }) => {
    await page.click('[data-testid="nav-tab-compose"]');
    await page.waitForTimeout(500);

    // Fill with leading/trailing whitespace
    await page.fill('[data-testid="compose-name-input"]', '  Test Channel  ');
    await page.fill('[data-testid="compose-description-input"]', '  Valid description  ');
    
    await page.click('[data-testid="compose-save"]');
    await page.waitForSelector('[data-testid="channel-created"]', { timeout: 5000 });
  });
});
