/* eslint-disable */
/**
 * Service Utilities
 *
 * Common utilities for service implementations.
 * Follows AGENTS.md: DRY, consistent patterns, modularized.
 */

export interface ServiceConfig {
  enabled: boolean;
  storageKey?: string;
}

export interface ServiceLifecycle {
  start(): void;
  stop(): void;
}

/**
 * Creates a singleton instance getter with lazy initialization.
 */
export function createSingleton<T extends new (...args: any[]) => any>(
  ServiceClass: T,
  defaultConfig?: ConstructorParameters<T>[0]
): () => InstanceType<T> {
  let instance: InstanceType<T> | null = null;

  return function getInstance(this: void, config?: ConstructorParameters<T>[0]): InstanceType<T> {
    if (!instance) {
      instance = new ServiceClass(config ?? defaultConfig) as InstanceType<T>;
    }
    return instance!;
  };
}

/**
 * Creates event listener management with automatic cleanup.
 */
export function createListenerManager<T extends (...args: any[]) => void>() {
  const listeners = new Set<T>();

  return {
    subscribe(callback: T): () => void {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },

    emit(...args: Parameters<T>): void {
      listeners.forEach((listener) => listener(...args));
    },

    clear(): void {
      listeners.clear();
    },

    get size(): number {
      return listeners.size;
    },
  };
}

/**
 * Creates storage helpers with automatic serialization.
 */
export function createStorageManager<T extends Record<string, any>>(storageKey: string) {
  return {
    load(defaultValue: T): T {
      try {
        const stored = localStorage.getItem(storageKey);
        if (!stored) return defaultValue;
        return { ...defaultValue, ...JSON.parse(stored) };
      } catch {
        return defaultValue;
      }
    },

    save(data: T): boolean {
      try {
        localStorage.setItem(storageKey, JSON.stringify(data));
        return true;
      } catch {
        return false;
      }
    },

    clear(): boolean {
      try {
        localStorage.removeItem(storageKey);
        return true;
      } catch {
        return false;
      }
    },

    exists(): boolean {
      try {
        return localStorage.getItem(storageKey) !== null;
      } catch {
        return false;
      }
    },
  };
}

/**
 * Creates a cache with TTL support.
 */
export function createCache<T>(options?: { maxAge?: number; maxSize?: number }) {
  const { maxAge = 3600000, maxSize = 100 } = options ?? {};
  const cache = new Map<string, { value: T; timestamp: number }>();

  return {
    get(key: string): T | undefined {
      const item = cache.get(key);
      if (!item) return undefined;
      if (Date.now() - item.timestamp > maxAge) {
        cache.delete(key);
        return undefined;
      }
      return item.value;
    },

    set(key: string, value: T): void {
      if (cache.size >= maxSize) {
        const oldest = Array.from(cache.entries()).sort(
          (a, b) => a[1].timestamp - b[1].timestamp
        )[0];
        if (oldest) cache.delete(oldest[0]);
      }
      cache.set(key, { value, timestamp: Date.now() });
    },

    has(key: string): boolean {
      return this.get(key) !== undefined;
    },

    delete(key: string): boolean {
      return cache.delete(key);
    },

    clear(): void {
      cache.clear();
    },

    get size(): number {
      return cache.size;
    },
  };
}

/**
 * Creates debounced function for performance optimization.
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function debounced(this: any, ...args: Parameters<T>) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Creates throttled function for performance optimization.
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return function throttled(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Creates visibility change handler.
 */
export function onVisibilityChange(callback: (visible: boolean) => void): () => void {
  const handler = () => callback(document.visibilityState === 'visible');
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}

/**
 * Creates focus handler for window/tab.
 */
export function onFocus(callback: () => void): () => void {
  window.addEventListener('focus', callback);
  return () => window.removeEventListener('focus', callback);
}

/**
 * Generates a unique ID with optional prefix.
 */
export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Hashes a string to a number.
 */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Shuffles an array in place (Fisher-Yates).
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Clamps a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation between two values.
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Maps a value from one range to another.
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}
