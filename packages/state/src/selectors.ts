/* eslint-disable */
/**
 * Memoized Selectors
 *
 * Efficient state selectors with memoization.
 */

import type { AppState } from './types.js';

/**
 * Simple memoization cache
 */
class MemoCache<T> {
  private cache: T | undefined;
  private deps: unknown[] = [];

  get(deps: unknown[]): T | undefined {
    if (this.deps.length !== deps.length) {return undefined;}
    if (this.deps.every((d, i) => d === deps[i])) {
      return this.cache;
    }
    return undefined;
  }

  set(value: T, deps: unknown[]): void {
    this.cache = value;
    this.deps = deps;
  }
}

/**
 * Create memoized selector
 */
export function memoize<T, D extends unknown[]>(
  selector: (state: AppState, ...deps: D) => T
): (state: AppState, ...deps: D) => T {
  const cache = new MemoCache<T>();

  return (state: AppState, ...deps: D): T => {
    const cached = cache.get(deps);
    if (cached !== undefined) {
      return cached;
    }

    const result = selector(state, ...deps);
    cache.set(result, deps);
    return result;
  };
}

/**
 * Channel selectors
 */
export const selectChannels = (state: AppState): unknown[] => state.channels;

export const selectActiveChannelId = (state: AppState): string | null =>
  state.activeChannelId;

export const selectActiveChannel = memoize((state: AppState) =>
  state.channels.find((c) => (c as { id?: string }).id === state.activeChannelId) || null
);

export const selectChannelById = memoize((state: AppState, id: string) =>
  state.channels.find((c) => (c as { id?: string }).id === id) || null
);

export const selectActiveChannels = memoize((state: AppState) =>
  state.channels.filter((c) => (c as { active?: boolean }).active)
);

/**
 * Post selectors
 */
export const selectPosts = (state: AppState): Map<string, unknown> => state.posts;

export const selectPostById = memoize((state: AppState, id: string) =>
  state.posts.get(id) || null
);

export const selectPostsByChannel = memoize((state: AppState, channelId: string) =>
  Array.from(state.posts.values()).filter((p) => (p as { channelID?: string }).channelID === channelId)
);

export const selectPostsByAuthor = memoize((state: AppState, authorId: string) =>
  Array.from(state.posts.values()).filter((p) => (p as { author?: string }).author === authorId)
);

/**
 * Feed selectors
 */
export const selectFeed = memoize((state: AppState, type: 'for-you' | 'following') =>
  state.feeds[type]
);

export const selectFeedPosts = memoize((state: AppState, type: 'for-you' | 'following') => {
  const feed = state.feeds[type];
  return feed.posts
    .map((id) => state.posts.get(id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined);
});

export const selectFeedLoading = memoize((state: AppState, type: 'for-you' | 'following') =>
  state.feeds[type].loading
);

export const selectFeedError = memoize((state: AppState, type: 'for-you' | 'following') =>
  state.feeds[type].error
);

/**
 * Conversation selectors
 */
export const selectConversations = (state: AppState): Map<string, unknown> =>
  state.conversations as unknown as Map<string, unknown>;

export const selectConversationById = memoize((state: AppState, id: string) =>
  state.conversations.get(id) || null
);

export const selectUnreadCount = memoize((state: AppState) =>
  Array.from(state.conversations.values()).reduce(
    (sum, c) => sum + c.unreadCount,
    0
  )
);

/**
 * Social graph selectors
 */
export const selectFollowing = (state: AppState): string[] => state.following;

export const selectFollowers = (state: AppState): string[] => state.followers;

export const selectIsFollowing = memoize((state: AppState, peerId: string) =>
  state.following.includes(peerId)
);

export const selectPendingFollows = (state: AppState): string[] => state.pendingFollows;

/**
 * UI selectors
 */
export const selectUI = (state: AppState): AppState['ui'] => state.ui;

export const selectSidebarOpen = (state: AppState): boolean => state.ui.sidebarOpen;

export const selectActiveModal = (state: AppState): string | null => state.ui.activeModal;

export const selectUILoading = (state: AppState): boolean => state.ui.loading;

export const selectUIError = (state: AppState): string | null => state.ui.error;

export const selectSearchQuery = (state: AppState): string => state.ui.searchQuery;

export const selectViewMode = (state: AppState): 'grid' | 'list' => state.ui.viewMode;

/**
 * Settings selectors
 */
export const selectSettings = (state: AppState): AppState['settings'] => state.settings;

export const selectTheme = (state: AppState): 'light' | 'dark' | 'system' =>
  state.settings.theme;

export const selectNotificationsEnabled = (state: AppState): boolean =>
  state.settings.notifications;

export const selectAccessibility = (state: AppState): AppState['settings']['accessibility'] =>
  state.settings.accessibility;

/**
 * Connection selectors
 */
export const selectIsOnline = (state: AppState): boolean => state.isOnline;

export const selectLastSyncAt = (state: AppState): number => state.lastSyncAt;

/**
 * Computed selectors
 */
export const selectHasActiveChannel = memoize((state: AppState) =>
  state.channels.some((c) => (c as { active?: boolean }).active)
);

export const selectChannelCount = (state: AppState): number => state.channels.length;

export const selectPostCount = (state: AppState): number => state.posts.size;

export const selectConversationCount = (state: AppState): number =>
  state.conversations.size;
