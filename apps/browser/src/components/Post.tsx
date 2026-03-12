import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { SignedPost } from '../social/types.js';
import { likePost, repostPost, replyToPost } from '../social/index.js';

interface PostProps {
  post: SignedPost;
  showActions?: boolean;
  onReply?: (replyId: string) => void;
}

const STYLES = {
  post: { padding: '12px 16px', borderBottom: '1px solid #e1e8ed' },
  header: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px' },
  author: { fontWeight: 'bold', fontSize: '14px' },
  time: { color: '#657786', fontSize: '12px' },
  content: { fontSize: '15px', lineHeight: 1.5, marginBottom: '12px' },
  footer: { display: 'flex', flexDirection: 'column', gap: '8px' },
  actions: { display: 'flex', gap: '24px' },
  actionBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#657786', padding: '4px 0' },
  replyBox: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' },
  textarea: { width: '100%', padding: '8px', border: '1px solid #e1e8ed', borderRadius: '4px', fontSize: '14px', resize: 'vertical' },
  replyBtn: { alignSelf: 'flex-end', padding: '6px 16px', background: '#1da1f2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' },
} as const;

function formatDate(timestamp: number): string {
  const hours = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function Post({ post, showActions = true, onReply }: PostProps) {
  const [counts, setCounts] = useState({ likes: 0, reposts: 0, replies: 0, quotes: 0 });
  const [liked, setLiked] = useState(false);
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyContent, setReplyContent] = useState('');

  const handleLike = async () => {
    if (liked) return;
    await likePost(post.id);
    setLiked(true);
    setCounts((c) => ({ ...c, likes: c.likes + 1 }));
  };

  const handleRepost = async () => {
    await repostPost(post.id);
    setCounts((c) => ({ ...c, reposts: c.reposts + 1 }));
  };

  const handleReply = async () => {
    if (!replyContent.trim()) return;
    await replyToPost(post.id, replyContent, post.channelID);
    setReplyContent('');
    setShowReplyBox(false);
    setCounts((c) => ({ ...c, replies: c.replies + 1 }));
    onReply?.(post.id);
  };

  return (
    <article class="post" style={STYLES.post}>
      <header style={STYLES.header}>
        <span style={STYLES.author}>{post.author.slice(0, 16)}...</span>
        <time style={STYLES.time}>{formatDate(post.timestamp)}</time>
      </header>
      <p style={STYLES.content}>{post.content}</p>
      {showActions && (
        <footer style={STYLES.footer}>
          <div style={STYLES.actions}>
            <button
              onClick={handleLike}
              style={{ ...STYLES.actionBtn, color: liked ? '#e0245e' : '#657786' }}
              disabled={liked}
            >
              ♥ {counts.likes}
            </button>
            <button onClick={handleRepost} style={STYLES.actionBtn}>
              ⟳ {counts.reposts}
            </button>
            <button onClick={() => setShowReplyBox(!showReplyBox)} style={STYLES.actionBtn}>
              💬 {counts.replies}
            </button>
          </div>
          {showReplyBox && (
            <div style={STYLES.replyBox}>
              <textarea
                value={replyContent}
                onInput={(e) => setReplyContent((e.target as HTMLTextAreaElement).value)}
                placeholder="Write a reply..."
                style={STYLES.textarea}
                rows={2}
              />
              <button onClick={handleReply} style={STYLES.replyBtn}>
                Reply
              </button>
            </div>
          )}
        </footer>
      )}
    </article>
  );
}
