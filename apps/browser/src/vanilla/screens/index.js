/**
 * Screen Factory Module
 *
 * Provides standardized screen lifecycle management.
 */

import { subscribe, getState } from '../../state.js';
import { el, render } from '../utils/dom.js';

/**
 * @typedef {Object} ScreenDefinition
 * @property {string} name - Screen name
 * @property {Function} render - Render function: (params) => string | HTMLElement
 * @property {Function} [bind] - Bind events: (container, params) => cleanup[] | cleanup
 * @property {Function} [update] - Update function: (container, state, params) => void
 * @property {Function} [destroy] - Cleanup function
 */

/**
 * @typedef {Object} ScreenInstance
 * @property {string} name
 * @property {Function} render
 * @property {Function} bind
 * @property {Function} update
 * @property {Function} destroy
 */

/**
 * Create a screen with standardized lifecycle
 * @param {ScreenDefinition} definition
 * @returns {ScreenInstance}
 */
export function createScreen(definition) {
  let container = null;
  let cleanupFns = [];
  let subscribed = false;
  let currentState = null;
  let currentParams = null;

  const { name, render: renderFn, bind, update, destroy } = definition;

  function shouldUpdate(newState, prevState) {
    return newState !== prevState;
  }

  return {
    name,

    render(params) {
      currentParams = params;
      return renderFn(params, getState());
    },

    bind(containerEl, params) {
      container = containerEl;
      currentParams = params;
      currentState = getState();

      cleanupFns = [];

      const boundCleanup = bind?.(container, params, getState());
      if (boundCleanup) {
        cleanupFns = Array.isArray(boundCleanup) ? boundCleanup : [boundCleanup];
      }

      if (update && !subscribed) {
        subscribed = true;
        const unsubscribe = subscribe((state, prev) => {
          if (shouldUpdate(state, prev)) {
            currentState = state;
            try {
              update(container, state, prev, currentParams);
            } catch (err) {
              console.error(`[Screen:${name}] Update error:`, err);
            }
          }
        });
        cleanupFns.push(unsubscribe);
      }

      return cleanupFns;
    },

    update(containerEl, params) {
      if (!containerEl) return;

      const oldContent = containerEl.innerHTML;
      const newContent = renderFn(params, getState());

      if (oldContent !== newContent) {
        cleanupFns.forEach((fn) => fn?.());
        cleanupFns = [];

        render(containerEl, newContent);
        currentParams = params;

        const boundCleanup = bind?.(containerEl, params, getState());
        cleanupFns = Array.isArray(boundCleanup)
          ? boundCleanup
          : boundCleanup
            ? [boundCleanup]
            : [];
      } else if (update) {
        currentParams = params;
        try {
          update(containerEl, getState(), currentState, params);
        } catch (err) {
          console.error(`[Screen:${name}] Update error:`, err);
        }
      }

      currentState = getState();
    },

    destroy() {
      cleanupFns.forEach((fn) => fn?.());
      cleanupFns = [];
      subscribed = false;
      destroy?.();
      container = null;
      currentState = null;
      currentParams = null;
    },
  };
}

/**
 * Create a simple screen with just render function
 * @param {string} name
 * @param {Function} renderFn
 * @param {Function} [bindFn]
 * @returns {ScreenInstance}
 */
export function createSimpleScreen(name, renderFn, bindFn) {
  return createScreen({ name, render: renderFn, bind: bindFn });
}

/**
 * Screen registry for centralized screen management
 */
class ScreenRegistry {
  #screens = new Map();
  #defaultScreen = null;

  /**
   * Register a screen
   * @param {string} route - Screen route/path
   * @param {ScreenDefinition} definition - Screen definition
   */
  register(route, definition) {
    this.#screens.set(route, createScreen(definition));
  }

  /**
   * Get screen by route
   * @param {string} route
   * @returns {ScreenInstance|undefined}
   */
  get(route) {
    return this.#screens.get(route);
  }

  /**
   * Get all registered routes
   * @returns {string[]}
   */
  getRoutes() {
    return Array.from(this.#screens.keys());
  }

  /**
   * Set default screen
   * @param {string} route
   */
  setDefault(route) {
    this.#defaultScreen = route;
  }

  /**
   * Get default screen route
   * @returns {string|undefined}
   */
  getDefault() {
    return this.#defaultScreen;
  }

  /**
   * Check if route exists
   * @param {string} route
   * @returns {boolean}
   */
  has(route) {
    return this.#screens.has(route);
  }

  /**
   * Unregister a screen
   * @param {string} route
   */
  unregister(route) {
    this.#screens.delete(route);
  }

  /**
   * Clear all screens
   */
  clear() {
    this.#screens.clear();
    this.#defaultScreen = null;
  }
}

/**
 * Create a new screen registry
 * @returns {ScreenRegistry}
 */
export function createScreenRegistry() {
  return new ScreenRegistry();
}

/**
 * Default screen registry instance
 */
export const screens = createScreenRegistry();

// Screen utility functions
export { createScreen as screen, createSimpleScreen as simpleScreen };

export default {
  createScreen,
  createSimpleScreen,
  createScreenRegistry,
  screens,
};
