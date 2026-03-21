/**
 * N1: Navigation Helper for E2E Tests
 *
 * Provides reusable navigation utilities for Playwright tests.
 */

import { Page, Locator, expect } from '@playwright/test';

export interface NavigationOptions {
  waitForLoad?: boolean;
  timeout?: number;
}

export class NavigationHelper {
  constructor(private page: Page) {}

  /**
   * Navigate to a route using hash routing
   */
  async goTo(route: string, options: NavigationOptions = {}): Promise<void> {
    const { waitForLoad = true, timeout = 5000 } = options;
    
    await this.page.goto(`#${route}`);
    
    if (waitForLoad) {
      await this.waitForScreenLoad(route, timeout);
    }
  }

  /**
   * Wait for a specific screen to be loaded
   */
  async waitForScreenLoad(route: string, timeout = 5000): Promise<void> {
    const screenMap: Record<string, string> = {
      '/now': '[data-testid="now-screen"]',
      '/discover': '[data-testid="discover-screen"]',
      '/chats': '[data-testid="chats-screen"]',
      '/settings': '[data-testid="settings-screen"]',
      '/compose': '[data-testid="compose-screen"]',
    };

    const selector = screenMap[route];
    if (selector) {
      await expect(this.page.locator(selector)).toBeVisible({ timeout });
    }
  }

  /**
   * Navigate using sidebar navigation
   */
  async navigateViaSidebar(route: string): Promise<void> {
    const routeMap: Record<string, string> = {
      '/now': '[data-testid="snav-now"]',
      '/discover': '[data-testid="snav-discover"]',
      '/chats': '[data-testid="snav-chats"]',
      '/settings': '[data-testid="snav-settings"]',
    };

    const button = this.page.locator(routeMap[route]);
    await button.click();
    await this.waitForScreenLoad(route);
  }

  /**
   * Get current route from URL hash
   */
  async getCurrentRoute(): Promise<string> {
    const url = this.page.url();
    const hashIndex = url.indexOf('#');
    if (hashIndex === -1) return '/';
    return url.substring(hashIndex + 1) || '/';
  }

  /**
   * Assert current route
   */
  async assertRoute(expected: string): Promise<void> {
    const current = await this.getCurrentRoute();
    expect(current).toBe(expected);
  }

  /**
   * Wait for URL hash change
   */
  async waitForHashChange(expectedHash: string, timeout = 5000): Promise<void> {
    await this.page.waitForFunction(
      (hash) => window.location.hash === `#${hash}`,
      expectedHash,
      { timeout }
    );
  }

  /**
   * Navigate back in browser history
   */
  async goBack(): Promise<void> {
    await this.page.goBack();
  }

  /**
   * Navigate forward in browser history
   */
  async goForward(): Promise<void> {
    await this.page.goForward();
  }

  /**
   * Wait for page to be fully loaded (no loading states)
   */
  async waitForPageReady(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForSelector('.irc-layout', { state: 'visible' });
  }

  /**
   * Get navigation element by route
   */
  getNavElement(route: string): Locator {
    const routeMap: Record<string, string> = {
      '/now': '[data-testid="snav-now"]',
      '/discover': '[data-testid="snav-discover"]',
      '/chats': '[data-testid="snav-chats"]',
      '/settings': '[data-testid="snav-settings"]',
    };
    return this.page.locator(routeMap[route] || `[data-route="${route}"]`);
  }

  /**
   * Check if navigation element is active
   */
  async isNavActive(route: string): Promise<boolean> {
    const element = this.getNavElement(route);
    const className = await element.getAttribute('class');
    return className?.includes('active') ?? false;
  }

  /**
   * Wait for active navigation state
   */
  async waitForNavActive(route: string, timeout = 3000): Promise<void> {
    const element = this.getNavElement(route);
    await expect(element).toHaveClass(/active/, { timeout });
  }
}

/**
 * Create navigation helper instance
 */
export function createNavigationHelper(page: Page): NavigationHelper {
  return new NavigationHelper(page);
}

// Re-export for convenience
export { expect } from '@playwright/test';
