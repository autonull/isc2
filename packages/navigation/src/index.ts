/**
 * @isc/navigation - Navigation Abstraction
 *
 * Unified navigation API across all platforms.
 */

export {
  createNavigator,
  createTabNavigator,
  MemoryNavigator,
} from './navigator.js';
export {
  BrowserNavigator,
  createBrowserNavigator,
} from './adapters/browser.js';
export {
  CliNavigator,
  createCliNavigator,
} from './adapters/cli.js';
export {
  WebNavigator,
  createWebNavigator,
} from './adapters/web.js';
export {
  useNavigation,
  useCurrentRoute,
  useTabs,
  useParams,
  setNavigator,
  getNavigator,
} from './hooks/index.js';
export type {
  Route,
  RouteConfig,
  RoutesMap,
  Navigator,
  TabConfig,
  TabNavigator,
  NavigationState,
  NavigationEvent,
  NavigationListener,
  NavigationOptions,
  UseNavigationReturn,
  UseTabsReturn,
} from './types.js';
