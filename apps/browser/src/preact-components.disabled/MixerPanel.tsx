/**
 * Mixer Panel Component
 *
 * Channel control surface with progressive disclosure.
 * Provides access to all adjustable channel parameters:
 * - Channel name/description editing
 * - View mode toggle (List / Space / Grid)
 * - Specificity slider (cosine threshold)
 * - Filter controls (me, others, trusted, alignment)
 * - Sort order (recency, similarity, activity)
 * - Status indicators (match count, ping)
 * - Archive/mute actions
 */

import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import type { Channel } from '@isc/core';
import type {
  ChannelSettings,
  ChannelViewMode,
  ChannelSortOrder,
  ChannelSettingsService,
} from '../services/channelSettingsService.js';
import { specificityToCosineThreshold } from '../services/channelSettingsService.js';

interface MixerPanelProps {
  channel: Channel | null;
  settingsService: ChannelSettingsService;
  matchCount?: number;
  pingTime?: number;
  onViewModeChange?: (mode: ChannelViewMode) => void;
  onSettingsChange?: (settings: ChannelSettings) => void;
  onEditChannel?: (channel: Channel) => void;
  onArchiveChannel?: (channelId: string) => void;
  onMuteChannel?: (channelId: string) => void;
}

const styles = {
  mixer: {
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px',
    color: '#e8e8e8',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  } as const,
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  } as const,
  channelInfo: {
    flex: 1,
  } as const,
  channelName: {
    fontSize: '18px',
    fontWeight: 'bold',
    margin: '0 0 4px 0',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  } as const,
  channelDescription: {
    fontSize: '13px',
    color: '#888',
    margin: 0,
    fontStyle: 'italic',
  } as const,
  statusRow: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
    fontSize: '12px',
    color: '#666',
  } as const,
  statusBadge: {
    padding: '4px 8px',
    borderRadius: '12px',
    background: 'rgba(59, 130, 246, 0.2)',
    color: '#60a5fa',
    fontWeight: '600',
  } as const,
  controls: {
    display: 'flex',
    gap: '8px',
  } as const,
  iconBtn: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    borderRadius: '6px',
    padding: '8px',
    color: '#888',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontSize: '14px',
  } as const,
  panel: {
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '12px',
  } as const,
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    padding: '4px 0',
  } as const,
  panelTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    margin: 0,
  } as const,
  panelContent: {
    marginTop: '12px',
  } as const,
  slider: {
    width: '100%',
    height: '6px',
    borderRadius: '3px',
    background: 'rgba(255, 255, 255, 0.1)',
    outline: 'none',
    WebkitAppearance: 'none' as const,
  } as const,
  sliderThumb: {
    WebkitAppearance: 'none' as const,
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: '#3b82f6',
    cursor: 'pointer',
    border: '2px solid #fff',
  } as const,
  buttonGroup: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap' as const,
  } as const,
  toggleBtn: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    background: 'rgba(255, 255, 255, 0.05)',
    color: '#888',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  } as const,
  toggleBtnActive: {
    background: 'rgba(59, 130, 246, 0.3)',
    border: '1px solid #3b82f6',
    color: '#60a5fa',
  } as const,
  select: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    background: 'rgba(0, 0, 0, 0.3)',
    color: '#e8e8e8',
    fontSize: '13px',
    cursor: 'pointer',
    outline: 'none',
  } as const,
  valueLabel: {
    fontSize: '11px',
    color: '#666',
    textAlign: 'right' as const,
    marginTop: '4px',
  } as const,
  editInput: {
    background: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '6px',
    padding: '8px 12px',
    color: '#fff',
    fontSize: '14px',
    width: '100%',
    marginBottom: '8px',
  } as const,
  actionBtn: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: 'none',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  } as const,
  dangerBtn: {
    background: 'rgba(224, 36, 94, 0.2)',
    color: '#e0245e',
  } as const,
  secondaryBtn: {
    background: 'rgba(255, 255, 255, 0.1)',
    color: '#888',
  } as const,
};

export function MixerPanel({
  channel,
  settingsService,
  matchCount = 0,
  pingTime,
  onViewModeChange,
  onSettingsChange,
  onEditChannel,
  onArchiveChannel,
  onMuteChannel,
}: MixerPanelProps) {
  const [settings, setSettings] = useState<ChannelSettings | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Load settings on mount or channel change
  useEffect(() => {
    if (!channel || !settingsService) return;

    settingsService.getSettings(channel.id).then(setSettings);
  }, [channel?.id, settingsService]);

  // Notify parent of settings changes
  useEffect(() => {
    if (settings && onSettingsChange) {
      onSettingsChange(settings);
    }
  }, [settings, onSettingsChange]);

  // Update settings
  const updateSetting = useCallback(
    async <K extends keyof ChannelSettings>(key: K, value: ChannelSettings[K]) => {
      if (!channel || !settingsService) return;

      const updated = await settingsService.updateSettings(channel.id, { [key]: value });
      setSettings(updated);
    },
    [channel, settingsService]
  );

  // Handle view mode change
  const handleViewModeChange = useCallback(
    (mode: ChannelViewMode) => {
      updateSetting('viewMode', mode);
      onViewModeChange?.(mode);
    },
    [updateSetting, onViewModeChange]
  );

  // Handle specificity change
  const handleSpecificityChange = useCallback(
    (e: Event) => {
      const value = Number((e.target as HTMLInputElement).value);
      updateSetting('specificity', value);
    },
    [updateSetting]
  );

  // Handle filter toggle
  const handleFilterToggle = useCallback(
    (filterType: keyof ChannelSettings['filters']) => {
      if (!settings) return;

      const newFilters = {
        ...settings.filters,
        [filterType]: !settings.filters[filterType],
      };
      updateSetting('filters', newFilters);
    },
    [settings, updateSetting]
  );

  // Handle sort order change
  const handleSortOrderChange = useCallback(
    (e: Event) => {
      const value = (e.target as HTMLSelectElement).value as ChannelSortOrder;
      updateSetting('sortOrder', value);
    },
    [updateSetting]
  );

  // Toggle panel expansion
  const togglePanel = useCallback(
    (panelKey: string) => {
      if (!channel || !settingsService) return;
      settingsService.togglePanel(channel.id, panelKey);
      // Refresh settings
      settingsService.getSettings(channel.id).then(setSettings);
    },
    [channel, settingsService]
  );

  // Handle edit mode
  const startEditing = useCallback(() => {
    if (!channel) return;
    setEditName(channel.name);
    setEditDescription(channel.description);
    setIsEditing(true);
  }, [channel]);

  const saveEdit = useCallback(() => {
    if (!channel || !editName.trim()) return;
    onEditChannel?.({
      ...channel,
      name: editName.trim(),
      description: editDescription.trim(),
    });
    setIsEditing(false);
  }, [channel, editName, editDescription, onEditChannel]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditName('');
    setEditDescription('');
  }, []);

  // Handle archive
  const handleArchive = useCallback(() => {
    if (!channel) return;
    onArchiveChannel?.(channel.id);
  }, [channel, onArchiveChannel]);

  // Handle mute
  const handleMute = useCallback(() => {
    if (!channel) return;
    if (settings?.isMuted) {
      settingsService.unmuteChannel(channel.id);
    } else {
      onMuteChannel?.(channel.id);
    }
  }, [channel, settings?.isMuted, settingsService, onMuteChannel]);

  // Get cosine threshold display value
  const cosineThreshold = settings ? specificityToCosineThreshold(settings.specificity) : 0.55;

  if (!channel || !settings) {
    return (
      <div style={styles.mixer}>
        <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
          Loading channel settings...
        </div>
      </div>
    );
  }

  return (
    <div style={styles.mixer} data-testid="mixer-panel">
      {/* Header with channel info and status */}
      <div style={styles.header}>
        <div style={styles.channelInfo}>
          {isEditing ? (
            <div>
              <input
                type="text"
                value={editName}
                onInput={(e) => setEditName((e.target as HTMLInputElement).value)}
                style={styles.editInput}
                placeholder="Channel name"
                autoFocus
              />
              <textarea
                value={editDescription}
                onInput={(e) => setEditDescription((e.target as HTMLInputElement).value)}
                style={{ ...styles.editInput, minHeight: '60px', resize: 'vertical' }}
                placeholder="Channel description"
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  onClick={saveEdit}
                  style={{ ...styles.actionBtn, background: '#17bf63', color: '#fff' }}
                >
                  Save
                </button>
                <button onClick={cancelEdit} style={{ ...styles.actionBtn, ...styles.secondaryBtn }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <h2 style={styles.channelName}>
                {channel.name}
                {settings.isMuted && <span title="Muted">🔇</span>}
                {settings.isArchived && <span title="Archived">📦</span>}
              </h2>
              {channel.description && (
                <p style={styles.channelDescription}>{channel.description}</p>
              )}
              {!channel.description && (
                <p style={{ ...styles.channelDescription, color: '#555' }}>
                  <em>Click edit to add a description</em>
                </p>
              )}
            </div>
          )}
        </div>

        {!isEditing && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <div style={styles.statusRow}>
              {matchCount > 0 && (
                <span style={styles.statusBadge} data-testid="match-count">
                  🔥 {matchCount} match{matchCount > 1 ? 'es' : ''}
                </span>
              )}
              {pingTime !== undefined && (
                <span style={{ color: pingTime < 100 ? '#17bf63' : pingTime < 300 ? '#ffad1f' : '#e0245e' }}>
                  {pingTime < 100 ? '●' : pingTime < 300 ? '●' : '●'} {pingTime}ms
                </span>
              )}
            </div>

            <div style={styles.controls}>
              <button
                onClick={startEditing}
                style={styles.iconBtn}
                title="Edit channel"
                data-testid="edit-channel-btn"
              >
                ✏️
              </button>
              <button
                onClick={handleMute}
                style={styles.iconBtn}
                title={settings.isMuted ? 'Unmute' : 'Mute'}
              >
                {settings.isMuted ? '🔇' : '🔈'}
              </button>
              <button
                onClick={handleArchive}
                style={styles.iconBtn}
                title="Archive channel"
              >
                📦
              </button>
            </div>
          </div>
        )}
      </div>

      {!isEditing && (
        <>
          {/* View Mode Panel */}
          <div style={styles.panel}>
            <div style={styles.panelHeader} onClick={() => togglePanel('view')}>
              <h4 style={styles.panelTitle}>👁 View Mode</h4>
              <span>{settings.panelsExpanded.view ? '▼' : '▶'}</span>
            </div>
            {settings.panelsExpanded.view && (
              <div style={styles.panelContent}>
                <div style={styles.buttonGroup}>
                  {(['list', 'space', 'grid'] as ChannelViewMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => handleViewModeChange(mode)}
                      style={{
                        ...styles.toggleBtn,
                        ...(settings.viewMode === mode ? styles.toggleBtnActive : {}),
                      }}
                      data-testid={`view-mode-${mode}`}
                    >
                      {mode === 'list' && '📋 List'}
                      {mode === 'space' && '🌌 Space'}
                      {mode === 'grid' && '▦ Grid'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Specificity Panel */}
          <div style={styles.panel}>
            <div style={styles.panelHeader} onClick={() => togglePanel('specificity')}>
              <h4 style={styles.panelTitle}>🎯 Specificity</h4>
              <span>{settings.panelsExpanded.specificity ? '▼' : '▶'}</span>
            </div>
            {settings.panelsExpanded.specificity && (
              <div style={styles.panelContent}>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.specificity}
                  onInput={handleSpecificityChange}
                  style={styles.slider}
                  data-testid="specificity-slider"
                />
                <div style={styles.valueLabel}>
                  <span>Specificity: {settings.specificity}%</span>
                  <span style={{ marginLeft: '16px' }}>Cosine threshold: {cosineThreshold.toFixed(2)}</span>
                  <span style={{ marginLeft: '16px' }}>
                    {settings.specificity < 30 ? '🌍 Broad' : settings.specificity < 70 ? '🎯 Focused' : '🔬 Narrow'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Filters Panel */}
          <div style={styles.panel}>
            <div style={styles.panelHeader} onClick={() => togglePanel('filters')}>
              <h4 style={styles.panelTitle}>🔍 Filters</h4>
              <span>{settings.panelsExpanded.filters ? '▼' : '▶'}</span>
            </div>
            {settings.panelsExpanded.filters && (
              <div style={styles.panelContent}>
                <div style={styles.buttonGroup}>
                  <button
                    onClick={() => handleFilterToggle('showMe')}
                    style={{
                      ...styles.toggleBtn,
                      ...(settings.filters.showMe ? styles.toggleBtnActive : {}),
                    }}
                  >
                    👤 Me
                  </button>
                  <button
                    onClick={() => handleFilterToggle('showOthers')}
                    style={{
                      ...styles.toggleBtn,
                      ...(settings.filters.showOthers ? styles.toggleBtnActive : {}),
                    }}
                  >
                    👥 Others
                  </button>
                  <button
                    onClick={() => handleFilterToggle('showTrusted')}
                    style={{
                      ...styles.toggleBtn,
                      ...(settings.filters.showTrusted ? styles.toggleBtnActive : {}),
                    }}
                  >
                    ✓ Trusted
                  </button>
                  <button
                    onClick={() => handleFilterToggle('showHighAlignment')}
                    style={{
                      ...styles.toggleBtn,
                      ...(settings.filters.showHighAlignment ? styles.toggleBtnActive : {}),
                    }}
                  >
                    🔥 High Alignment
                  </button>
                  <button
                    onClick={() => handleFilterToggle('showLowAlignment')}
                    style={{
                      ...styles.toggleBtn,
                      ...(settings.filters.showLowAlignment ? styles.toggleBtnActive : {}),
                    }}
                  >
                    🌱 Low Alignment
                  </button>
                </div>
                <div style={{ marginTop: '12px' }}>
                  <label style={{ fontSize: '12px', color: '#888' }}>
                    Min Similarity: {(settings.minSimilarity * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.minSimilarity * 100}
                    onChange={(e) =>
                      updateSetting('minSimilarity', Number((e.target as HTMLInputElement).value) / 100)
                    }
                    style={{ ...styles.slider, marginTop: '8px' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Sort Panel */}
          <div style={styles.panel}>
            <div style={styles.panelHeader} onClick={() => togglePanel('sort')}>
              <h4 style={styles.panelTitle}>📊 Sort Order</h4>
              <span>{settings.panelsExpanded.sort ? '▼' : '▶'}</span>
            </div>
            {settings.panelsExpanded.sort && (
              <div style={styles.panelContent}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select
                    value={settings.sortOrder}
                    onChange={handleSortOrderChange}
                    style={styles.select}
                    data-testid="sort-order-select"
                  >
                    <option value="recency">🕐 Recency</option>
                    <option value="similarity">🎯 Similarity</option>
                    <option value="activity">🔥 Activity</option>
                    <option value="alphabetical">A-Z Alphabetical</option>
                  </select>
                  <button
                    onClick={() => updateSetting('sortDescending', !settings.sortDescending)}
                    style={styles.toggleBtn}
                    title="Toggle ascending/descending"
                  >
                    {settings.sortDescending ? '↓ Desc' : '↑ Asc'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Advanced Panel */}
          <div style={styles.panel}>
            <div style={styles.panelHeader} onClick={() => togglePanel('advanced')}>
              <h4 style={styles.panelTitle}>⚙️ Advanced</h4>
              <span>{settings.panelsExpanded.advanced ? '▼' : '▶'}</span>
            </div>
            {settings.panelsExpanded.advanced && (
              <div style={styles.panelContent}>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>
                  <div>Channel ID: <code style={{ color: '#60a5fa' }}>{channel.id.slice(0, 16)}...</code></div>
                  <div>Created: {new Date(channel.createdAt).toLocaleString()}</div>
                  <div>Views: {settings.viewCount} | Last viewed: {settings.lastViewedAt > 0 ? new Date(settings.lastViewedAt).toLocaleString() : 'Never'}</div>
                </div>
                <button
                  onClick={() => settingsService.resetSettings(channel.id).then(() => settingsService.getSettings(channel.id).then(setSettings))}
                  style={{ ...styles.actionBtn, ...styles.secondaryBtn }}
                >
                  Reset to Defaults
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
