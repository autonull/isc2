/* eslint-disable */
/**
 * State Management Type Definitions
 *
 * Environment-agnostic state types for ISC.
 */

/**
 * User settings
 */
export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
  soundEnabled: boolean;
  language: string;
  accessibility: AccessibilitySettings;
}

/**
 * Accessibility settings
 */
export interface AccessibilitySettings {
  reduceMotion: boolean;
  highContrast: boolean;
  fontSize: 'small' | 'medium' | 'large';
}

/**
 * UI state
 */
export interface UIState {
  sidebarOpen: boolean;
  activeModal: string | null;
  loading: boolean;
  error: string | null;
  searchQuery: string;
  viewMode: 'grid' | 'list';
}

/**
 * Feed state
 */
export interface FeedState {
  posts: string[];
  loading: boolean;
  error: string | null;
  lastUpdated: number;
  hasMore: boolean;
  cursor?: string;
}

/**
 * Conversation state
 */
export interface ConversationState {
  id: string;
  participants: string[];
  messages: string[];
  lastMessageAt: number;
  unreadCount: number;
}

/**
 * Core application state
 */
export interface AppState {
  channels: unknown[];
  activeChannelId: string | null;
  posts: Map<string, unknown>;
  conversations: Map<string, ConversationState>;
  following: string[];
  followers: string[];
  pendingFollows: string[];
  ui: UIState;
  settings: UserSettings;
  feeds: {
    'for-you': FeedState;
    following: FeedState;
  };
  lastSyncAt: number;
  isOnline: boolean;
}

/**
 * Action interface
 */
export interface Action<T = unknown> {
  type: string;
  payload?: T;
  meta?: {
    timestamp: number;
    source: 'local' | 'remote';
  };
}

/**
 * Action creator
 */
export interface ActionCreator<T = unknown> {
  (payload: T): Action<T>;
  type: string;
}

/**
 * State selector
 */
export type Selector<T> = (state: AppState) => T;

/**
 * State store interface
 */
export interface StateStore {
  getState(): AppState;
  setState(partial: Partial<AppState>): Promise<void>;
  subscribe<T>(
    selector: Selector<T>,
    callback: (value: T) => void
  ): () => void;
  dispatch(action: Action): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Storage adapter for state persistence
 */
export interface StateStorage {
  get(): Promise<Partial<AppState> | null>;
  set(state: Partial<AppState>): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Sync adapter for cross-tab/device sync
 */
export interface StateSync {
  subscribe(callback: (state: Partial<AppState>) => void): () => void;
  broadcast(state: Partial<AppState>): Promise<void>;
}

/**
 * Store configuration
 */
export interface StoreConfig {
  storage?: StateStorage;
  sync?: StateSync;
  initialState?: Partial<AppState>;
}

/**
 * Default state
 */
export const defaultState: AppState = {
  channels: [],
  activeChannelId: null,
  posts: new Map(),
  conversations: new Map(),
  following: [],
  followers: [],
  pendingFollows: [],
  ui: {
    sidebarOpen: true,
    activeModal: null,
    loading: false,
    error: null,
    searchQuery: '',
    viewMode: 'list',
  },
  settings: {
    theme: 'system',
    notifications: true,
    soundEnabled: true,
    language: 'en',
    accessibility: {
      reduceMotion: false,
      highContrast: false,
      fontSize: 'medium',
    },
  },
  feeds: {
    'for-you': {
      posts: [],
      loading: false,
      error: null,
      lastUpdated: 0,
      hasMore: true,
    },
    following: {
      posts: [],
      loading: false,
      error: null,
      lastUpdated: 0,
      hasMore: true,
    },
  },
  lastSyncAt: 0,
  isOnline: true,
};
