/**
 * Test Utilities - Wait Helpers
 *
 * Replace fixed timeouts with proper wait conditions for reliable tests.
 */
import type { Page } from '@playwright/test';
/**
 * Wait for app to be fully initialized
 * Replaces: waitForTimeout(2000-3000) after page.goto('/')
 */
export declare function waitForAppReady(page: Page, timeout?: number): Promise<void>;
/**
 * Wait for navigation to complete
 * Replaces: waitForTimeout(500-1000) after tab clicks
 */
export declare function waitForNavigation(page: Page, tabName: string, timeout?: number): Promise<void>;
/**
 * Wait for posts to load
 * Replaces: waitForTimeout(2000-3000) after feed actions
 */
export declare function waitForPostsLoaded(page: Page, minCount?: number, timeout?: number): Promise<void>;
/**
 * Wait for channels to load
 * Replaces: waitForTimeout(1000-2000) after channel actions
 */
export declare function waitForChannelsLoaded(page: Page, minCount?: number, timeout?: number): Promise<void>;
/**
 * Wait for matches to load in Now screen
 * Replaces: waitForTimeout(3000-5000) for discovery
 */
export declare function waitForMatchesLoaded(page: Page, timeout?: number): Promise<void>;
/**
 * Wait for modal/dialog to appear
 * Replaces: waitForTimeout(500-1000) after modal triggers
 */
export declare function waitForModal(page: Page, modalTestId: string, timeout?: number): Promise<void>;
/**
 * Wait for toast/notification to appear
 * Replaces: waitForTimeout(500-1000) after actions
 */
export declare function waitForToast(page: Page, message: string, timeout?: number): Promise<void>;
/**
 * Wait for network idle with fallback
 * More reliable than page.waitForLoadState('networkidle') alone
 */
export declare function waitForNetworkIdle(page: Page, timeout?: number): Promise<void>;
/**
 * Wait for element to be stable (not animating)
 * Replaces: waitForTimeout(200-500) for animation completion
 */
export declare function waitForElementStable(page: Page, selector: string, timeout?: number): Promise<void>;
/**
 * Wait for text to appear anywhere on page
 * More flexible than specific selectors
 */
export declare function waitForText(page: Page, text: string, timeout?: number): Promise<void>;
/**
 * Wait for onboarding to complete
 * Special helper for onboarding flow tests
 */
export declare function waitForOnboardingComplete(page: Page, timeout?: number): Promise<void>;
/**
 * Complete onboarding flow
 * Helper for tests that need to skip onboarding
 */
export declare function completeOnboarding(page: Page, options?: {
    name?: string;
    bio?: string;
    channel?: string;
}): Promise<void>;
/**
 * Skip onboarding via localStorage (for tests that don't need onboarding)
 * More explicit than inline evaluate
 */
export declare function skipOnboarding(page: Page): Promise<void>;
//# sourceMappingURL=waitHelpers.d.ts.map