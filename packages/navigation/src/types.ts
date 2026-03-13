/**
 * Navigation Type Definitions
 *
 * Environment-agnostic navigation types.
 */

/**
 * Route definition
 */
export interface Route {
  name: string;
  path?: string;
  params?: Record<string, unknown>;
}

/**
 * Route configuration
 */
export interface RouteConfig {
  name: string;
  path?: string;
  params?: Record<string, unknown>;
}

/**
 * Routes map
 */
export interface RoutesMap {
  [key: string]: RouteConfig;
}

/**
 * Navigator interface
 */
export interface Navigator {
  navigate(route: Route): Promise<void>;
  goBack(): Promise<void>;
  goForward?(): Promise<void>;
  replace(route: Route): Promise<void>;
  push(route: Route): Promise<void>;
  pop(count?: number): Promise<void>;
  currentRoute: Route | null;
  canGoBack: boolean;
  canGoForward?: boolean;
  subscribe(listener: NavigationListener): () => void;
}

/**
 * Tab configuration
 */
export interface TabConfig {
  id: string;
  label: string;
  icon?: string;
  route: Route;
  badge?: number;
}

/**
 * Tab navigator interface
 */
export interface TabNavigator extends Navigator {
  tabs: TabConfig[];
  activeTab: string;
  setActiveTab(tabId: string): Promise<void>;
}

/**
 * Navigation state
 */
export interface NavigationState {
  currentRoute: Route | null;
  history: Route[];
  future: Route[];
  activeTab: string | null;
}

/**
 * Navigation event
 */
export interface NavigationEvent {
  type: 'navigate' | 'back' | 'forward' | 'replace' | 'push' | 'pop';
  from: Route | null;
  to: Route;
  timestamp: number;
}

/**
 * Navigation listener
 */
export type NavigationListener = (event: NavigationEvent) => void;

/**
 * Navigation options
 */
export interface NavigationOptions {
  replace?: boolean;
  state?: unknown;
}

/**
 * Hook return type for useNavigation
 */
export interface UseNavigationReturn {
  navigate: (route: Route) => Promise<void>;
  goBack: () => Promise<void>;
  goForward: () => Promise<void>;
  replace: (route: Route) => Promise<void>;
  push: (route: Route) => Promise<void>;
  pop: (count?: number) => Promise<void>;
  currentRoute: Route | null;
  canGoBack: boolean;
  canGoForward: boolean;
}

/**
 * Hook return type for useTabs
 */
export interface UseTabsReturn {
  tabs: TabConfig[];
  activeTab: string;
  setActiveTab: (tabId: string) => Promise<void>;
}
