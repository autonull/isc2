/**
 * Settings Screen - Full Implementation
 * 
 * User profile, identity management, preferences, and app settings.
 */

import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { useNavigation } from '@isc/navigation';
import { useDependencies } from '../di/container.js';
import { toast, showConfirm, showLoading } from '../utils/toast.js';

const styles = {
  screen: { display: 'flex', flexDirection: 'column' as const, minHeight: '100%', background: '#f5f8fa' } as const,
  header: { padding: '16px 20px', borderBottom: '1px solid #e1e8ed', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as const,
  title: { fontSize: '20px', fontWeight: 'bold', margin: 0, color: '#14171a' } as const,
  content: { flex: 1, padding: '20px', overflowY: 'auto' as const, maxWidth: '800px', margin: '0 auto', width: '100%' } as const,
  card: { background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } as const,
  cardTitle: { fontSize: '16px', fontWeight: 'bold', margin: '0 0 16px 0', color: '#14171a', display: 'flex', alignItems: 'center', gap: '8px' } as const,
  field: { marginBottom: '16px' } as const,
  label: { display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '6px', color: '#14171a' } as const,
  input: { width: '100%', padding: '10px 12px', border: '1px solid #e1e8ed', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' as const } as const,
  textarea: { width: '100%', padding: '10px 12px', border: '1px solid #e1e8ed', borderRadius: '6px', fontSize: '14px', minHeight: '100px', resize: 'vertical' as const, boxSizing: 'border-box' as const, fontFamily: 'inherit' } as const,
  code: { display: 'block', padding: '10px 12px', background: '#f7f9fa', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace', color: '#657786', wordBreak: 'break-all' as const } as const,
  button: { padding: '10px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' } as const,
  primaryBtn: { background: '#1da1f2', color: 'white' } as const,
  secondaryBtn: { background: '#e8f4fd', color: '#1da1f2' } as const,
  dangerBtn: { background: '#ffeef0', color: '#e0245e' } as const,
  disabledBtn: { background: '#aab8c2', color: 'white', cursor: 'not-allowed' } as const,
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' } as const,
  toggle: { width: '44px', height: '24px', borderRadius: '12px', position: 'relative' as const, cursor: 'pointer', transition: 'background 0.2s' } as const,
  toggleOn: { background: '#17bf63' } as const,
  toggleOff: { background: '#e1e8ed' } as const,
  toggleKnob: { width: '20px', height: '20px', borderRadius: '50%', background: 'white', position: 'absolute' as const, top: '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' } as const,
  select: { padding: '10px 12px', border: '1px solid #e1e8ed', borderRadius: '6px', fontSize: '14px', background: 'white', cursor: 'pointer' } as const,
  helpText: { fontSize: '12px', color: '#657786', marginTop: '4px' } as const,
  fileInput: { display: 'none' } as const,
  fileLabel: { display: 'inline-block', padding: '10px 20px', background: '#e8f4fd', color: '#1da1f2', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' } as const,
  buttonGroup: { display: 'flex', gap: '12px', marginTop: '16px' } as const,
  statusBadge: { padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' as const } as const,
};

export function SettingsScreen() {
  const { navigate } = useNavigation();
  const { networkService } = useDependencies();
  
  const [identity, setIdentity] = useState<any>(null);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [autoDiscover, setAutoDiscover] = useState(true);
  const [discoverInterval, setDiscoverInterval] = useState(30);
  const [similarityThreshold, setSimilarityThreshold] = useState(40);
  const [theme, setTheme] = useState('dark');
  const [notifications, setNotifications] = useState(true);
  const [loading, setLoading] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<string>('disconnected');

  // Load current settings
  useEffect(() => {
    if (!networkService) return;

    const id = networkService.getIdentity();
    if (id) {
      setIdentity(id);
      setName(id.name || '');
      setBio(id.bio || '');
    }

    setNetworkStatus(networkService.getStatus());

    // Load saved preferences
    const saved = localStorage.getItem('isc-settings');
    if (saved) {
      const prefs = JSON.parse(saved);
      setAutoDiscover(prefs.autoDiscover ?? true);
      setDiscoverInterval(prefs.discoverInterval ?? 30);
      setSimilarityThreshold(prefs.similarityThreshold ?? 40);
      setTheme(prefs.theme ?? 'dark');
      setNotifications(prefs.notifications ?? true);
    }
  }, [networkService]);

  // Save profile
  const handleSaveProfile = async () => {
    if (!networkService) return;

    setLoading(true);
    try {
      await networkService.updateIdentity({ name, bio });
      setIdentity({ ...identity, name, bio });
      toast.success('Profile saved!');
    } catch (err) {
      toast.error('Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  // Export identity
  const handleExport = async () => {
    if (!networkService) return;

    try {
      const exported = await networkService.exportIdentity();
      const blob = new Blob([exported], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `isc-identity-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Identity exported!');
    } catch (err) {
      toast.error('Failed to export identity');
    }
  };

  // Import identity
  const handleImport = async (event: Event) => {
    if (!networkService) return;

    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const confirmed = await showConfirm(
      'Importing will replace your current identity. Make sure you have backed up your current identity first. Continue?',
      { title: '⚠️ Import Identity', confirmText: 'Import', cancelText: 'Cancel' }
    );

    if (!confirmed) return;

    try {
      const text = await file.text();
      await networkService.importIdentity(text);
      toast.success('Identity imported! Reloading...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast.error('Failed to import identity');
    }
  };

  // Save preferences
  const handleSavePreferences = () => {
    localStorage.setItem('isc-settings', JSON.stringify({
      autoDiscover,
      discoverInterval,
      similarityThreshold,
      theme,
      notifications,
    }));
    toast.success('Preferences saved!');
  };

  // Clear all data
  const handleClearData = async () => {
    const confirmed = await showConfirm(
      'This will delete all your channels, posts, matches, and identity. This action cannot be undone. Are you sure?',
      { title: '⚠️ Clear All Data', confirmText: 'Delete Everything', cancelText: 'Cancel' }
    );

    if (!confirmed) return;

    try {
      await networkService?.clearCache();
      localStorage.removeItem('isc-settings');
      localStorage.removeItem('isc-identity');
      toast.success('All data cleared. Reloading...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast.error('Failed to clear data');
    }
  };

  // Logout
  const handleLogout = async () => {
    const confirmed = await showConfirm(
      'This will clear your identity. You will need to create a new identity on next launch. Continue?',
      { title: '🚪 Logout', confirmText: 'Logout', cancelText: 'Cancel' }
    );

    if (!confirmed) return;

    try {
      await networkService?.clearIdentity?.();
      localStorage.removeItem('isc-identity');
      toast.success('Logged out. Reloading...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast.error('Failed to logout');
    }
  };

  const toggleStyle = (on: boolean) => ({
    ...styles.toggle,
    ...(on ? styles.toggleOn : styles.toggleOff),
  });

  const knobStyle = (on: boolean) => ({
    ...styles.toggleKnob,
    left: on ? '22px' : '2px',
  });

  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <h1 style={styles.title} data-testid="settings-title">⚙️ Settings</h1>
        <span style={{
          ...styles.statusBadge,
          background: networkStatus === 'connected' ? '#edf9ef' : '#fef3f2',
          color: networkStatus === 'connected' ? '#17bf63' : '#d93025',
        }}>
          {networkStatus === 'connected' ? '● Online' : `○ ${networkStatus}`}
        </span>
      </div>

      <div style={styles.content}>
        {/* Profile Section */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>👤 Profile</h3>
          
          <div style={styles.field}>
            <label style={styles.label}>Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName((e.target as HTMLInputElement).value)}
              placeholder="Your name"
              style={styles.input}
              maxLength={50}
            />
            <div style={styles.helpText}>{name.length}/50 characters</div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio((e.target as HTMLTextAreaElement).value)}
              placeholder="Tell others about yourself..."
              style={styles.textarea}
              maxLength={200}
            />
            <div style={styles.helpText}>{bio.length}/200 characters - Used for peer matching</div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Peer ID</label>
            <code style={styles.code}>{identity?.peerId || 'Not available'}</code>
            <div style={styles.helpText}>Your unique identifier on the network</div>
          </div>

          <button
            style={{
              ...styles.button,
              ...styles.primaryBtn,
              ...(loading ? styles.disabledBtn : {}),
            }}
            onClick={handleSaveProfile}
            disabled={loading || !name.trim()}
          >
            {loading ? 'Saving...' : 'Save Profile'}
          </button>
        </div>

        {/* Identity Section */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>🔐 Identity</h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#657786' }}>
            Your identity is used to sign messages and verify your authenticity on the network.
          </p>

          <div style={styles.buttonGroup}>
            <button
              style={{ ...styles.button, ...styles.secondaryBtn }}
              onClick={handleExport}
            >
              📥 Export Identity
            </button>

            <label style={styles.fileLabel}>
              📤 Import Identity
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                style={styles.fileInput}
              />
            </label>
          </div>
        </div>

        {/* Discovery Settings */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>📡 Discovery</h3>

          <div style={styles.row}>
            <span style={{ fontSize: '14px', fontWeight: '500' }}>Auto-discover peers</span>
            <div
              style={toggleStyle(autoDiscover)}
              onClick={() => setAutoDiscover(!autoDiscover)}
            >
              <div style={knobStyle(autoDiscover)} />
            </div>
          </div>
          <div style={styles.helpText}>Automatically search for matching peers</div>

          <div style={{ ...styles.field, marginTop: '16px' }}>
            <label style={styles.label}>Discovery Interval: {discoverInterval}s</label>
            <input
              type="range"
              min="10"
              max="120"
              step="10"
              value={discoverInterval}
              onChange={(e) => setDiscoverInterval(parseInt((e.target as HTMLInputElement).value))}
              style={{ width: '100%' }}
            />
            <div style={styles.helpText}>How often to search for new peers</div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Similarity Threshold: {similarityThreshold}%</label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={similarityThreshold}
              onChange={(e) => setSimilarityThreshold(parseInt((e.target as HTMLInputElement).value))}
              style={{ width: '100%' }}
            />
            <div style={styles.helpText}>Minimum similarity to show as a match</div>
          </div>

          <button
            style={{ ...styles.button, ...styles.primaryBtn }}
            onClick={handleSavePreferences}
          >
            Save Discovery Settings
          </button>
        </div>

        {/* App Preferences */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>⚡ Preferences</h3>

          <div style={styles.row}>
            <span style={{ fontSize: '14px', fontWeight: '500' }}>Notifications</span>
            <div
              style={toggleStyle(notifications)}
              onClick={() => setNotifications(!notifications)}
              data-testid="notifications-toggle"
              role="switch"
              aria-checked={notifications}
            >
              <div style={knobStyle(notifications)} />
            </div>
          </div>

          <div style={styles.row}>
            <span style={{ fontSize: '14px', fontWeight: '500' }}>Theme</span>
            <select
              value={theme}
              onChange={(e) => setTheme((e.target as HTMLSelectElement).value)}
              style={styles.select}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </div>

          <button
            style={{ ...styles.button, ...styles.primaryBtn, marginTop: '16px' }}
            onClick={handleSavePreferences}
          >
            Save Preferences
          </button>
        </div>

        {/* Danger Zone */}
        <div style={{ ...styles.card, border: '1px solid #ffeef0' }}>
          <h3 style={{ ...styles.cardTitle, color: '#e0245e' }}>⚠️ Danger Zone</h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#657786' }}>
            Irreversible actions that will delete your data.
          </p>

          <div style={styles.buttonGroup}>
            <button
              style={{ ...styles.button, ...styles.dangerBtn }}
              onClick={handleClearData}
            >
              🗑️ Clear All Data
            </button>

            <button
              style={{ ...styles.button, ...styles.dangerBtn }}
              onClick={handleLogout}
            >
              🚪 Logout
            </button>
          </div>
        </div>

        {/* About */}
        <div style={{ ...styles.card, background: '#e8f4fd' }}>
          <h3 style={{ ...styles.cardTitle, color: '#1da1f2' }}>ℹ️ About</h3>
          <div style={{ fontSize: '14px', color: '#657786', lineHeight: 1.8 }}>
            <p style={{ margin: '0 0 8px 0' }}><strong>ISC</strong> - Internet Semantic Connect</p>
            <p style={{ margin: '0 0 8px 0' }}>Version 1.0.0</p>
            <p style={{ margin: 0 }}>A decentralized peer-to-peer communication network using semantic matching.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
