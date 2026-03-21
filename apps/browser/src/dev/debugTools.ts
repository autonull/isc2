/**
 * Debug Tools for Development
 *
 * Utilities for debugging and inspecting the app state during development.
 * These should only be used in development mode.
 */

import type { AppDependencies } from '../di/container.js';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Debug overlay component that shows app state
 */
export function createDebugOverlay(dependencies: AppDependencies) {
  if (!isDev) return null;

  const overlay = document.createElement('div');
  overlay.id = 'debug-overlay';
  overlay.style.cssText = `
    position: fixed;
    bottom: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.9);
    color: #0f0;
    font-family: monospace;
    font-size: 11px;
    padding: 10px;
    border-radius: 4px;
    z-index: 999999;
    max-width: 300px;
    max-height: 200px;
    overflow: auto;
  `;

  const updateOverlay = () => {
    const state = {
      identity: (dependencies as any).identityService ? '✓' : '✗',
      channels: (dependencies as any).chatService ? '✓' : '✗',
      posts: (dependencies as any).chatService ? '✓' : '✗',
      feed: (dependencies as any).chatService ? '✓' : '✗',
      navigator: typeof navigator !== 'undefined' ? '✓' : '✗',
      memory:
        typeof performance !== 'undefined' && 'memory' in performance
          ? Math.round((performance as any).memory?.usedJSHeapSize / 1024 / 1024) || '?'
          : '?',
      fps: 0,
    };

    overlay.innerHTML = `
      <div><strong>ISC Debug</strong></div>
      <div>Identity: ${state.identity}</div>
      <div>Channels: ${state.channels}</div>
      <div>Posts: ${state.posts}</div>
      <div>Feed: ${state.feed}</div>
      <div>Nav: ${state.navigator}</div>
      <div>Memory: ${state.memory}MB</div>
      <div>FPS: <span id="debug-fps">${state.fps}</span></div>
    `;
  };

  // FPS counter
  let frameCount = 0;
  let lastTime = performance.now();

  const countFPS = () => {
    frameCount++;
    const now = performance.now();
    if (now - lastTime >= 1000) {
      const fpsElement = overlay.querySelector('#debug-fps');
      if (fpsElement) {
        fpsElement.textContent = String(frameCount);
      }
      frameCount = 0;
      lastTime = now;
    }
    requestAnimationFrame(countFPS);
  };

  if (typeof requestAnimationFrame !== 'undefined') {
    countFPS();
  }

  updateOverlay();
  document.body.appendChild(overlay);

  return {
    update: updateOverlay,
    destroy: () => overlay.remove(),
  };
}

/**
 * Log state changes for debugging
 */
export function createDebugLogger(name: string) {
  if (!isDev) {
    return {
      log: () => {},
      warn: () => {},
      error: () => {},
      group: () => {},
      groupEnd: () => {},
    };
  }

  const prefix = `[${name}]`;
  const color = getColorForName(name);

  return {
    log: (...args: any[]) => {
      console.log(`%c${prefix}`, `color: ${color}`, ...args);
    },
    warn: (...args: any[]) => {
      console.warn(`%c${prefix}`, `color: ${color}`, ...args);
    },
    error: (...args: any[]) => {
      console.error(`%c${prefix}`, `color: ${color}`, ...args);
    },
    group: (label: string) => {
      console.group(`%c${prefix} ${label}`, `color: ${color}`);
    },
    groupEnd: () => {
      console.groupEnd();
    },
  };
}

/**
 * Generate a consistent color for a given name
 */
function getColorForName(name: string): string {
  const colors = [
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#96CEB4',
    '#FFEAA7',
    '#DDA0DD',
    '#98D8C8',
    '#F7DC6F',
    '#BB8FCE',
    '#85C1E9',
    '#F8B500',
    '#00CED1',
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

/**
 * Performance monitoring
 */
export class PerformanceMonitor {
  private marks: Map<string, number> = new Map();
  private measures: Array<{ name: string; duration: number }> = [];
  private enabled: boolean;

  constructor(enabled: boolean = isDev) {
    this.enabled = enabled;
  }

  /**
   * Mark a point in time
   */
  mark(name: string): void {
    if (!this.enabled) return;
    this.marks.set(name, performance.now());
  }

  /**
   * Measure duration between two marks
   */
  measure(from: string, to: string): number | null {
    if (!this.enabled) return null;

    const fromTime = this.marks.get(from);
    const toTime = this.marks.get(to);

    if (fromTime === undefined || toTime === undefined) {
      return null;
    }

    const duration = toTime - fromTime;
    this.measures.push({ name: `${from} → ${to}`, duration });

    console.log(`%c⏱ ${from} → ${to}: ${duration.toFixed(2)}ms`, 'color: #4ECDC4');

    return duration;
  }

  /**
   * Measure an async operation
   */
  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    if (!this.enabled) return fn();

    const start = performance.now();
    try {
      return await fn();
    } finally {
      const duration = performance.now() - start;
      this.measures.push({ name, duration });
      console.log(`%c⏱ ${name}: ${duration.toFixed(2)}ms`, 'color: #4ECDC4');
    }
  }

  /**
   * Get all measures
   */
  getMeasures(): Array<{ name: string; duration: number }> {
    return [...this.measures];
  }

  /**
   * Clear all marks and measures
   */
  clear(): void {
    this.marks.clear();
    this.measures.length = 0;
  }

  /**
   * Print summary
   */
  summary(): void {
    if (!this.enabled) return;

    console.group('📊 Performance Summary');
    console.table(this.measures);

    const total = this.measures.reduce((sum, m) => sum + m.duration, 0);
    console.log(`Total: ${total.toFixed(2)}ms`);
    console.groupEnd();
  }
}

/**
 * State inspector for debugging state changes
 */
export class StateInspector<T extends Record<string, any>> {
  private state: T;
  private history: Array<{ timestamp: number; changes: Partial<T> }> = [];
  private listeners: Set<(state: T) => void> = new Set();
  private name: string;
  private enabled: boolean;

  constructor(name: string, initialState: T, enabled: boolean = isDev) {
    this.name = name;
    this.state = initialState;
    this.enabled = enabled;
  }

  /**
   * Get current state
   */
  getState(): T {
    return { ...this.state };
  }

  /**
   * Update state
   */
  setState(changes: Partial<T>): void {
    this.state = { ...this.state, ...changes };

    if (this.enabled) {
      this.history.push({
        timestamp: Date.now(),
        changes,
      });

      console.log(`%c📦 ${this.name} state updated:`, 'color: #45B7D1', changes);
    }

    this.listeners.forEach((listener) => listener(this.state));
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: T) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get state history
   */
  getHistory(): Array<{ timestamp: number; changes: Partial<T> }> {
    return [...this.history];
  }

  /**
   * Print state
   */
  inspect(): void {
    if (!this.enabled) return;

    console.group(`📦 ${this.name} State`);
    console.log('Current:', this.state);
    console.log('History:', this.history.length, 'changes');
    if (this.history.length > 0) {
      console.log('Last change:', this.history[this.history.length - 1]);
    }
    console.groupEnd();
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history.length = 0;
  }
}

/**
 * Network request monitor
 */
export class NetworkMonitor {
  private requests: Array<{ url: string; method: string; status?: number; duration?: number }> = [];
  private enabled: boolean;

  constructor(enabled: boolean = isDev) {
    this.enabled = enabled;

    if (enabled && typeof window !== 'undefined') {
      this.setupInterceptors();
    }
  }

  private setupInterceptors(): void {
    // Monitor fetch
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url || '';
      const method = args[1]?.method || 'GET';
      const start = performance.now();

      try {
        const response = await originalFetch(...args);
        const duration = performance.now() - start;

        this.requests.push({
          url,
          method,
          status: response.status,
          duration,
        });

        if (this.enabled) {
          console.log(
            `%c🌐 ${method} ${url}`,
            'color: #96CEB4',
            `${response.status} (${duration.toFixed(0)}ms)`
          );
        }

        return response;
      } catch (error) {
        const duration = performance.now() - start;

        this.requests.push({
          url,
          method,
          duration,
        });

        if (this.enabled) {
          console.error(
            `%c🌐 ${method} ${url}`,
            'color: #FF6B6B',
            `FAILED (${duration.toFixed(0)}ms)`,
            error
          );
        }

        throw error;
      }
    };
  }

  /**
   * Get all requests
   */
  getRequests(): Array<{ url: string; method: string; status?: number; duration?: number }> {
    return [...this.requests];
  }

  /**
   * Get failed requests
   */
  getFailedRequests(): Array<{ url: string; method: string; duration?: number }> {
    return this.requests.filter((r) => !r.status || r.status >= 400);
  }

  /**
   * Clear history
   */
  clear(): void {
    this.requests.length = 0;
  }

  /**
   * Print summary
   */
  summary(): void {
    if (!this.enabled) return;

    console.group('🌐 Network Summary');
    console.log('Total requests:', this.requests.length);
    console.log('Failed requests:', this.getFailedRequests().length);

    const avgDuration =
      this.requests.reduce((sum, r) => sum + (r.duration || 0), 0) / this.requests.length;
    console.log('Average duration:', avgDuration.toFixed(0), 'ms');

    console.table(this.requests);
    console.groupEnd();
  }
}

/**
 * Global debug API exposed on window object
 */
export function exposeDebugAPI(dependencies: AppDependencies): void {
  if (!isDev || typeof window === 'undefined') return;

  const perfMonitor = new PerformanceMonitor(true);
  const networkMonitor = new NetworkMonitor(true);

  (window as any).ISC_DEBUG = {
    dependencies,
    perf: perfMonitor,
    network: networkMonitor,

    // Quick access to services
    channels: () => (dependencies as any).chatService?.getConversations(),
    posts: () => (dependencies as any).chatService?.getMessages?.(''),
    identity: () => (dependencies as any).identityService?.getFingerprint?.(),

    // Utilities
    clear: () => {
      perfMonitor.clear();
      networkMonitor.clear();
      console.clear();
    },

    help: () => {
      console.log(`
ISC Debug API:
  ISC_DEBUG.channels()     - Get all channels
  ISC_DEBUG.posts()        - Get all posts
  ISC_DEBUG.identity()     - Get identity fingerprint
  ISC_DEBUG.perf           - Performance monitor
  ISC_DEBUG.network        - Network monitor
  ISC_DEBUG.clear()        - Clear all logs and data
      `);
    },
  };

  console.log('%c🔧 ISC Debug Tools Enabled', 'color: #4ECDC4; font-weight: bold; font-size: 14px');
  console.log(
    'Type %cISC_DEBUG.help()',
    'color: #45B7D1; font-family: monospace',
    'for available commands'
  );
}

/**
 * Error boundary helper for catching and logging errors
 */
export function withErrorLogging<T extends (...args: any[]) => any>(fn: T, name: string): T {
  if (!isDev) return fn;

  return ((...args: any[]) => {
    try {
      return fn(...args);
    } catch (error) {
      console.error(`%c❌ Error in ${name}:`, 'color: #FF6B6B', error);
      throw error;
    }
  }) as T;
}

/**
 * Visualize component render times
 */
export function trackRenders(componentName: string) {
  if (!isDev) return () => {};

  const renders: number[] = [];
  let lastRender = 0;

  return () => {
    const now = performance.now();
    const duration = now - lastRender;
    lastRender = now;
    renders.push(duration);

    if (renders.length > 100) renders.shift();
    const avg = renders.reduce((a, b) => a + b, 0) / renders.length;

    if (duration > 16) {
      console.warn(
        `%c⚠️ ${componentName} slow render: ${duration.toFixed(2)}ms (avg: ${avg.toFixed(2)}ms)`,
        'color: #FF6B6B'
      );
    }
  };
}
