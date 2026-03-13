/**
 * Navigation Hooks
 *
 * Preact hooks for navigation.
 */

import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import type { Navigator, Route, TabConfig, UseNavigationReturn, UseTabsReturn } from '../types.js';

let globalNavigator: Navigator | null = null;

/**
 * Set global navigator
 */
export function setNavigator(navigator: Navigator): void {
  globalNavigator = navigator;
}

/**
 * Get global navigator
 */
export function getNavigator(): Navigator | null {
  return globalNavigator;
}

/**
 * Use navigation hook
 */
export function useNavigation(): UseNavigationReturn {
  const [navigator] = useState<Navigator | null>(() => globalNavigator);
  const [currentRoute, setCurrentRoute] = useState<Route | null>(() =>
    globalNavigator?.currentRoute || null
  );
  const [canGoBack, setCanGoBack] = useState<boolean>(() => globalNavigator?.canGoBack || false);
  const [canGoForward, setCanGoForward] = useState<boolean>(
    () => globalNavigator?.canGoForward || false
  );

  useEffect(() => {
    if (!navigator) return;

    const unsubscribe = navigator.subscribe(() => {
      setCurrentRoute(navigator.currentRoute);
      setCanGoBack(navigator.canGoBack);
      setCanGoForward(navigator.canGoForward || false);
    });

    return unsubscribe;
  }, [navigator]);

  const navigate = useCallback(async (route: Route) => {
    await navigator?.navigate(route);
  }, [navigator]);

  const goBack = useCallback(async () => {
    await navigator?.goBack();
  }, [navigator]);

  const goForward = useCallback(async () => {
    await navigator?.goForward?.();
  }, [navigator]);

  const replace = useCallback(async (route: Route) => {
    await navigator?.replace(route);
  }, [navigator]);

  const push = useCallback(async (route: Route) => {
    await navigator?.push(route);
  }, [navigator]);

  const pop = useCallback(async (count?: number) => {
    await navigator?.pop(count);
  }, [navigator]);

  return useMemo(
    () => ({
      navigate,
      goBack,
      goForward,
      replace,
      push,
      pop,
      currentRoute,
      canGoBack,
      canGoForward,
    }),
    [navigate, goBack, goForward, replace, push, pop, currentRoute, canGoBack, canGoForward]
  );
}

/**
 * Use current route hook
 */
export function useCurrentRoute(): Route | null {
  const [navigator] = useState<Navigator | null>(() => globalNavigator);
  const [route, setRoute] = useState<Route | null>(() => globalNavigator?.currentRoute || null);

  useEffect(() => {
    if (!navigator) return;

    const unsubscribe = navigator.subscribe(() => {
      setRoute(navigator.currentRoute);
    });

    return unsubscribe;
  }, [navigator]);

  return route;
}

/**
 * Use tabs hook
 */
export function useTabs(): UseTabsReturn {
  const [navigator] = useState<Navigator | null>(() => globalNavigator);
  const [tabs, setTabs] = useState<TabConfig[]>([]);
  const [activeTab, setActiveTabState] = useState<string>('');

  useEffect(() => {
    if (!navigator || !('tabs' in navigator)) return;

    const tabNavigator = navigator as Navigator & {
      tabs: TabConfig[];
      activeTab: string;
      setActiveTab: (tabId: string) => Promise<void>;
    };

    setTabs(tabNavigator.tabs);
    setActiveTabState(tabNavigator.activeTab);

    const unsubscribe = navigator.subscribe(() => {
      if ('tabs' in navigator) {
        setTabs((navigator as unknown as { tabs: TabConfig[] }).tabs);
        setActiveTabState((navigator as unknown as { activeTab: string }).activeTab);
      }
    });

    return unsubscribe;
  }, [navigator]);

  const setActiveTab = useCallback(
    async (tabId: string) => {
      if (navigator && 'setActiveTab' in navigator) {
        await (navigator as unknown as { setActiveTab: (tabId: string) => Promise<void> }).setActiveTab(tabId);
      }
    },
    [navigator]
  );

  return useMemo(
    () => ({
      tabs,
      activeTab,
      setActiveTab,
    }),
    [tabs, activeTab, setActiveTab]
  );
}

/**
 * Use route params hook
 */
export function useParams<T extends Record<string, string> = Record<string, string>>(): T {
  const route = useCurrentRoute();
  return (route?.params as T) || ({} as T);
}
