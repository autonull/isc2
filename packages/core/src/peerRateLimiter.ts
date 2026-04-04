/* eslint-disable */
export interface RateLimitInfo {
  count: number;
  resetTime: number;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export const PEER_RATE_LIMITS = {
  ANNOUNCE: { maxRequests: 5, windowMs: 60 * 1000 },
  DELEGATE_REQUEST: { maxRequests: 3, windowMs: 60 * 1000 },
  DELEGATE_RESPONSE_CONCURRENT: { maxRequests: 10, windowMs: 0 },
  CHAT_DIAL: { maxRequests: 20, windowMs: 60 * 60 * 1000 },
  DHT_QUERY: { maxRequests: 30, windowMs: 60 * 1000 },
  CHAT_MESSAGE: { maxRequests: 60, windowMs: 60 * 1000 },
  FOLLOW: { maxRequests: 10, windowMs: 60 * 1000 },
};

export type PeerRateLimitScope = keyof typeof PEER_RATE_LIMITS;

export class PeerRateLimiter {
  private limits: Map<string, Map<string, RateLimitInfo>> = new Map();

  public loadState(state: Map<string, Map<string, RateLimitInfo>>): void {
    this.limits = state;
  }

  public getState(): Map<string, Map<string, RateLimitInfo>> {
    return this.limits;
  }

  public attempt(peerId: string, action: string, config: RateLimitConfig): boolean {
    if (!this.limits.has(peerId)) {
      this.limits.set(peerId, new Map());
    }

    const peerLimits = this.limits.get(peerId)!;
    const now = Date.now();

    if (!peerLimits.has(action)) {
      peerLimits.set(action, { count: 1, resetTime: now + config.windowMs });
      return true;
    }

    const info = peerLimits.get(action)!;

    if (now > info.resetTime) {
      info.count = 1;
      info.resetTime = now + config.windowMs;
      return true;
    }

    if (info.count >= config.maxRequests) {
      return false;
    }

    info.count += 1;
    return true;
  }

  public attemptPeerScope(peerId: string, scope: PeerRateLimitScope): boolean {
    const config = PEER_RATE_LIMITS[scope];
    if (!config) {
      throw new Error(`Unknown rate limit scope: ${scope}`);
    }
    return this.attempt(peerId, scope, config);
  }

  public check(peerId: string, scope: PeerRateLimitScope): boolean {
    return this.attemptPeerScope(peerId, scope);
  }

  public getRemainingRequests(peerId: string, scope: PeerRateLimitScope): number {
    const config = PEER_RATE_LIMITS[scope];
    const peerLimits = this.limits.get(peerId);
    if (!peerLimits) {return config.maxRequests;}
    
    const info = peerLimits.get(scope);
    if (!info) {return config.maxRequests;}
    
    if (Date.now() > info.resetTime) {return config.maxRequests;}
    return Math.max(0, config.maxRequests - info.count);
  }

  public cleanup(): void {
    const now = Date.now();
    for (const [peerId, peerLimits] of this.limits.entries()) {
      for (const [action, info] of peerLimits.entries()) {
        if (now > info.resetTime) {
          peerLimits.delete(action);
        }
      }
      if (peerLimits.size === 0) {
        this.limits.delete(peerId);
      }
    }
  }

  public resetPeer(peerId: string): void {
    this.limits.delete(peerId);
  }

  public resetScope(scope: string): void {
    for (const peerLimits of this.limits.values()) {
      peerLimits.delete(scope);
    }
  }

  public clear(): void {
    this.limits.clear();
  }

  public getStats(): { peerCount: number; activeScopes: number } {
    const activeScopes = new Set<string>();
    for (const peerLimits of this.limits.values()) {
      for (const action of peerLimits.keys()) {
        activeScopes.add(action);
      }
    }
    return {
      peerCount: this.limits.size,
      activeScopes: activeScopes.size,
    };
  }
}

export const globalPeerRateLimiter = new PeerRateLimiter();
