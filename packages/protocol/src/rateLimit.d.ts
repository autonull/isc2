export type RateLimitScope = 'dht_announce' | 'dht_query' | 'chat_dial' | 'delegate_request' | 'delegate_response';
export interface RateLimitConfig {
    limit: number;
    windowMs: number;
}
export declare const RATE_LIMITS: Record<RateLimitScope, RateLimitConfig>;
export declare class RateLimiter {
    private windows;
    check(scope: RateLimitScope): boolean;
    _check(scope: string, limit: number, windowMs: number): boolean;
    reset(scope: string): void;
    getRemainingTime(scope: RateLimitScope): number;
    getCount(scope: RateLimitScope): number;
    clear(): void;
}
export declare const globalRateLimiter: RateLimiter;
//# sourceMappingURL=rateLimit.d.ts.map