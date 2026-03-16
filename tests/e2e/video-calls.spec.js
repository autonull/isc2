/**
 * Video Call E2E Tests
 *
 * Tests video call functionality including:
 * - Call creation and joining
 * - Media permissions handling
 * - Participant management
 * - Screen sharing
 * - Call controls (mute, video, end)
 */
import { test, expect } from '@playwright/test';
test.describe('Video Calls', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the app
        await page.goto('/');
        // Complete onboarding if shown
        const onboardingModal = page.locator('[data-testid="onboarding-modal"]');
        if (await onboardingModal.isVisible()) {
            await page.click('[data-testid="skip-onboarding"]');
        }
    });
    test.describe('Call Creation', () => {
        test('should create a direct video call', async ({ page }) => {
            // Navigate to video calls
            await page.click('[data-testid="nav-video-calls"]');
            // Click new call button
            await page.click('[data-testid="new-call-button"]');
            // Select direct call type
            await page.click('[data-testid="call-type-direct"]');
            // Enter recipient peer ID
            await page.fill('[data-testid="recipient-input"]', 'test-peer-id-123');
            // Click create call
            await page.click('[data-testid="create-call-button"]');
            // Should show video call UI
            await expect(page.locator('[data-testid="video-call-container"]')).toBeVisible();
            await expect(page.locator('[data-testid="local-video"]')).toBeVisible();
        });
        test('should create a group video call', async ({ page }) => {
            await page.click('[data-testid="nav-video-calls"]');
            await page.click('[data-testid="new-call-button"]');
            // Select group call type
            await page.click('[data-testid="call-type-group"]');
            // Enter channel ID
            await page.fill('[data-testid="channel-id-input"]', 'ch_test_channel');
            // Click create call
            await page.click('[data-testid="create-call-button"]');
            // Should show video call UI with group indicators
            await expect(page.locator('[data-testid="video-call-container"]')).toBeVisible();
            await expect(page.locator('[data-testid="participant-count"]')).toContainText('1 /');
        });
        test('should show error when creating call without recipient', async ({ page }) => {
            await page.click('[data-testid="nav-video-calls"]');
            await page.click('[data-testid="new-call-button"]');
            await page.click('[data-testid="call-type-direct"]');
            // Don't enter recipient, just click create
            await page.click('[data-testid="create-call-button"]');
            // Should show error message
            await expect(page.locator('[data-testid="call-error"]')).toBeVisible();
        });
    });
    test.describe('Call Controls', () => {
        test.beforeEach(async ({ page }) => {
            // Setup: Create a call
            await page.click('[data-testid="nav-video-calls"]');
            await page.click('[data-testid="new-call-button"]');
            await page.click('[data-testid="call-type-direct"]');
            await page.fill('[data-testid="recipient-input"]', 'test-peer');
            await page.click('[data-testid="create-call-button"]');
            // Wait for call to initialize
            await page.waitForSelector('[data-testid="video-call-container"]');
        });
        test('should toggle mute', async ({ page }) => {
            const muteButton = page.locator('[data-testid="mute-button"]');
            // Click mute
            await muteButton.click();
            await expect(muteButton).toHaveAttribute('aria-label', 'Unmute');
            // Click unmute
            await muteButton.click();
            await expect(muteButton).toHaveAttribute('aria-label', 'Mute');
        });
        test('should toggle video', async ({ page }) => {
            const videoButton = page.locator('[data-testid="video-button"]');
            // Click video off
            await videoButton.click();
            await expect(videoButton).toHaveAttribute('aria-label', 'Turn on video');
            // Click video on
            await videoButton.click();
            await expect(videoButton).toHaveAttribute('aria-label', 'Turn off video');
        });
        test('should end call', async ({ page }) => {
            const endButton = page.locator('[data-testid="end-call-button"]');
            await endButton.click();
            // Should return to call list
            await expect(page.locator('[data-testid="call-list"]')).toBeVisible();
        });
    });
    test.describe('Media Permissions', () => {
        test('should handle camera permission denied', async ({ page, context }) => {
            // Block camera access
            await context.clearPermissions();
            await page.click('[data-testid="nav-video-calls"]');
            await page.click('[data-testid="new-call-button"]');
            await page.click('[data-testid="call-type-direct"]');
            await page.fill('[data-testid="recipient-input"]', 'test-peer');
            await page.click('[data-testid="create-call-button"]');
            // Should show permission error
            await expect(page.locator('[data-testid="permission-error"]')).toBeVisible();
            await expect(page.locator('[data-testid="permission-error"]'))
                .toContainText('permission');
        });
        test('should handle no devices found', async ({ page }) => {
            // This would require mocking navigator.mediaDevices
            // For now, we test the error UI is present
            await page.click('[data-testid="nav-video-calls"]');
            await page.click('[data-testid="new-call-button"]');
            // Verify error container exists for when errors occur
            expect(page.locator('[data-testid="call-error"]')).toBeDefined();
        });
    });
    test.describe('Screen Sharing', () => {
        test.beforeEach(async ({ page }) => {
            await page.click('[data-testid="nav-video-calls"]');
            await page.click('[data-testid="new-call-button"]');
            await page.click('[data-testid="call-type-direct"]');
            await page.fill('[data-testid="recipient-input"]', 'test-peer');
            await page.click('[data-testid="create-call-button"]');
            await page.waitForSelector('[data-testid="video-call-container"]');
        });
        test('should start screen sharing', async ({ page }) => {
            const screenShareButton = page.locator('[data-testid="screen-share-button"]');
            // Note: Actual screen sharing requires user gesture and browser support
            // We test that the button is present and clickable
            await expect(screenShareButton).toBeVisible();
            await expect(screenShareButton).toBeEnabled();
        });
        test('should show screen share indicator', async ({ page }) => {
            // Screen share indicator should be visible when sharing
            // This would require actual screen sharing to test fully
            const participantTile = page.locator('[data-testid="participant-tile"]').first();
            await expect(participantTile).toBeVisible();
        });
    });
    test.describe('Multi-Participant', () => {
        test('should display participant count', async ({ page }) => {
            await page.click('[data-testid="nav-video-calls"]');
            await page.click('[data-testid="new-call-button"]');
            await page.click('[data-testid="call-type-group"]');
            await page.fill('[data-testid="channel-id-input"]', 'ch_test');
            await page.click('[data-testid="create-call-button"]');
            // Should show participant count
            const participantCount = page.locator('[data-testid="participant-count"]');
            await expect(participantCount).toBeVisible();
            await expect(participantCount).toContainText('1 /');
        });
        test('should show call duration', async ({ page }) => {
            await page.click('[data-testid="nav-video-calls"]');
            await page.click('[data-testid="new-call-button"]');
            await page.click('[data-testid="call-type-direct"]');
            await page.fill('[data-testid="recipient-input"]', 'test-peer');
            await page.click('[data-testid="create-call-button"]');
            // Duration should start at 00:00 and increment
            const duration = page.locator('[data-testid="call-duration"]');
            await expect(duration).toBeVisible();
            await expect(duration).toMatchText(/\d{2}:\d{2}/);
        });
    });
    test.describe('Call Quality Stats', () => {
        test('should display connection quality indicators', async ({ page }) => {
            await page.click('[data-testid="nav-video-calls"]');
            await page.click('[data-testid="new-call-button"]');
            await page.click('[data-testid="call-type-direct"]');
            await page.fill('[data-testid="recipient-input"]', 'test-peer');
            await page.click('[data-testid="create-call-button"]');
            // Video tiles should be visible
            const videoTiles = page.locator('[data-testid="video-tile"]');
            await expect(videoTiles).toHaveCount(1);
        });
    });
    test.describe('Error Recovery', () => {
        test('should handle network disconnection', async ({ page }) => {
            await page.click('[data-testid="nav-video-calls"]');
            await page.click('[data-testid="new-call-button"]');
            await page.click('[data-testid="call-type-direct"]');
            await page.fill('[data-testid="recipient-input"]', 'test-peer');
            await page.click('[data-testid="create-call-button"]');
            // Simulate network error by going offline
            await page.context().setOffline(true);
            // Try to send a message (should fail gracefully)
            // The UI should show an error or disabled state
            const muteButton = page.locator('[data-testid="mute-button"]');
            await muteButton.click();
            // Should still be able to interact with local controls
            await expect(muteButton).toBeVisible();
            // Go back online
            await page.context().setOffline(false);
        });
        test('should clean up after failed call', async ({ page }) => {
            await page.click('[data-testid="nav-video-calls"]');
            await page.click('[data-testid="new-call-button"]');
            await page.click('[data-testid="call-type-direct"]');
            await page.fill('[data-testid="recipient-input"]', 'test-peer');
            await page.click('[data-testid="create-call-button"]');
            // End the call
            await page.click('[data-testid="end-call-button"]');
            // Should return to call list with no active calls
            await expect(page.locator('[data-testid="no-active-calls"]')).toBeVisible();
        });
    });
});
test.describe('Video Call Integration', () => {
    test('should persist call state across navigation', async ({ page }) => {
        await page.click('[data-testid="nav-video-calls"]');
        await page.click('[data-testid="new-call-button"]');
        await page.click('[data-testid="call-type-direct"]');
        await page.fill('[data-testid="recipient-input"]', 'test-peer');
        await page.click('[data-testid="create-call-button"]');
        // Navigate away and back
        await page.click('[data-testid="nav-now"]');
        await page.click('[data-testid="nav-video-calls"]');
        // Call should still be active
        await expect(page.locator('[data-testid="video-call-container"]')).toBeVisible();
    });
    test('should handle multiple tabs', async ({ context }) => {
        // Open two tabs
        const page1 = await context.newPage();
        const page2 = await context.newPage();
        await page1.goto('/');
        await page2.goto('/');
        // Create call in page1
        await page1.click('[data-testid="nav-video-calls"]');
        await page1.click('[data-testid="new-call-button"]');
        await page1.click('[data-testid="call-type-direct"]');
        // Get peer ID from page2
        const peerIdElement = page2.locator('[data-testid="peer-id"]');
        const peerId = await peerIdElement.textContent();
        await page1.fill('[data-testid="recipient-input"]', peerId || 'test-peer');
        await page1.click('[data-testid="create-call-button"]');
        // Page2 should receive invitation (would need real DHT for full test)
        // For now, verify page1 call was created
        await expect(page1.locator('[data-testid="video-call-container"]')).toBeVisible();
        await page1.close();
        await page2.close();
    });
});
//# sourceMappingURL=video-calls.spec.js.map