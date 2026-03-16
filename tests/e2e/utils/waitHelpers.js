/**
 * Test Utilities - Wait Helpers
 *
 * Replace fixed timeouts with proper wait conditions for reliable tests.
 */
/**
 * Wait for app to be fully initialized
 * Replaces: waitForTimeout(2000-3000) after page.goto('/')
 */
export async function waitForAppReady(page, timeout) {
    await page.waitForSelector('[data-testid="sidebar"]', { timeout });
    await page.waitForFunction(() => {
        const app = document.getElementById('app');
        return app && app.children.length > 0;
    }, { timeout });
}
/**
 * Wait for navigation to complete
 * Replaces: waitForTimeout(500-1000) after tab clicks
 */
export async function waitForNavigation(page, tabName, timeout) {
    await page.waitForSelector(`[data-testid="nav-tab-${tabName}"][data-active="true"]`, { timeout });
    await page.waitForTimeout(300); // Minimal delay for animation
}
/**
 * Wait for posts to load
 * Replaces: waitForTimeout(2000-3000) after feed actions
 */
export async function waitForPostsLoaded(page, minCount = 0, timeout) {
    await page.waitForSelector('[data-testid="post-list"]', { timeout });
    if (minCount > 0) {
        await page.waitForFunction((min) => document.querySelectorAll('[data-testid="post"]').length >= min, minCount, { timeout });
    }
}
/**
 * Wait for channels to load
 * Replaces: waitForTimeout(1000-2000) after channel actions
 */
export async function waitForChannelsLoaded(page, minCount = 0, timeout) {
    await page.waitForSelector('[data-testid="sidebar-channel-list"]', { timeout });
    if (minCount > 0) {
        await page.waitForFunction((min) => document.querySelectorAll('[data-channel-id]').length >= min, minCount, { timeout });
    }
}
/**
 * Wait for matches to load in Now screen
 * Replaces: waitForTimeout(3000-5000) for discovery
 */
export async function waitForMatchesLoaded(page, timeout) {
    await page.waitForSelector('[data-testid="now-screen"]', { timeout });
    // Wait for either matches or empty state
    await page.waitForFunction(() => {
        const matches = document.querySelector('[data-section="very-close"], [data-section="nearby"]');
        const empty = document.querySelector('[data-testid="no-matches"]');
        const loading = document.querySelector('[data-testid="loading-matches"]');
        return (matches || empty) && !loading;
    }, { timeout });
}
/**
 * Wait for modal/dialog to appear
 * Replaces: waitForTimeout(500-1000) after modal triggers
 */
export async function waitForModal(page, modalTestId, timeout) {
    await page.waitForSelector(`[data-testid="${modalTestId}"]`, { timeout, state: 'visible' });
    await page.waitForTimeout(200); // Minimal delay for animation
}
/**
 * Wait for toast/notification to appear
 * Replaces: waitForTimeout(500-1000) after actions
 */
export async function waitForToast(page, message, timeout) {
    await page.waitForFunction((msg) => document.body.textContent?.includes(msg), message, { timeout });
}
/**
 * Wait for network idle with fallback
 * More reliable than page.waitForLoadState('networkidle') alone
 */
export async function waitForNetworkIdle(page, timeout) {
    await page.waitForLoadState('networkidle', { timeout });
    await page.waitForTimeout(500); // Allow render after network
}
/**
 * Wait for element to be stable (not animating)
 * Replaces: waitForTimeout(200-500) for animation completion
 */
export async function waitForElementStable(page, selector, timeout) {
    const element = await page.waitForSelector(selector, { timeout });
    await element.waitForElementState('stable', { timeout });
}
/**
 * Wait for text to appear anywhere on page
 * More flexible than specific selectors
 */
export async function waitForText(page, text, timeout) {
    await page.waitForFunction((txt) => document.body.textContent?.includes(txt), text, { timeout });
}
/**
 * Wait for onboarding to complete
 * Special helper for onboarding flow tests
 */
export async function waitForOnboardingComplete(page, timeout) {
    await page.waitForFunction(() => {
        return localStorage.getItem('isc-onboarding-completed') === 'true';
    }, { timeout });
    await page.waitForSelector('[data-testid="sidebar"]', { timeout });
}
/**
 * Complete onboarding flow
 * Helper for tests that need to skip onboarding
 */
export async function completeOnboarding(page, options) {
    const { name = 'Test User', bio = 'Testing ISC', channel = 'General' } = options || {};
    // Wait for onboarding modal
    await page.waitForSelector('[data-testid="onboarding-step-1"]', { timeout: 10000 });
    // Step 1: Name
    await page.fill('[data-testid="onboarding-name-input"]', name);
    await page.click('[data-testid="onboarding-next"]');
    // Step 2: Bio
    await page.waitForSelector('[data-testid="onboarding-step-2"]');
    await page.fill('[data-testid="onboarding-bio-input"]', bio);
    await page.click('[data-testid="onboarding-next"]');
    // Step 3: Channel
    await page.waitForSelector('[data-testid="onboarding-step-3"]');
    await page.fill('[data-testid="onboarding-channel-input"]', channel);
    await page.click('[data-testid="onboarding-complete"]');
    // Wait for completion
    await waitForOnboardingComplete(page);
}
/**
 * Skip onboarding via localStorage (for tests that don't need onboarding)
 * More explicit than inline evaluate
 */
export async function skipOnboarding(page) {
    await page.evaluate(() => {
        localStorage.setItem('isc-onboarding-completed', 'true');
    });
}
//# sourceMappingURL=waitHelpers.js.map