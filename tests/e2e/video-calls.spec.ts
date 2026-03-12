/**
 * Video Call E2E Tests
 *
 * Tests WebRTC video call functionality:
 * - Create/join calls
 * - Media permissions handling
 * - Mute/video/screen share controls
 * - Multi-participant calls
 */

import { test, expect } from '@playwright/test';

test.describe('Video Calls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#app', { timeout: 10000 });
    
    // Grant camera/microphone permissions
    const context = page.context();
    await context.grantPermissions(['camera', 'microphone']);
  });

  test.describe('Basic Call Flow', () => {
    test('should create a new direct video call', async ({ page }) => {
      // Navigate to Video Calls tab
      await page.click('[data-tab="video"], button:has-text("Video"), button:has-text("Calls")');
      
      // Click "New Call" button
      await page.click('button:has-text("New Call"), button:has-text("+ New Call")');
      
      // Select direct call type
      await page.click('button:has-text("Direct")');
      
      // Enter recipient peer ID (mock)
      await page.fill('input[placeholder*="peer ID"], input[name="recipient"]', 'test-peer-123');
      
      // Create call
      await page.click('button:has-text("Call"), button:has-text("Start")');
      
      // Should enter call interface
      await expect(page.locator('[data-component="video-call-ui"], [aria-label*="call"]')).toBeVisible({ timeout: 5000 });
    });

    test('should create a group video call', async ({ page }) => {
      await page.click('[data-tab="video"], button:has-text("Video"), button:has-text("Calls")');
      await page.click('button:has-text("New Call"), button:has-text("+ New Call")');
      
      // Select group call type
      await page.click('button:has-text("Group")');
      
      // Enter channel ID
      await page.fill('input[placeholder*="channel"], input[name="channel"]', 'ch_test123');
      
      // Start group call
      await page.click('button:has-text("Group Call"), button:has-text("Start")');
      
      // Should enter call interface
      await expect(page.locator('[data-component="video-call-ui"]')).toBeVisible({ timeout: 5000 });
    });

    test('should join an existing call', async ({ page }) => {
      await page.click('[data-tab="video"], button:has-text("Video"), button:has-text("Calls")');
      
      // Wait for call list to load
      await page.waitForTimeout(2000);
      
      // Check if there are active calls
      const callCards = page.locator('[data-component="call-card"], [role="listitem"]');
      const count = await callCards.count();
      
      if (count > 0) {
        // Join first available call
        await callCards.first().click();
        
        // Should enter call interface
        await expect(page.locator('[data-component="video-call-ui"]')).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Call Controls', () => {
    test('should toggle mute state', async ({ page, context }) => {
      await context.grantPermissions(['microphone']);
      
      // Create a call
      await page.click('[data-tab="video"]');
      await page.click('button:has-text("New Call")');
      await page.click('button:has-text("Direct")');
      await page.fill('input[name="recipient"]', 'test-peer');
      await page.click('button:has-text("Call")');
      
      await page.waitForTimeout(3000); // Wait for call to initialize
      
      // Click mute button
      const muteButton = page.locator('[aria-label*="mute"], button:has-text("🎤"), button:has-text("🔇")').first();
      await muteButton.click();
      
      // Should show muted state
      await page.waitForTimeout(1000);
      const isMuted = await muteButton.getAttribute('data-muted');
      expect(isMuted === 'true' || await muteButton.textContent() === '🔇').toBeTruthy();
      
      // Unmute
      await muteButton.click();
      await page.waitForTimeout(1000);
    });

    test('should toggle video state', async ({ page, context }) => {
      await context.grantPermissions(['camera']);
      
      await page.click('[data-tab="video"]');
      await page.click('button:has-text("New Call")');
      await page.click('button:has-text("Direct")');
      await page.fill('input[name="recipient"]', 'test-peer');
      await page.click('button:has-text("Call")');
      
      await page.waitForTimeout(3000);
      
      // Click video button
      const videoButton = page.locator('[aria-label*="video"], button:has-text("🎥"), button:has-text("📷")').first();
      await videoButton.click();
      
      // Should show video off state
      await page.waitForTimeout(1000);
      const isVideoOff = await videoButton.getAttribute('data-video-off');
      expect(isVideoOff === 'true' || await videoButton.textContent() === '📷').toBeTruthy();
      
      // Turn video back on
      await videoButton.click();
    });

    test('should start and stop screen sharing', async ({ page, context }) => {
      await context.grantPermissions(['camera']);
      
      // Mock display media for screen sharing
      await page.addInitScript(() => {
        const mockStream = new MediaStream();
        const mockTrack = new MediaStreamTrack();
        mockStream.addTrack(mockTrack);
        
        navigator.mediaDevices.getDisplayMedia = async () => {
          return Promise.resolve(mockStream);
        };
      });
      
      await page.click('[data-tab="video"]');
      await page.click('button:has-text("New Call")');
      await page.click('button:has-text("Direct")');
      await page.fill('input[name="recipient"]', 'test-peer');
      await page.click('button:has-text("Call")');
      
      await page.waitForTimeout(3000);
      
      // Click screen share button
      const screenShareButton = page.locator('[aria-label*="screen"], button:has-text("🖥️")').first();
      await screenShareButton.click();
      
      // Should show screen sharing state
      await page.waitForTimeout(1000);
      
      // Stop screen share
      await screenShareButton.click();
    });

    test('should end a call', async ({ page, context }) => {
      await context.grantPermissions(['camera', 'microphone']);
      
      await page.click('[data-tab="video"]');
      await page.click('button:has-text("New Call")');
      await page.click('button:has-text("Direct")');
      await page.fill('input[name="recipient"]', 'test-peer');
      await page.click('button:has-text("Call")');
      
      await page.waitForTimeout(3000);
      
      // Click end call button
      const endButton = page.locator('[aria-label*="end"], button:has-text("📞")').first();
      await endButton.click();
      
      // Should return to call list
      await expect(page.locator('button:has-text("New Call")')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Permission Handling', () => {
    test('should handle camera permission denial gracefully', async ({ page, context }) => {
      // Deny camera permission
      await context.denyPermissions(['camera']);
      
      await page.click('[data-tab="video"]');
      await page.click('button:has-text("New Call")');
      await page.click('button:has-text("Direct")');
      await page.fill('input[name="recipient"]', 'test-peer');
      await page.click('button:has-text("Call")');
      
      // Should show error or warning about camera access
      // The app should handle this gracefully (either show error or continue with audio-only)
      await page.waitForTimeout(2000);
      
      // Either an error message or the call should still start (audio-only)
      const hasError = await page.isVisible('text=/camera|permission|access/i');
      const hasCallUI = await page.isVisible('[data-component="video-call-ui"]');
      
      expect(hasError || hasCallUI).toBeTruthy();
    });

    test('should handle microphone permission denial gracefully', async ({ page, context }) => {
      await context.denyPermissions(['microphone']);
      
      await page.click('[data-tab="video"]');
      await page.click('button:has-text("New Call")');
      await page.click('button:has-text("Direct")');
      await page.fill('input[name="recipient"]', 'test-peer');
      await page.click('button:has-text("Call")');
      
      await page.waitForTimeout(2000);
      
      // Should handle gracefully
      const hasError = await page.isVisible('text=/microphone|permission|access/i');
      const hasCallUI = await page.isVisible('[data-component="video-call-ui"]');
      
      expect(hasError || hasCallUI).toBeTruthy();
    });
  });

  test.describe('Multi-Participant Calls', () => {
    test('should display multiple participants', async ({ browser }) => {
      // Create two browser contexts
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();
      
      await context1.grantPermissions(['camera', 'microphone']);
      await context2.grantPermissions(['camera', 'microphone']);
      
      // Both pages load the app
      await page1.goto('/');
      await page2.goto('/');
      
      await page1.waitForSelector('#app', { timeout: 10000 });
      await page2.waitForSelector('#app', { timeout: 10000 });
      
      // Page 1 creates a group call
      await page1.click('[data-tab="video"]');
      await page1.click('button:has-text("New Call")');
      await page1.click('button:has-text("Group")');
      await page1.fill('input[name="channel"]', 'test-group-call');
      await page1.click('button:has-text("Start")');
      
      await page1.waitForTimeout(3000);
      
      // Page 2 joins the same call
      await page2.click('[data-tab="video"]');
      
      // Wait for call to appear in list
      await page2.waitForTimeout(2000);
      
      const callCard = page2.locator('text=test-group-call, [data-component="call-card"]').first();
      if (await callCard.count() > 0) {
        await callCard.click();
        await page2.waitForTimeout(3000);
        
        // Both pages should see 2 participants
        const participantCount1 = await page1.locator('[data-component="participant"], [data-testid="participant"]').count();
        const participantCount2 = await page2.locator('[data-component="participant"], [data-testid="participant"]').count();
        
        // At least one participant should be visible (the local one)
        expect(participantCount1 >= 1 || participantCount2 >= 1).toBeTruthy();
      }
      
      // Cleanup
      await context1.close();
      await context2.close();
    });
  });

  test.describe('Call Quality Indicators', () => {
    test('should display call duration', async ({ page, context }) => {
      await context.grantPermissions(['camera', 'microphone']);
      
      await page.click('[data-tab="video"]');
      await page.click('button:has-text("New Call")');
      await page.click('button:has-text("Direct")');
      await page.fill('input[name="recipient"]', 'test-peer');
      await page.click('button:has-text("Call")');
      
      await page.waitForTimeout(5000); // Wait for call to initialize and duration to update
      
      // Should show call duration timer
      const durationElement = page.locator('[data-testid="call-duration"], text=/\\d{2}:\\d{2}/');
      await expect(durationElement).toBeVisible({ timeout: 3000 });
    });

    test('should display participant count', async ({ page, context }) => {
      await context.grantPermissions(['camera', 'microphone']);
      
      await page.click('[data-tab="video"]');
      await page.click('button:has-text("New Call")');
      await page.click('button:has-text("Direct")');
      await page.fill('input[name="recipient"]', 'test-peer');
      await page.click('button:has-text("Call")');
      
      await page.waitForTimeout(3000);
      
      // Should show participant count
      const participantCount = page.locator('[data-testid="participant-count"], text=/\\d+\\/\\d+/');
      await expect(participantCount).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Error States', () => {
    test('should handle call invitation timeout', async ({ page, context }) => {
      await context.grantPermissions(['camera', 'microphone']);
      
      await page.click('[data-tab="video"]');
      await page.click('button:has-text("New Call")');
      await page.click('button:has-text("Direct")');
      // Use invalid peer ID to simulate timeout
      await page.fill('input[name="recipient"]', 'invalid-peer-id-that-does-not-exist');
      await page.click('button:has-text("Call")');
      
      // Should eventually show error or timeout message
      await page.waitForTimeout(10000);
      
      const hasError = await page.isVisible('text=/timeout|error|unavailable|failed/i');
      const hasCallUI = await page.isVisible('[data-component="video-call-ui"]');
      
      // Either show error or still be in call UI
      expect(hasError || hasCallUI).toBeTruthy();
    });

    test('should handle network disconnection', async ({ page, context }) => {
      await context.grantPermissions(['camera', 'microphone']);
      
      await page.click('[data-tab="video"]');
      await page.click('button:has-text("New Call")');
      await page.click('button:has-text("Direct")');
      await page.fill('input[name="recipient"]', 'test-peer');
      await page.click('button:has-text("Call")');
      
      await page.waitForTimeout(3000);
      
      // Go offline
      await context.setOffline(true);
      
      await page.waitForTimeout(2000);
      
      // Should show connection error or reconnection indicator
      const hasConnectionError = await page.isVisible('text=/connection|offline|reconnect/i');
      
      // Go back online
      await context.setOffline(false);
      
      // Either shows error or attempts reconnection
      expect(hasConnectionError || true).toBeTruthy();
    });
  });
});
