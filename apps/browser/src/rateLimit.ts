/* eslint-disable */
/**
 * Rate Limit Enforcement
 * Protects against spam and DoS by tracking per-peer rates
 */

import { loggers } from './utils/logger.ts';

const logger = loggers.offline;

interface RateLimitEntry {
  timestamps: number[];
  violations: number;
  blockedUntil?: number;
}

interface RateLimitConfig {
  announceLimit: number; // per minute
  queryLimit: number; // per minute
  chatLimit: number; // per hour
  windowMs: number; // window size in ms
  blockDurationMs: number; // how long to block after max violations
  maxViolations: number; // violations before block
}

const DEFAULT_CONFIG: RateLimitConfig = {
  announceLimit: 5, // 5 per minute (per PROTOCOL.md)
  queryLimit: 30, // 30 per minute
  chatLimit: 20, // 20 per hour
  windowMs: 60000, // 1 minute
  blockDurationMs: 300000, // 5 minutes
  maxViolations: 3, // block after 3 violations
};

const peerRates = new Map<string, {
  announces: RateLimitEntry;
  queries: RateLimitEntry;
  chats: RateLimitEntry;
}>();

const config = { ...DEFAULT_CONFIG };

/**
 * Check and record rate limit for announces
 */
export function checkAnnounceRate(peerId: string): { allowed: boolean; retryAfter?: number; blocked?: boolean } {
  return checkRate(peerId, 'announces', config.announceLimit);
}

/**
 * Check and record rate limit for queries
 */
export function checkQueryRate(peerId: string): { allowed: boolean; retryAfter?: number; blocked?: boolean } {
  return checkRate(peerId, 'queries', config.queryLimit);
}

/**
 * Check and record rate limit for chat messages
 */
export function checkChatRate(peerId: string): { allowed: boolean; retryAfter?: number; blocked?: boolean } {
  return checkRate(peerId, 'chats', config.chatLimit, 3600000); // 1 hour window
}

/**
 * Generic rate check
 */
function checkRate(
  peerId: string,
  type: 'announces' | 'queries' | 'chats',
  limit: number,
  windowMs: number = config.windowMs
): { allowed: boolean; retryAfter?: number; blocked?: boolean } {
  const now = Date.now();
  
  // Get or create peer entry
  let entry = peerRates.get(peerId);
  if (!entry) {
    entry = {
      announces: { timestamps: [], violations: 0 },
      queries: { timestamps: [], violations: 0 },
      chats: { timestamps: [], violations: 0 },
    };
    peerRates.set(peerId, entry);
  }

  const rateEntry = entry[type];

  // Check if peer is temporarily blocked
  if (rateEntry.blockedUntil && now < rateEntry.blockedUntil) {
    return { 
      allowed: false, 
      blocked: true,
      retryAfter: Math.ceil((rateEntry.blockedUntil - now) / 1000)
    };
  }

  // Clear old timestamps outside window
  const windowStart = now - windowMs;
  rateEntry.timestamps = rateEntry.timestamps.filter(ts => ts > windowStart);

  // Check if limit exceeded
  if (rateEntry.timestamps.length >= limit) {
    const oldestInWindow = Math.min(...rateEntry.timestamps);
    const retryAfter = Math.ceil((oldestInWindow + windowMs - now) / 1000);
    
    // Record violation
    rateEntry.violations++;
    
    // Block if too many violations
    if (rateEntry.violations >= config.maxViolations) {
      rateEntry.blockedUntil = now + config.blockDurationMs;
      logger.warn('Peer blocked', { peerId, duration: config.blockDurationMs / 1000 });
      return {
        allowed: false,
        blocked: true,
        retryAfter: Math.ceil(config.blockDurationMs / 1000)
      };
    }
    
    return { allowed: false, retryAfter };
  }

  // Record this request
  rateEntry.timestamps.push(now);
  return { allowed: true };
}

/**
 * Get rate limit status for a peer
 */
export function getRateLimitStatus(peerId: string): {
  announcesRemaining: number;
  queriesRemaining: number;
  chatsRemaining: number;
  isBlocked: boolean;
  blockedUntil?: number;
} {
  const entry = peerRates.get(peerId);
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const chatWindowStart = now - 3600000;

  if (!entry) {
    return {
      announcesRemaining: config.announceLimit,
      queriesRemaining: config.queryLimit,
      chatsRemaining: config.chatLimit,
      isBlocked: false,
    };
  }

  const announceCount = entry.announces.timestamps.filter(ts => ts > windowStart).length;
  const queryCount = entry.queries.timestamps.filter(ts => ts > windowStart).length;
  const chatCount = entry.chats.timestamps.filter(ts => ts > chatWindowStart).length;

  const isBlocked = !!(entry.announces.blockedUntil && now < entry.announces.blockedUntil);

  return {
    announcesRemaining: Math.max(0, config.announceLimit - announceCount),
    queriesRemaining: Math.max(0, config.queryLimit - queryCount),
    chatsRemaining: Math.max(0, config.chatLimit - chatCount),
    isBlocked,
    blockedUntil: entry.announces.blockedUntil,
  };
}

/**
 * Manually block a peer
 */
export function blockPeer(peerId: string, durationMs: number = config.blockDurationMs): void {
  let entry = peerRates.get(peerId);
  if (!entry) {
    entry = {
      announces: { timestamps: [], violations: 0 },
      queries: { timestamps: [], violations: 0 },
      chats: { timestamps: [], violations: 0 },
    };
    peerRates.set(peerId, entry);
  }
  
  const blockUntil = Date.now() + durationMs;
  entry.announces.blockedUntil = blockUntil;
  entry.queries.blockedUntil = blockUntil;
  entry.chats.blockedUntil = blockUntil;

  logger.info('Peer manually blocked', { peerId, duration: durationMs / 1000 });
}

/**
 * Unblock a peer
 */
export function unblockPeer(peerId: string): void {
  const entry = peerRates.get(peerId);
  if (entry) {
    entry.announces.blockedUntil = undefined;
    entry.queries.blockedUntil = undefined;
    entry.chats.blockedUntil = undefined;
    entry.announces.violations = 0;
    entry.queries.violations = 0;
    entry.chats.violations = 0;
  }
  logger.info('Peer unblocked', { peerId });
}

/**
 * Clear all rate limit data
 */
export function clearAllRates(): void {
  peerRates.clear();
}

/**
 * Cleanup old entries (call periodically)
 */
export function cleanupOldEntries(): void {
  const now = Date.now();
  const maxAge = config.blockDurationMs * 2;
  
  for (const [peerId, entry] of peerRates.entries()) {
    const allClear = 
      entry.announces.timestamps.length === 0 &&
      entry.queries.timestamps.length === 0 &&
      entry.chats.timestamps.length === 0 &&
      (!entry.announces.blockedUntil || now > entry.announces.blockedUntil + maxAge);
    
    if (allClear) {
      peerRates.delete(peerId);
    }
  }
}

// Periodic cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupOldEntries, 300000);
}

/**
 * Update rate limit configuration
 */
export function configureRateLimits(newConfig: Partial<RateLimitConfig>): void {
  Object.assign(config, newConfig);
}

/**
 * Get current configuration
 */
export function getRateLimitConfig(): RateLimitConfig {
  return { ...config };
}
