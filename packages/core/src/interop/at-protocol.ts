/**
 * AT Protocol Bridge
 *
 * Interoperability layer for federated social protocols.
 * Enables cross-posting and content synchronization with
 * AT Protocol-compatible networks.
 *
 * References: NEXT_STEPS.md#91-at-protocol-bridge
 */

import { sign, type Signature } from '../crypto/index.js';
import { encode } from '../encoding.js';
import type { Keypair } from '../crypto/keypair.js';

/**
 * AT Protocol record types
 */
export const RecordTypes = {
  POST: 'app.bsky.feed.post',
  PROFILE: 'app.bsky.actor.profile',
  FOLLOW: 'app.bsky.graph.follow',
  LIKE: 'app.bsky.feed.like',
  REPOST: 'app.bsky.feed.repost',
  BLOCK: 'app.bsky.graph.block',
} as const;

/**
 * AT Protocol record
 */
export interface ATRecord {
  uri: string;
  cid: string;
  value: RecordValue;
  indexedAt: string;
}

/**
 * AT Protocol record value
 */
export interface RecordValue {
  $type: string;
  createdAt: string;
  [key: string]: unknown;
}

/**
 * AT Protocol post record
 */
export interface ATPostRecord extends RecordValue {
  $type: typeof RecordTypes.POST;
  text: string;
  entities?: Array<{
    index: { start: number; end: number };
    type: string;
    value?: string;
  }>;
  reply?: {
    root: { uri: string; cid: string };
    parent: { uri: string; cid: string };
  };
  embed?: {
    $type: string;
    image?: {
      alt: string;
      image: {
        $type: string;
        ref: { $link: string };
        mimeType: string;
        size: number;
      };
    };
  };
}

/**
 * AT Protocol profile record
 */
export interface ATProfileRecord extends RecordValue {
  $type: typeof RecordTypes.PROFILE;
  displayName?: string;
  description?: string;
  avatar?: {
    $type: string;
    image: {
      $type: string;
      ref: { $link: string };
      mimeType: string;
      size: number;
    };
  };
}

/**
 * AT Protocol follow record
 */
export interface ATFollowRecord extends RecordValue {
  $type: typeof RecordTypes.FOLLOW;
  subject: string; // DID of followed user
}

/**
 * AT Protocol like record
 */
export interface ATLikeRecord extends RecordValue {
  $type: typeof RecordTypes.LIKE;
  subject: { uri: string; cid: string };
}

/**
 * AT Protocol repost record
 */
export interface ATRepostRecord extends RecordValue {
  $type: typeof RecordTypes.REPOST;
  subject: { uri: string; cid: string };
}

/**
 * AT Protocol session
 */
export interface ATSession {
  accessJwt: string;
  refreshJwt: string;
  handle: string;
  did: string;
  email?: string;
  emailConfirmed: boolean;
  active: boolean;
}

/**
 * AT Protocol configuration
 */
export interface ATProtocolConfig {
  // Service endpoint
  serviceUrl: string;
  
  // Identity
  handle?: string;
  did?: string;
  signingKey?: Keypair;
  
  // Sync settings
  autoSync: boolean;
  syncInterval: number; // ms
  
  // Content settings
  defaultLanguage: string;
  includeEmbeds: boolean;
}

const DEFAULT_CONFIG: ATProtocolConfig = {
  serviceUrl: 'https://bsky.social',
  autoSync: false,
  syncInterval: 300000, // 5 minutes
  defaultLanguage: 'en',
  includeEmbeds: true,
};

/**
 * AT Protocol client for cross-posting
 */
export class ATProtocolClient {
  private config: ATProtocolConfig;
  private session: ATSession | null = null;
  private syncTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<ATProtocolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create session with AT Protocol service
   */
  async createSession(handle: string, _password: string): Promise<ATSession> {
    // In production, would make actual API call
    // This is a placeholder for the authentication flow
    this.session = {
      accessJwt: 'mock_access_token',
      refreshJwt: 'mock_refresh_token',
      handle,
      did: `did:plc:${crypto.randomUUID()}`,
      email: `${handle}@example.com`,
      emailConfirmed: true,
      active: true,
    };

    return this.session;
  }

  /**
   * Refresh session token
   */
  async refreshSession(): Promise<ATSession> {
    if (!this.session) {
      throw new Error('No active session');
    }

    // In production, would call refresh endpoint
    return this.session;
  }

  /**
   * Create a post record
   */
  createPostRecord(
    text: string,
    options?: {
      replyTo?: { root: { uri: string; cid: string }; parent: { uri: string; cid: string } };
      language?: string;
    }
  ): ATPostRecord {
    const record: ATPostRecord = {
      $type: RecordTypes.POST,
      createdAt: new Date().toISOString(),
      text,
    };

    if (options?.language) {
      record.lang = options.language;
    }

    if (options?.replyTo) {
      record.reply = options.replyTo;
    }

    return record;
  }

  /**
   * Create a profile record
   */
  createProfileRecord(
    displayName?: string,
    description?: string
  ): ATProfileRecord {
    return {
      $type: RecordTypes.PROFILE,
      createdAt: new Date().toISOString(),
      displayName,
      description,
    };
  }

  /**
   * Create a follow record
   */
  createFollowRecord(subject: string): ATFollowRecord {
    return {
      $type: RecordTypes.FOLLOW,
      createdAt: new Date().toISOString(),
      subject,
    };
  }

  /**
   * Create a like record
   */
  createLikeRecord(subjectUri: string, subjectCid: string): ATLikeRecord {
    return {
      $type: RecordTypes.LIKE,
      createdAt: new Date().toISOString(),
      subject: { uri: subjectUri, cid: subjectCid },
    };
  }

  /**
   * Create a repost record
   */
  createRepostRecord(subjectUri: string, subjectCid: string): ATRepostRecord {
    return {
      $type: RecordTypes.REPOST,
      createdAt: new Date().toISOString(),
      subject: { uri: subjectUri, cid: subjectCid },
    };
  }

  /**
   * Sign a record
   */
  async signRecord(
    record: RecordValue,
    keypair: Keypair
  ): Promise<{ record: RecordValue; signature: Signature }> {
    const payload = encode(record);
    const signature = await sign(payload, keypair.privateKey);

    return { record, signature };
  }

  /**
   * Convert ISC post to AT Protocol format
   */
  convertToATPost(
    content: string,
    _timestamp: number,
    options?: {
      language?: string;
      replyTo?: { root: { uri: string; cid: string }; parent: { uri: string; cid: string } };
    }
  ): ATPostRecord {
    return this.createPostRecord(content, {
      language: options?.language || this.config.defaultLanguage,
      replyTo: options?.replyTo,
    });
  }

  /**
   * Convert AT Protocol post to ISC format
   */
  convertFromATPost(record: ATPostRecord): {
    content: string;
    timestamp: number;
    language?: string;
    replyTo?: { root: string; parent: string };
  } {
    return {
      content: record.text,
      timestamp: new Date(record.createdAt).getTime(),
      language: (record as any).lang,
      replyTo: record.reply
        ? {
            root: record.reply.root.uri,
            parent: record.reply.parent.uri,
          }
        : undefined,
    };
  }

  /**
   * Start auto-sync
   */
  startAutoSync(callback: () => Promise<void>): void {
    if (this.syncTimer) {
      this.stopAutoSync();
    }

    this.syncTimer = setInterval(() => {
      callback().catch(console.error);
    }, this.config.syncInterval);
  }

  /**
   * Stop auto-sync
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Get current session
   */
  getSession(): ATSession | null {
    return this.session;
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.session !== null && this.session.active;
  }

  /**
   * Logout
   */
  logout(): void {
    this.session = null;
    this.stopAutoSync();
  }
}

/**
 * Parse AT Protocol URI
 */
export function parseATUri(uri: string): {
  did: string;
  collection: string;
  rkey: string;
} | null {
  const match = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (!match) return null;

  return {
    did: match[1],
    collection: match[2],
    rkey: match[3],
  };
}

/**
 * Build AT Protocol URI
 */
export function buildATUri(did: string, collection: string, rkey: string): string {
  return `at://${did}/${collection}/${rkey}`;
}

/**
 * Validate AT Protocol handle
 */
export function isValidHandle(handle: string): boolean {
  // Basic handle validation
  return /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(handle) && handle.length >= 3;
}

/**
 * Validate AT Protocol DID
 */
export function isValidDID(did: string): boolean {
  return /^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/.test(did);
}

/**
 * Extract mentions from text
 */
export function extractMentions(text: string): Array<{
  handle: string;
  start: number;
  end: number;
}> {
  const mentions: Array<{ handle: string; start: number; end: number }> = [];
  const mentionRegex = /@([a-z0-9][a-z0-9.-]*[a-z0-9])/gi;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push({
      handle: match[1],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return mentions;
}

/**
 * Extract hashtags from text
 */
export function extractHashtags(text: string): Array<{
  tag: string;
  start: number;
  end: number;
}> {
  const hashtags: Array<{ tag: string; start: number; end: number }> = [];
  const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
  let match;

  while ((match = hashtagRegex.exec(text)) !== null) {
    hashtags.push({
      tag: match[1],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return hashtags;
}

/**
 * Create enriched post with entities
 */
export function createEnrichedPost(
  text: string
): { text: string; entities: Array<{ index: { start: number; end: number }; type: string; value: string }> } {
  const entities: Array<{ index: { start: number; end: number }; type: string; value: string }> = [];

  // Extract mentions
  const mentions = extractMentions(text);
  for (const mention of mentions) {
    entities.push({
      index: { start: mention.start, end: mention.end },
      type: 'mention',
      value: mention.handle,
    });
  }

  // Extract hashtags
  const hashtags = extractHashtags(text);
  for (const hashtag of hashtags) {
    entities.push({
      index: { start: hashtag.start, end: hashtag.end },
      type: 'tag',
      value: hashtag.tag,
    });
  }

  return { text, entities };
}

/**
 * Rate limiter for AT Protocol API calls
 */
export class ATRateLimiter {
  private requests: number[] = [];
  private limit: number;
  private windowMs: number;

  constructor(limit: number = 100, windowMs: number = 60000) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  async throttle(): Promise<void> {
    const now = Date.now();
    
    // Remove old requests
    this.requests = this.requests.filter((t) => now - t < this.windowMs);

    if (this.requests.length >= this.limit) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    this.requests.push(Date.now());
  }
}
