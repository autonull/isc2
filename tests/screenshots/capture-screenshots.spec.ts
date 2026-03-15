/**
 * ISC Web UI - Screenshot Capture Script
 * 
 * Captures screenshots of all main screens for documentation.
 */

import { test, expect } from '@playwright/test';

test.describe('ISC Web UI Screenshots', () => {
  test.beforeEach(async ({ page }) => {
    // Set viewport for desktop
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('Capture Splash/Loading Screen', async ({ page }) => {
    // The splash screen shows during initialization
    // We'll capture it immediately after page load
    await page.goto('http://localhost:3000', { waitUntil: 'commit' });
    
    // Wait for splash to be visible
    await page.waitForTimeout(500);
    
    await page.screenshot({ 
      path: 'screenshots/01-splash-loading.png',
      fullPage: true 
    });
    
    console.log('✓ Captured splash/loading screen');
  });

  test('Capture Now Screen (Feed)', async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    
    // Wait for app to fully load
    await page.waitForTimeout(2000);
    
    // Navigate to Now screen (default)
    await page.waitForSelector('[data-testid="now-screen"]', { timeout: 10000 });
    
    await page.screenshot({ 
      path: 'screenshots/02-now-feed.png',
      fullPage: true 
    });
    
    console.log('✓ Captured Now (Feed) screen');
  });

  test('Capture Now Screen - Empty State', async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // The empty state should show when there are no posts
    await page.waitForSelector('[data-testid="now-empty-state"]', { timeout: 5000 });
    
    await page.screenshot({ 
      path: 'screenshots/03-now-empty-state.png',
      fullPage: true 
    });
    
    console.log('✓ Captured Now empty state');
  });

  test('Capture Discover Screen', async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Click Discover tab
    const discoverTab = page.getByText('📡').or(page.getByText('Discover')).first();
    await discoverTab.click();
    
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: 'screenshots/04-discover.png',
      fullPage: true 
    });
    
    console.log('✓ Captured Discover screen');
  });

  test('Capture Compose Screen', async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Click Compose tab
    const composeTab = page.getByText('✏️').or(page.getByText('Compose')).first();
    await composeTab.click();
    
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: 'screenshots/05-compose-channel.png',
      fullPage: true 
    });
    
    console.log('✓ Captured Compose screen');
  });

  test('Capture Settings Screen', async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Click Settings tab
    const settingsTab = page.getByText('⚙️').or(page.getByText('Settings')).first();
    await settingsTab.click();
    
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: 'screenshots/06-settings.png',
      fullPage: true 
    });
    
    console.log('✓ Captured Settings screen');
  });

  test('Capture Keyboard Shortcuts Help', async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Press ? to show keyboard help
    await page.keyboard.press('?');
    
    await page.waitForTimeout(500);
    
    await page.screenshot({ 
      path: 'screenshots/07-keyboard-help.png',
      fullPage: true 
    });
    
    console.log('✓ Captured Keyboard shortcuts help');
  });

  test('Capture Navigation Sidebar', async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Focus on the sidebar area
    const sidebar = page.getByRole('navigation').or(page.locator('.irc-sidebar')).first();
    
    await page.screenshot({ 
      path: 'screenshots/08-navigation-sidebar.png',
      fullPage: false 
    });
    
    console.log('✓ Captured Navigation sidebar');
  });

  test('Capture Toast Notification Demo', async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Navigate to compose and trigger a validation error
    const composeTab = page.getByText('✏️').or(page.getByText('Compose')).first();
    await composeTab.click();
    
    await page.waitForTimeout(500);
    
    // Try to save without filling form
    const saveButton = page.getByText('Save').first();
    await saveButton.click();
    
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: 'screenshots/09-toast-notification.png',
      fullPage: true 
    });
    
    console.log('✓ Captured Toast notification');
  });

  test('Capture Full App Layout', async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    await page.screenshot({ 
      path: 'screenshots/10-full-app-layout.png',
      fullPage: true 
    });
    
    console.log('✓ Captured Full app layout');
  });
});
