/**
 * State Provider
 *
 * Provides state store to component tree.
 */

import { h, JSX } from 'preact';
import { createContext } from 'preact';
import type { StateStore } from '@isc/state';
import { setStateStore } from '../hooks/useAppState.js';

/**
 * State context
 */
export const StateContext = createContext<StateStore | null>(null);

/**
 * State provider props
 */
export interface StateProviderProps {
  store: StateStore;
  children: JSX.Element;
}

/**
 * State provider component
 */
export function StateProvider({ store, children }: StateProviderProps): JSX.Element {
  // Initialize global store
  setStateStore(store);

  return h(StateContext.Provider, { value: store }, children);
}
