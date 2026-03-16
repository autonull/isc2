/**
 * Post List Component
 *
 * Displays a list of posts with engagement actions.
 */

import { h } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import type { Post } from '../types/extended.js';
import { formatPostTimestamp, computeEngagementScore } from '../services/postService.js';
import { usePostService } from '../di/container.js';
import { toast } from '../utils/toast.js';

interface PostListProps {
  posts: Post[];
  onRefresh?: () => void;
}

const styles = {
  list: { display: 'flex', flexDirection: 'column' as const, gap: '16px' } as const,
  post: { background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } as const,
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' } as const,
  author: { fontSize: '14px', fontWeight: 'bold', color: '#14171a' } as const,
  timestamp: { fontSize: '12px', color: '#657786' } as const,
  content: { fontSize: '15px', color: '#14171a', lineHeight: 1.5, marginBottom: '12px' } as const,
  actions: { display: 'flex', gap: '24px', borderTop: '1px solid #e1e8ed', paddingTop: '12px' } as const,
  actionButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#657786',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '16px',
    transition: 'background 0.2s',
  } as const,
  actionButtonActive: {
    color: '#e0245e',
    background: 'rgba(224, 36, 94, 0.1)',
  } as const,
};

export function PostList({ posts, onRefresh }: PostListProps) {
  const postService = usePostService();
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [repostedPosts, setRepostedPosts] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  const handleLike = useCallback(async (postId: string) => {
    try {
      await postService?.likePost(postId);
      setLikedPosts(prev => {
        const next = new Set(prev);
        if (next.has(postId)) {
          next.delete(postId);
        } else {
          next.add(postId);
        }
        return next;
      });
      onRefresh?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to like post');
    }
  }, [postService, onRefresh]);

  const handleRepost = useCallback(async (postId: string) => {
    try {
      await postService?.repostPost(postId);
      setRepostedPosts(prev => new Set(prev).add(postId));
      toast.success('Reposted!');
      onRefresh?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to repost');
    }
  }, [postService, onRefresh]);

  const handleReply = useCallback(async (postId: string) => {
    if (!replyContent.trim()) return;
    try {
      await postService?.replyToPost(postId, replyContent.trim());
      setReplyingTo(null);
      setReplyContent('');
      toast.success('Reply posted!');
      onRefresh?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reply');
    }
  }, [postService, onRefresh, replyContent]);

  if (posts.length === 0) {
    return null;
  }

  return (
    <div style={styles.list} data-testid="post-list">
      {posts.map((post) => (
        <PostItem
          key={post.id}
          post={post}
          liked={likedPosts.has(post.id)}
          reposted={repostedPosts.has(post.id)}
          onLike={() => handleLike(post.id)}
          onRepost={() => handleRepost(post.id)}
          onReply={() => setReplyingTo(replyingTo === post.id ? null : post.id)}
          replying={replyingTo === post.id}
          replyContent={replyContent}
          onReplyContentChange={setReplyContent}
          onSubmitReply={() => handleReply(post.id)}
        />
      ))}
    </div>
  );
}

interface PostItemProps {
  post: Post;
  liked: boolean;
  reposted: boolean;
  onLike: () => void;
  onRepost: () => void;
  onReply: () => void;
  replying: boolean;
  replyContent: string;
  onReplyContentChange: (content: string) => void;
  onSubmitReply: () => void;
}

function PostItem({
  post,
  liked,
  reposted,
  onLike,
  onRepost,
  onReply,
  replying,
  replyContent,
  onReplyContentChange,
  onSubmitReply,
}: PostItemProps) {
  const engagementScore = computeEngagementScore(post);
  const likeCount = (post.likeCount || 0) + (liked ? 1 : 0);
  const repostCount = (post.repostCount || 0) + (reposted ? 1 : 0);
  const replyCount = post.replyCount || 0;

  return (
    <article
      style={styles.post}
      data-testid="post"
      data-post-id={post.id}
    >
      <div style={styles.header}>
        <span style={styles.author} data-testid="post-author">
          @{post.author.slice(0, 8)}
        </span>
        <span style={styles.timestamp} data-testid="post-timestamp">
          {formatPostTimestamp(post.timestamp)}
        </span>
      </div>

      <p style={styles.content} data-testid="post-content">
        {post.content}
      </p>

      <div style={styles.actions}>
        <button
          style={{
            ...styles.actionButton,
            ...(liked ? styles.actionButtonActive : {}),
          }}
          onClick={onLike}
          data-testid="post-like"
          data-active={liked}
          title="Like"
        >
          ❤️ <span data-testid="post-like-count">{likeCount}</span>
        </button>

        <button
          style={{
            ...styles.actionButton,
            ...(reposted ? { color: '#17bf63', background: 'rgba(23, 191, 99, 0.1)' } : {}),
          }}
          onClick={onRepost}
          data-testid="post-repost"
          data-active={reposted}
          title="Repost"
        >
          🔄 <span data-testid="post-repost-count">{repostCount}</span>
        </button>

        <button
          style={{
            ...styles.actionButton,
            ...(replying ? { color: '#1da1f2', background: 'rgba(29, 161, 242, 0.1)' } : {}),
          }}
          onClick={onReply}
          data-testid="post-reply"
          data-active={replying}
          title="Reply"
        >
          💬 <span data-testid="post-reply-count">{replyCount}</span>
        </button>

        {engagementScore > 0 && (
          <span style={{ ...styles.actionButton, cursor: 'default' }} title="Engagement score">
            📊 {engagementScore}
          </span>
        )}
      </div>

      {replying && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e1e8ed' }} data-testid="reply-form">
          <textarea
            style={{
              width: '100%',
              minHeight: '60px',
              padding: '8px',
              border: '1px solid #e1e8ed',
              borderRadius: '8px',
              fontSize: '14px',
              resize: 'vertical' as const,
            }}
            placeholder="Write a reply..."
            value={replyContent}
            onInput={(e) => onReplyContentChange((e.target as HTMLTextAreaElement).value)}
            data-testid="reply-textarea"
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
            <button
              onClick={onReply}
              style={{
                padding: '6px 12px',
                background: '#e1e8ed',
                border: 'none',
                borderRadius: '16px',
                cursor: 'pointer',
              }}
              data-testid="reply-cancel"
            >
              Cancel
            </button>
            <button
              onClick={onSubmitReply}
              disabled={!replyContent.trim()}
              style={{
                padding: '6px 16px',
                background: replyContent.trim() ? '#1da1f2' : '#aab8c2',
                color: 'white',
                border: 'none',
                borderRadius: '16px',
                cursor: replyContent.trim() ? 'pointer' : 'not-allowed',
              }}
              data-testid="reply-submit"
            >
              Reply
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
