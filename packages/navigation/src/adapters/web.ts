/**
 * Web Navigation Adapter
 *
 * History API-based navigation for web browsers.
 */

import type { Navigator, Route, NavigationListener, NavigationEvent } from '../types.js';

/**
 * Web navigator using History API
 */
export class WebNavigator implements Navigator {
  private listeners = new Set<NavigationListener>();
  private basePath: string;

  constructor(basePath: string = '') {
    this.basePath = basePath;

    // Listen to popstate events
    window.addEventListener('popstate', this.handlePopState.bind(this));
  }

  private handlePopState(): void {
    const route = this.parseLocation();
    this.notify({
      type: 'navigate',
      from: this.currentRoute,
      to: route,
      timestamp: Date.now(),
    });
  }

  private notify(event: NavigationEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }

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
    const path = this.buildPath(route);
    window.history.pushState(route, '', path);
    this.notify({
      type: 'navigate',
      from: this.currentRoute,
      to: route,
      timestamp: Date.now(),
    });
  }

  async goBack(): Promise<void> {
    window.history.back();
  }

  async goForward(): Promise<void> {
    window.history.forward();
  }

  async replace(route: Route): Promise<void> {
    const path = this.buildPath(route);
    window.history.replaceState(route, '', path);
    this.notify({
      type: 'replace',
      from: this.currentRoute,
      to: route,
      timestamp: Date.now(),
    });
  }

  async push(route: Route): Promise<void> {
    const path = this.buildPath(route);
    window.history.pushState(route, '', path);
    this.notify({
      type: 'push',
      from: this.currentRoute,
      to: route,
      timestamp: Date.now(),
    });
  }

  async pop(count: number = 1): Promise<void> {
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
    // Note: This is not reliable in all browsers
    return true;
  }

  destroy(): void {
    window.removeEventListener('popstate', this.handlePopState.bind(this));
  }
}

/**
 * Create web navigator
 */
export function createWebNavigator(basePath?: string): WebNavigator {
  return new WebNavigator(basePath);
}
