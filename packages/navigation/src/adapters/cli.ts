/**
 * CLI Navigation Adapter
 *
 * In-memory navigation for CLI applications.
 */

import type { Navigator, Route, NavigationListener } from '../types.js';

/**
 * CLI navigator using in-memory state
 */
export class CliNavigator implements Navigator {
  private listeners = new Set<NavigationListener>();
  private currentRouteState: Route | null = null;
  private history: Route[] = [];
  private future: Route[] = [];

  async navigate(route: Route): Promise<void> {
    const from = this.currentRouteState;
    this.history.push(from!);
    this.currentRouteState = route;
    this.future = [];
    this.notify('navigate', from, route);
  }

  async goBack(): Promise<void> {
    if (this.history.length === 0) return;
    const from = this.currentRouteState;
    const previous = this.history.pop()!;
    this.future.unshift(from!);
    this.currentRouteState = previous;
    this.notify('back', from, previous);
  }

  async goForward(): Promise<void> {
    if (this.future.length === 0) return;
    const from = this.currentRouteState;
    const next = this.future.shift()!;
    this.history.push(from!);
    this.currentRouteState = next;
    this.notify('forward', from, next);
  }

  async replace(route: Route): Promise<void> {
    const from = this.currentRouteState;
    this.currentRouteState = route;
    this.notify('replace', from, route);
  }

  async push(route: Route): Promise<void> {
    await this.navigate(route);
  }

  async pop(count = 1): Promise<void> {
    for (let i = 0; i < Math.min(count, this.history.length); i++) {
      await this.goBack();
    }
  }

  subscribe(listener: NavigationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get currentRoute(): Route | null {
    return this.currentRouteState;
  }

  get canGoBack(): boolean {
    return this.history.length > 0;
  }

  get canGoForward(): boolean {
    return this.future.length > 0;
  }

  private notify(type: string, from: Route | null, to: Route): void {
    this.listeners.forEach((listener) =>
      listener({
        type: type as NavigationListener['type'],
        from,
        to,
        timestamp: Date.now(),
      })
    );
  }
}

/**
 * Create CLI navigator
 */
export function createCliNavigator(initialRoute?: Route): CliNavigator {
  const navigator = new CliNavigator();
  if (initialRoute) {
    navigator['currentRouteState'] = initialRoute;
  }
  return navigator;
}
