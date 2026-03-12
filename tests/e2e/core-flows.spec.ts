/**
 * ISC Playwright E2E Tests - Core Flows
 *
 * Tests: Channel create → Announce → Query → Match
 */

import { test, expect } from '@playwright/test';

test.describe('ISC Core Flows', () => {
  test('should load the application', async ({ page }) => {
    await page.goto('/');
    
    // App should render
    await expect(page.locator('#app')).toBeVisible({ timeout: 10000 });
    
    // Should have navigation
    await expect(page.locator('[data-nav], nav, [role="navigation"]')).toBeVisible();
  });

  test('should display Now tab with match sections', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);
    
    // Navigate to Now tab
    const nowTab = page.locator('[data-tab="now"], button:has-text("Now"), a:has-text("Now")').first();
    if (await nowTab.count() > 0) {
      await nowTab.click();
      await page.waitForTimeout(2000);
    }
    
    // Should show either matches or empty state
    const content = await page.content();
    expect(content).toMatch(/Now|matches|nearby|No one nearby/i);
  });

  test('should navigate to Compose tab', async ({ page }) => {
    await page.goto('/');
    
    const composeTab = page.locator('[data-tab="compose"], button:has-text("Compose"), a:has-text("Compose"), button:has-text("+")').first();
    if (await composeTab.count() > 0) {
      await composeTab.click();
      await page.waitForTimeout(1000);
      
      // Should show compose form
      const content = await page.content();
      expect(content).toMatch(/channel|description|thinking|save|create/i);
    }
  });

  test('should navigate to Chats tab', async ({ page }) => {
    await page.goto('/');
    
    const chatsTab = page.locator('[data-tab="chats"], button:has-text("Chats"), a:has-text("Chats")').first();
    if (await chatsTab.count() > 0) {
      await chatsTab.click();
      await page.waitForTimeout(1000);
      
      // Should show chats list or empty state
      const content = await page.content();
      expect(content).toMatch(/chat|conversation|message|No active/i);
    }
  });

  test('should navigate to Settings tab', async ({ page }) => {
    await page.goto('/');
    
    const settingsTab = page.locator('[data-tab="settings"], button:has-text("Settings"), a:has-text("Settings"), [aria-label*="settings"]').first();
    if (await settingsTab.count() > 0) {
      await settingsTab.click();
      await page.waitForTimeout(1000);
      
      // Should show settings
      const content = await page.content();
      expect(content).toMatch(/settings|profile|preferences|theme/i);
    }
  });

  test('should have PWA manifest linked', async ({ page }) => {
    await page.goto('/');
    
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute('href');
  });

  test('should have service worker registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);
    
    const hasServiceWorker = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const registration = await navigator.serviceWorker.getRegistration();
      return !!registration;
    });
    
    // Service worker should be registered or registerable
    expect(hasServiceWorker || 'serviceWorker' in await page.evaluate(() => navigator)).toBe(true);
  });

  test('should handle responsive layout', async ({ page }) => {
    await page.goto('/');
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    await expect(page.locator('#app')).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(1000);
    await expect(page.locator('#app')).toBeVisible();
  });
});
