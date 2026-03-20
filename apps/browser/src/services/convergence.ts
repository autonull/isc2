/**
 * Convergence Events Service
 *
 * Detects when multiple independent peers arrive at nearly identical thoughts
 * within a short time window. This is ISC's most shareable moment.
 */

interface ConvergencePeer {
  peerId: string;
  lshBucket: string;
  seenAt: number;
  contacted: boolean;
}

interface ConvergenceEvent {
  bucketKey: string;
  peerCount: number;
  firstSeen: number;
  lastSeen: number;
  duration: number;
}

const CONVERGENCE_THRESHOLD = 5; // Minimum peers to trigger
const CONVERGENCE_WINDOW_MS = 60 * 60 * 1000; // 60 minutes
const BUCKET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

class ConvergenceService {
  private buckets: Map<string, ConvergencePeer[]> = new Map();
  private lastSweep = 0;
  private sweepIntervalMs = 30 * 1000; // Sweep every 30 seconds

  addPeer(peerId: string, lshBucket: string): ConvergenceEvent | null {
    const now = Date.now();
    this.cleanupExpiredBuckets();

    if (!this.buckets.has(lshBucket)) {
      this.buckets.set(lshBucket, []);
    }

    const bucket = this.buckets.get(lshBucket)!;

    // Check if peer already in bucket
    const existingIndex = bucket.findIndex((p) => p.peerId === peerId);
    if (existingIndex >= 0) {
      bucket[existingIndex].seenAt = now;
      return null;
    }

    bucket.push({
      peerId,
      lshBucket,
      seenAt: now,
      contacted: false,
    });

    return this.checkForConvergence(lshBucket);
  }

  private checkForConvergence(bucketKey: string): ConvergenceEvent | null {
    const bucket = this.buckets.get(bucketKey);
    if (!bucket) return null;

    const now = Date.now();
    const recentPeers = bucket.filter((p) => now - p.seenAt <= CONVERGENCE_WINDOW_MS);
    const distinctPeers = new Set(recentPeers.map((p) => p.peerId));

    if (distinctPeers.size >= CONVERGENCE_THRESHOLD) {
      const firstSeen = Math.min(...recentPeers.map((p) => p.seenAt));
      const lastSeen = Math.max(...recentPeers.map((p) => p.seenAt));

      return {
        bucketKey,
        peerCount: distinctPeers.size,
        firstSeen,
        lastSeen,
        duration: lastSeen - firstSeen,
      };
    }

    return null;
  }

  private cleanupExpiredBuckets(): void {
    const now = Date.now();

    for (const [bucketKey, peers] of this.buckets.entries()) {
      const recentPeers = peers.filter((p) => now - p.seenAt <= BUCKET_EXPIRY_MS);

      if (recentPeers.length === 0) {
        this.buckets.delete(bucketKey);
      } else {
        this.buckets.set(bucketKey, recentPeers);
      }
    }
  }

  getActiveConvergences(): ConvergenceEvent[] {
    this.cleanupExpiredBuckets();
    const events: ConvergenceEvent[] = [];

    for (const bucketKey of this.buckets.keys()) {
      const event = this.checkForConvergence(bucketKey);
      if (event) {
        events.push(event);
      }
    }

    return events.sort((a, b) => b.peerCount - a.peerCount);
  }

  getBucketInfo(bucketKey: string): { count: number; peers: string[] } | null {
    const bucket = this.buckets.get(bucketKey);
    if (!bucket) return null;

    const now = Date.now();
    const recent = bucket.filter((p) => now - p.seenAt <= CONVERGENCE_WINDOW_MS);
    const uniquePeers = [...new Set(recent.map((p) => p.peerId))];

    return {
      count: uniquePeers.length,
      peers: uniquePeers,
    };
  }

  markPeerContacted(peerId: string): void {
    for (const peers of this.buckets.values()) {
      const peer = peers.find((p) => p.peerId === peerId);
      if (peer) {
        peer.contacted = true;
      }
    }
  }

  getUncontactedCount(bucketKey: string): number {
    const bucket = this.buckets.get(bucketKey);
    if (!bucket) return 0;

    const now = Date.now();
    return bucket.filter((p) => now - p.seenAt <= CONVERGENCE_WINDOW_MS && !p.contacted).length;
  }

  clear(): void {
    this.buckets.clear();
  }
}

export const convergenceService = new ConvergenceService();
export default convergenceService;
