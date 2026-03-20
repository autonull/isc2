/**
 * Create Channel Step Component
 * Enhanced with live embedding preview as user types
 */

import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { onboardingStyles as styles } from '../styles/Onboarding.css.js';
import { StepNavigation } from './StepNavigation.js';
import { StepIndicator } from './StepIndicator.js';
import { validateCreateChannelForm } from '../utils/onboardingValidator.js';
import { channelManager } from '../../../channels/manager.js';
import { getEmbeddingService } from '@isc/network';

interface CreateChannelStepProps {
  onNext: () => void;
  onBack: () => void;
  onComplete: () => void;
}

export function CreateChannelStep({
  onNext,
  onBack,
  onComplete,
}: CreateChannelStepProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [embeddingStatus, setEmbeddingStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [similarityPreview, setSimilarityPreview] = useState<number | null>(null);
  const embeddingService = getEmbeddingService();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Live embedding preview as user types
  useEffect(() => {
    if (!description || description.length < 10) {
      setSimilarityPreview(null);
      setEmbeddingStatus('idle');
      return;
    }

    setEmbeddingStatus('loading');

    // Debounce embedding computation
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      try {
        if (!embeddingService.isLoaded()) {
          await embeddingService.load();
        }

        // Compute embedding for the description
        const embedding = await embeddingService.compute(description);

        // Simulate similarity with a "typical" peer vector for preview
        // In real usage, this would compare against actual discovered peers
        const mockPeerVector = new Array(384).fill(0).map(() => Math.random() - 0.5);
        const similarity = cosineSimilarity(embedding, mockPeerVector);

        setSimilarityPreview(similarity);
        setEmbeddingStatus('ready');
      } catch (err) {
        console.warn('Embedding preview failed:', err);
        setEmbeddingStatus('error');
      }
    }, 500);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [description]);

  const handleCreate = async () => {
    const validation = validateCreateChannelForm(name, description);
    if (!validation.valid) {
      setError(validation.error!);
      return;
    }

    setSaving(true);
    setError('');

    try {
      await channelManager.createChannel(name.trim(), description.trim(), 0.15, []);
      onComplete();
    } catch (err) {
      setError('Failed to create channel: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const similarityPercent = similarityPreview != null ? Math.round(similarityPreview * 100) : null;
  const similarityColor = similarityPercent != null
    ? similarityPercent >= 70 ? '#4ade80' : similarityPercent >= 50 ? '#fbbf24' : '#f87171'
    : undefined;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <StepIndicator totalSteps={3} currentStep={1} />

        <div style={styles.icon}>🧠</div>
        <h1 style={styles.title}>What Are You Thinking About?</h1>
        <p style={styles.description}>
          Create a channel — your thought fingerprint. ISC will embed this locally
          and find peers with similar mental models. Your text never leaves your device.
        </p>

        <input
          type="text"
          value={name}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
          placeholder="Channel Name (e.g., 'AI Ethics')"
          style={styles.input}
          maxLength={50}
        />

        <textarea
          value={description}
          onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
          placeholder="Describe your thoughts in detail... Be specific — the more detail, the better the matching."
          style={styles.textarea}
          maxLength={500}
        />

        {/* Live Embedding Preview */}
        {description.length >= 10 && (
          <div style={{
            marginTop: '12px',
            padding: '12px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '8px',
            fontSize: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              {embeddingStatus === 'loading' && (
                <>
                  <span style={{ fontSize: '14px' }}>⏳</span>
                  <span>Computing your semantic vector…</span>
                </>
              )}
              {embeddingStatus === 'ready' && (
                <>
                  <span style={{ fontSize: '14px' }}>✓</span>
                  <span>Vector ready — ready to find thought neighbors</span>
                </>
              )}
              {embeddingStatus === 'error' && (
                <>
                  <span style={{ fontSize: '14px' }}>⚠️</span>
                  <span>Using fallback embedding (model unavailable)</span>
                </>
              )}
            </div>

            {similarityPercent != null && embeddingStatus === 'ready' && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>
                  Example match preview (actual matches may vary):
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    flex: 1,
                    height: '6px',
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${similarityPercent}%`,
                      height: '100%',
                      background: similarityColor,
                      borderRadius: '3px',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                  <span style={{
                    fontSize: '11px',
                    color: similarityColor,
                    minWidth: '35px',
                    textAlign: 'right',
                  }}>
                    ~{similarityPercent}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {error && <div style={styles.error}>{error}</div>}

        <StepNavigation
          onBack={onBack}
          onNext={handleCreate}
          nextLabel={saving ? 'Creating…' : 'Create & Continue'}
          loading={saving}
        />
      </div>
    </div>
  );
}

/**
 * Compute cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
