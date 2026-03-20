import { PostProtocol } from '../protocol/post.js';
import type { Libp2p } from 'libp2p';
import type { PostData } from '@isc/network';

export class PostSyncService {
  private protocol: PostProtocol;
  private receivedPosts = new Map<string, PostData>();
  private syncInProgress = new Set<string>();

  constructor(node: Libp2p, postService: any) {
    this.protocol = new PostProtocol(node, {
      onHistoricalPost: (post) => this.handleHistoricalPost(post),
      onSyncRequest: (channelId) => this.getPostsForChannel(channelId, postService),
    });

    // Also need to register handler for incoming streams
    node.handle('/isc/post/1.0.0', (event: any) => {
      this.protocol.handleStream(event.stream).catch(console.error);
    });
  }

  async requestHistoricalPosts(peerId: string, channelId: string): Promise<void> {
    // Prevent concurrent syncs for same channel
    if (this.syncInProgress.has(channelId)) {
      console.log('Sync already in progress for channel:', channelId);
      return;
    }

    this.syncInProgress.add(channelId);
    try {
      await this.protocol.requestHistoricalPosts(peerId, channelId);
    } catch (error) {
      console.error('Error during historical post request:', error);
    } finally {
      this.syncInProgress.delete(channelId);
    }
  }

  private handleHistoricalPost(post: PostData): void {
    // Deduplicate by ID
    if (!this.receivedPosts.has(post.id)) {
      this.receivedPosts.set(post.id, post);
      this.savePost(post).catch(console.error);
    }
  }

  private async getPostsForChannel(channelId: string, postService: any): Promise<PostData[]> {
    return postService.getPostsByChannel(channelId);
  }

  private async savePost(post: PostData): Promise<void> {
    const { getDB, dbPut } = await import('../db/factory.js');
    const db = await getDB('isc-posts', 1, ['posts']);
    await dbPut(db, 'posts', post);
  }
}

let _instance: PostSyncService | null = null;
export function getPostSyncService(node: Libp2p, postService: any): PostSyncService {
  if (!_instance) _instance = new PostSyncService(node, postService);
  return _instance;
}
