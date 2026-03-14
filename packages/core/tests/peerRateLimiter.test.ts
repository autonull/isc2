import { describe, it, expect, beforeEach } from 'vitest';
import { PeerRateLimiter, PEER_RATE_LIMITS, PeerRateLimitScope } from '../src/peerRateLimiter.js';

describe('PeerRateLimiter', () => {
  let limiter: PeerRateLimiter;

  beforeEach(() => {
    limiter = new PeerRateLimiter();
  });

  describe('basic rate limiting', () => {
    it('should allow requests within limit', () => {
      const result = limiter.attempt('peer1', 'ANNOUNCE', PEER_RATE_LIMITS.ANNOUNCE);
      expect(result).toBe(true);
    });

    it('should track request count per peer', () => {
      limiter.attempt('peer1', 'ANNOUNCE', PEER_RATE_LIMITS.ANNOUNCE);
      limiter.attempt('peer1', 'ANNOUNCE', PEER_RATE_LIMITS.ANNOUNCE);
      const result = limiter.attempt('peer1', 'ANNOUNCE', PEER_RATE_LIMITS.ANNOUNCE);
      expect(result).toBe(true);
    });

    it('should block requests exceeding limit', () => {
      for (let i = 0; i < 5; i++) {
        limiter.attempt('peer1', 'ANNOUNCE', PEER_RATE_LIMITS.ANNOUNCE);
      }
      const result = limiter.attempt('peer1', 'ANNOUNCE', PEER_RATE_LIMITS.ANNOUNCE);
      expect(result).toBe(false);
    });

    it('should allow different peers independently', () => {
      for (let i = 0; i < 5; i++) {
        limiter.attempt('peer1', 'ANNOUNCE', PEER_RATE_LIMITS.ANNOUNCE);
      }
      const result = limiter.attempt('peer2', 'ANNOUNCE', PEER_RATE_LIMITS.ANNOUNCE);
      expect(result).toBe(true);
    });
  });

  describe('scope-based rate limiting', () => {
    it('should use predefined scope configs', () => {
      expect(limiter.attemptPeerScope('peer1', 'ANNOUNCE')).toBe(true);
      expect(limiter.attemptPeerScope('peer1', 'CHAT_DIAL')).toBe(true);
    });

    it('should enforce different limits per scope', () => {
      for (let i = 0; i < 5; i++) {
        limiter.attemptPeerScope('peer1', 'ANNOUNCE');
      }
      expect(limiter.attemptPeerScope('peer1', 'ANNOUNCE')).toBe(false);
      expect(limiter.attemptPeerScope('peer1', 'CHAT_DIAL')).toBe(true);
    });
  });

  describe('check method', () => {
    it('should work as alias for attemptPeerScope', () => {
      expect(limiter.check('peer1', 'ANNOUNCE')).toBe(true);
    });
  });

  describe('getRemainingRequests', () => {
    it('should return remaining requests', () => {
      limiter.attemptPeerScope('peer1', 'ANNOUNCE');
      limiter.attemptPeerScope('peer1', 'ANNOUNCE');
      expect(limiter.getRemainingRequests('peer1', 'ANNOUNCE')).toBe(3);
    });

    it('should return full limit for unknown peer', () => {
      expect(limiter.getRemainingRequests('unknown', 'ANNOUNCE')).toBe(5);
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', () => {
      const shortLimit = { maxRequests: 1, windowMs: 10 };
      limiter.attempt('peer1', 'TEST', shortLimit);
      expect(limiter.attempt('peer1', 'TEST', shortLimit)).toBe(false);
      
      return new Promise(resolve => setTimeout(resolve, 20)).then(() => {
        limiter.cleanup();
        expect(limiter.attempt('peer1', 'TEST', shortLimit)).toBe(true);
      });
    });
  });

  describe('state management', () => {
    it('should serialize and restore state', () => {
      limiter.attemptPeerScope('peer1', 'ANNOUNCE');
      limiter.attemptPeerScope('peer1', 'ANNOUNCE');
      
      const state = limiter.getState();
      const newLimiter = new PeerRateLimiter();
      newLimiter.loadState(state);
      
      expect(newLimiter.getRemainingRequests('peer1', 'ANNOUNCE')).toBe(3);
    });

    it('should reset specific peer', () => {
      limiter.attemptPeerScope('peer1', 'ANNOUNCE');
      limiter.attemptPeerScope('peer2', 'ANNOUNCE');
      
      limiter.resetPeer('peer1');
      
      expect(limiter.getRemainingRequests('peer1', 'ANNOUNCE')).toBe(5);
      expect(limiter.getRemainingRequests('peer2', 'ANNOUNCE')).toBe(4);
    });

    it('should reset specific scope', () => {
      limiter.attemptPeerScope('peer1', 'ANNOUNCE');
      limiter.attemptPeerScope('peer1', 'CHAT_DIAL');
      
      limiter.resetScope('ANNOUNCE');
      
      expect(limiter.getRemainingRequests('peer1', 'ANNOUNCE')).toBe(5);
      expect(limiter.getRemainingRequests('peer1', 'CHAT_DIAL')).toBe(19);
    });

    it('should clear all state', () => {
      limiter.attemptPeerScope('peer1', 'ANNOUNCE');
      limiter.attemptPeerScope('peer2', 'CHAT_DIAL');
      
      limiter.clear();
      
      expect(limiter.getRemainingRequests('peer1', 'ANNOUNCE')).toBe(5);
      expect(limiter.getRemainingRequests('peer2', 'CHAT_DIAL')).toBe(20);
    });
  });

  describe('getStats', () => {
    it('should return accurate stats', () => {
      limiter.attemptPeerScope('peer1', 'ANNOUNCE');
      limiter.attemptPeerScope('peer1', 'CHAT_DIAL');
      limiter.attemptPeerScope('peer2', 'ANNOUNCE');
      
      const stats = limiter.getStats();
      expect(stats.peerCount).toBe(2);
      expect(stats.activeScopes).toBe(2);
    });
  });
});
