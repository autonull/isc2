/**
 * useChannel Hook
 *
 * Channel management hook.
 */

import { useCallback } from 'preact/hooks';
import type { AppState } from '@isc/state';
import type { Channel } from '@isc/core';
import { useAppState } from './useAppState.js';

/**
 * Use channel hook
 */
export function useChannel(id: string | null): Channel | null {
  return useAppState((state: AppState) => {
    if (!id) return null;
    return (state.channels.find((c) => (c as Channel).id === id) as Channel) || null;
  });
}

/**
 * Use active channel hook
 */
export function useActiveChannel(): Channel | null {
  return useAppState((state: AppState) => {
    return (state.channels.find((c) => (c as Channel).active) as Channel) || null;
  });
}

/**
 * Use all channels hook
 */
export function useChannels(): Channel[] {
  return useAppState((state: AppState) => state.channels as Channel[]);
}

/**
 * Use active channels hook
 */
export function useActiveChannels(): Channel[] {
  return useAppState((state: AppState) => state.channels.filter((c) => (c as Channel).active) as Channel[]);
}

/**
 * Use channel actions
 */
export function useChannelActions() {
  const setActiveChannel = useCallback((_id: string | null) => {
    // Would dispatch action in real implementation
  }, []);

  const createChannel = useCallback(async (_name: string, _description: string) => {
    // Would dispatch action in real implementation
  }, []);

  const updateChannel = useCallback(async (_id: string, _updates: Partial<Channel>) => {
    // Would dispatch action in real implementation
  }, []);

  const deleteChannel = useCallback(async (_id: string) => {
    // Would dispatch action in real implementation
  }, []);

  const activateChannel = useCallback(async (_id: string) => {
    // Would dispatch action in real implementation
  }, []);

  const deactivateChannel = useCallback(async (_id: string) => {
    // Would dispatch action in real implementation
  }, []);

  return {
    setActiveChannel,
    createChannel,
    updateChannel,
    deleteChannel,
    activateChannel,
    deactivateChannel,
  };
}
