export const RATE_LIMITS = {
    dht_announce: { limit: 5, windowMs: 60_000 },
    dht_query: { limit: 30, windowMs: 60_000 },
    chat_dial: { limit: 20, windowMs: 3_600_000 },
    delegate_request: { limit: 3, windowMs: 60_000 },
    delegate_response: { limit: 10, windowMs: 60_000 },
};
export class RateLimiter {
    windows = new Map();
    check(scope) {
        const config = RATE_LIMITS[scope];
        if (!config) {
            throw new Error(`Unknown rate limit scope: ${scope}`);
        }
        return this._check(scope, config.limit, config.windowMs);
    }
    _check(scope, limit, windowMs) {
        const now = Date.now();
        const window = this.windows.get(scope);
        if (!window || now >= window.resetAt) {
            this.windows.set(scope, { count: 1, resetAt: now + windowMs });
            return true;
        }
        if (window.count >= limit)
            return false;
        window.count++;
        return true;
    }
    reset(scope) {
        this.windows.delete(scope);
    }
    getRemainingTime(scope) {
        const window = this.windows.get(scope);
        if (!window)
            return 0;
        return Math.max(0, window.resetAt - Date.now());
    }
    getCount(scope) {
        const window = this.windows.get(scope);
        return window?.count ?? 0;
    }
    clear() {
        this.windows.clear();
    }
}
export const globalRateLimiter = new RateLimiter();
//# sourceMappingURL=rateLimit.js.map