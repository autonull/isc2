import { h } from 'preact';
import { useState } from 'preact/hooks';
import { createPost } from '../social/index.js';
import type { Channel } from '@isc/core';

interface ComposePostProps {
  channel?: Channel | null;
  onPost?: (postId: string) => void;
  onCancel?: () => void;
}

const MAX_LENGTH = 500;

const styles = {
  form: { padding: '16px', borderBottom: '1px solid #e1e8ed' } as const,
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' } as const,
  channel: { fontSize: '14px', color: '#1da1f2', fontWeight: 500 } as const,
  cancelBtn: { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#657786', padding: '4px 8px' } as const,
  textarea: { width: '100%', padding: '12px', border: '1px solid #e1e8ed', borderRadius: '4px', fontSize: '15px', resize: 'vertical' as const, fontFamily: 'inherit', marginBottom: '12px' } as const,
  footer: { display: 'flex', alignItems: 'center', gap: '16px' } as const,
  counter: { fontSize: '14px' } as const,
  counterText: { fontWeight: 500 } as const,
  error: { color: '#e0245e', fontSize: '14px', flex: 1 } as const,
  postBtn: { padding: '8px 20px', background: '#1da1f2', color: 'white', border: 'none', borderRadius: '4px', fontSize: '15px', fontWeight: 'bold' as const } as const,
};

export function ComposePost({ channel, onPost, onCancel }: ComposePostProps) {
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = MAX_LENGTH - content.length;
  const isOverLimit = remaining < 0;
  const canPost = content.trim().length > 0 && !isOverLimit && !posting;

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!canPost || !channel) return;
    setPosting(true);
    setError(null);
    try {
      const post = await createPost(content.trim(), channel.id);
      setContent('');
      onPost?.(post.id);
    } catch {
      setError('Failed to post');
    } finally {
      setPosting(false);
    }
  };

  const handleCancel = () => {
    setContent('');
    setError(null);
    onCancel?.();
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.header}>
        <span style={styles.channel}>{channel ? `Posting in ${channel.name}` : 'Select a channel'}</span>
        {onCancel && <button type="button" onClick={handleCancel} style={styles.cancelBtn}>✕</button>}
      </div>
      <textarea
        value={content}
        onInput={(e) => setContent((e.target as HTMLTextAreaElement).value)}
        placeholder="What's on your mind?"
        style={{ ...styles.textarea, borderColor: isOverLimit ? '#e0245e' : '#e1e8ed' }}
        rows={4}
        maxLength={MAX_LENGTH + 50}
        disabled={posting}
      />
      <div style={styles.footer}>
        <div style={styles.counter}>
          <span style={{ ...styles.counterText, color: remaining < 20 ? (isOverLimit ? '#e0245e' : '#ffad1f') : '#657786' }}>{remaining}</span>
        </div>
        {error && <span style={styles.error}>{error}</span>}
        <button
          type="submit"
          disabled={!canPost || posting}
          style={{ ...styles.postBtn, opacity: canPost && !posting ? 1 : 0.5, cursor: canPost && !posting ? 'pointer' : 'not-allowed' }}
        >
          {posting ? 'Posting...' : 'Post'}
        </button>
      </div>
    </form>
  );
}
