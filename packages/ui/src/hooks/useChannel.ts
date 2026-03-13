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
  const setActiveChannel = useCallback((id: string | null) => {
    console.log('Set active channel:', id);
    // Would dispatch action in real implementation
  }, []);

  const createChannel = useCallback(async (name: string, description: string) => {
    console.log('Create channel:', name, description);
    // Would dispatch action in real implementation
  }, []);

  const updateChannel = useCallback(async (id: string, updates: Partial<Channel>) => {
    console.log('Update channel:', id, updates);
    // Would dispatch action in real implementation
  }, []);

  const deleteChannel = useCallback(async (id: string) => {
    console.log('Delete channel:', id);
    // Would dispatch action in real implementation
  }, []);

  const activateChannel = useCallback(async (id: string) => {
    console.log('Activate channel:', id);
    // Would dispatch action in real implementation
  }, []);

  const deactivateChannel = useCallback(async (id: string) => {
    console.log('Deactivate channel:', id);
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
