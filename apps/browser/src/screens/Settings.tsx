/**
 * Settings Screen - Self-contained
 */

import { h } from 'preact';
import { useState } from 'preact/hooks';

const styles = {
  screen: { display: 'flex', flexDirection: 'column' as const, minHeight: '100%', background: '#f7f9fa' } as const,
  header: { padding: '16px 20px', borderBottom: '1px solid #e1e8ed', background: 'white' } as const,
  title: { fontSize: '20px', fontWeight: 'bold', margin: 0, color: '#14171a' } as const,
  content: { flex: 1, padding: '20px', overflowY: 'auto' as const } as const,
  section: { background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } as const,
  sectionTitle: { fontSize: '14px', fontWeight: 'bold' as const, color: '#657786', marginBottom: '16px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' } as const,
  settingRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f7f9fa' } as const,
  settingLabel: { fontSize: '14px', color: '#14171a' } as const,
  settingDesc: { fontSize: '12px', color: '#657786', marginTop: '4px' } as const,
  toggle: { width: '50px', height: '28px', borderRadius: '14px', border: 'none', cursor: 'pointer', position: 'relative' as const } as const,
  select: { padding: '8px 12px', borderRadius: '6px', border: '1px solid #e1e8ed', fontSize: '14px', background: 'white' } as const,
  button: { padding: '10px 20px', borderRadius: '6px', border: 'none', fontSize: '14px', fontWeight: 'bold' as const, cursor: 'pointer', marginTop: '16px' } as const,
};

export function SettingsScreen() {
  const [notifications, setNotifications] = useState(true);
  const [theme, setTheme] = useState('auto');
  const [dataSaver, setDataSaver] = useState(false);

  const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!enabled)}
      style={{
        ...styles.toggle,
        background: enabled ? '#17bf63' : '#e1e8ed',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '4px',
          left: enabled ? '26px' : '4px',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: 'white',
          transition: 'left 0.2s',
        }}
      />
    </button>
  );

  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <h1 style={styles.title}>⚙️ Settings</h1>
      </div>

      <div style={styles.content}>
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Appearance</h3>
          <div style={styles.settingRow}>
            <div>
              <div style={styles.settingLabel}>Theme</div>
              <div style={styles.settingDesc}>Choose light, dark, or system theme</div>
            </div>
            <select value={theme} onChange={(e) => setTheme((e.target as HTMLSelectElement).value)} style={styles.select}>
              <option value="auto">Auto</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Notifications</h3>
          <div style={styles.settingRow}>
            <div>
              <div style={styles.settingLabel}>Push Notifications</div>
              <div style={styles.settingDesc}>Receive notifications for new messages</div>
            </div>
            <Toggle enabled={notifications} onChange={setNotifications} />
          </div>
        </div>

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Data & Storage</h3>
          <div style={styles.settingRow}>
            <div>
              <div style={styles.settingLabel}>Data Saver Mode</div>
              <div style={styles.settingDesc}>Reduce data usage on mobile networks</div>
            </div>
            <Toggle enabled={dataSaver} onChange={setDataSaver} />
          </div>
          <div style={{ ...styles.settingRow, borderBottom: 'none' }}>
            <div>
              <div style={styles.settingLabel}>Clear Cache</div>
              <div style={styles.settingDesc}>Free up storage space</div>
            </div>
            <button style={{ ...styles.button, background: '#ff4444', color: 'white' }}>Clear</button>
          </div>
        </div>

        <div style={{ ...styles.section, background: '#e8f4fd' }}>
          <h3 style={{ ...styles.sectionTitle, color: '#1da1f2' }}>About ISC</h3>
          <p style={{ fontSize: '14px', color: '#657786', lineHeight: 1.6, margin: 0 }}>
            <strong>Internet Semantic Chat</strong> is a decentralized P2P social platform.
          </p>
          <p style={{ fontSize: '12px', color: '#657786', marginTop: '12px', margin: 0 }}>Version: 0.1.0</p>
        </div>
      </div>
    </div>
  );
}
