# ISC Refactoring Plan Phase 2: Deduplication & Integration

**Version**: 2.0.0  
**Date**: March 13, 2026  
**Status**: Planned  
**Goal**: Zero duplication, maximum abstraction, elegant modularity

---

## Executive Summary

**Phase 1 Complete**: 6 shared packages created (`@isc/state`, `@isc/ui`, `@isc/navigation`, `@isc/notifications`, `@isc/forms`, `@isc/a11y`)

**Phase 2 Objective**: Achieve architectural purity through:
- **Zero duplication** - Single source of truth for all cross-cutting concerns
- **Maximum abstraction** - Headless logic + platform adapters
- **Elegant modularity** - Composition over inheritance, parameterized components
- **Professional quality** - Type-safe, tested, performant

**Target Metrics**:
- 90%+ code reuse across form factors
- 0 duplicate implementations
- <1 week to add new form factor
- WCAG 2.1 AA compliance built-in

---

## Architecture Principles

### Dependency Rules (Strict)

```
┌─────────────────────────────────────────────────────────────┐
│                    Form Factor Apps                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Browser  │  │  Mobile  │  │ Desktop  │  │   CLI    │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       └─────────────┴─────────────┴─────────────┘          │
│                              │                               │
│                              ▼                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    packages/ui                           ││
│  │  Headless logic │ Adapters │ Styles │ Providers        ││
│  └─────────────────────────────────────────────────────────┘│
│                              │                               │
│                              ▼                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   packages/state                         ││
│  │  Store │ Selectors │ Actions │ Sync │ Persistence      ││
│  └─────────────────────────────────────────────────────────┘│
│                              │                               │
│                              ▼                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   packages/core                          ││
│  │  Social │ Channels │ Reputation │ Feeds │ Graph        ││
│  └─────────────────────────────────────────────────────────┘│
│                              │                               │
│                              ▼                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                  packages/adapters                       ││
│  │  Browser │ Node │ React Native │ Electron │ CLI        ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Never**:
- Core → UI (business logic never knows about presentation)
- State → Form Factor (state is environment-agnostic)
- Adapters → Core (adapters implement, core defines interfaces)
- Apps → Apps (no cross-app dependencies)

### Composition Over Inheritance

```typescript
// ❌ Avoid: Inheritance chains
class FeedComponent extends BaseComponent extends Component { ... }

// ✅ Prefer: Composition with render props/hooks
function Feed({ renderItem, renderLoading, renderEmpty }) {
  const { posts, loading, error } = useFeedLogic();
  if (loading) return renderLoading();
  if (error) return renderEmpty();
  return posts.map(renderItem);
}
```

### Interface-Driven Design

```typescript
// Core defines interface
export interface StorageAdapter<T> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  watch?(key: string, callback: (value: T | null) => void): () => void;
}

// Adapters implement
export class BrowserStorage<T> implements StorageAdapter<T> { ... }
export class ReactNativeStorage<T> implements StorageAdapter<T> { ... }
export class FileStorage<T> implements StorageAdapter<T> { ... }
```

---

## Redundancy Matrix

| Concern | apps/browser | apps/cli | apps/node | packages/ | Action |
|---------|--------------|----------|-----------|-----------|--------|
| **Navigation** | router.ts (custom) | commander | - | @isc/navigation | Migrate all → packages |
| **Feed UI** | Feed.tsx | - | - | @isc/ui | Refactor → headless + adapter |
| **Tab Nav** | TopNav.tsx | - | - | @isc/navigation | Replace with TabBar |
| **Validation** | inline | inline | - | @isc/forms | Consolidate → packages |
| **State** | local state | - | - | @isc/state | Migrate → packages |
| **Loading UI** | Skeleton.tsx | - | - | @isc/ui | Move → packages |
| **Error UI** | ErrorBoundary.tsx | - | - | @isc/ui | Move → packages |
| **Connection** | ConnectionStatus.tsx | - | - | @isc/ui | Move → packages |
| **Social Logic** | ✅ migrated | ✅ migrated | ✅ migrated | @isc/core | Complete |
| **Channel Logic** | ✅ migrated | ✅ migrated | ✅ migrated | @isc/core | Complete |

---

## Migration Phases

### Phase 2A: Navigation Consolidation

**Goal**: Single navigation implementation across all form factors

#### Files to Delete
- `apps/browser/src/router.ts`

#### Files to Create

```typescript
// packages/navigation/src/adapters/browser.ts
import type { Navigator, Route, NavigationListener } from '../types.js';

export class BrowserNavigator implements Navigator {
  private listeners = new Set<NavigationListener>();
  private basePath: string;

  constructor(basePath = '') {
    this.basePath = basePath;
    window.addEventListener('popstate', this.handlePopState);
  }

  private handlePopState = (): void => {
    const route = this.parseLocation();
    this.listeners.forEach(listener => listener({
      type: 'navigate',
      from: this.currentRoute,
      to: route,
      timestamp: Date.now(),
    }));
  };

  private parseLocation(): Route {
    const path = window.location.pathname.replace(this.basePath, '') || '/';
    const params = new URLSearchParams(window.location.search);
    return {
      name: path.replace(/^\//, '').replace(/\/$/, '') || 'home',
      path,
      params: Object.fromEntries(params),
    };
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
    for (let i = 0; i < count; i++) window.history.back();
  }

  subscribe(listener: NavigationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
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

  private buildPath(route: Route): string {
    const query = route.params ? `?${new URLSearchParams(route.params as Record<string, string>)}` : '';
    return `${this.basePath}${route.path || `/${route.name}`}${query}`;
  }

  destroy(): void {
    window.removeEventListener('popstate', this.handlePopState);
  }
}
```

```typescript
// packages/navigation/src/adapters/cli.ts
import type { Navigator, Route, NavigationListener } from '../types.js';
import { render, Text, Box } from 'ink';

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
    this.listeners.forEach(listener => listener({
      type: type as NavigationListener['type'],
      from,
      to,
      timestamp: Date.now(),
    }));
  }
}
```

#### Files to Modify

```typescript
// apps/browser/src/index.tsx
import { BrowserNavigator, setNavigator } from '@isc/navigation';

const navigator = new BrowserNavigator();
setNavigator(navigator);

render(<App />, document.getElementById('root'));
```

```typescript
// apps/browser/src/App.tsx
import { useCurrentRoute } from '@isc/navigation';
import { TabBar } from '@isc/ui';
import { NowScreen, DiscoverScreen, ChatsScreen, SettingsScreen } from './screens/index.js';

const ROUTES: Record<string, () => JSX.Element> = {
  now: NowScreen,
  discover: DiscoverScreen,
  chats: ChatsScreen,
  settings: SettingsScreen,
};

export function App(): JSX.Element {
  const { currentRoute } = useCurrentRoute();
  const Screen = ROUTES[currentRoute?.name ?? 'now'];

  return (
    <Layout>
      <TabBar position="top" />
      <main><Screen /></main>
    </Layout>
  );
}
```

#### Checklist
- [ ] Create `BrowserNavigator` class
- [ ] Create `CliNavigator` class
- [ ] Create `ReactNativeNavigator` class (future)
- [ ] Create `ElectronNavigator` class (future)
- [ ] Delete `apps/browser/src/router.ts`
- [ ] Update all `navigate()` calls to use hooks
- [ ] Test deep linking
- [ ] Test browser back/forward

---

### Phase 2B: Headless Feed Pattern

**Goal**: Separate feed logic from presentation

#### Headless Hook

```typescript
// packages/ui/src/hooks/useFeedLogic.ts
import { useState, useEffect, useCallback } from 'preact/hooks';
import type { SignedPost } from '@isc/core';
import { getForYouFeed, getFollowingFeed } from '@isc/core';

export interface UseFeedLogicOptions {
  type: 'for-you' | 'following';
  limit?: number;
  pullToRefresh?: boolean;
}

export interface UseFeedLogicReturn {
  posts: SignedPost[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  cursor?: string;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

export function useFeedLogic({
  type,
  limit = 50,
  pullToRefresh = false,
}: UseFeedLogicOptions): UseFeedLogicReturn {
  const [posts, setPosts] = useState<SignedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string>();

  const fetchPosts = useCallback(async (isRefresh = false): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const fetched = type === 'following'
        ? await getFollowingFeed(limit)
        : await getForYouFeed(limit);
      
      setPosts(isRefresh ? fetched : [...posts, ...fetched]);
      setHasMore(fetched.length === limit);
      setCursor(fetched[fetched.length - 1]?.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, [type, limit, posts]);

  const refresh = useCallback(async (): Promise<void> => {
    await fetchPosts(true);
  }, [fetchPosts]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (!hasMore) return;
    await fetchPosts(false);
  }, [fetchPosts, hasMore]);

  useEffect(() => {
    fetchPosts();
  }, [type]);

  return { posts, loading, error, hasMore, cursor, refresh, loadMore };
}
```

#### Headless Component

```typescript
// packages/ui/src/components/Feed/FeedHeadless.tsx
import { h, JSX } from 'preact';
import type { SignedPost } from '@isc/core';
import { useFeedLogic, type UseFeedLogicOptions } from '../../hooks/useFeedLogic.js';

export interface FeedHeadlessProps extends UseFeedLogicOptions {
  children: (props: UseFeedLogicReturn & {
    renderPost: (post: SignedPost) => JSX.Element;
  }) => JSX.Element;
  renderPost: (post: SignedPost) => JSX.Element;
  renderLoading?: () => JSX.Element;
  renderError?: (error: string) => JSX.Element;
  renderEmpty?: () => JSX.Element;
}

export function FeedHeadless({
  children,
  renderPost,
  renderLoading,
  renderError,
  renderEmpty,
  ...options
}: FeedHeadlessProps): JSX.Element {
  const feed = useFeedLogic(options);

  if (feed.loading) return renderLoading?.() ?? <Loading />;
  if (feed.error) return renderError?.(feed.error) ?? <Error message={feed.error} />;
  if (feed.posts.length === 0) return renderEmpty?.() ?? <Empty />;

  return children({ ...feed, renderPost });
}
```

#### Browser Adapter

```typescript
// packages/ui/src/adapters/browser/Feed.tsx
import { h, JSX } from 'preact';
import { FeedHeadless } from '../../components/Feed/FeedHeadless.js';
import { usePullToRefresh } from '../../hooks/usePullToRefresh.js';
import type { SignedPost } from '@isc/core';

export interface FeedProps {
  type?: 'for-you' | 'following';
  limit?: number;
  renderPost: (post: SignedPost) => JSX.Element;
  renderLoading?: () => JSX.Element;
  renderError?: (error: string) => JSX.Element;
  renderEmpty?: () => JSX.Element;
}

export function Feed({
  type = 'for-you',
  limit = 50,
  renderPost,
  renderLoading,
  renderError,
  renderEmpty,
}: FeedProps): JSX.Element {
  return (
    <FeedHeadless
      type={type}
      limit={limit}
      renderPost={renderPost}
      renderLoading={renderLoading}
      renderError={renderError}
      renderEmpty={renderEmpty}
    >
      {({ posts, refresh, renderPost: render }) => {
        usePullToRefresh(refresh);
        return (
          <div role="feed" aria-label="Posts">
            {posts.map(render)}
          </div>
        );
      }}
    </FeedHeadless>
  );
}
```

#### Checklist
- [ ] Create `useFeedLogic` hook
- [ ] Create `FeedHeadless` component
- [ ] Create browser adapter
- [ ] Create React Native adapter (future)
- [ ] Create CLI adapter (future)
- [ ] Refactor `apps/browser/src/components/Feed.tsx`
- [ ] Test pull-to-refresh
- [ ] Test infinite scroll

---

### Phase 2C: Navigation UI Components

**Goal**: Platform-agnostic navigation UI

#### Compound Component Pattern

```typescript
// packages/ui/src/components/Navigation/TabBar/index.tsx
import { h, JSX } from 'preact';
import { createContext } from 'preact';
import { useTabs } from '../../../hooks/useNavigation.js';

interface TabBarContext {
  activeTab: string;
  setActiveTab: (id: string) => Promise<void>;
  orientation: 'horizontal' | 'vertical';
}

const TabBarContext = createContext<TabBarContext | null>(null);

interface TabBarProps {
  orientation?: 'horizontal' | 'vertical';
  position?: 'top' | 'bottom' | 'left' | 'right';
  children: JSX.Element;
  className?: string;
}

function TabBarRoot({
  orientation = 'horizontal',
  position = 'top',
  children,
  className,
}: TabBarProps): JSX.Element {
  const { activeTab, setActiveTab } = useTabs();

  return (
    <TabBarContext.Provider value={{ activeTab, setActiveTab, orientation }}>
      <nav class={`tab-bar tab-bar--${position} tab-bar--${orientation} ${className ?? ''}`}>
        {children}
      </nav>
    </TabBarContext.Provider>
  );
}

interface TabProps {
  id: string;
  icon?: string;
  label?: string;
  badge?: number;
  children?: JSX.Element;
}

function Tab({ id, icon, label, badge, children }: TabProps): JSX.Element {
  const context = TabBarContext;
  if (!context) throw new Error('Tab must be used within TabBar');
  
  const { activeTab, setActiveTab } = context;
  const isActive = activeTab === id;

  return (
    <button
      class={`tab ${isActive ? 'tab--active' : ''}`}
      onClick={() => setActiveTab(id)}
      aria-current={isActive ? 'page' : undefined}
    >
      {icon && <span class="tab__icon">{icon}</span>}
      {label && <span class="tab__label">{label}</span>}
      {badge !== undefined && badge > 0 && (
        <span class="tab__badge">{badge}</span>
      )}
      {children}
    </button>
  );
}

export const TabBar = Object.assign(TabBarRoot, { Tab });
```

#### Usage

```typescript
// apps/browser/src/components/TopNav.tsx
import { TabBar } from '@isc/ui';

export function TopNav(): JSX.Element {
  return (
    <TabBar position="top">
      <TabBar.Tab id="now" icon="🏠" label="Now" />
      <TabBar.Tab id="discover" icon="📡" label="Discover" />
      <TabBar.Tab id="video" icon="📹" label="Video" />
      <TabBar.Tab id="compose" icon="➕" label="Compose" />
      <TabBar.Tab id="chats" icon="💬" label="Chats" badge={3} />
      <TabBar.Tab id="settings" icon="⚙️" label="Settings" />
    </TabBar>
  );
}
```

#### Checklist
- [ ] Create `TabBar` compound component
- [ ] Create `Sidebar` compound component
- [ ] Create `Breadcrumb` component
- [ ] Create `MobileNav` component
- [ ] Export from `@isc/ui`
- [ ] Replace `apps/browser/src/components/TopNav.tsx`
- [ ] Test responsive behavior

---

### Phase 2D: Form Validation Consolidation

**Goal**: Single validation source across all form factors

#### Enhanced Validators

```typescript
// packages/forms/src/validators.ts
import type { Validator } from './types.js';

export const required = <T>(): Validator<T | null | undefined> => ({
  validate: value => ({
    valid: value !== null && value !== undefined && value !== '',
    error: 'This field is required',
  }),
});

export const minLength = (min: number): Validator<string> => ({
  validate: value => ({
    valid: value.length >= min,
    error: `Minimum ${min} characters required`,
  }),
});

export const maxLength = (max: number): Validator<string> => ({
  validate: value => ({
    valid: value.length <= max,
    error: `Maximum ${max} characters allowed`,
  }),
});

export const pattern = (regex: RegExp, message: string): Validator<string> => ({
  validate: value => ({
    valid: regex.test(value),
    error: message,
  }),
});

export const email = (): Validator<string> => ({
  validate: value => ({
    valid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    error: 'Invalid email address',
  }),
});

export const compose = <T>(validators: Validator<T>[]): Validator<T> => ({
  validate: (value, context) => {
    for (const validator of validators) {
      const result = validator.validate(value, context);
      if (!result.valid) return result;
    }
    return { valid: true };
  },
});

// ISC Domain Validators
export const iscValidators = {
  channelName: (): Validator<string> => compose([
    required(),
    minLength(3),
    maxLength(30),
    pattern(/^[a-zA-Z0-9\s_-]+$/, 'Letters, numbers, spaces, hyphens only'),
  ]),

  channelDescription: (): Validator<string> => compose([
    required(),
    minLength(10),
    maxLength(500),
  ]),

  peerId: (): Validator<string> => compose([
    required(),
    pattern(/^[\w-]{20,}$/, 'Invalid peer ID format'),
  ]),

  channelSpread: (): Validator<number> => ({
    validate: value => ({
      valid: value >= 0 && value <= 0.3,
      error: 'Spread must be between 0 and 0.3',
    }),
  }),

  relationTag: (): Validator<string> => compose([
    required(),
    pattern(/^[a-z][a-z0-9_]{2,29}$/, 'Lowercase, 3-30 characters'),
  ]),

  relationWeight: (): Validator<number> => ({
    validate: value => ({
      valid: value >= 0.1 && value <= 10,
      error: 'Weight must be between 0.1 and 10',
    }),
  }),
};
```

#### CLI Integration

```typescript
// apps/cli/src/commands/channel.ts
import { iscValidators, compose } from '@isc/forms';

const createChannelValidator = compose([
  iscValidators.channelName(),
]);

const describeChannelValidator = compose([
  iscValidators.channelDescription(),
]);

export async function createChannel(name: string, description: string): Promise<void> {
  const nameResult = createChannelValidator.validate(name);
  if (!nameResult.valid) {
    console.error(`Invalid channel name: ${nameResult.error}`);
    process.exit(1);
  }

  const descResult = describeChannelValidator.validate(description);
  if (!descResult.valid) {
    console.error(`Invalid description: ${descResult.error}`);
    process.exit(1);
  }

  await channelManager.createChannel(name, description);
  console.log(`Channel "${name}" created successfully`);
}
```

#### Checklist
- [ ] Enhance `@isc/forms` validators
- [ ] Add `compose` utility
- [ ] Update all CLI commands
- [ ] Add browser form validation
- [ ] Test validation error messages
- [ ] Add unit tests

---

### Phase 2E: State Management Integration

**Goal**: Unified state with platform-specific persistence

#### Browser Storage Adapter

```typescript
// packages/state/src/adapters/browser.ts
import type { StateStorage, AppState } from '../types.js';

const STORAGE_KEY = 'isc-state';

export class BrowserStorage implements StateStorage {
  async get(): Promise<Partial<AppState> | null> {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  async set(state: Partial<AppState>): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Quota exceeded
    }
  }

  async clear(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export class IndexedDBStorage implements StateStorage {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'isc';
  private readonly storeName = 'state';

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { this.db = request.result; resolve(); };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  async get(): Promise<Partial<AppState> | null> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get('state');
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result ?? null);
    });
  }

  async set(state: Partial<AppState>): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.put(state, 'state');
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clear(): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete('state');
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}
```

#### App Integration

```typescript
// apps/browser/src/state/store.ts
import { createStateStore } from '@isc/state';
import { IndexedDBStorage, BroadcastChannelSync } from '@isc/state';

const storage = new IndexedDBStorage();
const sync = new BroadcastChannelSync();

export const store = createStateStore({
  storage,
  sync,
  initialState: {
    ui: { sidebarOpen: true },
  },
});
```

#### Checklist
- [ ] Create `BrowserStorage` class
- [ ] Create `IndexedDBStorage` class
- [ ] Create `ReactNativeStorage` class (future)
- [ ] Create `FileStorage` class (future)
- [ ] Update app store initialization
- [ ] Test state persistence
- [ ] Test cross-tab sync

---

### Phase 2F: Shared UI Components

**Goal**: Complete component library for all form factors

#### Component Inventory

```
packages/ui/src/components/common/
├── Skeleton.tsx           # Loading states
├── ErrorBoundary.tsx      # Error handling
├── ConnectionStatus.tsx   # Online/offline
├── EmptyState.tsx         # Empty states
├── Spinner.tsx            # Loading indicators
├── Badge.tsx              # Notifications
├── Button.tsx             # Actions
├── Input.tsx              # Form inputs
├── Modal.tsx              # Dialogs
├── Card.tsx               # Content containers
├── Avatar.tsx             # User images
└── index.ts
```

#### Skeleton Component

```typescript
// packages/ui/src/components/common/Skeleton.tsx
import { h, JSX } from 'preact';

export interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'post';
  width?: string | number;
  height?: string | number;
  className?: string;
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  className,
}: SkeletonProps): JSX.Element {
  const style: JSX.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  return (
    <div
      class={`skeleton skeleton--${variant} ${className ?? ''}`}
      style={style}
      aria-label="Loading"
      role="progressbar"
    />
  );
}

export function SkeletonPost(): JSX.Element {
  return (
    <div class="skeleton-post">
      <Skeleton variant="circular" width={48} height={48} />
      <div class="skeleton-post__content">
        <Skeleton variant="text" height={16} />
        <Skeleton variant="text" height={16} width="80%" />
        <Skeleton variant="rectangular" height={200} />
      </div>
    </div>
  );
}
```

#### ConnectionStatus Component

```typescript
// packages/ui/src/components/common/ConnectionStatus.tsx
import { h, JSX } from 'preact';
import { useIsOnline } from '../../hooks/useAppState.js';

export interface ConnectionStatusProps {
  showLabel?: boolean;
  className?: string;
}

export function ConnectionStatus({
  showLabel = false,
  className,
}: ConnectionStatusProps): JSX.Element {
  const isOnline = useIsOnline();

  return (
    <div
      class={`connection-status connection-status--${isOnline ? 'online' : 'offline'} ${className ?? ''}`}
      role="status"
      aria-live="polite"
    >
      <span class="connection-status__indicator" />
      {showLabel && (
        <span class="connection-status__label">
          {isOnline ? 'Connected' : 'Offline'}
        </span>
      )}
    </div>
  );
}
```

#### Checklist
- [ ] Create all common components
- [ ] Add TypeScript types
- [ ] Add accessibility attributes
- [ ] Test with screen readers
- [ ] Test keyboard navigation
- [ ] Document props in JSDoc

---

## Testing Strategy

### Principles (per AGENTS.md)

- **No mocks** - Test real objects
- **Behavior over implementation** - Test what, not how
- **Deterministic** - Same input = same output
- **Focused** - One assertion per test

### Unit Tests

```typescript
// packages/forms/src/validators.test.ts
import { describe, it, expect } from 'vitest';
import { required, minLength, iscValidators } from './validators.js';

describe('validators', () => {
  describe('required', () => {
    it('passes for non-empty string', () => {
      expect(required().validate('hello')).toEqual({ valid: true });
    });

    it('fails for empty string', () => {
      expect(required().validate('')).toEqual({
        valid: false,
        error: 'This field is required',
      });
    });

    it('fails for null', () => {
      expect(required().validate(null)).toEqual({
        valid: false,
        error: 'This field is required',
      });
    });
  });

  describe('iscValidators.channelName', () => {
    it('passes for valid name', () => {
      expect(iscValidators.channelName().validate('My Channel')).toEqual({ valid: true });
    });

    it('fails for name too short', () => {
      const result = iscValidators.channelName().validate('AB');
      expect(result.valid).toBe(false);
    });

    it('fails for invalid characters', () => {
      const result = iscValidators.channelName().validate('Channel@123');
      expect(result.valid).toBe(false);
    });
  });
});
```

### Integration Tests

```typescript
// packages/ui/src/components/Feed/Feed.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import { Feed } from './Feed.js';

describe('Feed', () => {
  const mockPosts = [
    { id: '1', author: 'user1', content: 'Hello', channelID: 'ch1', timestamp: Date.now() },
    { id: '2', author: 'user2', content: 'World', channelID: 'ch1', timestamp: Date.now() },
  ];

  it('renders loading state', async () => {
    render(<Feed posts={[]} loading={true} error={null} onRefresh={() => {}} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders empty state', async () => {
    render(<Feed posts={[]} loading={false} error={null} onRefresh={() => {}} />);
    expect(screen.getByText(/no posts/i)).toBeInTheDocument();
  });

  it('renders posts', async () => {
    render(
      <Feed
        posts={mockPosts}
        loading={false}
        error={null}
        onRefresh={() => {}}
        renderPost={(post) => <div data-testid="post">{post.content}</div>}
      />
    );
    expect(screen.getAllByTestId('post')).toHaveLength(2);
  });

  it('renders error state', async () => {
    render(<Feed posts={[]} loading={false} error="Failed" onRefresh={() => {}} />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });
});
```

### E2E Tests

```typescript
// tests/e2e/navigation.spec.ts
import { test, expect } from '@playwright/test';

test('navigation flows', async ({ page }) => {
  await page.goto('/');

  // Tab navigation
  await page.click('[data-testid="tab-discover"]');
  await expect(page).toHaveURL('/discover');

  // Browser back
  await page.goBack();
  await expect(page).toHaveURL('/');

  // Deep link
  await page.goto('/chats/room-123');
  await expect(page.locator('[data-testid="chat-room"]')).toBeVisible();
});

test('feed interactions', async ({ page }) => {
  await page.goto('/');

  // Pull to refresh
  await page.evaluate(() => {
    window.dispatchEvent(new TouchEvent('touchstart', { touches: [{ clientY: 0 }] }));
    window.dispatchEvent(new TouchEvent('touchmove', { touches: [{ clientY: 150 }] }));
  });

  await expect(page.locator('[data-testid="feed-refreshing"]')).toBeVisible();
});
```

---

## Performance Guidelines

### Hot Path Optimization

```typescript
// ❌ Avoid: Object creation in loops
function processPosts(posts: Post[]): ProcessedPost[] {
  return posts.map(post => ({
    ...post,
    formatted: formatPost(post),
    metadata: { createdAt: new Date(post.timestamp) },
  }));
}

// ✅ Prefer: Memoization, Set for membership
const processedCache = new Map<string, ProcessedPost>();

function processPosts(posts: Post[]): ProcessedPost[] {
  const seen = new Set<string>();
  return posts
    .filter(post => {
      if (seen.has(post.id)) return false;
      seen.add(post.id);
      return true;
    })
    .map(post => {
      if (processedCache.has(post.id)) return processedCache.get(post.id)!;
      const processed = { ...post, formatted: formatPost(post) };
      processedCache.set(post.id, processed);
      return processed;
    });
}
```

### Selector Memoization

```typescript
// packages/state/src/selectors.ts
const cache = new WeakMap<object, unknown>();

export function memoize<T>(selector: (state: AppState) => T): (state: AppState) => T {
  return (state: AppState): T => {
    if (cache.has(state)) return cache.get(state) as T;
    const result = selector(state);
    cache.set(state, result);
    return result;
  };
}

export const selectActiveChannel = memoize((state: AppState) =>
  state.channels.find(c => c.id === state.activeChannelId) ?? null
);
```

---

## Error Handling Patterns

### Specific Error Types

```typescript
// packages/core/src/errors.ts
export class ISCError extends Error {
  constructor(message: string, public code: string, public context?: Record<string, unknown>) {
    super(message);
    this.name = 'ISCError';
  }
}

export class ValidationError extends ISCError {
  constructor(field: string, message: string) {
    super(message, 'VALIDATION_ERROR', { field });
    this.name = 'ValidationError';
  }
}

export class NetworkError extends ISCError {
  constructor(message: string, public endpoint?: string) {
    super(message, 'NETWORK_ERROR', { endpoint });
    this.name = 'NetworkError';
  }
}

export class StorageError extends ISCError {
  constructor(message: string, public operation?: string) {
    super(message, 'STORAGE_ERROR', { operation });
    this.name = 'StorageError';
  }
}
```

### Error Boundaries

```typescript
// packages/ui/src/components/common/ErrorBoundary.tsx
import { h, JSX, Component } from 'preact';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: JSX.Element; fallback?: (error: Error) => JSX.Element }, ErrorBoundaryState> {
  constructor(props: { children: JSX.Element }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: Record<string, unknown>): void {
    console.error('ErrorBoundary caught:', { error, info });
  }

  render(): JSX.Element {
    if (this.state.hasError) {
      return this.props.fallback?.(this.state.error!) ?? <DefaultError error={this.state.error!} />;
    }
    return this.props.children;
  }
}
```

---

## Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Components | PascalCase | `Feed`, `TabBar`, `ErrorBoundary` |
| Hooks | camelCase with `use` prefix | `useFeed`, `useNavigation`, `useAppState` |
| Types/Interfaces | PascalCase | `FeedProps`, `Navigator`, `AppState` |
| Constants | UPPER_SNAKE_CASE | `MAX_ACTIVE_CHANNELS`, `STORAGE_KEY` |
| Files | PascalCase (components), camelCase (utils) | `Feed.tsx`, `validators.ts` |
| Adapters | PascalCase with platform | `BrowserNavigator`, `CliNavigator` |

---

## Import Organization

```typescript
// 1. Standard library
import { useState, useEffect } from 'preact/hooks';
import { h, JSX } from 'preact';

// 2. Third-party
import { render } from '@testing-library/preact';

// 3. Internal packages (alphabetical)
import type { SignedPost } from '@isc/core';
import { useFeed } from '@isc/ui';
import { ValidationError } from '@isc/core/errors';

// 4. Local (relative, alphabetical)
import { Post } from './Post.js';
import { Skeleton } from './Skeleton.js';
import type { FeedProps } from './types.js';
```

---

## File Action Summary

### Delete

| File | Reason | Phase |
|------|--------|-------|
| `apps/browser/src/router.ts` | Replaced by `@isc/navigation` | 2A |
| `apps/browser/src/components/Feed.tsx` | Replaced by `@isc/ui` Feed | 2B |
| `apps/browser/src/components/TopNav.tsx` | Replaced by `@isc/ui` TabBar | 2C |
| `apps/browser/src/components/Skeleton.tsx` | Replaced by `@isc/ui` Skeleton | 2F |

### Create

| File | Purpose | Phase |
|------|---------|-------|
| `packages/navigation/src/adapters/browser.ts` | Browser navigation | 2A |
| `packages/navigation/src/adapters/cli.ts` | CLI navigation | 2A |
| `packages/ui/src/hooks/useFeedLogic.ts` | Headless feed logic | 2B |
| `packages/ui/src/components/Feed/FeedHeadless.tsx` | Headless feed | 2B |
| `packages/ui/src/components/Navigation/TabBar/index.tsx` | Tab bar | 2C |
| `packages/ui/src/components/Navigation/Sidebar/index.tsx` | Sidebar | 2C |
| `packages/state/src/adapters/browser.ts` | Browser storage | 2E |
| `packages/ui/src/components/common/Skeleton.tsx` | Skeleton | 2F |
| `packages/ui/src/components/common/ErrorBoundary.tsx` | Error boundary | 2F |
| `packages/ui/src/components/common/ConnectionStatus.tsx` | Connection status | 2F |

### Modify

| File | Changes | Phase |
|------|---------|-------|
| `apps/browser/src/index.tsx` | Initialize navigator | 2A |
| `apps/browser/src/App.tsx` | Use providers, hooks | 2A, 2E |
| `apps/cli/src/commands/*.ts` | Use `@isc/forms` | 2D |
| `apps/browser/src/screens/**/*.tsx` | Use navigation hooks | 2A |

---

## Timeline

| Phase | Description | Hours |
|-------|-------------|-------|
| 2A | Navigation | 3 |
| 2B | Feed | 4 |
| 2C | Navigation UI | 5 |
| 2D | Forms | 3 |
| 2E | State | 4 |
| 2F | Components | 5 |
| Testing | Unit + Integration + E2E | 8 |
| Buffer | Bug fixes | 6 |
| **Total** | | **38** |

---

## Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Code reuse | >90% | Bundle analysis |
| Duplicate implementations | 0 | Code audit |
| New form factor time | <1 week | Time tracking |
| Type safety | 0 `any` in critical paths | TypeScript strict |
| Test coverage | >80% | Coverage reports |
| Bundle size | -15% vs current | Build analysis |
| WCAG compliance | AA | Accessibility audit |

---

**Version**: 2.0.0  
**Date**: March 13, 2026  
**Status**: Ready for implementation
