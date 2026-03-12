export interface RateLimitConfig {
  storage?: RateLimitStorage;
}

export interface RateLimitWindow {
  count: number;
  resetAt: number;
}

export interface RateLimitStorage {
  get(key: string): Promise<RateLimitWindow | null>;
  set(key: string, window: RateLimitWindow): Promise<void>;
}

class MemoryStorage implements RateLimitStorage {
  private store = new Map<string, RateLimitWindow>();

  async get(key: string): Promise<RateLimitWindow | null> {
    const window = this.store.get(key);
    if (!window || Date.now() >= window.resetAt) {
      if (window) this.store.delete(key);
      return null;
    }
    return window;
  }

  async set(key: string, window: RateLimitWindow): Promise<void> {
    this.store.set(key, window);
  }
}

export class RateLimiter {
  private windows = new Map<string, RateLimitWindow>();

  constructor(private storage: RateLimitStorage = new MemoryStorage()) {}

  async check(scope: string, limit: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    let window = this.windows.get(scope);

    if (!window || now >= window.resetAt) {
      window = { count: 1, resetAt: now + windowMs };
      this.windows.set(scope, window);
      await this.storage.set(scope, window);
      return true;
    }

    if (window.count >= limit) return false;
    window.count++;
    this.windows.set(scope, window);
    await this.storage.set(scope, window);
    return true;
  }

  async getRemaining(scope: string, limit: number): Promise<number> {
    const window = this.windows.get(scope);
    if (!window || Date.now() >= window.resetAt) return limit;
    return Math.max(0, limit - window.count);
  }

  async getResetTime(scope: string): Promise<number | null> {
    const window = this.windows.get(scope);
    if (!window || Date.now() >= window.resetAt) return null;
    return window.resetAt;
  }

  reset(scope: string): void {
    this.windows.delete(scope);
  }

  resetAll(): void {
    this.windows.clear();
  }
}

export const RATE_LIMITS = {
  DHT_ANNOUNCE: { limit: 5, windowMs: 60000 },
  CHAT_DIAL: { limit: 20, windowMs: 3600000 },
  DHT_QUERY: { limit: 30, windowMs: 60000 },
  DELEGATE_REQUEST: { limit: 3, windowMs: 60000 },
  DELEGATE_RESPONSE: { limit: 10, windowMs: 60000 },
} as const;
