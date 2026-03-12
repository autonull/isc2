/**
 * Settings Screen - Real Preferences
 * 
 * No mocks - actual settings persistence
 */

import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { channelManager } from '../channels/manager.js';
import type { Channel } from '@isc/core';

interface Settings {
  theme: 'light' | 'dark' | 'auto';
  notifications: boolean;
  ephemeral: boolean;
  ephemeralTTL: number; // hours
  allowDelegation: boolean;
  incognito: boolean;
  dataSaver: boolean;
  deviceTier: 'auto' | 'high' | 'mid' | 'low' | 'minimal';
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'auto',
  notifications: true,
  ephemeral: false,
  ephemeralTTL: 24,
  allowDelegation: true,
  incognito: false,
  dataSaver: false,
  deviceTier: 'auto',
};

const SETTINGS_KEY = 'isc-settings';

const styles = {
  screen: { display: 'flex', flexDirection: 'column' as const, height: '100%', background: '#f7f9fa' },
  header: { padding: '16px', background: 'white', borderBottom: '1px solid #e1e8ed' } as const,
  title: { fontSize: '18px', fontWeight: 'bold' as const, margin: 0 } as const,
  content: { flex: 1, padding: '16px', overflowY: 'auto' as const },
  section: { background: 'white', borderRadius: '8px', padding: '16px', marginBottom: '16px' } as const,
  sectionTitle: { fontSize: '14px', fontWeight: 'bold' as const, color: '#657786', marginBottom: '12px', textTransform: 'uppercase' as const } as const,
  settingRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f7f9fa' } as const,
  settingLabel: { fontSize: '14px' } as const,
  settingDesc: { fontSize: '12px', color: '#657786', marginTop: '4px' } as const,
  toggle: { width: '50px', height: '28px', borderRadius: '14px', border: 'none', cursor: 'pointer', position: 'relative' as const, transition: 'background 0.2s' } as const,
  toggleOn: { background: '#17bf63' } as const,
  toggleOff: { background: '#e1e8ed' } as const,
  toggleKnob: { width: '24px', height: '24px', borderRadius: '50%', background: 'white', position: 'absolute' as const, top: '2px', left: '2px', transition: 'transform 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' } as const,
  select: { padding: '8px 12px', border: '1px solid #e1e8ed', borderRadius: '4px', fontSize: '14px', background: 'white' } as const,
  slider: { width: '100%' } as const,
  channelItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f7f9fa' } as const,
  channelName: { fontWeight: 'bold' as const, fontSize: '14px' } as const,
  channelDesc: { fontSize: '12px', color: '#657786', marginTop: '4px' } as const,
  activeBadge: { background: '#17bf63', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' } as const,
  button: { padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' as const } as const,
  primaryBtn: { background: '#1da1f2', color: 'white' } as const,
  dangerBtn: { background: '#ff4444', color: 'white' } as const,
};

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      style={{
        ...styles.toggle,
        ...(enabled ? styles.toggleOn : styles.toggleOff),
      }}
      onClick={() => onChange(!enabled)}
      role="switch"
      aria-checked={enabled}
    >
      <div
        style={{
          ...styles.toggleKnob,
          transform: enabled ? 'translateX(22px)' : 'translateX(0)',
        }}
      />
    </button>
  );
}

export function SettingsScreen() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);

  useEffect(() => {
    // Load settings
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      } catch {
        // Use defaults
      }
    }

    // Load channels
    channelManager.getAllChannels().then(chs => {
      setChannels(chs);
      const active = chs.find(c => c.active) || null;
      setActiveChannel(active);
    });
  }, []);

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
  };

  const handleActivateChannel = async (channelId: string) => {
    try {
      await channelManager.activateChannel(channelId, []);
      const ch = await channelManager.getChannel(channelId);
      setActiveChannel(ch);
      setChannels(await channelManager.getAllChannels());
    } catch (err) {
      console.error('Failed to activate channel:', err);
    }
  };

  const handleExportData = () => {
    const data = {
      settings,
      channels,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `isc-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearData = () => {
    if (confirm('Are you sure you want to clear all local data? This cannot be undone.')) {
      localStorage.clear();
      indexedDB.deleteDatabase('isc-channels');
      window.location.reload();
    }
  };

  return (
    <div style={styles.screen}>
      <header style={styles.header}>
        <h1 style={styles.title}>Settings</h1>
      </header>

      <div style={styles.content}>
        {/* Appearance */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Appearance</h2>
          
          <div style={styles.settingRow}>
            <div>
              <div style={styles.settingLabel}>Theme</div>
              <div style={styles.settingDesc}>Choose light, dark, or system</div>
            </div>
            <select
              value={settings.theme}
              onChange={(e) => updateSetting('theme', (e.target as HTMLSelectElement).value as Settings['theme'])}
              style={styles.select}
            >
              <option value="auto">Auto</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>

        {/* Privacy */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Privacy</h2>
          
          <div style={styles.settingRow}>
            <div>
              <div style={styles.settingLabel}>Ephemeral Mode</div>
              <div style={styles.settingDesc}>Messages auto-delete after TTL</div>
            </div>
            <Toggle
              enabled={settings.ephemeral}
              onChange={(v) => updateSetting('ephemeral', v)}
            />
          </div>

          {settings.ephemeral && (
            <div style={{ ...styles.settingRow, flexDirection: 'column', alignItems: 'flex-start' }}>
              <div style={styles.settingLabel}>TTL: {settings.ephemeralTTL} hours</div>
              <input
                type="range"
                min="1"
                max="168"
                value={settings.ephemeralTTL}
                onChange={(e) => updateSetting('ephemeralTTL', parseInt((e.target as HTMLInputElement).value))}
                style={styles.slider}
              />
            </div>
          )}

          <div style={styles.settingRow}>
            <div>
              <div style={styles.settingLabel}>Incognito Mode</div>
              <div style={styles.settingDesc}>Browse without appearing in match lists</div>
            </div>
            <Toggle
              enabled={settings.incognito}
              onChange={(v) => updateSetting('incognito', v)}
            />
          </div>
        </div>

        {/* Network */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Network</h2>
          
          <div style={styles.settingRow}>
            <div>
              <div style={styles.settingLabel}>Allow Delegation</div>
              <div style={styles.settingDesc}>Help other peers find matches (High-tier only)</div>
            </div>
            <Toggle
              enabled={settings.allowDelegation}
              onChange={(v) => updateSetting('allowDelegation', v)}
            />
          </div>

          <div style={styles.settingRow}>
            <div>
              <div style={styles.settingLabel}>Data Saver</div>
              <div style={styles.settingDesc}>Reduce model quality on slow connections</div>
            </div>
            <Toggle
              enabled={settings.dataSaver}
              onChange={(v) => updateSetting('dataSaver', v)}
            />
          </div>

          <div style={styles.settingRow}>
            <div>
              <div style={styles.settingLabel}>Device Tier</div>
              <div style={styles.settingDesc}>Override automatic detection</div>
            </div>
            <select
              value={settings.deviceTier}
              onChange={(e) => updateSetting('deviceTier', (e.target as HTMLSelectElement).value as Settings['deviceTier'])}
              style={styles.select}
            >
              <option value="auto">Auto</option>
              <option value="high">High</option>
              <option value="mid">Mid</option>
              <option value="low">Low</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>
        </div>

        {/* Channels */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Your Channels ({channels.length})</h2>
          
          {channels.length === 0 ? (
            <p style={{ color: '#657786', fontSize: '14px' }}>No channels yet. Create one in Compose.</p>
          ) : (
            channels.map(channel => (
              <div key={channel.id} style={styles.channelItem}>
                <div>
                  <div style={styles.channelName}>{channel.name}</div>
                  <div style={styles.channelDesc}>{channel.description.slice(0, 50)}...</div>
                </div>
                {channel.id === activeChannel?.id ? (
                  <span style={styles.activeBadge}>Active</span>
                ) : (
                  <button
                    style={{ ...styles.button, ...styles.primaryBtn }}
                    onClick={() => handleActivateChannel(channel.id)}
                  >
                    Activate
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Data */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Data</h2>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              style={{ ...styles.button, ...styles.primaryBtn }}
              onClick={handleExportData}
            >
              Export Data
            </button>
            <button
              style={{ ...styles.button, ...styles.dangerBtn }}
              onClick={handleClearData}
            >
              Clear All Data
            </button>
          </div>
        </div>

        {/* About */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>About</h2>
          <div style={{ fontSize: '14px', color: '#657786' }}>
            <p><strong>ISC</strong> - Internet Semantic Chat</p>
            <p>Version: 0.1.0</p>
            <p>License: MIT</p>
            <p style={{ marginTop: '12px' }}>
              No servers. No accounts. No surveillance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
