/**
 * Custom Hooks for ISC Browser App
 * 
 * Reusable hooks that encapsulate common patterns and logic.
 */

import { useState, useEffect, useCallback } from 'preact/hooks';
import { useDependencies } from '../di/container.jsx';
import type { Channel } from '@isc/core';
import type { Post } from '../types/extended.js';

/**
 * Hook to manage channel data with loading and error states
 */
export function useChannels() {
  const { channelService } = useDependencies();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadChannels = useCallback(async () => {
    if (!channelService) {
      setError('Channel service not available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const allChannels = await channelService.getAllChannels();
      setChannels(allChannels);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load channels');
    } finally {
      setLoading(false);
    }
  }, [channelService]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  return {
    channels,
    loading,
    error,
    refresh: loadChannels,
  };
}

/**
 * Hook to get a single channel by ID
 */
export function useChannel(channelId: string | null) {
  const { channelService } = useDependencies();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadChannel = useCallback(async () => {
    if (!channelId || !channelService) return;

    try {
      setLoading(true);
      const ch = await channelService.getChannel(channelId);
      setChannel(ch);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load channel');
    } finally {
      setLoading(false);
    }
  }, [channelId, channelService]);

  useEffect(() => {
    loadChannel();
  }, [loadChannel]);

  return {
    channel,
    loading,
    error,
    refresh: loadChannel,
  };
}

/**
 * Hook to get the active channel
 */
export function useActiveChannel() {
  const { channelService } = useDependencies();
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);

  useEffect(() => {
    if (!channelService) return;

    const loadActive = async () => {
      const active = await channelService.getActiveChannels();
      setActiveChannel(active[0] || null);
    };

    loadActive();
  }, [channelService]);

  return activeChannel;
}

/**
 * Hook to manage posts with loading and error states
 */
export function usePosts(channelId?: string) {
  const { postService } = useDependencies();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    if (!postService) {
      setError('Post service not available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const allPosts = await postService.getAllPosts(channelId);
      setPosts(allPosts.sort((a, b) => b.timestamp - a.timestamp));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, [channelId, postService]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  return {
    posts,
    loading,
    error,
    refresh: loadPosts,
  };
}

/**
 * Hook to manage feed data
 */
export function useFeed(type: 'for-you' | 'following' | 'channel' = 'for-you', channelId?: string) {
  const { feedService } = useDependencies();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    if (!feedService) {
      setError('Feed service not available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let feedPosts: Post[];
      
      if (type === 'channel' && channelId) {
        feedPosts = await feedService.getChannelFeed(channelId);
      } else if (type === 'following') {
        feedPosts = await feedService.getFollowingFeed();
      } else {
        feedPosts = await feedService.getForYouFeed(channelId);
      }
      
      setPosts(feedPosts.sort((a, b) => b.timestamp - a.timestamp));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feed');
    } finally {
      setLoading(false);
    }
  }, [feedService, type, channelId]);

  const refresh = useCallback(async () => {
    if (feedService) {
      await feedService.refresh();
      await loadFeed();
    }
  }, [feedService, loadFeed]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  return {
    posts,
    loading,
    error,
    refresh,
  };
}

/**
 * Hook to manage identity state
 */
export function useIdentity() {
  const { identity } = useDependencies();
  const [isInitialized, setIsInitialized] = useState(false);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!identity) {
      setLoading(false);
      return;
    }

    const checkIdentity = async () => {
      try {
        const initialized = await identity.isInitialized();
        setIsInitialized(initialized);
        
        if (initialized) {
          const fp = await identity.getFingerprint();
          setFingerprint(fp);
        }
      } catch (err) {
        console.error('Failed to check identity:', err);
      } finally {
        setLoading(false);
      }
    };

    checkIdentity();
  }, [identity]);

  return {
    isInitialized,
    fingerprint,
    loading,
    identity,
  };
}

/**
 * Hook to manage settings with persistence
 */
export function useSettings() {
  const { settings } = useDependencies();
  const [settingsState, setSettingsState] = useState<Record<string, any>>({
    theme: 'auto',
    notifications: true,
    dataSaver: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!settings) {
      setLoading(false);
      return;
    }

    const loadSettings = async () => {
      try {
        const all = await settings.getAll();
        setSettingsState(prev => ({ ...prev, ...all }));
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [settings]);

  const updateSetting = useCallback(async (key: string, value: any) => {
    if (!settings) return;
    
    setSettingsState(prev => ({ ...prev, [key]: value }));
    await settings.set(key, value);
  }, [settings]);

  const updateSettings = useCallback(async (updates: Record<string, any>) => {
    if (!settings) return;
    
    setSettingsState(prev => ({ ...prev, ...updates }));
    await settings.update(updates);
  }, [settings]);

  return {
    settings: settingsState,
    loading,
    updateSetting,
    updateSettings,
  };
}

/**
 * Hook to manage connection status
 */
export function useConnectionStatus() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check connection speed periodically
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!navigator.onLine) {
      setIsSlow(false);
      return;
    }

    const checkSpeed = async () => {
      try {
        const start = performance.now();
        await fetch('/favicon.ico', { method: 'HEAD', cache: 'no-cache' });
        const duration = performance.now() - start;
        setIsSlow(duration > 2000); // Slow if > 2 seconds
      } catch {
        setIsSlow(true);
      }
    };

    checkSpeed();
    const interval = setInterval(checkSpeed, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  return {
    isOnline,
    isSlow,
    status: !isOnline ? 'offline' : isSlow ? 'slow' : 'online',
  };
}

/**
 * Hook for debounced values
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for local storage with type safety
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof localStorage === 'undefined') return initialValue;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (err) {
      console.error('Failed to save to localStorage:', err);
    }
  };

  return [storedValue, setValue];
}

/**
 * Hook for handling keyboard shortcuts
 */
export function useKeyboardShortcut(
  key: string,
  handler: (event: KeyboardEvent) => void,
  options: { ctrl?: boolean; shift?: boolean; alt?: boolean } = {}
) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== key.toLowerCase()) return;
      if (options.ctrl && !event.ctrlKey) return;
      if (options.shift && !event.shiftKey) return;
      if (options.alt && !event.altKey) return;

      handler(event);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [key, handler, options.ctrl, options.shift, options.alt]);
}

/**
 * Hook for intersection observer (lazy loading)
 */
export function useIntersectionObserver<T extends Element>(
  options: IntersectionObserverInit = {}
): [{ current: T | null }, boolean] {
  const ref = { current: null as T | null };
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [options]);

  return [ref, isIntersecting];
}
