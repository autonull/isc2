/**
 * Mixer Panel Component
 *
 * Channel control surface with progressive disclosure.
 * Renders the full Mixer UI with all adjustable parameters.
 */

import { getState, actions } from '../../state.js';
import { channelSettingsService, specificityToCosineThreshold, getSpecificityLabel } from '../../services/channelSettings.js';
import { escapeHtml } from '../../utils/dom.js';
import { channelService } from '../../services/index.js';
import { toasts } from '../../utils/toast.js';

/**
 * Preset configurations for quick access
 */
const PRESETS = {
  discovery: {
    name: 'Discovery',
    icon: '🌍',
    description: 'Broad matching - find diverse perspectives',
    specificity: 20,
    minSimilarity: 0.35,
  },
  balanced: {
    name: 'Balanced',
    icon: '⚖️',
    description: 'Mix of familiar and new ideas',
    specificity: 50,
    minSimilarity: 0.55,
  },
  focus: {
    name: 'Focus',
    icon: '🎯',
    description: 'Narrow matching - deep dive into topics',
    specificity: 80,
    minSimilarity: 0.75,
  },
};

/**
 * Render the Mixer Panel HTML
 */
export function renderMixerPanel(activeChannel) {
  if (!activeChannel) return '';

  const settings = channelSettingsService.getSettings(activeChannel.id);
  const { specificity, viewMode, isArchived, isMuted, panelsExpanded, filters, minSimilarity, sortOrder, sortDescending } = settings;
  const cosineThreshold = specificityToCosineThreshold(specificity);
  const specificityLabel = getSpecificityLabel(specificity);

  // Determine which panels should be expanded by default
  const defaultExpanded = {
    view: true, // Always show view mode
    specificity: true, // Always show precision - it's the key feature
    filters: panelsExpanded.filters,
    sort: panelsExpanded.sort,
    advanced: panelsExpanded.advanced,
  };

  return `
    <div class="mixer-panel" data-testid="mixer-panel" data-channel-id="${escapeHtml(activeChannel.id)}">
      <!-- Header Row: Channel Info + Status + Actions -->
      <div class="mixer-header">
        <div class="mixer-channel-info">
          <div class="mixer-channel-row">
            <h2 class="mixer-channel-name">
              ${escapeHtml(activeChannel.name)}
              ${isMuted ? '<span class="status-icon" title="Muted">🔇</span>' : ''}
              ${isArchived ? '<span class="status-icon" title="Archived">📦</span>' : ''}
            </h2>
            <div class="mixer-channel-switcher">
              <span class="mixer-label-inline">Channel:</span>
              <select id="mixer-channel-select" class="mixer-channel-select" data-testid="channel-select">
                ${renderChannelOptions(activeChannel.id)}
              </select>
            </div>
          </div>
          ${activeChannel.description ? `
            <p class="mixer-channel-description">${escapeHtml(activeChannel.description)}</p>
          ` : `
            <p class="mixer-channel-description empty">Click edit to add a description</p>
          `}
        </div>
        <div class="mixer-actions">
          <button class="mixer-icon-btn" id="mixer-edit" title="Edit channel" data-testid="edit-channel-btn">✏️</button>
          <button class="mixer-icon-btn" id="mixer-mute" title="${isMuted ? 'Unmute' : 'Mute'}">${isMuted ? '🔇' : '🔈'}</button>
          <button class="mixer-icon-btn" id="mixer-archive" title="Archive channel">📦</button>
        </div>
      </div>

      <!-- Quick Presets Bar -->
      <div class="mixer-presets">
        <span class="mixer-presets-label">Quick presets:</span>
        <div class="mixer-button-group">
          ${Object.entries(PRESETS).map(([key, preset]) => `
            <button class="mixer-preset-btn ${specificity === preset.specificity ? 'active' : ''}" 
                    data-preset="${key}"
                    title="${preset.description}">
              ${preset.icon} ${preset.name}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Precision Panel (Always Expanded) -->
      <div class="mixer-section mixer-section-primary">
        <div class="mixer-section-header">
          <div>
            <h4 class="mixer-section-title">🎯 Precision</h4>
            <p class="mixer-section-description">
              Controls how closely posts must match your channel's topic.
              <span class="mixer-help-toggle" title="Higher precision = more focused, fewer posts. Lower = more diverse, broader matching.">ⓘ</span>
            </p>
          </div>
        </div>
        <div class="mixer-section-content">
          <div class="mixer-slider-with-values">
            <input type="range" class="mixer-slider" id="mixer-specificity-slider"
                   min="0" max="100" value="${specificity}"
                   data-testid="specificity-slider" />
            <div class="mixer-slider-labels">
              <span>Broad</span>
              <span>Balanced</span>
              <span>Narrow</span>
            </div>
          </div>
          <div class="mixer-value-row mixer-value-row-highlight">
            <span class="mixer-value-item">
              <span class="mixer-value-label">Specificity</span>
              <span class="mixer-value-strong">${specificity}%</span>
            </span>
            <span class="mixer-value-item">
              <span class="mixer-value-label">Cosine threshold</span>
              <span class="mixer-value-strong">${cosineThreshold.toFixed(2)}</span>
            </span>
            <span class="mixer-value-item">
              <span class="mixer-value-label">${specificityLabel.icon}</span>
              <span class="mixer-value-strong">${specificityLabel.label}</span>
            </span>
          </div>
        </div>
      </div>

      <!-- View Mode Panel (Always Expanded) -->
      <div class="mixer-section mixer-section-primary">
        <div class="mixer-section-header">
          <h4 class="mixer-section-title">👁 View Mode</h4>
        </div>
        <div class="mixer-section-content">
          <div class="mixer-button-group">
            <button class="mixer-toggle-btn ${viewMode === 'list' ? 'active' : ''}" data-view-mode="list" data-testid="view-mode-list">
              📋 List
            </button>
            <button class="mixer-toggle-btn ${viewMode === 'space' ? 'active' : ''}" data-view-mode="space" data-testid="view-mode-space">
              🌌 Space
            </button>
            <button class="mixer-toggle-btn ${viewMode === 'grid' ? 'active' : ''}" data-view-mode="grid" data-testid="view-mode-grid">
              ▦ Grid
            </button>
          </div>
        </div>
      </div>

      <!-- Filters Panel -->
      <div class="mixer-section">
        <div class="mixer-section-header" id="mixer-toggle-filters" style="cursor:pointer">
          <h4 class="mixer-section-title">🔍 Filters</h4>
          <span class="mixer-toggle-icon">${defaultExpanded.filters ? '▼' : '▶'}</span>
        </div>
        ${defaultExpanded.filters ? `
          <div class="mixer-section-content">
            <div class="mixer-button-group">
              <button class="mixer-toggle-btn ${filters.showMe ? 'active' : ''}" data-filter="showMe">👤 My posts</button>
              <button class="mixer-toggle-btn ${filters.showOthers ? 'active' : ''}" data-filter="showOthers">👥 Others</button>
              <button class="mixer-toggle-btn ${filters.showTrusted ? 'active' : ''}" data-filter="showTrusted">✓ Trusted</button>
              <button class="mixer-toggle-btn ${filters.showHighAlignment ? 'active' : ''}" data-filter="showHighAlignment">🔥 High alignment</button>
              <button class="mixer-toggle-btn ${filters.showLowAlignment ? 'active' : ''}" data-filter="showLowAlignment">🌱 Low alignment</button>
            </div>
            <div class="mixer-filter-row">
              <label class="mixer-label">
                Min similarity: <strong>${Math.round(minSimilarity * 100)}%</strong>
                <span class="mixer-help-toggle" title="Posts below this similarity threshold will be hidden">ⓘ</span>
              </label>
              <input type="range" class="mixer-slider" id="mixer-similarity-slider"
                     min="0" max="100" value="${Math.round(minSimilarity * 100)}" />
            </div>
          </div>
        ` : ''}
      </div>

      <!-- Sort Panel -->
      <div class="mixer-section">
        <div class="mixer-section-header" id="mixer-toggle-sort" style="cursor:pointer">
          <h4 class="mixer-section-title">📊 Sort Order</h4>
          <span class="mixer-toggle-icon">${defaultExpanded.sort ? '▼' : '▶'}</span>
        </div>
        ${defaultExpanded.sort ? `
          <div class="mixer-section-content">
            <div class="mixer-sort-row">
              <select class="mixer-select" id="mixer-sort-order" data-testid="sort-order-select">
                <option value="recency" ${sortOrder === 'recency' ? 'selected' : ''}>🕐 Most recent</option>
                <option value="similarity" ${sortOrder === 'similarity' ? 'selected' : ''}>🎯 Best match</option>
                <option value="activity" ${sortOrder === 'activity' ? 'selected' : ''}>🔥 Most active</option>
                <option value="alphabetical" ${sortOrder === 'alphabetical' ? 'selected' : ''}>A-Z Alphabetical</option>
              </select>
              <button class="mixer-toggle-btn" id="mixer-sort-direction" title="Toggle ascending/descending">
                ${sortDescending ? '↓ Descending' : '↑ Ascending'}
              </button>
            </div>
          </div>
        ` : ''}
      </div>

      <!-- Advanced Panel -->
      <div class="mixer-section">
        <div class="mixer-section-header" id="mixer-toggle-advanced" style="cursor:pointer">
          <h4 class="mixer-section-title">⚙️ Advanced</h4>
          <span class="mixer-toggle-icon">${defaultExpanded.advanced ? '▼' : '▶'}</span>
        </div>
        ${defaultExpanded.advanced ? `
          <div class="mixer-section-content">
            <div class="mixer-advanced-info">
              <div>Channel ID: <code>${escapeHtml(activeChannel.id.slice(0, 16))}...</code></div>
              <div>Created: ${new Date(activeChannel.createdAt).toLocaleString()}</div>
              <div>Views: ${settings.viewCount} | Last viewed: ${settings.lastViewedAt > 0 ? new Date(settings.lastViewedAt).toLocaleString() : 'Never'}</div>
            </div>
            <div class="mixer-advanced-actions">
              <button class="mixer-btn mixer-btn-secondary" id="mixer-reset">Reset to defaults</button>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Render channel options for the select dropdown
 */
function renderChannelOptions(activeChannelId) {
  const { channels } = getState();
  if (!channels || channels.length === 0) return '';

  return channels.map(ch => `
    <option value="${escapeHtml(ch.id)}" ${ch.id === activeChannelId ? 'selected' : ''}>
      #${escapeHtml(ch.name)}
    </option>
  `).join('');
}

/**
 * Edit Channel Modal
 */
export function renderEditModal(channel) {
  return `
    <div class="modal-overlay" id="edit-modal-overlay">
      <div class="modal-content mixer-edit-modal">
        <div class="modal-header">
          <h3>Edit Channel</h3>
          <button class="modal-close" id="edit-modal-close">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="edit-channel-name">Channel Name</label>
            <input type="text" id="edit-channel-name" class="form-input" 
                   value="${escapeHtml(channel.name)}" 
                   placeholder="Channel name" autofocus />
          </div>
          <div class="form-group">
            <label for="edit-channel-description">Description</label>
            <textarea id="edit-channel-description" class="form-textarea" 
                      rows="4" placeholder="Channel description">${escapeHtml(channel.description || '')}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="mixer-btn mixer-btn-secondary" id="edit-modal-cancel">Cancel</button>
          <button class="mixer-btn mixer-btn-primary" id="edit-modal-save">Save Changes</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Bind event handlers for the Mixer Panel
 */
export function bindMixerPanel(container, activeChannel) {
  if (!activeChannel) return;

  // Channel switcher
  container.querySelector('#mixer-channel-select')?.addEventListener('change', (e) => {
    const newChannelId = e.target.value;
    actions.setActiveChannel(newChannelId);
    toasts.success(`Switched to #${activeChannel.name}`);
    // Refresh the page to show new channel content
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('isc:refresh-feed'));
    }, 100);
  });

  // Preset buttons
  container.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const presetKey = btn.dataset.preset;
      const preset = PRESETS[presetKey];
      if (!preset) return;

      channelSettingsService.updateSettings(activeChannel.id, {
        specificity: preset.specificity,
        minSimilarity: preset.minSimilarity,
      });
      refreshMixerPanel(container, activeChannel);
      toasts.success(`Applied ${preset.name} preset`);

      // Trigger feed refresh
      document.dispatchEvent(new CustomEvent('isc:channel-sort-change', {
        detail: { specificity: preset.specificity, minSimilarity: preset.minSimilarity }
      }));
    });
  });

  // Panel toggle handlers (for collapsible sections)
  const togglePanels = ['filters', 'sort', 'advanced'];
  togglePanels.forEach(panel => {
    const toggle = container.querySelector(`#mixer-toggle-${panel}`);
    toggle?.addEventListener('click', () => {
      channelSettingsService.togglePanel(activeChannel.id, panel);
      refreshMixerPanel(container, activeChannel);
    });
  });

  // View mode buttons
  container.querySelectorAll('[data-view-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.viewMode;
      channelSettingsService.updateSettings(activeChannel.id, { viewMode: mode });
      refreshMixerPanel(container, activeChannel);
      // Dispatch event for view change
      document.dispatchEvent(new CustomEvent('isc:channel-view-change', { detail: { mode } }));
    });
  });

  // Specificity slider
  const specificitySlider = container.querySelector('#mixer-specificity-slider');
  specificitySlider?.addEventListener('input', (e) => {
    const value = parseInt(e.target.value, 10);
    channelSettingsService.updateSettings(activeChannel.id, { specificity: value });
    refreshMixerPanel(container, activeChannel);
  });

  // Similarity slider
  const similaritySlider = container.querySelector('#mixer-similarity-slider');
  similaritySlider?.addEventListener('input', (e) => {
    const value = parseInt(e.target.value, 10) / 100;
    channelSettingsService.updateSettings(activeChannel.id, { minSimilarity: value });
    refreshMixerPanel(container, activeChannel);
  });

  // Filter buttons
  container.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const filterType = btn.dataset.filter;
      const settings = channelSettingsService.getSettings(activeChannel.id);
      const newValue = !settings.filters[filterType];
      channelSettingsService.updateSettings(activeChannel.id, {
        filters: { ...settings.filters, [filterType]: newValue },
      });
      refreshMixerPanel(container, activeChannel);
    });
  });

  // Sort order select
  const sortSelect = container.querySelector('#mixer-sort-order');
  sortSelect?.addEventListener('change', (e) => {
    channelSettingsService.updateSettings(activeChannel.id, { sortOrder: e.target.value });
    document.dispatchEvent(new CustomEvent('isc:channel-sort-change', { 
      detail: { sortOrder: e.target.value } 
    }));
  });

  // Sort direction toggle
  const sortDirBtn = container.querySelector('#mixer-sort-direction');
  sortDirBtn?.addEventListener('click', () => {
    const settings = channelSettingsService.getSettings(activeChannel.id);
    channelSettingsService.updateSettings(activeChannel.id, { sortDescending: !settings.sortDescending });
    refreshMixerPanel(container, activeChannel);
    document.dispatchEvent(new CustomEvent('isc:channel-sort-change', { 
      detail: { sortDescending: !settings.sortDescending } 
    }));
  });

  // Action buttons
  container.querySelector('#mixer-edit')?.addEventListener('click', () => {
    showEditModal(activeChannel);
  });

  container.querySelector('#mixer-mute')?.addEventListener('click', () => {
    const settings = channelSettingsService.getSettings(activeChannel.id);
    if (settings.isMuted) {
      channelSettingsService.unmuteChannel(activeChannel.id);
    } else {
      channelSettingsService.muteChannel(activeChannel.id);
    }
    refreshMixerPanel(container, activeChannel);
  });

  container.querySelector('#mixer-archive')?.addEventListener('click', () => {
    const confirmed = confirm('Archive this channel? It will be hidden from the main view.');
    if (confirmed) {
      channelSettingsService.archiveChannel(activeChannel.id);
      refreshMixerPanel(container, activeChannel);
      toasts.info('Channel archived');
      document.dispatchEvent(new CustomEvent('isc:refresh-channels'));
    }
  });

  // Reset button
  container.querySelector('#mixer-reset')?.addEventListener('click', () => {
    const confirmed = confirm('Reset all settings for this channel to defaults?');
    if (confirmed) {
      channelSettingsService.resetSettings(activeChannel.id);
      refreshMixerPanel(container, activeChannel);
      toasts.info('Settings reset to defaults');
    }
  });
}

/**
 * Show edit channel modal
 */
function showEditModal(channel) {
  const modalHtml = renderEditModal(channel);
  const tempContainer = document.createElement('div');
  tempContainer.innerHTML = modalHtml;
  const modal = tempContainer.firstElementChild;
  document.body.appendChild(modal);

  // Bind modal events
  const closeBtn = document.querySelector('#edit-modal-close');
  const cancelBtn = document.querySelector('#edit-modal-cancel');
  const saveBtn = document.querySelector('#edit-modal-save');
  const nameInput = document.querySelector('#edit-channel-name');
  const descInput = document.querySelector('#edit-channel-description');

  const closeModal = () => {
    modal.remove();
  };

  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);

  saveBtn?.addEventListener('click', async () => {
    const newName = nameInput?.value.trim();
    const newDesc = descInput?.value.trim();

    if (!newName || newName.length < 3) {
      toasts.error('Channel name must be at least 3 characters');
      return;
    }

    try {
      await channelService.update(channel.id, {
        name: newName,
        description: newDesc,
      });
      actions.setActiveChannel(channel.id); // Trigger state update
      closeModal();
      toasts.success('Channel updated');

      // Refresh the mixer panel
      const mixerPanel = document.querySelector('.mixer-panel');
      if (mixerPanel) {
        const { channels, activeChannelId } = getState();
        const updatedChannel = channels.find(c => c.id === activeChannelId);
        if (updatedChannel) {
          refreshMixerPanel(mixerPanel, updatedChannel);
        }
      }
    } catch (err) {
      toasts.error('Failed to update channel: ' + err.message);
    }
  });

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Close on Escape
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

/**
 * Refresh the Mixer Panel after settings change
 */
export function refreshMixerPanel(container, activeChannel) {
  const mixerPanel = container.querySelector('.mixer-panel');
  if (!mixerPanel) return;

  const newHtml = renderMixerPanel(activeChannel);
  const tempContainer = document.createElement('div');
  tempContainer.innerHTML = newHtml;
  const newPanel = tempContainer.firstElementChild;

  mixerPanel.replaceWith(newPanel);
  bindMixerPanel(newPanel, activeChannel);
}

/**
 * Initialize the Mixer Panel in a container
 */
export function initMixerPanel(container, activeChannel) {
  const mixerContainer = container.querySelector('#mixer-container');
  if (!mixerContainer) return;

  mixerContainer.innerHTML = renderMixerPanel(activeChannel);
  bindMixerPanel(mixerContainer, activeChannel);
}
