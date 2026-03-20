/**
 * Mixer Panel Component
 *
 * Compact channel control surface with progressive disclosure.
 * Default: Shows only essential controls (precision slider, view mode).
 * Expanded: Shows filters, sort, and advanced options.
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
    description: 'Broad matching',
    specificity: 20,
    minSimilarity: 0.35,
  },
  balanced: {
    name: 'Balanced',
    icon: '⚖️',
    description: 'Mix of familiar and new',
    specificity: 50,
    minSimilarity: 0.55,
  },
  focus: {
    name: 'Focus',
    icon: '🎯',
    description: 'Narrow matching',
    specificity: 80,
    minSimilarity: 0.75,
  },
};

/**
 * Render the compact Mixer Panel HTML
 */
export function renderMixerPanel(activeChannel) {
  if (!activeChannel) return '';

  const settings = channelSettingsService.getSettings(activeChannel.id);
  const { specificity, viewMode, isArchived, isMuted, panelsExpanded, filters, minSimilarity } = settings;
  const cosineThreshold = specificityToCosineThreshold(specificity);
  const specificityLabel = getSpecificityLabel(specificity);

  // Only show expanded if explicitly toggled
  const isExpanded = panelsExpanded.mixerExpanded === true;

  return `
    <div class="mixer-panel ${isExpanded ? 'mixer-panel-expanded' : ''}" data-testid="mixer-panel" data-channel-id="${escapeHtml(activeChannel.id)}">
      <!-- Compact Header (always visible) -->
      <div class="mixer-compact-header">
        <div class="mixer-channel-row">
          <h2 class="mixer-channel-name">
            ${escapeHtml(activeChannel.name)}
            ${isMuted ? '<span class="status-icon" title="Muted">🔇</span>' : ''}
          </h2>
          <select id="mixer-channel-select" class="mixer-channel-select" data-testid="channel-select">
            ${renderChannelOptions(activeChannel.id)}
          </select>
        </div>
        <div class="mixer-header-actions">
          <button class="mixer-icon-btn mixer-btn-expand" id="mixer-expand" title="${isExpanded ? 'Collapse' : 'More options'}">
            ${isExpanded ? '▼' : '▲'}
          </button>
          <button class="mixer-icon-btn" id="mixer-edit" title="Edit channel">✏️</button>
          <button class="mixer-icon-btn" id="mixer-mute" title="${isMuted ? 'Unmute' : 'Mute'}">${isMuted ? '🔇' : '🔈'}</button>
        </div>
      </div>

      <!-- Essential Controls (always visible) -->
      <div class="mixer-essential">
        <!-- Precision Slider -->
        <div class="mixer-precision-control">
          <div class="mixer-precision-header">
            <span class="mixer-control-label">🎯 Precision</span>
            <div class="mixer-precision-value">
              <span class="mixer-value-badge">${specificity}%</span>
              <span class="mixer-value-label">${specificityLabel.label}</span>
            </div>
          </div>
          <input type="range" class="mixer-slider mixer-slider-compact" id="mixer-specificity-slider"
                 min="0" max="100" value="${specificity}"
                 data-testid="specificity-slider" />
          <div class="mixer-presets-row">
            ${Object.entries(PRESETS).map(([key, preset]) => `
              <button class="mixer-preset-chip ${specificity === preset.specificity ? 'active' : ''}" 
                      data-preset="${key}"
                      title="${preset.description}">
                ${preset.icon}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- View Mode Buttons -->
        <div class="mixer-view-control">
          <span class="mixer-control-label">👁 View</span>
          <div class="mixer-button-group mixer-view-buttons">
            <button class="mixer-view-btn ${viewMode === 'list' ? 'active' : ''}" data-view-mode="list" title="List view">
              📋
            </button>
            <button class="mixer-view-btn ${viewMode === 'space' ? 'active' : ''}" data-view-mode="space" title="Space view">
              🌌
            </button>
            <button class="mixer-view-btn ${viewMode === 'grid' ? 'active' : ''}" data-view-mode="grid" title="Grid view">
              ▦
            </button>
          </div>
        </div>
      </div>

      <!-- Expanded Controls (collapsible) -->
      ${isExpanded ? `
        <div class="mixer-expanded-content">
          <!-- Filters -->
          <div class="mixer-section-compact">
            <div class="mixer-section-header-compact">
              <span class="mixer-section-title-compact">🔍 Filters</span>
            </div>
            <div class="mixer-filters-row">
              <button class="mixer-filter-chip ${filters.showMe ? 'active' : ''}" data-filter="showMe">👤 Me</button>
              <button class="mixer-filter-chip ${filters.showOthers ? 'active' : ''}" data-filter="showOthers">👥 Others</button>
              <button class="mixer-filter-chip ${filters.showTrusted ? 'active' : ''}" data-filter="showTrusted">✓ Trusted</button>
              <button class="mixer-filter-chip ${filters.showHighAlignment ? 'active' : ''}" data-filter="showHighAlignment">🔥 High</button>
              <button class="mixer-filter-chip ${filters.showLowAlignment ? 'active' : ''}" data-filter="showLowAlignment">🌱 Low</button>
            </div>
            <div class="mixer-similarity-control">
              <span class="mixer-control-label">Min similarity: <strong>${Math.round(minSimilarity * 100)}%</strong></span>
              <input type="range" class="mixer-slider mixer-slider-mini" id="mixer-similarity-slider"
                     min="0" max="100" value="${Math.round(minSimilarity * 100)}" />
            </div>
          </div>

          <!-- Sort -->
          <div class="mixer-section-compact">
            <div class="mixer-section-header-compact">
              <span class="mixer-section-title-compact">📊 Sort</span>
              <select class="mixer-select-compact" id="mixer-sort-order">
                <option value="recency" ${settings.sortOrder === 'recency' ? 'selected' : ''}>Recent</option>
                <option value="similarity" ${settings.sortOrder === 'similarity' ? 'selected' : ''}>Match</option>
                <option value="activity" ${settings.sortOrder === 'activity' ? 'selected' : ''}>Active</option>
              </select>
            </div>
          </div>

          <!-- Actions -->
          <div class="mixer-section-compact">
            <div class="mixer-actions-row">
              <button class="mixer-btn-compact" id="mixer-archive">📦 Archive</button>
              <button class="mixer-btn-compact mixer-btn-danger" id="mixer-reset">↺ Reset</button>
            </div>
          </div>
        </div>
      ` : ''}
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

  // Expand/collapse toggle
  container.querySelector('#mixer-expand')?.addEventListener('click', () => {
    channelSettingsService.togglePanel(activeChannel.id, 'mixerExpanded');
    refreshMixerPanel(container, activeChannel);
  });

  // Channel switcher
  container.querySelector('#mixer-channel-select')?.addEventListener('change', (e) => {
    const newChannelId = e.target.value;
    actions.setActiveChannel(newChannelId);
    toasts.success(`Switched to channel`);
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
      document.dispatchEvent(new CustomEvent('isc:refresh-feed'));
    });
  });

  // Precision slider
  container.querySelector('#mixer-specificity-slider')?.addEventListener('input', (e) => {
    const value = parseInt(e.target.value, 10);
    channelSettingsService.updateSettings(activeChannel.id, { specificity: value });
    refreshMixerPanel(container, activeChannel);
    document.dispatchEvent(new CustomEvent('isc:refresh-feed'));
  });

  // View mode buttons
  container.querySelectorAll('[data-view-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.viewMode;
      channelSettingsService.updateSettings(activeChannel.id, { viewMode: mode });
      refreshMixerPanel(container, activeChannel);
      document.dispatchEvent(new CustomEvent('isc:channel-view-change', { detail: { mode } }));
    });
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
      document.dispatchEvent(new CustomEvent('isc:refresh-feed'));
    });
  });

  // Similarity slider
  container.querySelector('#mixer-similarity-slider')?.addEventListener('input', (e) => {
    const value = parseInt(e.target.value, 10) / 100;
    channelSettingsService.updateSettings(activeChannel.id, { minSimilarity: value });
    refreshMixerPanel(container, activeChannel);
    document.dispatchEvent(new CustomEvent('isc:refresh-feed'));
  });

  // Sort order
  container.querySelector('#mixer-sort-order')?.addEventListener('change', (e) => {
    channelSettingsService.updateSettings(activeChannel.id, { sortOrder: e.target.value });
    document.dispatchEvent(new CustomEvent('isc:refresh-feed'));
  });

  // Edit button
  container.querySelector('#mixer-edit')?.addEventListener('click', () => {
    showEditModal(activeChannel);
  });

  // Mute button
  container.querySelector('#mixer-mute')?.addEventListener('click', () => {
    const settings = channelSettingsService.getSettings(activeChannel.id);
    if (settings.isMuted) {
      channelSettingsService.unmuteChannel(activeChannel.id);
      toasts.info('Channel unmuted');
    } else {
      channelSettingsService.muteChannel(activeChannel.id);
      toasts.info('Channel muted');
    }
    refreshMixerPanel(container, activeChannel);
  });

  // Archive button
  container.querySelector('#mixer-archive')?.addEventListener('click', () => {
    const confirmed = confirm('Archive this channel?');
    if (confirmed) {
      channelSettingsService.archiveChannel(activeChannel.id);
      toasts.info('Channel archived');
      refreshMixerPanel(container, activeChannel);
      document.dispatchEvent(new CustomEvent('isc:refresh-channels'));
    }
  });

  // Reset button
  container.querySelector('#mixer-reset')?.addEventListener('click', () => {
    const confirmed = confirm('Reset all settings to defaults?');
    if (confirmed) {
      channelSettingsService.resetSettings(activeChannel.id);
      toasts.info('Settings reset');
      refreshMixerPanel(container, activeChannel);
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
