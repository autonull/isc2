/**
 * Unit Tests for Rate Limiting
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { checkAnnounceRate, checkQueryRate, checkChatRate, getRateLimitStatus, blockPeer, unblockPeer, clearAllRates, configureRateLimits, getRateLimitConfig, } from '../../apps/browser/src/rateLimit.js';
describe('Rate Limiting', () => {
    const testPeerId = 'test-peer-123';
    beforeEach(() => {
        clearAllRates();
        configureRateLimits({
            announceLimit: 5,
            queryLimit: 30,
            chatLimit: 20,
            windowMs: 60000,
            blockDurationMs: 300000,
            maxViolations: 3,
        });
    });
    describe('checkAnnounceRate', () => {
        it('should allow requests within limit', () => {
            for (let i = 0; i < 5; i++) {
                const result = checkAnnounceRate(testPeerId);
                expect(result.allowed).toBe(true);
            }
        });
        it('should reject requests exceeding limit', () => {
            for (let i = 0; i < 5; i++) {
                checkAnnounceRate(testPeerId);
            }
            const result = checkAnnounceRate(testPeerId);
            expect(result.allowed).toBe(false);
            expect(result.retryAfter).toBeGreaterThan(0);
        });
        it('should block peer after max violations', () => {
            // Exceed limit 3 times to trigger block
            for (let violation = 0; violation < 3; violation++) {
                for (let i = 0; i < 6; i++) {
                    checkAnnounceRate(testPeerId);
                }
                clearAllRates(); // Reset to trigger violation again
            }
            const result = checkAnnounceRate(testPeerId);
            expect(result.allowed).toBe(false);
            expect(result.blocked).toBe(true);
        });
        it('should track different peers independently', () => {
            const peer1 = 'peer-1';
            const peer2 = 'peer-2';
            // Exhaust peer1's limit
            for (let i = 0; i < 5; i++) {
                checkAnnounceRate(peer1);
            }
            // Peer2 should still have full limit
            const result = checkAnnounceRate(peer2);
            expect(result.allowed).toBe(true);
        });
    });
    describe('checkQueryRate', () => {
        it('should allow requests within limit', () => {
            for (let i = 0; i < 30; i++) {
                const result = checkQueryRate(testPeerId);
                expect(result.allowed).toBe(true);
            }
        });
        it('should reject requests exceeding limit', () => {
            for (let i = 0; i < 30; i++) {
                checkQueryRate(testPeerId);
            }
            const result = checkQueryRate(testPeerId);
            expect(result.allowed).toBe(false);
        });
    });
    describe('checkChatRate', () => {
        it('should allow requests within limit', () => {
            for (let i = 0; i < 20; i++) {
                const result = checkChatRate(testPeerId);
                expect(result.allowed).toBe(true);
            }
        });
        it('should reject requests exceeding limit', () => {
            for (let i = 0; i < 20; i++) {
                checkChatRate(testPeerId);
            }
            const result = checkChatRate(testPeerId);
            expect(result.allowed).toBe(false);
        });
    });
    describe('getRateLimitStatus', () => {
        it('should return correct remaining counts', () => {
            checkAnnounceRate(testPeerId);
            checkAnnounceRate(testPeerId);
            checkQueryRate(testPeerId);
            const status = getRateLimitStatus(testPeerId);
            expect(status.announcesRemaining).toBe(3);
            expect(status.queriesRemaining).toBe(29);
            expect(status.chatsRemaining).toBe(20);
            expect(status.isBlocked).toBe(false);
        });
        it('should return default values for unknown peer', () => {
            const status = getRateLimitStatus('unknown-peer');
            expect(status.announcesRemaining).toBe(5);
            expect(status.queriesRemaining).toBe(30);
            expect(status.chatsRemaining).toBe(20);
        });
    });
    describe('blockPeer & unblockPeer', () => {
        it('should manually block a peer', () => {
            blockPeer(testPeerId);
            const status = getRateLimitStatus(testPeerId);
            expect(status.isBlocked).toBe(true);
        });
        it('should unblock a peer', () => {
            blockPeer(testPeerId);
            unblockPeer(testPeerId);
            const status = getRateLimitStatus(testPeerId);
            expect(status.isBlocked).toBe(false);
        });
    });
    describe('configureRateLimits', () => {
        it('should update configuration', () => {
            configureRateLimits({
                announceLimit: 10,
                queryLimit: 50,
            });
            const config = getRateLimitConfig();
            expect(config.announceLimit).toBe(10);
            expect(config.queryLimit).toBe(50);
        });
        it('should enforce new limits', () => {
            configureRateLimits({ announceLimit: 2 });
            checkAnnounceRate(testPeerId);
            checkAnnounceRate(testPeerId);
            const result = checkAnnounceRate(testPeerId);
            expect(result.allowed).toBe(false);
        });
    });
});
//# sourceMappingURL=rateLimit.test.js.map