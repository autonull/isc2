import { sign, type Signature } from '../crypto/index.js';
import { encode } from '../encoding.js';
import type { Keypair } from '../crypto/keypair.js';

export const RecordTypes = {
  POST: 'app.bsky.feed.post',
  PROFILE: 'app.bsky.actor.profile',
  FOLLOW: 'app.bsky.graph.follow',
  LIKE: 'app.bsky.feed.like',
  REPOST: 'app.bsky.feed.repost',
  BLOCK: 'app.bsky.graph.block',
} as const;

export interface ATRecord {
  uri: string;
  cid: string;
  value: RecordValue;
  indexedAt: string;
}

export interface RecordValue {
  $type: string;
  createdAt: string;
  [key: string]: unknown;
}

export interface ATPostRecord extends RecordValue {
  $type: typeof RecordTypes.POST;
  text: string;
  entities?: Array<{ index: { start: number; end: number }; type: string; value?: string }>;
  reply?: { root: { uri: string; cid: string }; parent: { uri: string; cid: string } };
  embed?: { $type: string; image?: { alt: string; image: { $type: string; ref: { $link: string }; mimeType: string; size: number } } };
}

export interface ATProfileRecord extends RecordValue {
  $type: typeof RecordTypes.PROFILE;
  displayName?: string;
  description?: string;
  avatar?: { $type: string; image: { $type: string; ref: { $link: string }; mimeType: string; size: number } };
}

export interface ATFollowRecord extends RecordValue {
  $type: typeof RecordTypes.FOLLOW;
  subject: string;
}

export interface ATLikeRecord extends RecordValue {
  $type: typeof RecordTypes.LIKE;
  subject: { uri: string; cid: string };
}

export interface ATRepostRecord extends RecordValue {
  $type: typeof RecordTypes.REPOST;
  subject: { uri: string; cid: string };
}

export interface ATSession {
  accessJwt: string;
  refreshJwt: string;
  handle: string;
  did: string;
  email?: string;
  emailConfirmed: boolean;
  active: boolean;
}

export interface ATProtocolConfig {
  serviceUrl: string;
  handle?: string;
  did?: string;
  signingKey?: Keypair;
  autoSync: boolean;
  syncInterval: number;
  defaultLanguage: string;
  includeEmbeds: boolean;
}

const DEFAULT_CONFIG: ATProtocolConfig = {
  serviceUrl: 'https://bsky.social',
  autoSync: false,
  syncInterval: 300000,
  defaultLanguage: 'en',
  includeEmbeds: true,
};

export class ATProtocolClient {
  private config: ATProtocolConfig;
  private session: ATSession | null = null;
  private syncTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<ATProtocolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async createSession(handle: string, password: string): Promise<ATSession> {
    const url = `${this.config.serviceUrl}/xrpc/com.atproto.server.createSession`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: handle,
          password: password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `AT Protocol login failed: ${response.statusText}`);
      }

      const data = await response.json();

      this.session = {
        accessJwt: data.accessJwt,
        refreshJwt: data.refreshJwt,
        handle: data.handle,
        did: data.did,
        email: data.email,
        emailConfirmed: !!data.emailConfirmed,
        active: true,
      };

      return this.session;
    } catch (err) {
      this.session = null;
      throw err;
    }
  }

  async refreshSession(): Promise<ATSession> {
    if (!this.session) throw new Error('No active session');
    return this.session;
  }

  createPostRecord(text: string, options?: { replyTo?: { root: { uri: string; cid: string }; parent: { uri: string; cid: string } }; language?: string }): ATPostRecord {
    const record: ATPostRecord = {
      $type: RecordTypes.POST,
      createdAt: new Date().toISOString(),
      text,
    };

    if (options?.language) record.lang = options.language;
    if (options?.replyTo) record.reply = options.replyTo;
    return record;
  }

  createProfileRecord(displayName?: string, description?: string): ATProfileRecord {
    return { $type: RecordTypes.PROFILE, createdAt: new Date().toISOString(), displayName, description };
  }

  createFollowRecord(subject: string): ATFollowRecord {
    return { $type: RecordTypes.FOLLOW, createdAt: new Date().toISOString(), subject };
  }

  createLikeRecord(subjectUri: string, subjectCid: string): ATLikeRecord {
    return { $type: RecordTypes.LIKE, createdAt: new Date().toISOString(), subject: { uri: subjectUri, cid: subjectCid } };
  }

  createRepostRecord(subjectUri: string, subjectCid: string): ATRepostRecord {
    return { $type: RecordTypes.REPOST, createdAt: new Date().toISOString(), subject: { uri: subjectUri, cid: subjectCid } };
  }

  async signRecord(record: RecordValue, keypair: Keypair): Promise<{ record: RecordValue; signature: Signature }> {
    const signature = await sign(encode(record), keypair.privateKey);
    return { record, signature };
  }

  convertToATPost(content: string, _timestamp: number, options?: { language?: string; replyTo?: { root: { uri: string; cid: string }; parent: { uri: string; cid: string } } }): ATPostRecord {
    return this.createPostRecord(content, { language: options?.language ?? this.config.defaultLanguage, replyTo: options?.replyTo });
  }

  convertFromATPost(record: ATPostRecord): { content: string; timestamp: number; language?: string; replyTo?: { root: string; parent: string } } {
    return {
      content: record.text,
      timestamp: new Date(record.createdAt).getTime(),
      language: (record as any).lang,
      replyTo: record.reply ? { root: record.reply.root.uri, parent: record.reply.parent.uri } : undefined,
    };
  }

  startAutoSync(callback: () => Promise<void>): void {
    if (this.syncTimer) this.stopAutoSync();
    this.syncTimer = setInterval(() => callback().catch(console.error), this.config.syncInterval);
  }

  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  getSession(): ATSession | null {
    return this.session;
  }

  isAuthenticated(): boolean {
    return this.session !== null && this.session.active;
  }

  logout(): void {
    this.session = null;
    this.stopAutoSync();
  }
}

export function parseATUri(uri: string): { did: string; collection: string; rkey: string } | null {
  const match = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/);
  return match ? { did: match[1], collection: match[2], rkey: match[3] } : null;
}

export function buildATUri(did: string, collection: string, rkey: string): string {
  return `at://${did}/${collection}/${rkey}`;
}

export function isValidHandle(handle: string): boolean {
  return /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(handle) && handle.length >= 3;
}

export function isValidDID(did: string): boolean {
  return /^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/.test(did);
}

export function extractMentions(text: string): Array<{ handle: string; start: number; end: number }> {
  const mentions: Array<{ handle: string; start: number; end: number }> = [];
  const mentionRegex = /@([a-z0-9][a-z0-9.-]*[a-z0-9])/gi;
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push({ handle: match[1], start: match.index, end: match.index + match[0].length });
  }
  return mentions;
}

export function extractHashtags(text: string): Array<{ tag: string; start: number; end: number }> {
  const hashtags: Array<{ tag: string; start: number; end: number }> = [];
  const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
  let match;
  while ((match = hashtagRegex.exec(text)) !== null) {
    hashtags.push({ tag: match[1], start: match.index, end: match.index + match[0].length });
  }
  return hashtags;
}

export function createEnrichedPost(text: string): { text: string; entities: Array<{ index: { start: number; end: number }; type: string; value: string }> } {
  const entities: Array<{ index: { start: number; end: number }; type: string; value: string }> = [];
  for (const mention of extractMentions(text)) {
    entities.push({ index: { start: mention.start, end: mention.end }, type: 'mention', value: mention.handle });
  }
  for (const hashtag of extractHashtags(text)) {
    entities.push({ index: { start: hashtag.start, end: hashtag.end }, type: 'tag', value: hashtag.tag });
  }
  return { text, entities };
}

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
    this.requests = this.requests.filter((t) => now - t < this.windowMs);

    if (this.requests.length >= this.limit) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      if (waitTime > 0) await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.requests.push(Date.now());
  }
}
