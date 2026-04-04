/* eslint-disable */
import { describe, it, expect, vi } from 'vitest';
import { PostProtocol } from '../../src/protocol/post.js';

describe('PostProtocol', () => {
  it('should request historical posts', async () => {
    // Mock sink and source
    const mockSink = vi.fn();
    const mockSource = [
      new TextEncoder().encode(JSON.stringify({ id: '1', content: 'test 1', type: 'POST' }) + '\n'),
      new TextEncoder().encode(JSON.stringify({ id: '2', content: 'test 2', type: 'POST' }) + '\n'),
    ];

    const mockStream = {
      sink: mockSink,
      source: mockSource,
      close: vi.fn(),
    };

    const mockNode = {
      dialProtocol: vi.fn().mockResolvedValue(mockStream),
    };

    const onHistoricalPost = vi.fn();
    const protocol = new PostProtocol(mockNode as any, { onHistoricalPost });

    await protocol.requestHistoricalPosts('peer1', 'channel1');

    expect(mockNode.dialProtocol).toHaveBeenCalledWith('peer1', '/isc/post/1.0.0');
    expect(mockSink).toHaveBeenCalled();
    expect(onHistoricalPost).toHaveBeenCalledTimes(2);
    expect(mockStream.close).toHaveBeenCalled();
  });

  it('should limit history to MAX_HISTORY_POSTS', async () => {
    const mockSink = vi.fn();

    // Create source with more than 100 posts
    const mockSource = Array.from({ length: 110 }).map((_, i) =>
      new TextEncoder().encode(JSON.stringify({ id: String(i), content: `test ${i}` }) + '\n')
    );

    const mockStream = {
      sink: mockSink,
      source: mockSource,
      close: vi.fn(),
    };

    const mockNode = {
      dialProtocol: vi.fn().mockResolvedValue(mockStream),
    };

    const onHistoricalPost = vi.fn();
    const protocol = new PostProtocol(mockNode as any, { onHistoricalPost });

    await protocol.requestHistoricalPosts('peer1', 'channel1');

    // Should stop processing after 100 posts
    expect(onHistoricalPost).toHaveBeenCalledTimes(100);
  });
});
