/**
 * Navigation Helper for E2E Tests
 */

import { Page, Locator, expect } from '@playwright/test';

export interface NavigationOptions {
  waitForLoad?: boolean;
  timeout?: number;
}

const SCREEN_MAP: Record<string, string> = {
  '/now': '[data-testid="now-screen"]',
  '/discover': '[data-testid="discover-screen"]',
  '/chats': '[data-testid="chats-screen"]',
  '/settings': '[data-testid="settings-screen"]',
  '/compose': '[data-testid="compose-screen"]',
};

const ROUTE_MAP: Record<string, string> = {
  '/now': '[data-testid="snav-now"]',
  '/discover': '[data-testid="snav-discover"]',
  '/chats': '[data-testid="snav-chats"]',
  '/settings': '[data-testid="snav-settings"]',
};

export class NavigationHelper {
  constructor(private page: Page) {}

  async goTo(route: string, options: NavigationOptions = {}): Promise<void> {
    const { waitForLoad = true, timeout = 5000 } = options;
    await this.page.goto(`#${route}`);
    if (waitForLoad) await this.waitForScreenLoad(route, timeout);
  }

  async waitForScreenLoad(route: string, timeout = 5000): Promise<void> {
    const selector = SCREEN_MAP[route];
    if (selector) await expect(this.page.locator(selector)).toBeVisible({ timeout });
  }

  async navigateViaSidebar(route: string): Promise<void> {
    await this.page.locator(ROUTE_MAP[route]).click();
    await this.waitForScreenLoad(route);
  }

  async getCurrentRoute(): Promise<string> {
    const url = this.page.url();
    const hashIndex = url.indexOf('#');
    return hashIndex === -1 ? '/' : url.substring(hashIndex + 1) || '/';
  }

  async assertRoute(expected: string): Promise<void> {
    expect(await this.getCurrentRoute()).toBe(expected);
  }

  async waitForHashChange(expectedHash: string, timeout = 5000): Promise<void> {
    await this.page.waitForFunction((hash) => window.location.hash === `#${hash}`, expectedHash, {
      timeout,
    });
  }

  async goBack(): Promise<void> {
    await this.page.goBack();
  }

  async goForward(): Promise<void> {
    await this.page.goForward();
  }

  async waitForPageReady(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForSelector('.irc-layout', { state: 'visible' });
  }

  getNavElement(route: string): Locator {
    return this.page.locator(ROUTE_MAP[route] || `[data-route="${route}"]`);
  }

  async isNavActive(route: string): Promise<boolean> {
    const className = await this.getNavElement(route).getAttribute('class');
    return className?.includes('active') ?? false;
  }

  async waitForNavActive(route: string, timeout = 3000): Promise<void> {
    await expect(this.getNavElement(route)).toHaveClass(/active/, { timeout });
  }
}

export function createNavigationHelper(page: Page): NavigationHelper {
  return new NavigationHelper(page);
}

export { expect } from '@playwright/test';
