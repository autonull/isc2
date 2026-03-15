/**
 * Compose Post Component
 *
 * Allows users to create new posts in a channel.
 */

import { h } from 'preact';
import { useState } from 'preact/hooks';
import { usePostService } from '../di/container.js';
import { toast } from '../utils/toast.js';

interface ComposePostProps {
  channelId?: string;
  onSuccess?: () => void;
}

const styles = {
  container: { background: 'white', borderRadius: '12px', padding: '16px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } as const,
  textarea: { 
    width: '100%', 
    minHeight: '80px', 
    padding: '12px', 
    border: '1px solid #e1e8ed', 
    borderRadius: '8px', 
    fontSize: '15px', 
    fontFamily: 'inherit',
    resize: 'vertical' as const,
    marginBottom: '12px',
  } as const,
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as const,
  charCount: { fontSize: '12px', color: '#657786' } as const,
  submitButton: { 
    padding: '8px 20px', 
    background: '#1da1f2', 
    color: 'white', 
    border: 'none', 
    borderRadius: '20px', 
    fontSize: '14px', 
    fontWeight: 'bold' as const, 
    cursor: 'pointer',
  } as const,
  submitButtonDisabled: { 
    padding: '8px 20px', 
    background: '#aab8c2', 
    color: 'white', 
    border: 'none', 
    borderRadius: '20px', 
    fontSize: '14px', 
    fontWeight: 'bold' as const, 
    cursor: 'not-allowed',
  } as const,
  error: { color: '#e0245e', fontSize: '12px', marginTop: '8px' } as const,
  success: { color: '#17bf63', fontSize: '12px', marginTop: '8px' } as const,
};

const MAX_LENGTH = 500;

export function ComposePost({ channelId, onSuccess }: ComposePostProps) {
  const postService = usePostService();
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const remainingChars = MAX_LENGTH - content.length;
  const canSubmit = content.trim().length > 0 && content.length <= MAX_LENGTH && !submitting;

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    if (!canSubmit) return;

    if (!channelId) {
      const msg = 'Please select a channel first';
      setError(msg);
      toast.warning(msg);
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      await postService?.createPost({
        content: content.trim(),
        channelId,
      });

      setContent('');
      setSuccess(true);
      toast.success('Post created!');
      onSuccess?.();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create post';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTextChange = (e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    setContent(target.value);
  };

  return (
    <div style={styles.container} data-testid="compose-post">
      <form onSubmit={handleSubmit}>
        <textarea
          style={styles.textarea}
          placeholder="What's happening?"
          value={content}
          onInput={handleTextChange}
          maxLength={MAX_LENGTH + 1}
          data-testid="compose-post-textarea"
        />

        <div style={styles.footer}>
          <div>
            <span style={{
              ...styles.charCount,
              color: remainingChars < 20 ? '#e0245e' : remainingChars < 50 ? '#ffad1f' : '#657786',
            }}>
              {remainingChars}
            </span>
            {error && <div style={styles.error} data-testid="compose-error">{error}</div>}
            {success && <div style={styles.success} data-testid="compose-success">Post created!</div>}
          </div>

          <button
            type="submit"
            style={canSubmit ? styles.submitButton : styles.submitButtonDisabled}
            disabled={!canSubmit}
            data-testid="submit-post"
          >
            {submitting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </form>
    </div>
  );
}
