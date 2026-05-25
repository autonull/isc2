/* eslint-disable */
/**
 * useAppState Hook
 *
 * Subscribe to app state changes.
 */

import { useEffect, useState } from 'preact/hooks';
import type { StateStore, Selector, AppState } from '@isc/state';

let globalStore: StateStore | null = null;

/**
 * Set global state store
 */
export function setStateStore(store: StateStore): void {
  globalStore = store;
}

/**
 * Get global state store
 */
export function getStateStore(): StateStore | null {
  return globalStore;
}

/**
 * Subscribe to state changes
 */
export function useAppState<T>(selector: Selector<T>): T {
  const [value, setValue] = useState<T>(() => {
    if (!globalStore) {
      throw new Error('State store not initialized. Call setStateStore first.');
    }
    return selector(globalStore.getState());
  });

  useEffect(() => {
    if (!globalStore) {return;}

    const unsubscribe = globalStore.subscribe(selector, setValue);
    return unsubscribe;
  }, [selector]);

  return value;
}

/**
 * Select specific state slices
 */
export function useActiveChannel() {
  return useAppState((state: AppState) =>
    (state.channels.find((c) => (c as { id?: string }).id === state.activeChannelId)) || null
  );
}

export function useActiveChannelId() {
  return useAppState((state: AppState) => state.activeChannelId);
}

export function useChannels() {
  return useAppState((state: AppState) => state.channels);
}

export function usePosts() {
  return useAppState((state: AppState) => state.posts);
}

export function usePost(id: string) {
  return useAppState((state: AppState) => state.posts.get(id) || null);
}

export function usePostsByChannel(channelId: string) {
  return useAppState((state: AppState) =>
    Array.from(state.posts.values()).filter((p) => (p as { channelID?: string }).channelID === channelId)
  );
}

export function useFollowing() {
  return useAppState((state: AppState) => state.following);
}

export function useIsFollowing(peerId: string) {
  return useAppState((state: AppState) => state.following.includes(peerId));
}

export function useUI() {
  return useAppState((state: AppState) => state.ui);
}

export function useSettings() {
  return useAppState((state: AppState) => state.settings);
}

export function useTheme() {
  return useAppState((state: AppState) => state.settings.theme);
}

export function useIsOnline() {
  return useAppState((state: AppState) => state.isOnline);
}

export function useUnreadCount() {
  return useAppState((state: AppState) =>
    Array.from(state.conversations.values()).reduce((sum, c) => sum + c.unreadCount, 0)
  );
}
