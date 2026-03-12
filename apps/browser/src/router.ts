export type Route = 'now' | 'following' | 'discover' | 'compose' | 'chats' | 'settings' | 'video';

type RouteChangeCallback = (route: Route) => void;

const VALID_ROUTES: Route[] = ['now', 'following', 'discover', 'compose', 'chats', 'settings', 'video'];

class Router {
  private currentRoute: Route = 'now';
  private listeners = new Set<RouteChangeCallback>();
  private params: Record<string, string> = {};

  get route(): Route {
    return this.currentRoute;
  }

  get params_(): Record<string, string> {
    return this.params;
  }

  navigate(route: Route, params: Record<string, string> = {}): void {
    this.currentRoute = route;
    this.params = params;
    this.listeners.forEach((listener) => listener(route));
    window.history.pushState({}, '', `#/${route}`);
  }

  onChange(callback: RouteChangeCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  getRouteFromHash(): Route {
    const hash = window.location.hash.slice(2) || 'now';
    return VALID_ROUTES.includes(hash as Route) ? (hash as Route) : 'now';
  }

  init(): void {
    const initialRoute = this.getRouteFromHash();
    this.navigate(initialRoute);

    window.addEventListener('hashchange', () => {
      const route = this.getRouteFromHash();
      this.navigate(route);
    });
  }
}

export const router = new Router();
export const navigate = router.navigate.bind(router);
export const onRouteChange = router.onChange.bind(router);
export const initRouter = router.init.bind(router);
export const currentRoute = () => router.route;
export const routeParams = () => router.params_;
