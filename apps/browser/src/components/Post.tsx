import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { SignedPost } from '../social/types.js';
import { likePost, repostPost, replyToPost } from '../social/index.js';
import { toast } from '../utils/toast.js';
import { useDependencies } from '../di/container.js';

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
  const { networkService } = useDependencies();

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

  const handleFileDownload = async (hash: string) => {
    try {
      const node = networkService?.getNode?.();
      if (!node) {
        toast.error('Network not connected');
        return;
      }
      toast.info('Downloading file...');
      const { getFileTransferService } = await import('../services/fileTransferService.js');
      const service = getFileTransferService(node);
      // Determine peer. For now, try to use post's author, or discovery if needed
      // Actually we need the peerId of the author
      const peerId = post.authorId || post.author;
      const blob = await service.downloadFile(peerId, hash);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `file-${hash.slice(0, 8)}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('File downloaded');
    } catch (err) {
      console.error(err);
      toast.error('Failed to download file');
    }
  };

  const renderContent = (content: string) => {
    const fileMatch = content.match(/\[FILE:([a-f0-9]+)\]/);

    return (
      <p style={STYLES.content}>
        {content.replace(/\[FILE:[a-f0-9]+\]/, '')}
        {fileMatch && (
          <a
            href={`#file:${fileMatch[1]}`}
            onClick={(e) => {
              e.preventDefault();
              handleFileDownload(fileMatch[1]);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              color: '#1da1f2',
              textDecoration: 'none',
              padding: '4px 8px',
              background: '#e8f4fd',
              borderRadius: '4px',
              fontSize: '13px',
              marginLeft: '8px',
            }}
            data-testid="file-download-link"
          >
            📎 Download Attachment
          </a>
        )}
      </p>
    );
  };

  return (
    <article class="post" style={STYLES.post}>
      <header style={STYLES.header}>
        <span style={STYLES.author}>{post.author.slice(0, 16)}...</span>
        <time style={STYLES.time}>{formatDate(post.timestamp)}</time>
      </header>
      {renderContent(post.content)}
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
