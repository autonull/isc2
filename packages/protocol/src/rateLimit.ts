export type RateLimitScope =
  | 'dht_announce'
  | 'dht_query'
  | 'chat_dial'
  | 'delegate_request'
  | 'delegate_response';

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

export const RATE_LIMITS: Record<RateLimitScope, RateLimitConfig> = {
  dht_announce: { limit: 5, windowMs: 60_000 },
  dht_query: { limit: 30, windowMs: 60_000 },
  chat_dial: { limit: 20, windowMs: 3_600_000 },
  delegate_request: { limit: 3, windowMs: 60_000 },
  delegate_response: { limit: 10, windowMs: 60_000 },
};

export class RateLimiter {
  private windows = new Map<string, { count: number; resetAt: number }>();

  check(scope: RateLimitScope): boolean {
    const config = RATE_LIMITS[scope];
    if (!config) {
      throw new Error(`Unknown rate limit scope: ${scope}`);
    }
    return this._check(scope, config.limit, config.windowMs);
  }

  _check(scope: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const window = this.windows.get(scope);
    if (!window || now >= window.resetAt) {
      this.windows.set(scope, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (window.count >= limit) return false;
    window.count++;
    return true;
  }

  reset(scope: string): void {
    this.windows.delete(scope);
  }

  getRemainingTime(scope: RateLimitScope): number {
    const window = this.windows.get(scope);
    if (!window) return 0;
    return Math.max(0, window.resetAt - Date.now());
  }

  getCount(scope: RateLimitScope): number {
    const window = this.windows.get(scope);
    return window?.count ?? 0;
  }

  clear(): void {
    this.windows.clear();
  }
}

export const globalRateLimiter = new RateLimiter();
