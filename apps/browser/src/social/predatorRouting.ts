/**
 * ISC Phase E5: Predator Routing Mitigations
 *
 * Implements safety measures to protect against malicious actors who may use
 * semantic routing for targeted predation. These are mitigations, not a
 * complete solution - they reduce risk without eliminating it.
 *
 * Mitigations:
 * 1. TTL floor: minimum time before contact initiation in a semantic region
 * 2. Cluster quarantine: temporary quarantine of regions with high abuse reports
 * 3. Manipulation classifiers: pattern matching for common manipulation tactics
 */

export interface PeerNeighborhoodEntry {
  peerId: string;
  lshBucket: string;
  firstSeen: number;
  lastSeen: number;
  canInitiateContact: boolean;
}

export interface QuarantinedRegion {
  lshBucket: string;
  reason: string;
  quarantinedAt: number;
  expiresAt: number;
}

export interface ManipulationFlag {
  type: 'urgency' | 'isolation' | 'financial' | 'trust_exploitation';
  confidence: number;
  matchedPatterns: string[];
  message: string;
}

const MIN_NEIGHBORHOOD_TTL_MS = 30 * 60 * 1000;
const QUARANTINE_DURATION_MS = 24 * 60 * 60 * 1000;
const ABUSE_THRESHOLD = 5;
const ABUSE_WINDOW_MS = 24 * 60 * 60 * 1000;

const neighborhoodTracker = new Map<string, PeerNeighborhoodEntry>();
const quarantinedRegions = new Map<string, QuarantinedRegion>();
const abuseReportsByBucket = new Map<string, { count: number; windowStart: number }>();

const MANIPULATION_PATTERNS = {
  urgency: [
    /\burgent(ly)?\b/i,
    /\bright now\b/i,
    /\bimmediately\b/i,
    /\bdon'?t tell anyone\b/i,
    /\bkeep (this|it) secret\b/i,
    /\bno time to (waste|think)\b/i,
    /\bact (fast|now|immediately)\b/i,
  ],
  isolation: [
    /\bdon'?t (trust|believe|listen to)\b.*\b(others|anyone|family|friends)\b/i,
    /\bonly (I|me|you) can (help|save|understand)\b/i,
    /\byou (can'?t|cannot) (tell|trust|go to)\b/i,
    /\bthey.?re (lying|against you|trying to|hiding)\b/i,
    /\bdisconnect from\b/i,
  ],
  financial: [
    /\bsend (money|bitcoin|ether|cash|gold)\b/i,
    /\bwire transfer\b/i,
    /\bgift card\b/i,
    /\bwestern union\b/i,
    /\bpay(pal)? (me|venmo|zelle)\b/i,
    /\b(i need|we need).*money\b/i,
    /\bhelp.*(family|emergency|hospital|prison|bail)\b/i,
  ],
  trust_exploitation: [
    /\b(i am|i'?m|we are).*(lawyer|doctor|police|authority|official)\b/i,
    /\btrust me\b/i,
    /\b(i guarantee|i promise|i swear)\b.*\b(safe|legit|real)\b/i,
    /\bverify.*(identity|account|investment)\b/i,
  ],
};

export function trackPeerNeighborhood(peerId: string, lshBucket: string): void {
  const now = Date.now();
  const existing = neighborhoodTracker.get(peerId);

  if (existing) {
    if (existing.lshBucket !== lshBucket) {
      existing.lshBucket = lshBucket;
      existing.firstSeen = now;
      existing.canInitiateContact = false;
    }
    existing.lastSeen = now;
  } else {
    neighborhoodTracker.set(peerId, {
      peerId,
      lshBucket,
      firstSeen: now,
      lastSeen: now,
      canInitiateContact: false,
    });
  }
}

export function canPeerInitiateContact(peerId: string): boolean {
  const entry = neighborhoodTracker.get(peerId);
  if (!entry) return true;

  const elapsed = Date.now() - entry.firstSeen;
  return elapsed >= MIN_NEIGHBORHOOD_TTL_MS;
}

export function canContactBeInitiated(
  peerId: string,
  targetLshBucket: string
): { allowed: boolean; reason?: string } {
  const region = quarantinedRegions.get(targetLshBucket);
  if (region && region.expiresAt > Date.now()) {
    return { allowed: false, reason: 'Region temporarily quarantined due to abuse reports' };
  }

  const entry = neighborhoodTracker.get(peerId);
  if (entry) {
    const elapsed = Date.now() - entry.firstSeen;
    if (elapsed < MIN_NEIGHBORHOOD_TTL_MS) {
      const remaining = Math.ceil((MIN_NEIGHBORHOOD_TTL_MS - elapsed) / 60000);
      return {
        allowed: false,
        reason: `Contact allowed after ${remaining} more minutes in this region`,
      };
    }
  }

  return { allowed: true };
}

export function reportAbuse(lshBucket: string, reporterId: string): void {
  const now = Date.now();
  let stats = abuseReportsByBucket.get(lshBucket);

  if (!stats || now - stats.windowStart > ABUSE_WINDOW_MS) {
    stats = { count: 0, windowStart: now };
    abuseReportsByBucket.set(lshBucket, stats);
  }

  stats.count++;

  if (stats.count >= ABUSE_THRESHOLD) {
    quarantineRegion(lshBucket, 'High volume of abuse reports in this semantic region');
  }
}

export function quarantineRegion(lshBucket: string, reason: string): void {
  const now = Date.now();
  const existing = quarantinedRegions.get(lshBucket);

  if (existing && existing.expiresAt > now) {
    existing.expiresAt = now + QUARANTINE_DURATION_MS;
    existing.reason = reason;
  } else {
    quarantinedRegions.set(lshBucket, {
      lshBucket,
      reason,
      quarantinedAt: now,
      expiresAt: now + QUARANTINE_DURATION_MS,
    });
  }

  console.warn(`[PredatorMitigation] Quarantined region ${lshBucket}: ${reason}`);
}

export function isRegionQuarantined(lshBucket: string): boolean {
  const region = quarantinedRegions.get(lshBucket);
  return !!region && region.expiresAt > Date.now();
}

export function getQuarantinedRegions(): QuarantinedRegion[] {
  const now = Date.now();
  const active: QuarantinedRegion[] = [];
  for (const region of quarantinedRegions.values()) {
    if (region.expiresAt > now) {
      active.push(region);
    }
  }
  return active;
}

export function classifyMessage(message: string): ManipulationFlag | null {
  const matchedPatterns: string[] = [];
  let detectedType: ManipulationFlag['type'] | null = null;
  let maxConfidence = 0;

  for (const [type, patterns] of Object.entries(MANIPULATION_PATTERNS) as [
    ManipulationFlag['type'],
    RegExp[],
  ][]) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        matchedPatterns.push(pattern.source);
        const confidence = matchedPatterns.length / patterns.length;
        if (confidence > maxConfidence) {
          maxConfidence = confidence;
          detectedType = type;
        }
      }
    }
  }

  if (!detectedType || matchedPatterns.length === 0) {
    return null;
  }

  return {
    type: detectedType,
    confidence: Math.min(maxConfidence, 1),
    matchedPatterns: [...new Set(matchedPatterns)],
    message: message.slice(0, 100),
  };
}

export function flagMessage(message: string): {
  flagged: boolean;
  details: ManipulationFlag | null;
} {
  const flag = classifyMessage(message);
  if (flag) {
    console.debug(
      `[PredatorMitigation] Flagged message: ${flag.type} (confidence: ${flag.confidence.toFixed(2)})`
    );
  }
  return { flagged: !!flag, details: flag };
}

export function getPeerNeighborhood(peerId: string): PeerNeighborhoodEntry | undefined {
  return neighborhoodTracker.get(peerId);
}

export function cleanupStaleEntries(): void {
  const now = Date.now();
  const staleThreshold = 7 * 24 * 60 * 60 * 1000;

  for (const [peerId, entry] of neighborhoodTracker.entries()) {
    if (now - entry.lastSeen > staleThreshold) {
      neighborhoodTracker.delete(peerId);
    }
  }

  for (const [lshBucket, region] of quarantinedRegions.entries()) {
    if (region.expiresAt <= now) {
      quarantinedRegions.delete(lshBucket);
    }
  }

  for (const [lshBucket, stats] of abuseReportsByBucket.entries()) {
    if (now - stats.windowStart > ABUSE_WINDOW_MS) {
      abuseReportsByBucket.delete(lshBucket);
    }
  }
}

export function getMitigationStats(): {
  trackedPeers: number;
  quarantinedRegions: number;
  abuseReportsByBucket: Record<string, number>;
} {
  const abuseMap: Record<string, number> = {};
  for (const [bucket, stats] of abuseReportsByBucket.entries()) {
    if (Date.now() - stats.windowStart <= ABUSE_WINDOW_MS) {
      abuseMap[bucket] = stats.count;
    }
  }

  return {
    trackedPeers: neighborhoodTracker.size,
    quarantinedRegions: quarantinedRegions.size,
    abuseReportsByBucket: abuseMap,
  };
}
