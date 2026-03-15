/**
 * Post List Component
 * 
 * Displays a list of posts with engagement actions.
 */

import { h } from 'preact';
import type { Post } from '../types/extended.js';
import { formatPostTimestamp, computeEngagementScore } from '../services/postService.js';

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
};

export function PostList({ posts, onRefresh }: PostListProps) {
  const handleLike = async (postId: string) => {
    // TODO: Implement like
    console.log('Like post:', postId);
  };

  const handleRepost = async (postId: string) => {
    // TODO: Implement repost
    console.log('Repost:', postId);
  };

  const handleReply = async (postId: string) => {
    // TODO: Implement reply navigation
    console.log('Reply to:', postId);
  };

  if (posts.length === 0) {
    return null;
  }

  return (
    <div style={styles.list} data-testid="post-list">
      {posts.map((post) => (
        <PostItem
          key={post.id}
          post={post}
          onLike={handleLike}
          onRepost={handleRepost}
          onReply={handleReply}
        />
      ))}
    </div>
  );
}

interface PostItemProps {
  post: Post;
  onLike: (postId: string) => void;
  onRepost: (postId: string) => void;
  onReply: (postId: string) => void;
}

function PostItem({ post, onLike, onRepost, onReply }: PostItemProps) {
  const engagementScore = computeEngagementScore(post);
  const likeCount = post.likeCount || 0;
  const repostCount = post.repostCount || 0;
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
          style={styles.actionButton}
          onClick={() => onLike(post.id)}
          data-testid="post-like"
          title="Like"
        >
          ❤️ <span data-testid="post-like-count">{likeCount}</span>
        </button>

        <button
          style={styles.actionButton}
          onClick={() => onRepost(post.id)}
          data-testid="post-repost"
          title="Repost"
        >
          🔄 <span data-testid="post-repost-count">{repostCount}</span>
        </button>

        <button
          style={styles.actionButton}
          onClick={() => onReply(post.id)}
          data-testid="post-reply"
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
    </article>
  );
}
