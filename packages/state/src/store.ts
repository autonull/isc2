/**
 * Core State Store
 *
 * Environment-agnostic state management with subscription system.
 */

import type { AppState, StateStore, Selector, Action, StoreConfig, StateStorage, StateSync } from './types.js';
import { defaultState } from './types.js';

/**
 * Deep merge two partial states
 */
function mergeState(current: AppState, partial: Partial<AppState>): AppState {
  const merged: Record<string, unknown> = { ...current };

  for (const key of Object.keys(partial)) {
    const value = partial[key as keyof AppState];
    if (value === undefined) continue;

    if (value instanceof Map) {
      merged[key] = new Map(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      merged[key] = { ...(merged[key] as object), ...value };
    } else {
      merged[key] = value;
    }
  }

  return merged as unknown as AppState;
}

/**
 * Create state store
 */
export function createStateStore(config: StoreConfig = {}): StateStore {
  const { storage, sync, initialState } = config;
  let state: AppState = { ...defaultState, ...initialState };
  const listeners = new Map<symbol, { selector: Selector<unknown>; callback: (value: unknown) => void }>();

  /**
   * Notify listeners of state changes
   */
  function notify(): void {
    for (const [, listener] of listeners) {
      const value = listener.selector(state);
      listener.callback(value);
    }
  }

  /**
   * Persist state to storage
   */
  async function persist(partial: Partial<AppState>): Promise<void> {
    if (!storage) return;
    try {
      await storage.set(partial);
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Broadcast state changes to other tabs/devices
   */
  async function broadcast(partial: Partial<AppState>): Promise<void> {
    if (!sync) return;
    try {
      await sync.broadcast(partial);
    } catch {
      // Ignore broadcast errors
    }
  }

  /**
   * Get current state
   */
  function getState(): AppState {
    return { ...state };
  }

  /**
   * Update state
   */
  async function setState(partial: Partial<AppState>): Promise<void> {
    state = mergeState(state, partial);
    notify();

    const changedPartial: Partial<AppState> = {};
    for (const key of Object.keys(partial) as (keyof AppState)[]) {
      changedPartial[key] = partial[key] as never;
    }

    await Promise.all([persist(changedPartial), broadcast(changedPartial)]);
  }

  /**
   * Subscribe to state changes
   */
  function subscribe<T>(
    selector: Selector<T>,
    callback: (value: T) => void
  ): () => void {
    const id = Symbol('listener');
    const listener = {
      selector: selector as Selector<unknown>,
      callback: callback as (value: unknown) => void,
    };
    listeners.set(id, listener);

    // Initial call
    callback(selector(state));

    return () => {
      listeners.delete(id);
    };
  }

  /**
   * Dispatch action
   */
  async function dispatch(_action: Action): Promise<void> {
    notify();
  }

  /**
   * Clear all state
   */
  async function clear(): Promise<void> {
    state = { ...defaultState };
    notify();

    if (storage) {
      await storage.clear();
    }
  }

  // Set up sync listener
  if (sync) {
    sync.subscribe((remoteState) => {
      state = mergeState(state, remoteState);
      notify();
    });
  }

  // Load persisted state
  async function init(): Promise<void> {
    if (storage) {
      try {
        const persisted = await storage.get();
        if (persisted) {
          state = mergeState(state, persisted);
          notify();
        }
      } catch {
        // Ignore load errors
      }
    }
  }

  init();

  return {
    getState,
    setState,
    subscribe,
    dispatch,
    clear,
  };
}

/**
 * Create in-memory storage (default fallback)
 */
export function createMemoryStorage(): StateStorage {
  let stored: Partial<AppState> | null = null;

  return {
    async get(): Promise<Partial<AppState> | null> {
      return stored;
    },
    async set(state: Partial<AppState>): Promise<void> {
      stored = state;
    },
    async clear(): Promise<void> {
      stored = null;
    },
  };
}

/**
 * Create no-op sync (default fallback)
 */
export function createNoopSync(): StateSync {
  return {
    subscribe(): () => void {
      return () => {};
    },
    async broadcast(): Promise<void> {},
  };
}
