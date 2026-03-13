/**
 * Core Navigator
 *
 * Environment-agnostic navigation implementation.
 */

import type { Navigator, Route, NavigationState, NavigationEvent, NavigationListener, TabConfig, TabNavigator } from './types.js';

/**
 * Create navigator
 */
export function createNavigator(config: {
  initialRoute: Route;
}): Navigator {
  const { initialRoute } = config;
  const state: NavigationState = {
    currentRoute: initialRoute,
    history: [],
    future: [],
    activeTab: null,
  };
  const listeners = new Set<NavigationListener>();

  function notify(event: NavigationEvent): void {
    listeners.forEach((listener) => listener(event));
  }

  async function navigate(route: Route): Promise<void> {
    const from = state.currentRoute;
    state.history.push(from!);
    state.currentRoute = route;
    state.future = [];

    notify({
      type: 'navigate',
      from,
      to: route,
      timestamp: Date.now(),
    });
  }

  async function goBack(): Promise<void> {
    if (state.history.length === 0) return;

    const from = state.currentRoute;
    const previous = state.history.pop()!;
    state.future.unshift(from!);
    state.currentRoute = previous;

    notify({
      type: 'back',
      from,
      to: previous,
      timestamp: Date.now(),
    });
  }

  async function goForward(): Promise<void> {
    if (state.future.length === 0) return;

    const from = state.currentRoute;
    const next = state.future.shift()!;
    state.history.push(from!);
    state.currentRoute = next;

    notify({
      type: 'forward',
      from,
      to: next,
      timestamp: Date.now(),
    });
  }

  async function replace(route: Route): Promise<void> {
    const from = state.currentRoute;
    state.currentRoute = route;

    notify({
      type: 'replace',
      from,
      to: route,
      timestamp: Date.now(),
    });
  }

  async function push(route: Route): Promise<void> {
    const from = state.currentRoute;
    state.history.push(from!);
    state.currentRoute = route;
    state.future = [];

    notify({
      type: 'push',
      from,
      to: route,
      timestamp: Date.now(),
    });
  }

  async function pop(count: number = 1): Promise<void> {
    if (state.history.length === 0) return;

    const actualCount = Math.min(count, state.history.length);
    const from = state.currentRoute;

    for (let i = 0; i < actualCount; i++) {
      const previous = state.history.pop()!;
      state.future.unshift(from!);
      state.currentRoute = previous;
    }

    notify({
      type: 'pop',
      from,
      to: state.currentRoute!,
      timestamp: Date.now(),
    });
  }

  return {
    navigate,
    goBack,
    goForward,
    replace,
    push,
    pop,
    get currentRoute() {
      return state.currentRoute;
    },
    get canGoBack() {
      return state.history.length > 0;
    },
    get canGoForward() {
      return state.future.length > 0;
    },
    subscribe(listener: NavigationListener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Create tab navigator
 */
export function createTabNavigator(config: {
  tabs: TabConfig[];
  initialTab?: string;
}): TabNavigator {
  const { tabs, initialTab } = config;
  const initialTabId = initialTab || tabs[0]?.id;
  const initialRoute = tabs.find((t) => t.id === initialTabId)?.route || { name: 'home' };

  const baseNavigator = createNavigator({ initialRoute });
  let activeTab = initialTabId;

  async function setActiveTab(tabId: string): Promise<void> {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    activeTab = tabId;
    await baseNavigator.navigate(tab.route);
  }

  return {
    ...baseNavigator,
    tabs,
    get activeTab() {
      return activeTab;
    },
    setActiveTab,
  };
}

/**
 * Memory navigator for testing and non-browser environments
 */
export class MemoryNavigator implements Navigator {
  private state: NavigationState;
  private listeners = new Set<NavigationListener>();

  constructor(initialRoute: Route = { name: 'home' }) {
    this.state = {
      currentRoute: initialRoute,
      history: [],
      future: [],
      activeTab: null,
    };
  }

  private notify(event: NavigationEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }

  async navigate(route: Route): Promise<void> {
    const from = this.state.currentRoute;
    this.state.history.push(from!);
    this.state.currentRoute = route;
    this.state.future = [];

    this.notify({
      type: 'navigate',
      from,
      to: route,
      timestamp: Date.now(),
    });
  }

  async goBack(): Promise<void> {
    if (this.state.history.length === 0) return;

    const from = this.state.currentRoute;
    const previous = this.state.history.pop()!;
    this.state.future.unshift(from!);
    this.state.currentRoute = previous;

    this.notify({
      type: 'back',
      from,
      to: previous,
      timestamp: Date.now(),
    });
  }

  async goForward(): Promise<void> {
    if (this.state.future.length === 0) return;

    const from = this.state.currentRoute;
    const next = this.state.future.shift()!;
    this.state.history.push(from!);
    this.state.currentRoute = next;

    this.notify({
      type: 'forward',
      from,
      to: next,
      timestamp: Date.now(),
    });
  }

  async replace(route: Route): Promise<void> {
    const from = this.state.currentRoute;
    this.state.currentRoute = route;

    this.notify({
      type: 'replace',
      from,
      to: route,
      timestamp: Date.now(),
    });
  }

  async push(route: Route): Promise<void> {
    const from = this.state.currentRoute;
    this.state.history.push(from!);
    this.state.currentRoute = route;
    this.state.future = [];

    this.notify({
      type: 'push',
      from,
      to: route,
      timestamp: Date.now(),
    });
  }

  async pop(count: number = 1): Promise<void> {
    if (this.state.history.length === 0) return;

    const actualCount = Math.min(count, this.state.history.length);
    const from = this.state.currentRoute;

    for (let i = 0; i < actualCount; i++) {
      const previous = this.state.history.pop()!;
      this.state.future.unshift(from!);
      this.state.currentRoute = previous;
    }

    this.notify({
      type: 'pop',
      from,
      to: this.state.currentRoute!,
      timestamp: Date.now(),
    });
  }

  subscribe(listener: NavigationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  get currentRoute(): Route | null {
    return this.state.currentRoute;
  }

  get canGoBack(): boolean {
    return this.state.history.length > 0;
  }

  get canGoForward(): boolean {
    return this.state.future.length > 0;
  }
}
