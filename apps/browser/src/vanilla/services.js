/* eslint-disable */
/**
 * Service Locator Module
 *
 * Dependency injection container for application services.
 * Provides centralized access to services without direct imports.
 */

const services = new Map();
const aliases = new Map();

/**
 * @typedef {Object} ServiceRegistration
 * @property {*} instance - Service instance
 * @property {boolean} [lazy] - Lazy initialization flag
 * @property {Function} [factory] - Factory function for lazy creation
 */

/**
 * Register a service
 * @param {string} name - Service name
 * @param {*} instance - Service instance
 * @param {string} [alias] - Optional alias
 */
export function register(name, instance, alias) {
  if (services.has(name)) {
    console.warn(`[Services] Service "${name}" already registered, overwriting`);
  }
  services.set(name, { instance });

  if (alias) {
    aliases.set(alias, name);
  }
}

/**
 * Register a lazy service with factory
 * @param {string} name - Service name
 * @param {Function} factory - Factory function
 * @param {string} [alias] - Optional alias
 */
export function registerLazy(name, factory, alias) {
  if (services.has(name)) {
    console.warn(`[Services] Service "${name}" already registered, overwriting`);
  }
  services.set(name, { factory, lazy: true });

  if (alias) {
    aliases.set(alias, name);
  }
}

/**
 * Get a service by name
 * @param {string} name - Service name or alias
 * @returns {*}
 */
export function get(name) {
  const resolvedName = aliases.get(name) ?? name;
  const registration = services.get(resolvedName);

  if (!registration) {
    console.warn(`[Services] Service "${name}" not found`);
    return null;
  }

  if (registration.lazy && !registration.instance) {
    registration.instance = registration.factory();
    delete registration.factory;
    registration.lazy = false;
  }

  return registration?.instance ?? null;
}

/**
 * Check if a service is registered
 * @param {string} name - Service name
 * @returns {boolean}
 */
export function has(name) {
  return services.has(name) || aliases.has(name);
}

/**
 * Unregister a service
 * @param {string} name - Service name
 */
export function unregister(name) {
  const resolvedName = aliases.get(name) ?? name;
  services.delete(resolvedName);

  for (const [alias, target] of aliases) {
    if (target === resolvedName) {
      aliases.delete(alias);
    }
  }
}

/**
 * Get all registered services
 * @returns {Object} Map of service name to instance
 */
export function getAll() {
  const result = {};
  for (const [name, reg] of services) {
    if (reg.lazy && !reg.instance) {
      reg.instance = reg.factory();
      delete reg.factory;
      reg.lazy = false;
    }
    result[name] = reg.instance;
  }
  return result;
}

/**
 * Clear all services
 */
export function clear() {
  services.clear();
  aliases.clear();
}

/**
 * Service names constants
 * @readonly
 * @enum {string}
 */
export const SERVICE_NAMES = {
  NETWORK: 'network',
  POST: 'post',
  FEED: 'feed',
  CHANNEL: 'channel',
  MODAL: 'modal',
  TOAST: 'toast',
  IDENTITY: 'identity',
  MODERATION: 'moderation',
  EMBEDDING: 'embedding',
  STORAGE: 'storage',
};

/**
 * Initialize default services (called from app.js)
 * @param {Object} serviceInstances - Map of service names to instances
 */
export function initialize(serviceInstances) {
  const defaults = {
    network: 'networkService',
    post: 'postService',
    feed: 'feedService',
    channel: 'channelService',
    modal: 'modals',
    toast: 'toasts',
    identity: 'identityService',
    moderation: 'moderationService',
    embedding: 'embeddingService',
    storage: 'storageService',
  };

  Object.entries(serviceInstances).forEach(([key, instance]) => {
    const name = defaults[key] ?? key;
    register(name, instance);
  });
}

/**
 * Create a service getter with default
 * @param {string} name - Service name
 * @param {*} defaultValue - Default if service not found
 * @returns {Function} Getter function
 */
export function createGetter(name, defaultValue = null) {
  return () => get(name) ?? defaultValue;
}

/**
 * Default services instance
 */
export const services$ = {
  register,
  registerLazy,
  get,
  has,
  unregister,
  getAll,
  clear,
  initialize,
  createGetter,
  SERVICE_NAMES,
};

export default services$;
