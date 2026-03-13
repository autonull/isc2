/**
 * Compose Screen - Create/Edit Channel
 */

import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { channelManager } from '../channels/manager.js';
import { getDHTClient, initializeDHT } from '../network/dht.js';
import { lshHash } from '@isc/core';
import { navigate } from '../router.js';
import { EmbeddingService, isModelLoaded, isModelLoading, getLoadProgress } from '../channels/embedding.js';
import { loggers } from '../utils/logger.js';

const logger = loggers.channel;

interface RelationInput {
  tag: string;
  object: string;
}

const RELATION_OPTIONS = [
  { value: 'in_location', label: '📍 Location', placeholder: 'Where are you thinking this?' },
  { value: 'during_time', label: '🕐 Time', placeholder: 'When is this relevant?' },
  { value: 'with_mood', label: '💭 Mood', placeholder: 'What\'s the emotional context?' },
  { value: 'under_domain', label: '🔬 Domain', placeholder: 'What field or discipline?' },
  { value: 'causes_effect', label: '⚡ Causal', placeholder: 'What causes what?' },
];

const styles = {
  screen: { display: 'flex', flexDirection: 'column' as const, height: '100%' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid #e1e8ed' } as const,
  title: { fontSize: '18px', fontWeight: 'bold' as const, margin: 0 },
  button: { padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' as const } as const,
  cancelBtn: { background: 'transparent', color: '#657786' } as const,
  saveBtn: { background: '#1da1f2', color: 'white' } as const,
  content: { flex: 1, padding: '16px', overflowY: 'auto' as const },
  input: { width: '100%', padding: '12px', border: '1px solid #e1e8ed', borderRadius: '4px', fontSize: '16px', marginBottom: '16px', boxSizing: 'border-box' as const } as const,
  textarea: { width: '100%', padding: '12px', border: '1px solid #e1e8ed', borderRadius: '4px', fontSize: '16px', minHeight: '120px', resize: 'vertical' as const, boxSizing: 'border-box' as const, fontFamily: 'inherit' } as const,
  label: { display: 'block', fontSize: '14px', fontWeight: 'bold' as const, marginBottom: '8px', color: '#657786' } as const,
  relationBtn: { display: 'inline-block', padding: '8px 12px', margin: '4px', background: '#f7f9fa', border: '1px solid #e1e8ed', borderRadius: '16px', cursor: 'pointer', fontSize: '14px' } as const,
  relationBtnActive: { background: '#1da1f2', color: 'white', borderColor: '#1da1f2' } as const,
  relationInput: { display: 'flex', gap: '8px', marginTop: '8px', marginBottom: '16px' } as const,
  relationInputField: { flex: 1, padding: '8px', border: '1px solid #e1e8ed', borderRadius: '4px', fontSize: '14px' } as const,
  removeBtn: { padding: '8px 12px', background: '#ff4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' } as const,
  spreadContainer: { marginBottom: '16px' },
  slider: { width: '100%' } as const,
  sliderLabels: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#657786', marginTop: '4px' } as const,
  error: { color: '#ff4444', fontSize: '14px', marginTop: '8px' } as const,
  success: { color: '#17bf63', fontSize: '14px', marginTop: '8px' } as const,
};

export function ComposeScreen() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [spread, setSpread] = useState(0.15);
  const [relations, setRelations] = useState<RelationInput[]>([]);
  const [showRelationInput, setShowRelationInput] = useState<string | null>(null);
  const [relationObject, setRelationObject] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [modelStatus, setModelStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  // Check model status on mount
  useEffect(() => {
    if (isModelLoaded()) {
      setModelStatus('ready');
    } else if (isModelLoading()) {
      setModelStatus('loading');
      const interval = setInterval(() => {
        setModelProgress(getLoadProgress());
        if (isModelLoaded()) {
          setModelStatus('ready');
          clearInterval(interval);
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, []);

  const handleAddRelation = (tag: string) => {
    if (relations.length >= 5) {
      setError('Maximum 5 relations allowed');
      return;
    }
    if (relations.some(r => r.tag === tag)) {
      return; // Already added
    }
    setShowRelationInput(tag);
    setRelationObject('');
  };

  const handleSaveRelation = () => {
    if (!showRelationInput || !relationObject.trim()) return;
    setRelations([...relations, { tag: showRelationInput, object: relationObject.trim() }]);
    setShowRelationInput(null);
    setRelationObject('');
    setError('');
  };

  const handleRemoveRelation = (tag: string) => {
    setRelations(relations.filter(r => r.tag !== tag));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Channel name is required');
      return;
    }
    if (!description.trim()) {
      setError('Description is required');
      return;
    }
    if (description.trim().length < 10) {
      setError('Description must be at least 10 characters');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Create channel locally
      const channel = await channelManager.createChannel(
        name.trim(),
        description.trim(),
        spread,
        relations.map(r => ({ tag: r.tag, object: r.object, weight: 1.0 }))
      );

      // Initialize DHT
      const dhtClient = await initializeDHT();

      // Compute channel vector using real embedding model with progress tracking
      setModelStatus('loading');
      let normalizedVec: number[];
      try {
        // Load model if not already loaded (with progress tracking)
        await EmbeddingService.loadModel();

        // Compute embedding
        normalizedVec = await EmbeddingService.computeEmbedding(description.trim());
        setModelStatus('ready');
      } catch (err) {
        logger.warn('Embedding failed, using fallback', { error: (err as Error).message });
        setModelStatus('error');
        // Fallback to stub embedding
        const encoder = new TextEncoder();
        const hash = await crypto.subtle.digest('SHA-256', encoder.encode(description.trim()));
        const hashBytes = new Uint8Array(hash);
        const vec = Array.from({ length: 384 }, (_, i) => {
          const byte = hashBytes[i % 32];
          return (byte / 255) * 2 - 1;
        });
        const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
        normalizedVec = vec.map(v => v / norm);
      }

      // Generate LSH hashes
      const modelHash = 'XenovaallMiniLM'.slice(0, 12);
      const hashes = lshHash(normalizedVec, modelHash, 20, 32);

      // Create announcement payload
      const announcement = {
        peerId: dhtClient.getPeerId(),
        channelID: channel.id,
        model: 'Xenova/all-MiniLM-L6-v2',
        vec: normalizedVec,
        ttl: 300,
        updatedAt: Date.now(),
      };

      // Announce to DHT (announce to multiple hash buckets)
      const encoded = new TextEncoder().encode(JSON.stringify(announcement));
      for (const hash of hashes.slice(0, 5)) {
        const key = `/isc/announce/${modelHash}/${hash}`;
        await dhtClient.announce(key, encoded, 300);
      }

      logger.info('Channel announced to DHT', { channelID: channel.id });

      // Activate the channel locally
      await channelManager.activateChannel(channel.id, [{ mu: normalizedVec, sigma: spread }]);

      // Navigate back to Now tab
      navigate('now');
    } catch (err) {
      setModelStatus('error');
      setError('Failed to create channel: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.screen}>
      <header style={styles.header}>
        <button style={{ ...styles.button, ...styles.cancelBtn }} onClick={() => navigate('now')}>
          Cancel
        </button>
        <h1 style={styles.title}>New Channel</h1>
        <button
          style={{ ...styles.button, ...styles.saveBtn, opacity: saving || modelStatus === 'loading' ? 0.5 : 1 }}
          onClick={handleSave}
          disabled={saving || modelStatus === 'loading'}
        >
          {modelStatus === 'loading' ? `Loading ${Math.round(modelProgress * 100)}%...` : saving ? 'Saving...' : 'Save'}
        </button>
      </header>

      {/* Model loading indicator */}
      {modelStatus === 'loading' && (
        <div style={{ padding: '16px', background: '#e8f4fd', borderBottom: '1px solid #b3d9ff' }}>
          <div style={{ fontSize: '14px', color: '#0066cc', marginBottom: '8px' }}>
            🧠 Loading semantic model... ({Math.round(modelProgress * 100)}%)
          </div>
          <div style={{ background: '#b3d9ff', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
            <div style={{
              background: '#0066cc',
              height: '100%',
              width: `${modelProgress * 100}%`,
              transition: 'width 0.3s ease'
            }} />
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            First load downloads ~22MB. Subsequent loads use cached model.
          </div>
        </div>
      )}

      {modelStatus === 'error' && (
        <div style={{ padding: '16px', background: '#fff3cd', borderBottom: '1px solid #ffc107' }}>
          <div style={{ fontSize: '14px', color: '#856404' }}>
            ⚠️ Model failed to load. Using fallback embedding (reduced quality).
          </div>
        </div>
      )}

      {modelStatus === 'ready' && (
        <div style={{ padding: '8px 16px', background: '#d4edda', borderBottom: '1px solid #c3e6cb' }}>
          <div style={{ fontSize: '12px', color: '#155724' }}>
            ✓ Semantic model ready for high-quality matching
          </div>
        </div>
      )}

      <div style={styles.content}>
        <label style={styles.label}>Channel Name</label>
        <input
          type="text"
          value={name}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
          placeholder="What are you thinking about?"
          style={styles.input}
          maxLength={50}
        />

        <label style={styles.label}>Description</label>
        <textarea
          value={description}
          onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
          placeholder="Describe your thoughts in detail..."
          style={styles.textarea}
          maxLength={500}
        />
        <div style={{ fontSize: '12px', color: '#657786', textAlign: 'right' }}>
          {description.length}/500
        </div>

        <label style={styles.label}>How specific are you being?</label>
        <div style={styles.spreadContainer}>
          <input
            type="range"
            min="0"
            max="0.3"
            step="0.01"
            value={spread}
            onInput={(e) => setSpread(parseFloat((e.target as HTMLInputElement).value))}
            style={styles.slider}
          />
          <div style={styles.sliderLabels}>
            <span>Precise</span>
            <span>Exploratory</span>
          </div>
        </div>

        <label style={styles.label}>Add Context (optional, max 5)</label>
        <div style={{ marginBottom: '16px' }}>
          {RELATION_OPTIONS.map((opt) => {
            const isActive = relations.some(r => r.tag === opt.value);
            const isEditing = showRelationInput === opt.value;
            return (
              <div key={opt.value}>
                <button
                  style={{
                    ...styles.relationBtn,
                    ...(isActive ? styles.relationBtnActive : {}),
                  }}
                  onClick={() => !isActive && handleAddRelation(opt.value)}
                >
                  {opt.label}
                </button>
                {isEditing && (
                  <div style={styles.relationInput}>
                    <input
                      type="text"
                      value={relationObject}
                      onInput={(e) => setRelationObject((e.target as HTMLInputElement).value)}
                      placeholder={opt.placeholder}
                      style={styles.relationInputField}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRelation();
                        if (e.key === 'Escape') {
                          setShowRelationInput(null);
                          setRelationObject('');
                        }
                      }}
                    />
                    <button style={styles.saveBtn as any} onClick={handleSaveRelation}>Add</button>
                    <button
                      style={{ ...styles.removeBtn, background: 'transparent', color: '#657786' }}
                      onClick={() => {
                        setShowRelationInput(null);
                        setRelationObject('');
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {relations.length > 0 && (
          <div>
            <label style={styles.label}>Added Context</label>
            {relations.map((r) => (
              <div key={r.tag} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ background: '#f7f9fa', padding: '4px 8px', borderRadius: '4px', fontSize: '14px' }}>
                  {RELATION_OPTIONS.find(o => o.value === r.tag)?.label}
                </span>
                <span style={{ flex: 1, fontSize: '14px' }}>{r.object}</span>
                <button
                  style={{ ...styles.removeBtn, padding: '4px 8px', fontSize: '12px' }}
                  onClick={() => handleRemoveRelation(r.tag)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {error && <div style={styles.error}>{error}</div>}
      </div>
    </div>
  );
}
