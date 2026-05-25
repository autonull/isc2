/* eslint-disable */
/**
 * Social Posts - Environment-agnostic core
 *
 * Provides post creation, signing, and verification logic.
 * Storage and identity are injected via interfaces.
 */

import { sign, encode, verify, Config } from '../index.js';
import type { SignedPost } from './types.js';

/**
 * Storage adapter interface for posts
 */
export interface PostStorage {
  getPost(id: string): Promise<SignedPost | null>;
  getAllPosts(): Promise<SignedPost[]>;
  getPostsByChannel(channelID: string): Promise<SignedPost[]>;
  getPostsByAuthor(author: string): Promise<SignedPost[]>;
  savePost(post: SignedPost): Promise<void>;
  deletePost(id: string): Promise<void>;
}

/**
 * Identity adapter interface
 */
export interface IdentityProvider {
  getPeerID(): Promise<string>;
  getKeypair(): { publicKey: CryptoKey; privateKey: CryptoKey } | null;
  getPeerPublicKey(peerID: string): Promise<CryptoKey | null>;
  announcePublicKey(): Promise<void>;
}

/**
 * Network adapter interface for DHT operations
 */
export interface PostNetwork {
  announce(key: string, value: Uint8Array, ttl: number): Promise<void>;
  query(key: string, limit: number): Promise<SignedPost[]>;
  getInstance(): PostNetwork | null;
}

/**
 * Create and sign a new post
 */
export async function createPost(
  content: string,
  channelID: string,
  storage: PostStorage,
  identity: IdentityProvider,
  network?: PostNetwork | null
): Promise<SignedPost> {
  const peerID = await identity.getPeerID();
  const keypair = identity.getKeypair();

  if (!keypair) {
    throw new Error('Identity not initialized');
  }

  const post: Omit<SignedPost, 'signature'> = {
    id: `post_${crypto.randomUUID()}`,
    author: peerID,
    content,
    channelID,
    timestamp: Date.now(),
  };

  const payload = encode(post);
  const signature = await sign(payload, keypair.privateKey);
  const signedPost: SignedPost = { ...post, signature };

  await storage.savePost(signedPost);

  if (network) {
    const key = `/isc/post/${channelID}/${signedPost.id}`;
    await network.announce(key, encode(signedPost), Config.social.posts.defaultTtlSeconds);
  }

  await identity.announcePublicKey();
  return signedPost;
}

/**
 * Verify post signature
 */
export async function verifyPost(
  post: SignedPost,
  identity: IdentityProvider
): Promise<boolean> {
  try {
    const { signature, ...postWithoutSig } = post;
    const payload = encode(postWithoutSig);

    const publicKey = await identity.getPeerPublicKey(post.author);
    if (!publicKey) {
      return false;
    }

    return verify(payload, signature, publicKey);
  } catch {
    return false;
  }
}

/**
 * Batch verify multiple posts
 */
export async function verifyPosts(
  posts: SignedPost[],
  identity: IdentityProvider
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();

  for (const post of posts) {
    const isValid = await verifyPost(post, identity);
    results.set(post.id, isValid);
  }

  return results;
}

/**
 * Discover posts from DHT and cache locally
 */
export async function discoverPosts(
  channelID: string,
  storage: PostStorage,
  network: PostNetwork,
  limit: number = 50
): Promise<SignedPost[]> {
  const posts = await network.query(`/isc/post/${channelID}`, limit);

  for (const post of posts) {
    await storage.savePost(post);
  }

  return posts;
}

/**
 * Delete post and announce deletion to DHT
 */
export async function deletePost(
  id: string,
  storage: PostStorage,
  network?: PostNetwork | null
): Promise<void> {
  const post = await storage.getPost(id);

  if (post && network) {
    const key = `/isc/post/${post.channelID}/${id}`;
    await network.announce(key, new Uint8Array(), 0);
  }

  await storage.deletePost(id);
}

/**
 * Post service class for convenience
 */
export class PostService {
  constructor(
    private storage: PostStorage,
    private identity: IdentityProvider,
    private network?: PostNetwork | null
  ) {}

  async create(content: string, channelID: string): Promise<SignedPost> {
    return createPost(content, channelID, this.storage, this.identity, this.network);
  }

  async get(id: string): Promise<SignedPost | null> {
    return this.storage.getPost(id);
  }

  async getAll(): Promise<SignedPost[]> {
    return this.storage.getAllPosts();
  }

  async getByChannel(channelID: string): Promise<SignedPost[]> {
    return this.storage.getPostsByChannel(channelID);
  }

  async getByAuthor(author: string): Promise<SignedPost[]> {
    return this.storage.getPostsByAuthor(author);
  }

  async verify(post: SignedPost): Promise<boolean> {
    return verifyPost(post, this.identity);
  }

  async discover(channelID: string, limit?: number): Promise<SignedPost[]> {
    if (!this.network) {
      return this.storage.getPostsByChannel(channelID);
    }
    return discoverPosts(channelID, this.storage, this.network, limit);
  }

  async delete(id: string): Promise<void> {
    return deletePost(id, this.storage, this.network);
  }
}
