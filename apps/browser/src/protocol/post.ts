/**
 * Historical Post Sync Protocol - /isc/post/1.0
 * Matches Java's PostProtocol with SYNC_REQUEST pattern
 *
 * @see java/src/main/java/network/isc/protocol/PostProtocol.java
 * @see java/src/main/java/network/isc/controllers/ChatController.java#155
 */

import type { Libp2p } from 'libp2p';
import { toString, fromString } from 'uint8arrays';
import type { PostData } from '@isc/network';

const PROTOCOL_POST = '/isc/post/1.0.0';
const MAX_HISTORY_POSTS = 100;

interface PostCallbacks {
  onHistoricalPost?: (post: PostData) => void;
  onSyncRequest?: (channelId: string) => Promise<PostData[]>;
}

interface ISCStream {
  sink(source: AsyncIterable<Uint8Array>): Promise<void>;
  source: AsyncIterable<Uint8Array>;
  close(): Promise<void>;
}

export class PostProtocol {
  private node: Libp2p;
  private callbacks: PostCallbacks;

  constructor(node: Libp2p, callbacks: PostCallbacks) {
    this.node = node;
    this.callbacks = callbacks;
  }

  async requestHistoricalPosts(peerId: string, channelId: string): Promise<void> {
    const stream = (await this.node.dialProtocol(
      peerId as any,
      PROTOCOL_POST
    )) as unknown as ISCStream;

    await stream.sink(
      (async function* () {
        yield fromString(
          JSON.stringify({
            type: 'SYNC_REQUEST',
            channelId,
            timestamp: Date.now(),
          }) + '\n',
          'utf-8'
        );
      })()
    );

    let count = 0;
    let buffer = '';
    for await (const chunk of stream.source) {
      if (count >= MAX_HISTORY_POSTS) break;

      buffer += toString(chunk, 'utf-8');
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const post = JSON.parse(line);
          if (this.callbacks.onHistoricalPost) {
            this.callbacks.onHistoricalPost(post);
            count++;
          }
        } catch (e) {
          console.error('Failed to parse post response', e, line);
        }
      }
    }
    await stream.close();
  }

  async handleStream(stream: ISCStream): Promise<void> {
    try {
      let buffer = '';
      for await (const chunk of stream.source) {
        buffer += toString(chunk, 'utf-8');
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === 'SYNC_REQUEST') {
              await this.handleSyncRequest(stream, data.channelId);
              return;
            } else if (this.callbacks.onHistoricalPost) {
              this.callbacks.onHistoricalPost(data);
            }
          } catch (e) {
            console.error('Failed to parse post chunk', e, line);
          }
        }
      }
    } finally {
      await stream.close();
    }
  }

  private async handleSyncRequest(stream: ISCStream, channelId: string): Promise<void> {
    if (!this.callbacks.onSyncRequest) {
      await stream.close();
      return;
    }
    const posts = await this.callbacks.onSyncRequest(channelId);

    await stream.sink(
      (async function* () {
        for (const post of posts.slice(0, MAX_HISTORY_POSTS)) {
          yield fromString(JSON.stringify(post) + '\n', 'utf-8');
        }
      })()
    );
    await stream.close();
  }
}
