/**
 * App State
 *
 * Exposes state management to vanilla JS components.
 */

import { subscribeState, getState as syncGetState, updateState, setState as syncSetState, clearState } from './state/sync.ts';

// Helper to get full state object
const getFullState = () => ({
  status: syncGetState('network')?.status || 'disconnected',
  channels: syncGetState('channels') || [],
  matches: syncGetState('matches') || [],
  activeChannelId: syncGetState('ui')?.activeChannelId,
  identity: syncGetState('identity') || null,
  posts: syncGetState('posts') || [],
  settings: syncGetState('settings') || {},
});

// Re-export subscription and getter for vanilla use
export const subscribe = (callback) => {
  let prevState = getFullState();
  const notify = () => {
    const newState = getFullState();
    callback(newState, prevState);
    prevState = newState;
  }

  const unsubNetwork = subscribeState('network', notify);
  const unsubChannels = subscribeState('channels', notify);
  const unsubMatches = subscribeState('matches', notify);
  const unsubUI = subscribeState('ui', notify);
  const unsubPosts = subscribeState('posts', notify);
  const unsubIdentity = subscribeState('identity', notify);
  const unsubSettings = subscribeState('settings', notify);

  return () => {
    unsubNetwork();
    unsubChannels();
    unsubMatches();
    unsubUI();
    unsubPosts();
    unsubIdentity();
    unsubSettings();
  }
};
export const getState = (key) => {
  if (key === undefined) {
    return getFullState();
  }

  if (key === 'status') return syncGetState('network')?.status || 'disconnected';
  return syncGetState(key);
};

// Provide an actions object to match the API expected by vanilla JS
export const actions = {
  // Network / Connection status
  setStatus: (status) => updateState('network', { status }),
  setOnline: (isOnline) => updateState('network', { isOnline }),

  // Channels
  setChannels: (channels) => syncSetState('channels', channels),
  addChannel: (channel) => {
    const channels = syncGetState('channels') || [];
    syncSetState('channels', [...channels, channel]);
  },
  removeChannel: (id) => {
    const channels = syncGetState('channels') || [];
    syncSetState('channels', channels.filter(c => c.id !== id));
  },
  setActiveChannel: (id) => updateState('ui', { activeChannelId: id }),
  setChannelSettings: (id, settings) => {
    const allSettings = syncGetState('channelSettings') || {};
    syncSetState('channelSettings', { ...allSettings, [id]: settings });
  },
  resetChannelSettings: (id) => {
    const allSettings = syncGetState('channelSettings') || {};
    const newSettings = { ...allSettings };
    delete newSettings[id];
    syncSetState('channelSettings', newSettings);
  },

  // Peer Matches
  setMatches: (matches) => syncSetState('matches', matches),

  // Identity
  setIdentity: (identity) => syncSetState('identity', identity),

  // Posts
  setPosts: (posts) => syncSetState('posts', posts),
  addPost: (post) => {
    const posts = syncGetState('posts') || [];
    syncSetState('posts', [post, ...posts]);
  },

  // Settings
  setSettings: (settings) => syncSetState('settings', settings),
};