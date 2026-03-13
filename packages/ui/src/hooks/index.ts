/**
 * Hooks Module
 *
 * React/Preact hooks for state and UI management.
 */

export {
  useAppState,
  setStateStore,
  getStateStore,
  useActiveChannel,
  useActiveChannelId,
  useChannels,
  usePosts,
  usePost,
  usePostsByChannel,
  useFollowing,
  useIsFollowing,
  useUI,
  useSettings,
  useTheme as useThemeFromState,
  useIsOnline,
  useUnreadCount,
} from './useAppState.js';
export { useFeed, type FeedOptions, type UseFeedReturn } from './useFeed.js';
export {
  useFeedLogic,
  type UseFeedLogicOptions,
  type UseFeedLogicReturn,
} from './useFeedLogic.js';
export {
  useChannel,
  useActiveChannel as useActiveChannelHook,
  useChannels as useChannelsHook,
  useActiveChannels,
  useChannelActions,
} from './useChannel.js';
export { useTheme, useDarkMode } from './useTheme.js';
export {
  useNotifications,
  useBadgeCount,
  type Notification,
  type NotificationType,
} from './useNotification.js';
