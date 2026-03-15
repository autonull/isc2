/**
 * Compose Screen - Channel Creation
 * 
 * Allows users to create new channels with semantic matching configuration.
 */

import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { useNavigation } from '@isc/navigation';
import { useChannelService } from '../di/container.js';
import { useDependencies } from '../di/container.js';
import { validateChannelInput } from '../services/channelService.js';
import { toast } from '../utils/toast.js';

const styles = {
  screen: { display: 'flex', flexDirection: 'column' as const, height: '100%', background: '#f7f9fa' } as const,
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e1e8ed', background: 'white' } as const,
  title: { fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#14171a' } as const,
  button: { padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' } as const,
  cancelBtn: { background: 'transparent', color: '#657786' } as const,
  saveBtn: { background: '#1da1f2', color: 'white' } as const,
  saveBtnDisabled: { background: '#aab8c2', color: 'white', cursor: 'not-allowed' } as const,
  content: { flex: 1, padding: '20px', overflowY: 'auto' as const, maxWidth: '600px', margin: '0 auto', width: '100%' } as const,
  card: { background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } as const,
  label: { display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#14171a' } as const,
  input: { width: '100%', padding: '12px', border: '1px solid #e1e8ed', borderRadius: '6px', fontSize: '16px', boxSizing: 'border-box' as const } as const,
  textarea: { width: '100%', padding: '12px', border: '1px solid #e1e8ed', borderRadius: '6px', fontSize: '16px', minHeight: '120px', resize: 'vertical' as const, boxSizing: 'border-box' as const, fontFamily: 'inherit' } as const,
  helpText: { fontSize: '12px', color: '#657786', marginTop: '4px' } as const,
  slider: { width: '100%', marginTop: '8px' } as const,
  sliderLabels: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#657786', marginTop: '4px' } as const,
  error: { background: '#fef3f2', color: '#d93025', padding: '12px', borderRadius: '8px', marginBottom: '16px' } as const,
  success: { background: '#edf9ef', color: '#17bf63', padding: '12px', borderRadius: '8px', marginBottom: '16px' } as const,
};

export function ComposeScreen() {
  const { navigate } = useNavigation();
  const channelService = useChannelService();
  const { networkService } = useDependencies();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [spread, setSpread] = useState(50);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<string>('disconnected');

  // Subscribe to network status
  useEffect(() => {
    if (!networkService) return;

    const updateStatus = () => {
      setNetworkStatus(networkService.getStatus());
    };

    updateStatus();
    networkService.on({ onStatusChange: updateStatus });

    return () => {
      // Cleanup if needed
    };
  }, [networkService]);

  const canSubmit = name.trim().length >= 3 && description.trim().length >= 10 && !submitting;

  const handleSave = async () => {
    setError('');

    if (!canSubmit) {
      if (name.trim().length < 3) {
        const msg = 'Channel name must be at least 3 characters';
        setError(msg);
        toast.warning(msg);
      } else if (description.trim().length < 10) {
        const msg = 'Description must be at least 10 characters';
        setError(msg);
        toast.warning(msg);
      }
      return;
    }

    // Validate input
    const validation = validateChannelInput({
      name,
      description,
      spread,
      relations: [],
    });

    if (!validation.valid) {
      const msg = validation.errors.join('. ');
      setError(msg);
      toast.warning(msg);
      return;
    }

    setSubmitting(true);

    try {
      // Create channel using both services for redundancy
      // First try network service (with embeddings)
      if (networkService && networkService.getStatus() === 'connected') {
        const channel = await networkService.createChannel(name.trim(), description.trim());
        console.log('[ComposeScreen] Channel created via network service:', channel);
        toast.success(`Channel "#${name.trim()}" created!`);
      } 
      // Fallback to channel service
      else if (channelService) {
        const channel = await channelService.createChannel({
          name: name.trim(),
          description: description.trim(),
          spread,
          relations: [],
        });
        console.log('[ComposeScreen] Channel created via channel service:', channel);
        toast.success(`Channel "#${name.trim()}" created!`);
      }

      setSuccess(true);

      // Navigate to now screen after short delay
      setTimeout(() => {
        navigate({ name: 'now', path: '/now' });
      }, 1500);
    } catch (err) {
      console.error('[ComposeScreen] Error creating channel:', err);
      const msg = err instanceof Error ? err.message : 'Failed to create channel';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNameInput = (e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    setName(value);
    if (value.length >= 3) setError('');
  };

  const handleDescriptionInput = (e: Event) => {
    const value = (e.target as HTMLTextAreaElement).value;
    setDescription(value);
    if (value.length >= 10) setError('');
  };

  const handleSpreadInput = (e: Event) => {
    const value = parseFloat((e.target as HTMLInputElement).value);
    setSpread(value);
  };

  return (
    <div style={styles.screen} data-testid="compose-screen">
      <div style={styles.header}>
        <button 
          style={{ ...styles.button, ...styles.cancelBtn }} 
          onClick={() => navigate({ name: 'now', path: '/now' })}
          data-testid="compose-cancel"
        >
          Cancel
        </button>
        <h1 style={styles.title}>New Channel</h1>
        <button 
          style={{ 
            ...styles.button, 
            ...(canSubmit && !submitting ? styles.saveBtn : styles.saveBtnDisabled) 
          }} 
          onClick={handleSave}
          disabled={!canSubmit || submitting}
          data-testid="compose-save"
        >
          {submitting ? 'Creating...' : 'Save'}
        </button>
      </div>

      <div style={styles.content}>
        {/* Network status indicator */}
        <div style={{ ...styles.card, background: networkStatus === 'connected' ? '#edf9ef' : '#fef3f2', marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', color: networkStatus === 'connected' ? '#17bf63' : '#d93025' }}>
            {networkStatus === 'connected' ? '✅ Network connected' : `⏳ Network: ${networkStatus}`}
          </div>
        </div>

        {success && (
          <div style={styles.success} data-testid="channel-created">
            ✅ Channel created successfully! Redirecting...
          </div>
        )}

        {error && (
          <div style={styles.error} data-testid="compose-error">
            ⚠️ {error}
          </div>
        )}

        <div style={styles.card}>
          <label style={styles.label}>Channel Name</label>
          <input 
            type="text" 
            value={name} 
            onInput={handleNameInput} 
            placeholder="What are you thinking about?" 
            style={styles.input} 
            maxLength={50}
            data-testid="compose-name-input"
          />
          <div style={styles.helpText}>{name.length}/50 characters (minimum 3)</div>
        </div>

        <div style={styles.card}>
          <label style={styles.label}>Description</label>
          <textarea 
            value={description} 
            onInput={handleDescriptionInput} 
            placeholder="Describe your thoughts in detail..." 
            style={styles.textarea} 
            maxLength={500}
            data-testid="compose-description-input"
          />
          <div style={styles.helpText}>{description.length}/500 characters (minimum 10)</div>
        </div>

        <div style={styles.card}>
          <label style={styles.label}>How specific are you being?</label>
          <input 
            type="range" 
            min="0" 
            max="100" 
            step="1" 
            value={spread} 
            onInput={handleSpreadInput} 
            style={styles.slider}
            data-testid="compose-spread-slider"
          />
          <div style={styles.sliderLabels}>
            <span>Precise (narrow matching)</span>
            <span>Exploratory (broad matching)</span>
          </div>
          <div style={styles.helpText}>Current: {spread}%</div>
        </div>

        <div style={styles.card}>
          <label style={styles.label}>Add Context (optional)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
            {['📍 Location', '🕐 Time', '💭 Mood', '🔬 Domain', '⚡ Causal'].map((opt) => (
              <button 
                key={opt} 
                style={{ padding: '8px 12px', background: '#f7f9fa', border: '1px solid #e1e8ed', borderRadius: '16px', cursor: 'pointer', fontSize: '14px' }}
                type="button"
              >
                {opt}
              </button>
            ))}
          </div>
          <div style={styles.helpText}>Add context to help refine semantic matching</div>
        </div>

        <div style={{ ...styles.card, background: '#e8f4fd' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#1da1f2', fontSize: '14px' }}>💡 Tips for Good Channels</h4>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#657786', lineHeight: 1.8 }}>
            <li>Use descriptive names that capture your topic</li>
            <li>Write detailed descriptions for better matching</li>
            <li>Add context to refine your semantic neighborhood</li>
            <li>Adjust specificity to control match breadth</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
