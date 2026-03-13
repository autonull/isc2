/**
 * Browser Navigation Adapter
 *
 * History API-based navigation for web browsers.
 */

import type { Navigator, Route, NavigationListener } from '../types.js';

/**
 * Browser navigator using History API
 */
export class BrowserNavigator implements Navigator {
  private listeners = new Set<NavigationListener>();
  private basePath: string;

  constructor(basePath = '') {
    this.basePath = basePath;
    window.addEventListener('popstate', this.handlePopState);
  }

  private handlePopState = (): void => {
    const route = this.parseLocation();
    this.listeners.forEach((listener) =>
      listener({
        type: 'navigate',
        from: this.currentRoute,
        to: route,
        timestamp: Date.now(),
      })
    );
  };

  private parseLocation(): Route {
    const path = window.location.pathname.replace(this.basePath, '') || '/';
    const searchParams = new URLSearchParams(window.location.search);
    const params: Record<string, unknown> = {};

    searchParams.forEach((value, key) => {
      params[key] = value;
    });

    return {
      name: path.replace(/^\//, '').replace(/\/$/, '') || 'home',
      path,
      params: Object.keys(params).length > 0 ? params : undefined,
    };
  }

  private buildPath(route: Route): string {
    const path = route.path || `/${route.name}`;
    const queryString = route.params
      ? `?${new URLSearchParams(route.params as Record<string, string>).toString()}`
      : '';
    return `${this.basePath}${path}${queryString}`;
  }

  async navigate(route: Route): Promise<void> {
    window.history.pushState(route, '', this.buildPath(route));
  }

  async goBack(): Promise<void> {
    window.history.back();
  }

  async goForward(): Promise<void> {
    window.history.forward();
  }

  async replace(route: Route): Promise<void> {
    window.history.replaceState(route, '', this.buildPath(route));
  }

  async push(route: Route): Promise<void> {
    window.history.pushState(route, '', this.buildPath(route));
  }

  async pop(count = 1): Promise<void> {
    for (let i = 0; i < count; i++) {
      window.history.back();
    }
  }

  subscribe(listener: NavigationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  get currentRoute(): Route | null {
    return this.parseLocation();
  }

  get canGoBack(): boolean {
    return window.history.length > 1;
  }

  get canGoForward(): boolean {
    return true;
  }

  destroy(): void {
    window.removeEventListener('popstate', this.handlePopState);
  }
}

/**
 * Create browser navigator
 */
export function createBrowserNavigator(basePath?: string): BrowserNavigator {
  return new BrowserNavigator(basePath);
}
