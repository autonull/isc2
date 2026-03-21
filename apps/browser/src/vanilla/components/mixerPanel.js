/**
 * Mixer Panel Component
 *
 * Compact channel control surface with progressive disclosure.
 */

import { channelSettingsService, getSpecificityLabel } from '../../services/channelSettings.js';
import { channelService, networkService } from '../../services/index.js';
import { toasts } from '../../utils/toast.js';
import { escapeHtml } from '../../utils/dom.js';
import { getMultilingualService } from '../../services/multilingual.ts';
import { getState, actions } from '../../state.js';

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

const VIEW_MODES = [
  { mode: 'list', icon: '📋', label: 'List view' },
  { mode: 'space', icon: '🌌', label: 'Space view' },
  { mode: 'grid', icon: '▦', label: 'Grid view' },
];

const FILTERS = [
  { key: 'showMe', icon: '👤', label: 'Me' },
  { key: 'showOthers', icon: '👥', label: 'Others' },
  { key: 'showTrusted', icon: '✓', label: 'Trusted' },
  { key: 'showHighAlignment', icon: '🔥', label: 'High' },
  { key: 'showLowAlignment', icon: '🌱', label: 'Low' },
];

const SORT_OPTIONS = [
  { value: 'recency', label: 'Recent' },
  { value: 'similarity', label: 'Match' },
  { value: 'activity', label: 'Active' },
];

export function renderMixerPanel(activeChannel) {
  if (!activeChannel) return '';

  const settings = channelSettingsService.getSettings(activeChannel.id);
  const { specificity, viewMode, isMuted, panelsExpanded, filters, minSimilarity, sortOrder } =
    settings;
  const specificityLabel = getSpecificityLabel(specificity);
  const isExpanded = panelsExpanded.mixerExpanded;
  const isLurker = activeChannel.isLurker ?? false;

  return `
<div class="mixer-panel ${isExpanded ? 'mixer-panel-expanded' : ''}" data-channel-id="${escapeHtml(activeChannel.id)}">
  ${renderHeader(activeChannel, isMuted, isLurker, isExpanded)}
  ${renderEssentialControls(specificity, specificityLabel, viewMode)}
  ${isExpanded ? renderExpandedContent(filters, minSimilarity, sortOrder) : ''}
</div>
`;
}

function renderHeader(channel, isMuted, isLurker, isExpanded) {
  return `
<div class="mixer-compact-header">
  <h2 class="mixer-channel-name">
    ${escapeHtml(channel.name)}
    ${isMuted ? '<span class="status-icon" title="Muted">🔇</span>' : ''}
    ${isLurker ? '<span class="status-icon" title="Lurk mode - not included in your vector">👁</span>' : ''}
  </h2>
  <div class="mixer-header-actions">
    <button class="mixer-icon-btn mixer-btn-expand" id="mixer-expand" title="${isExpanded ? 'Collapse' : 'More options'}">
      ${isExpanded ? '▼' : '▲'}
    </button>
    <button class="mixer-icon-btn" id="mixer-edit" title="Edit channel">✏️</button>
    <button class="mixer-icon-btn" id="mixer-mute" title="${isMuted ? 'Unmute' : 'Mute'}">${isMuted ? '🔇' : '🔈'}</button>
    <button class="mixer-icon-btn" id="mixer-lurk" title="${isLurker ? 'Stop lurk mode' : "Lurk (don't include in my vector)"}">${isLurker ? '👁' : '👁‍🗨'}</button>
  </div>
</div>
`;
}

function renderEssentialControls(specificity, specificityLabel, viewMode) {
  return `
    <div class="mixer-essential">
      ${renderPrecisionControl(specificity, specificityLabel)}
      ${renderViewControl(viewMode)}
    </div>
  `;
}

function renderPrecisionControl(specificity, specificityLabel) {
  return `
    <div class="mixer-precision-control">
      <div class="mixer-precision-header">
        <span class="mixer-control-label">🎯 Precision</span>
        <div class="mixer-precision-value">
          <span class="mixer-value-badge">${specificity}%</span>
          <span class="mixer-value-label">${specificityLabel.label}</span>
        </div>
      </div>
      <input type="range" class="mixer-slider mixer-slider-compact" id="mixer-specificity-slider"
             min="0" max="100" value="${specificity}" />
      <div class="mixer-presets-row">
        ${Object.entries(PRESETS)
          .map(
            ([key, preset]) => `
          <button class="mixer-preset-chip ${specificity === preset.specificity ? 'active' : ''}"
                  data-preset="${key}" title="${preset.description}">
            ${preset.icon}
          </button>
        `
          )
          .join('')}
      </div>
    </div>
  `;
}

function renderViewControl(viewMode) {
  return `
    <div class="mixer-view-control">
      <span class="mixer-control-label">👁 View</span>
      <div class="mixer-button-group mixer-view-buttons">
        ${VIEW_MODES.map(
          ({ mode, icon, label }) => `
          <button class="mixer-view-btn ${viewMode === mode ? 'active' : ''}"
                  data-view-mode="${mode}" title="${label}">
            ${icon}
          </button>
        `
        ).join('')}
      </div>
    </div>
  `;
}

function renderExpandedContent(filters, minSimilarity, sortOrder) {
  return `
    <div class="mixer-expanded-content">
      ${renderFiltersSection(filters, minSimilarity)}
      ${renderSortSection(sortOrder)}
      ${renderActionsSection()}
    </div>
  `;
}

function renderFiltersSection(filters, minSimilarity) {
  return `
    <div class="mixer-section-compact">
      <div class="mixer-section-header-compact">
        <span class="mixer-section-title-compact">🔍 Filters</span>
      </div>
      <div class="mixer-filters-row">
        ${FILTERS.map(
          ({ key, icon, label }) => `
          <button class="mixer-filter-chip ${filters[key] ? 'active' : ''}" data-filter="${key}">
            ${icon} ${label}
          </button>
        `
        ).join('')}
      </div>
      <div class="mixer-similarity-control">
        <span class="mixer-control-label">Min similarity: <strong>${Math.round(minSimilarity * 100)}%</strong></span>
        <input type="range" class="mixer-slider mixer-slider-mini" id="mixer-similarity-slider"
               min="0" max="100" value="${Math.round(minSimilarity * 100)}" />
      </div>
    </div>
  `;
}

function renderSortSection(sortOrder) {
  return `
    <div class="mixer-section-compact">
      <div class="mixer-section-header-compact">
        <span class="mixer-section-title-compact">📊 Sort</span>
        <select class="mixer-select-compact" id="mixer-sort-order">
          ${SORT_OPTIONS.map(
            ({ value, label }) => `
            <option value="${value}" ${sortOrder === value ? 'selected' : ''}>${label}</option>
          `
          ).join('')}
        </select>
      </div>
    </div>
  `;
}

function renderActionsSection() {
  return `
    <div class="mixer-section-compact">
      <div class="mixer-actions-row">
        <button class="mixer-btn-compact" id="mixer-archive">📦 Archive</button>
        <button class="mixer-btn-compact mixer-btn-danger" id="mixer-reset">↺ Reset</button>
      </div>
    </div>
  `;
}

export function renderEditModal(channel) {
  const langService = getMultilingualService();
  const currentLang = langService.getCurrentLanguage();
  const langLabel = currentLang ? `${currentLang.flag} ${currentLang.name}` : '';

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
                   value="${escapeHtml(channel.name)}" placeholder="Channel name" autofocus />
          </div>
          <div class="form-group">
            <label for="edit-channel-description">
              Description
              <span id="lang-indicator" class="lang-indicator" style="display:none">${escapeHtml(langLabel)}</span>
            </label>
            <textarea id="edit-channel-description" class="form-textarea"
                      rows="4" placeholder="Channel description">${escapeHtml(channel.description || '')}</textarea>
            <span class="form-hint" id="edit-lang-hint" style="display:none"></span>
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

export function bindMixerPanel(container, activeChannel) {
  if (!activeChannel) return;

  on('#mixer-expand', toggleExpanded);
  on('#mixer-specificity-slider', 'input', updateSpecificity);
  on('#mixer-similarity-slider', 'input', updateSimilarity);
  on('#mixer-sort-order', 'change', updateSortOrder);
  onAll('[data-preset]', 'click', applyPreset);
  onAll('[data-view-mode]', 'click', setViewMode);
  onAll('[data-filter]', 'click', toggleFilter);
  on('#mixer-edit', 'click', openEditModal);
  on('#mixer-mute', 'click', toggleMute);
  on('#mixer-lurk', 'click', toggleLurk);
  on('#mixer-archive', 'click', archiveChannel);
  on('#mixer-reset', 'click', resetSettings);

  function on(selector, event, handler) {
    container.querySelector(selector)?.addEventListener(event, handler);
  }

  function onAll(selector, event, handler) {
    container.querySelectorAll(selector).forEach((el) => el.addEventListener(event, handler));
  }

  function toggleExpanded() {
    channelSettingsService.togglePanel(activeChannel.id, 'mixerExpanded');
    refreshMixerPanel(container, activeChannel);
  }

  function applyPreset(e) {
    const preset = PRESETS[e.target.dataset.preset];
    if (!preset) return;
    channelSettingsService.updateSettings(activeChannel.id, {
      specificity: preset.specificity,
      minSimilarity: preset.minSimilarity,
    });
    refreshMixerPanel(container, activeChannel);
    toasts.success(`Applied ${preset.name} preset`);
    document.dispatchEvent(new CustomEvent('isc:refresh-feed'));
  }

  function updateSpecificity(e) {
    const value = parseInt(e.target.value, 10);
    channelSettingsService.updateSettings(activeChannel.id, { specificity: value });
    refreshMixerPanel(container, activeChannel);
    document.dispatchEvent(new CustomEvent('isc:refresh-feed'));
  }

  function setViewMode(e) {
    const mode = e.target.dataset.viewMode;
    channelSettingsService.updateSettings(activeChannel.id, { viewMode: mode });
    refreshMixerPanel(container, activeChannel);
    document.dispatchEvent(new CustomEvent('isc:channel-view-change', { detail: { mode } }));
  }

  function toggleFilter(e) {
    const filterType = e.target.dataset.filter;
    const settings = channelSettingsService.getSettings(activeChannel.id);
    channelSettingsService.updateSettings(activeChannel.id, {
      filters: { ...settings.filters, [filterType]: !settings.filters[filterType] },
    });
    refreshMixerPanel(container, activeChannel);
    document.dispatchEvent(new CustomEvent('isc:refresh-feed'));
  }

  function updateSimilarity(e) {
    const value = parseInt(e.target.value, 10) / 100;
    channelSettingsService.updateSettings(activeChannel.id, { minSimilarity: value });
    refreshMixerPanel(container, activeChannel);
    document.dispatchEvent(new CustomEvent('isc:refresh-feed'));
  }

  function updateSortOrder(e) {
    channelSettingsService.updateSettings(activeChannel.id, { sortOrder: e.target.value });
    document.dispatchEvent(new CustomEvent('isc:refresh-feed'));
  }

  function openEditModal() {
    showEditModal(activeChannel);
  }

  function toggleMute() {
    const settings = channelSettingsService.getSettings(activeChannel.id);
    const action = settings.isMuted ? 'unmuteChannel' : 'muteChannel';
    channelSettingsService[action](activeChannel.id);
    toasts.info(settings.isMuted ? 'Channel unmuted' : 'Channel muted');
    refreshMixerPanel(container, activeChannel);
  }

  async function toggleLurk() {
    const channel = activeChannel;
    const isLurker = channel.isLurker ?? false;
    try {
      await networkService.setChannelLurkMode(channel.id, !isLurker);
      toasts.info(
        isLurker
          ? 'Channel added to your vector'
          : 'Channel set to lurk mode - not included in your semantic position'
      );
      refreshMixerPanel(container, activeChannel);
      document.dispatchEvent(new CustomEvent('isc:refresh-feed'));
    } catch (err) {
      toasts.error('Failed to update lurk mode: ' + err.message);
    }
  }

  function archiveChannel() {
    if (!confirm('Archive this channel?')) return;
    channelSettingsService.archiveChannel(activeChannel.id);
    toasts.info('Channel archived');
    refreshMixerPanel(container, activeChannel);
    document.dispatchEvent(new CustomEvent('isc:refresh-channels'));
  }

  function resetSettings() {
    if (!confirm('Reset all settings to defaults?')) return;
    channelSettingsService.resetSettings(activeChannel.id);
    toasts.info('Settings reset');
    refreshMixerPanel(container, activeChannel);
  }
}

function showEditModal(channel) {
  const tempContainer = document.createElement('div');
  tempContainer.innerHTML = renderEditModal(channel);
  const modal = tempContainer.firstElementChild;
  document.body.appendChild(modal);

  const close = () => modal.remove();

  on('#edit-modal-close', 'click', close);
  on('#edit-modal-cancel', 'click', close);
  on('#edit-modal-save', 'click', saveChanges);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  document.addEventListener('keydown', function handleEscape(e) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', handleEscape);
    }
  });

  function on(selector, event, handler) {
    document.querySelector(selector)?.addEventListener(event, handler);
  }

  const langService = getMultilingualService();
  const SUPPORTED_LANGS = langService.getSupportedLanguages();
  let langDebounceTimer = null;

  function updateLangIndicator(text) {
    const indicator = document.querySelector('#lang-indicator');
    const hint = document.querySelector('#edit-lang-hint');
    if (!indicator || !hint) return;

    if (!text || text.length < 3) {
      indicator.style.display = 'none';
      hint.style.display = 'none';
      return;
    }

    const detected = langService.detectLanguage(text);
    const lang = SUPPORTED_LANGS.find((l) => l.code === detected);
    if (lang && detected !== 'en') {
      indicator.style.display = 'inline';
      indicator.textContent = `${lang.flag} ${lang.name}`;
      hint.style.display = 'inline';
      hint.textContent =
        'Tip: Matching works across languages — your meaning is translated automatically.';
    } else {
      indicator.style.display = 'none';
      hint.style.display = 'none';
    }
  }

  document.querySelector('#edit-channel-description')?.addEventListener('input', (e) => {
    clearTimeout(langDebounceTimer);
    langDebounceTimer = setTimeout(() => updateLangIndicator(e.target.value), 300);
  });

  async function saveChanges() {
    const name = document.querySelector('#edit-channel-name')?.value.trim();
    const description = document.querySelector('#edit-channel-description')?.value.trim() || '';

    if (!name || name.length < 3) {
      toasts.error('Channel name must be at least 3 characters');
      return;
    }

    try {
      await channelService.update(channel.id, { name, description });
      actions.setActiveChannel(channel.id);
      close();
      toasts.success('Channel updated');
      refreshCurrentMixerPanel();
    } catch (err) {
      toasts.error('Failed to update channel: ' + err.message);
    }
  }

  function refreshCurrentMixerPanel() {
    const mixerPanel = document.querySelector('.mixer-panel');
    if (!mixerPanel) return;
    const { channels, activeChannelId } = getState();
    const updatedChannel = channels.find((c) => c.id === activeChannelId);
    if (updatedChannel) refreshMixerPanel(mixerPanel, updatedChannel);
  }
}

export function refreshMixerPanel(container, activeChannel) {
  const mixerPanel = container.querySelector('.mixer-panel');
  if (!mixerPanel) return;

  const newPanel = document.createElement('div');
  newPanel.innerHTML = renderMixerPanel(activeChannel);
  mixerPanel.replaceWith(newPanel.firstElementChild);
  bindMixerPanel(newPanel, activeChannel);
}

export function initMixerPanel(container, activeChannel) {
  const mixerContainer = container.querySelector('#mixer-container');
  if (!mixerContainer) return;

  mixerContainer.innerHTML = renderMixerPanel(activeChannel);
  bindMixerPanel(mixerContainer, activeChannel);
}
