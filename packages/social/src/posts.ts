/**
 * Post Service
 *
 * Business logic for post operations.
 * Storage and identity are injected via adapters.
 */

import type { SignedPost, ScoredPost } from '../types';
import type { SocialStorage, SocialIdentity, SocialNetwork } from '../adapters/interfaces';

export interface CreatePostInput {
  content: string;
  channelId: string;
  replyTo?: string;
}

export interface PostService {
  create(input: CreatePostInput): Promise<SignedPost>;
  get(id: string): Promise<SignedPost | null>;
  getAll(): Promise<ScoredPost[]>;
  getByChannel(channelId: string): Promise<ScoredPost[]>;
  getByAuthor(authorId: string): Promise<SignedPost[]>;
  delete(id: string): Promise<void>;
  like(postId: string): Promise<void>;
  reply(postId: string, content: string): Promise<SignedPost>;
}

export function createPostService(
  storage: SocialStorage,
  identity: SocialIdentity,
  network?: SocialNetwork
): PostService {
  return {
    async create({ content, channelId, replyTo }: CreatePostInput): Promise<SignedPost> {
      const peerId = await identity.getPeerId();

      const post: Omit<SignedPost, 'signature'> = {
        id: `post_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
        author: peerId,
        content,
        channelID: channelId,
        timestamp: Date.now(),
        likes: [],
        replies: [],
        ...(replyTo && { replyTo }),
      };

      // Sign the post
      const payload = new TextEncoder().encode(JSON.stringify(post));
      const signature = await identity.sign(payload);

      const signedPost: SignedPost = { ...post, signature };

      // Save locally
      await storage.savePost(signedPost);

      // Broadcast to network
      if (network) {
        await network.broadcastPost(signedPost);
      }

      return signedPost;
    },

    async get(id: string): Promise<SignedPost | null> {
      const posts = await storage.getPosts();
      return posts.find((p: SignedPost) => p.id === id) ?? null;
    },

    async getAll(): Promise<ScoredPost[]> {
      const posts = await storage.getPosts();
      return scorePosts(posts);
    },

    async getByChannel(channelId: string): Promise<ScoredPost[]> {
      const posts = await storage.getPostsByChannel(channelId);
      return scorePosts(posts);
    },

    async getByAuthor(authorId: string): Promise<SignedPost[]> {
      return storage.getPostsByAuthor(authorId);
    },

    async delete(id: string): Promise<void> {
      await storage.deletePost(id);
    },

    async like(postId: string): Promise<void> {
      const post = await this.get(postId);
      if (!post) throw new Error(`Post not found: ${postId}`);

      const peerId = await identity.getPeerId();
      const likes = post.likes ?? [];

      if (!likes.includes(peerId)) {
        likes.push(peerId);
        const updated: SignedPost = { ...post, likes };
        await storage.savePost(updated);
      }
    },

    async reply(postId: string, content: string): Promise<SignedPost> {
      const parent = await this.get(postId);
      if (!parent) throw new Error(`Post not found: ${postId}`);

      const reply = await this.create({
        content,
        channelId: parent.channelID,
        replyTo: postId,
      });

      // Update parent's reply count
      const replies = parent.replies ?? [];
      if (!replies.includes(reply.id)) {
        replies.push(reply.id);
        const updated: SignedPost = { ...parent, replies };
        await storage.savePost(updated);
      }

      return reply;
    },
  };
}

/**
 * Score posts for feed ranking
 */
function scorePosts(posts: SignedPost[]): ScoredPost[] {
  const now = Date.now();

  return posts.map((post) => {
    let score = 1;

    // Recency boost (decay over 24h)
    const age = now - post.timestamp;
    const recencyBoost = Math.max(0.1, 1 - age / 86_400_000);
    score *= recencyBoost;

    // Engagement boost
    score *= 1 + (post.likes?.length ?? 0) * 0.1;
    score *= 1 + (post.replies?.length ?? 0) * 0.05;

    return { ...post, score };
  });
}

/**
 * Verify post signature
 */
export async function verifyPost(
  post: SignedPost,
  identity: SocialIdentity
): Promise<boolean> {
  const { signature, ...postWithoutSig } = post;
  const payload = new TextEncoder().encode(JSON.stringify(postWithoutSig));

  const publicKey = await identity.getPublicKey();
  if (!publicKey) return false;

  return identity.verify(payload, signature, publicKey);
}

/**
 * Verify multiple posts
 */
export async function verifyPosts(
  posts: SignedPost[],
  identity: SocialIdentity
): Promise<{ valid: SignedPost[]; invalid: SignedPost[] }> {
  const valid: SignedPost[] = [];
  const invalid: SignedPost[] = [];

  for (const post of posts) {
    if (await verifyPost(post, identity)) {
      valid.push(post);
    } else {
      invalid.push(post);
    }
  }

  return { valid, invalid };
}
