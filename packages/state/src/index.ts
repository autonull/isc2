/**
 * @isc/state - State Management
 *
 * Unified state management with environment-specific persistence.
 */

export { createStateStore, createMemoryStorage, createNoopSync } from './store.js';
export {
  // Channel selectors
  selectChannels,
  selectActiveChannelId,
  selectActiveChannel,
  selectChannelById,
  selectActiveChannels,
  // Post selectors
  selectPosts,
  selectPostById,
  selectPostsByChannel,
  selectPostsByAuthor,
  // Feed selectors
  selectFeed,
  selectFeedPosts,
  selectFeedLoading,
  selectFeedError,
  // Conversation selectors
  selectConversations,
  selectConversationById,
  selectUnreadCount,
  // Social selectors
  selectFollowing,
  selectFollowers,
  selectIsFollowing,
  selectPendingFollows,
  // UI selectors
  selectUI,
  selectSidebarOpen,
  selectActiveModal,
  selectUILoading,
  selectUIError,
  selectSearchQuery,
  selectViewMode,
  // Settings selectors
  selectSettings,
  selectTheme,
  selectNotificationsEnabled,
  selectAccessibility,
  // Connection selectors
  selectIsOnline,
  selectLastSyncAt,
  // Computed selectors
  selectHasActiveChannel,
  selectChannelCount,
  selectPostCount,
  selectConversationCount,
  // Utilities
  memoize,
} from './selectors.js';
export {
  // Channel actions
  setChannels,
  addChannel,
  updateChannel,
  removeChannel,
  setActiveChannel,
  SET_CHANNELS,
  ADD_CHANNEL,
  UPDATE_CHANNEL,
  REMOVE_CHANNEL,
  SET_ACTIVE_CHANNEL,
  // Post actions
  setPosts,
  addPost,
  removePost,
  SET_POSTS,
  ADD_POST,
  REMOVE_POST,
  // Feed actions
  setFeed,
  setFeedLoading,
  setFeedError,
  appendFeedPosts,
  SET_FEED,
  SET_FEED_LOADING,
  SET_FEED_ERROR,
  APPEND_FEED_POSTS,
  // Social actions
  setFollowing,
  setFollowers,
  addFollowing,
  removeFollowing,
  SET_FOLLOWING,
  SET_FOLLOWERS,
  ADD_FOLLOWING,
  REMOVE_FOLLOWING,
  // UI actions
  setSidebar,
  setModal,
  setUILoading,
  setUIError,
  setSearchQuery,
  setViewMode,
  SET_SIDEBAR,
  SET_MODAL,
  SET_UI_LOADING,
  SET_UI_ERROR,
  SET_SEARCH_QUERY,
  SET_VIEW_MODE,
  // Settings actions
  setTheme,
  setNotifications,
  setSound,
  setLanguage,
  SET_THEME,
  SET_NOTIFICATIONS,
  SET_SOUND,
  SET_LANGUAGE,
  // Connection actions
  setOnline,
  setLastSync,
  SET_ONLINE,
  SET_LAST_SYNC,
} from './actions.js';
export {
  // Sync implementations
  BroadcastChannelSync,
  StorageEventSync,
  WebSocketSync,
  CompositeSync,
  createSync,
} from './sync.js';
export {
  // Browser storage adapters
  BrowserStorage,
  IndexedDBStorage,
  StorageObserver,
  createBrowserStorage,
} from './adapters/browser.js';
export type {
  // Types
  AppState,
  UserSettings,
  AccessibilitySettings,
  UIState,
  FeedState,
  ConversationState,
  Action,
  ActionCreator,
  Selector,
  StateStore,
  StateStorage,
  StateSync,
  StoreConfig,
} from './types.js';
