/**
 * Compose Screen - Self-contained
 */

import { h } from 'preact';
import { useState } from 'preact/hooks';
import { useNavigation } from '@isc/navigation';

const styles = {
  screen: { display: 'flex', flexDirection: 'column' as const, height: '100%', background: '#f7f9fa' } as const,
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e1e8ed', background: 'white' } as const,
  title: { fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#14171a' } as const,
  button: { padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' } as const,
  cancelBtn: { background: 'transparent', color: '#657786' } as const,
  saveBtn: { background: '#1da1f2', color: 'white' } as const,
  content: { flex: 1, padding: '20px', overflowY: 'auto' as const, maxWidth: '600px', margin: '0 auto', width: '100%' } as const,
  card: { background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } as const,
  label: { display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#14171a' } as const,
  input: { width: '100%', padding: '12px', border: '1px solid #e1e8ed', borderRadius: '6px', fontSize: '16px', boxSizing: 'border-box' as const } as const,
  textarea: { width: '100%', padding: '12px', border: '1px solid #e1e8ed', borderRadius: '6px', fontSize: '16px', minHeight: '120px', resize: 'vertical' as const, boxSizing: 'border-box' as const, fontFamily: 'inherit' } as const,
  helpText: { fontSize: '12px', color: '#657786', marginTop: '4px' } as const,
  slider: { width: '100%', marginTop: '8px' } as const,
  sliderLabels: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#657786', marginTop: '4px' } as const,
};

export function ComposeScreen() {
  const { navigate } = useNavigation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [spread, setSpread] = useState(0.15);
  const [error, setError] = useState('');

  const handleSave = () => {
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
    navigate({ name: 'now', path: '/now' });
  };

  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <button style={{ ...styles.button, ...styles.cancelBtn }} onClick={() => navigate({ name: 'now', path: '/now' })}>Cancel</button>
        <h1 style={styles.title}>New Channel</h1>
        <button style={{ ...styles.button, ...styles.saveBtn }} onClick={handleSave}>Save</button>
      </div>

      <div style={styles.content}>
        <div style={styles.card}>
          <label style={styles.label}>Channel Name</label>
          <input type="text" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} placeholder="What are you thinking about?" style={styles.input} maxLength={50} />
          <div style={styles.helpText}>{name.length}/50 characters</div>
        </div>

        <div style={styles.card}>
          <label style={styles.label}>Description</label>
          <textarea value={description} onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)} placeholder="Describe your thoughts in detail." style={styles.textarea} maxLength={500} />
          <div style={styles.helpText}>{description.length}/500 characters (minimum 10)</div>
        </div>

        <div style={styles.card}>
          <label style={styles.label}>How specific are you being?</label>
          <input type="range" min="0" max="0.3" step="0.01" value={spread} onInput={(e) => setSpread(parseFloat((e.target as HTMLInputElement).value))} style={styles.slider} />
          <div style={styles.sliderLabels}>
            <span>Precise (narrow matching)</span>
            <span>Exploratory (broad matching)</span>
          </div>
          <div style={styles.helpText}>Current: {Math.round(spread * 100)}%</div>
        </div>

        <div style={styles.card}>
          <label style={styles.label}>Add Context (optional)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
            {['📍 Location', '🕐 Time', '💭 Mood', '🔬 Domain', '⚡ Causal'].map((opt) => (
              <button key={opt} style={{ padding: '8px 12px', background: '#f7f9fa', border: '1px solid #e1e8ed', borderRadius: '16px', cursor: 'pointer', fontSize: '14px' }}>{opt}</button>
            ))}
          </div>
          <div style={styles.helpText}>Add context to help refine semantic matching</div>
        </div>

        {error && <div style={{ ...styles.card, background: '#fef3f2', color: '#d93025' }}>{error}</div>}

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
