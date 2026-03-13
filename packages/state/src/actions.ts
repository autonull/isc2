/**
 * Action Creators
 *
 * Type-safe action creators for state updates.
 */

import type { Action, ActionCreator } from './types.js';

/**
 * Channel actions
 */
export const SET_CHANNELS = 'channels/SET';
export const ADD_CHANNEL = 'channels/ADD';
export const UPDATE_CHANNEL = 'channels/UPDATE';
export const REMOVE_CHANNEL = 'channels/REMOVE';
export const SET_ACTIVE_CHANNEL = 'channels/SET_ACTIVE';

export const setChannels: ActionCreator<unknown[]> = Object.assign(
  (payload: unknown[]): Action<unknown[]> => ({
    type: SET_CHANNELS,
    payload,
  }),
  { type: SET_CHANNELS }
);

export const addChannel: ActionCreator<unknown> = Object.assign(
  (payload: unknown): Action<unknown> => ({
    type: ADD_CHANNEL,
    payload,
  }),
  { type: ADD_CHANNEL }
);

export const updateChannel: ActionCreator<{ id: string; updates: Record<string, unknown> }> =
  Object.assign(
    (payload: { id: string; updates: Record<string, unknown> }): Action<{ id: string; updates: Record<string, unknown> }> => ({
      type: UPDATE_CHANNEL,
      payload,
    }),
    { type: UPDATE_CHANNEL }
  );

export const removeChannel: ActionCreator<string> = Object.assign(
  (payload: string): Action<string> => ({
    type: REMOVE_CHANNEL,
    payload,
  }),
  { type: REMOVE_CHANNEL }
);

export const setActiveChannel: ActionCreator<string | null> = Object.assign(
  (payload: string | null): Action<string | null> => ({
    type: SET_ACTIVE_CHANNEL,
    payload,
  }),
  { type: SET_ACTIVE_CHANNEL }
);

/**
 * Post actions
 */
export const SET_POSTS = 'posts/SET';
export const ADD_POST = 'posts/ADD';
export const REMOVE_POST = 'posts/REMOVE';

export const setPosts: ActionCreator<Map<string, unknown>> = Object.assign(
  (payload: Map<string, unknown>): Action<Map<string, unknown>> => ({
    type: SET_POSTS,
    payload,
  }),
  { type: SET_POSTS }
);

export const addPost: ActionCreator<unknown> = Object.assign(
  (payload: unknown): Action<unknown> => ({
    type: ADD_POST,
    payload,
  }),
  { type: ADD_POST }
);

export const removePost: ActionCreator<string> = Object.assign(
  (payload: string): Action<string> => ({
    type: REMOVE_POST,
    payload,
  }),
  { type: REMOVE_POST }
);

/**
 * Feed actions
 */
export const SET_FEED = 'feed/SET';
export const SET_FEED_LOADING = 'feed/SET_LOADING';
export const SET_FEED_ERROR = 'feed/SET_ERROR';
export const APPEND_FEED_POSTS = 'feed/APPEND_POSTS';

export const setFeed: ActionCreator<{
  type: 'for-you' | 'following';
  posts: string[];
  hasMore: boolean;
  cursor?: string;
}> = Object.assign(
  (payload: {
    type: 'for-you' | 'following';
    posts: string[];
    hasMore: boolean;
    cursor?: string;
  }): Action<{
    type: 'for-you' | 'following';
    posts: string[];
    hasMore: boolean;
    cursor?: string;
  }> => ({
    type: SET_FEED,
    payload,
  }),
  { type: SET_FEED }
);

export const setFeedLoading: ActionCreator<{
  type: 'for-you' | 'following';
  loading: boolean;
}> = Object.assign(
  (payload: { type: 'for-you' | 'following'; loading: boolean }): Action<{
    type: 'for-you' | 'following';
    loading: boolean;
  }> => ({
    type: SET_FEED_LOADING,
    payload,
  }),
  { type: SET_FEED_LOADING }
);

export const setFeedError: ActionCreator<{
  type: 'for-you' | 'following';
  error: string | null;
}> = Object.assign(
  (payload: { type: 'for-you' | 'following'; error: string | null }): Action<{
    type: 'for-you' | 'following';
    error: string | null;
  }> => ({
    type: SET_FEED_ERROR,
    payload,
  }),
  { type: SET_FEED_ERROR }
);

export const appendFeedPosts: ActionCreator<{
  type: 'for-you' | 'following';
  posts: string[];
}> = Object.assign(
  (payload: { type: 'for-you' | 'following'; posts: string[] }): Action<{
    type: 'for-you' | 'following';
    posts: string[];
  }> => ({
    type: APPEND_FEED_POSTS,
    payload,
  }),
  { type: APPEND_FEED_POSTS }
);

/**
 * Social actions
 */
export const SET_FOLLOWING = 'social/SET_FOLLOWING';
export const SET_FOLLOWERS = 'social/SET_FOLLOWERS';
export const ADD_FOLLOWING = 'social/ADD_FOLLOWING';
export const REMOVE_FOLLOWING = 'social/REMOVE_FOLLOWING';

export const setFollowing: ActionCreator<string[]> = Object.assign(
  (payload: string[]): Action<string[]> => ({
    type: SET_FOLLOWING,
    payload,
  }),
  { type: SET_FOLLOWING }
);

export const setFollowers: ActionCreator<string[]> = Object.assign(
  (payload: string[]): Action<string[]> => ({
    type: SET_FOLLOWERS,
    payload,
  }),
  { type: SET_FOLLOWERS }
);

export const addFollowing: ActionCreator<string> = Object.assign(
  (payload: string): Action<string> => ({
    type: ADD_FOLLOWING,
    payload,
  }),
  { type: ADD_FOLLOWING }
);

export const removeFollowing: ActionCreator<string> = Object.assign(
  (payload: string): Action<string> => ({
    type: REMOVE_FOLLOWING,
    payload,
  }),
  { type: REMOVE_FOLLOWING }
);

/**
 * UI actions
 */
export const SET_SIDEBAR = 'ui/SET_SIDEBAR';
export const SET_MODAL = 'ui/SET_MODAL';
export const SET_UI_LOADING = 'ui/SET_LOADING';
export const SET_UI_ERROR = 'ui/SET_ERROR';
export const SET_SEARCH_QUERY = 'ui/SET_SEARCH';
export const SET_VIEW_MODE = 'ui/SET_VIEW_MODE';

export const setSidebar: ActionCreator<boolean> = Object.assign(
  (payload: boolean): Action<boolean> => ({
    type: SET_SIDEBAR,
    payload,
  }),
  { type: SET_SIDEBAR }
);

export const setModal: ActionCreator<string | null> = Object.assign(
  (payload: string | null): Action<string | null> => ({
    type: SET_MODAL,
    payload,
  }),
  { type: SET_MODAL }
);

export const setUILoading: ActionCreator<boolean> = Object.assign(
  (payload: boolean): Action<boolean> => ({
    type: SET_UI_LOADING,
    payload,
  }),
  { type: SET_UI_LOADING }
);

export const setUIError: ActionCreator<string | null> = Object.assign(
  (payload: string | null): Action<string | null> => ({
    type: SET_UI_ERROR,
    payload,
  }),
  { type: SET_UI_ERROR }
);

export const setSearchQuery: ActionCreator<string> = Object.assign(
  (payload: string): Action<string> => ({
    type: SET_SEARCH_QUERY,
    payload,
  }),
  { type: SET_SEARCH_QUERY }
);

export const setViewMode: ActionCreator<'grid' | 'list'> = Object.assign(
  (payload: 'grid' | 'list'): Action<'grid' | 'list'> => ({
    type: SET_VIEW_MODE,
    payload,
  }),
  { type: SET_VIEW_MODE }
);

/**
 * Settings actions
 */
export const SET_THEME = 'settings/SET_THEME';
export const SET_NOTIFICATIONS = 'settings/SET_NOTIFICATIONS';
export const SET_SOUND = 'settings/SET_SOUND';
export const SET_LANGUAGE = 'settings/SET_LANGUAGE';

export const setTheme: ActionCreator<'light' | 'dark' | 'system'> = Object.assign(
  (payload: 'light' | 'dark' | 'system'): Action<'light' | 'dark' | 'system'> => ({
    type: SET_THEME,
    payload,
  }),
  { type: SET_THEME }
);

export const setNotifications: ActionCreator<boolean> = Object.assign(
  (payload: boolean): Action<boolean> => ({
    type: SET_NOTIFICATIONS,
    payload,
  }),
  { type: SET_NOTIFICATIONS }
);

export const setSound: ActionCreator<boolean> = Object.assign(
  (payload: boolean): Action<boolean> => ({
    type: SET_SOUND,
    payload,
  }),
  { type: SET_SOUND }
);

export const setLanguage: ActionCreator<string> = Object.assign(
  (payload: string): Action<string> => ({
    type: SET_LANGUAGE,
    payload,
  }),
  { type: SET_LANGUAGE }
);

/**
 * Connection actions
 */
export const SET_ONLINE = 'connection/SET_ONLINE';
export const SET_LAST_SYNC = 'connection/SET_LAST_SYNC';

export const setOnline: ActionCreator<boolean> = Object.assign(
  (payload: boolean): Action<boolean> => ({
    type: SET_ONLINE,
    payload,
  }),
  { type: SET_ONLINE }
);

export const setLastSync: ActionCreator<number> = Object.assign(
  (payload: number): Action<number> => ({
    type: SET_LAST_SYNC,
    payload,
  }),
  { type: SET_LAST_SYNC }
);
