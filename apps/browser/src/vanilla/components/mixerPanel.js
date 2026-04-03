/**
 * Mixer Panel Component
 *
 * Compact channel control surface with progressive disclosure.
 * OOP class with self-contained state and scoped event handling.
 */

import { channelSettingsService, getSpecificityLabel } from '../../services/index.js';
import { channelService, networkService } from '../../services/index.js';
import { toast as toasts } from '../../utils/toast.ts';
import { escapeHtml, isMobile } from '../utils/dom.js';
import { getMultilingualService } from '../../services/multilingual.ts';
import { getState, actions } from '../../state.js';
import { modals } from './modal.js';

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

class MixerPanelComponent {
  #container;
  #channel;
  #boundHandlers = [];

  constructor(container, channel) {
    this.#container = container;
    this.#channel = channel;
    this.#render();
    this.#bind();
  }

  get channel() {
    return this.#channel;
  }

  setChannel(channel) {
    this.#channel = channel;
    this.#render();
    this.#bind();
  }

  #getSettings() {
    return this.#channel ? channelSettingsService.getSettings(this.#channel.id) : {};
  }

  #render() {
    if (!this.#channel) {
      this.#container.innerHTML = '';
      return;
    }

    const settings = this.#getSettings();
    const { specificity, viewMode, isMuted, panelsExpanded, filters, minSimilarity, sortOrder } =
      settings;
    const specificityLabel = getSpecificityLabel(specificity);
    const isExpanded = isMobile()
      ? (panelsExpanded?.mixerExpanded ?? false)
      : (panelsExpanded?.mixerExpanded ?? true);
    const isLurker = this.#channel.isLurker ?? false;

    this.#container.innerHTML = `
      <div class="mixer-panel ${isExpanded ? 'mixer-panel-expanded' : ''}" data-channel-id="${escapeHtml(this.#channel.id)}">
        ${this.#renderHeader(isMuted, isLurker, isExpanded)}
        ${this.#renderEssentialControls(specificity, specificityLabel, viewMode)}
        ${isExpanded ? this.#renderExpandedContent(filters, minSimilarity, sortOrder) : ''}
      </div>
    `;
  }

  #renderHeader(isMuted, isLurker, isExpanded) {
    return `
      <div class="mixer-compact-header">
        <h2 class="mixer-channel-name">
          ${escapeHtml(this.#channel.name)}
          ${isMuted ? '<span class="status-icon" title="Muted">🔇</span>' : ''}
          ${isLurker ? '<span class="status-icon" title="Lurk mode - not included in your vector">👁</span>' : ''}
        </h2>
        <div class="mixer-header-actions">
          <button class="mixer-icon-btn mixer-btn-expand" data-action="expand" title="${isExpanded ? 'Collapse' : 'More options'}">
            ${isExpanded ? '▼' : '▲'}
          </button>
          <button class="mixer-icon-btn" data-action="edit" title="Edit channel">✏️</button>
          <button class="mixer-icon-btn" data-action="mute" title="${isMuted ? 'Unmute' : 'Mute'}">${isMuted ? '🔇' : '🔈'}</button>
          <button class="mixer-icon-btn" data-action="lurk" title="${isLurker ? 'Stop lurk mode' : "Lurk (don't include in my vector)"}">${isLurker ? '👁' : '👁‍🗨'}</button>
        </div>
      </div>
    `;
  }

  #renderEssentialControls(specificity, specificityLabel, viewMode) {
    return `
      <div class="mixer-essential">
        ${this.#renderPrecisionControl(specificity, specificityLabel)}
        ${this.#renderViewControl(viewMode)}
      </div>
    `;
  }

  #renderPrecisionControl(specificity, specificityLabel) {
    return `
      <div class="mixer-precision-control">
        <div class="mixer-precision-header">
          <span class="mixer-control-label">🎯 Precision</span>
          <div class="mixer-precision-value">
            <span class="mixer-value-badge">${specificity}%</span>
            <span class="mixer-value-label">${specificityLabel.label}</span>
          </div>
        </div>
        <input type="range" class="mixer-slider mixer-slider-compact" data-action="specificity" min="0" max="100" value="${specificity}" />
        <div class="mixer-presets-row">
          ${Object.entries(PRESETS)
            .map(
              ([key, preset]) => `
            <button class="mixer-preset-chip ${specificity === preset.specificity ? 'active' : ''}" data-preset="${key}" title="${preset.description}">
              ${preset.icon}
            </button>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  #renderViewControl(viewMode) {
    return `
      <div class="mixer-view-control">
        <span class="mixer-control-label">👁 View</span>
        <div class="mixer-button-group mixer-view-buttons">
          ${VIEW_MODES.map(
            ({ mode, icon, label }) => `
            <button class="mixer-view-btn ${viewMode === mode ? 'active' : ''}" data-view-mode="${mode}" title="${label}">
              ${icon}
            </button>
          `
          ).join('')}
        </div>
      </div>
    `;
  }

  #renderExpandedContent(filters, minSimilarity, sortOrder) {
    return `
      <div class="mixer-expanded-content">
        ${this.#renderFiltersSection(filters, minSimilarity)}
        ${this.#renderSortSection(sortOrder)}
        ${this.#renderActionsSection()}
      </div>
    `;
  }

  #renderFiltersSection(filters, minSimilarity) {
    return `
      <div class="mixer-section-compact">
        <div class="mixer-section-header-compact">
          <span class="mixer-section-title-compact">🔍 Filters</span>
        </div>
        <div class="mixer-filters-row">
          ${FILTERS.map(
            ({ key, icon, label }) => `
            <button class="mixer-filter-chip ${filters?.[key] ? 'active' : ''}" data-filter="${key}">
              ${icon} ${label}
            </button>
          `
          ).join('')}
        </div>
        <div class="mixer-similarity-control">
          <span class="mixer-control-label">Min similarity: <strong>${Math.round((minSimilarity ?? 0.5) * 100)}%</strong></span>
          <input type="range" class="mixer-slider mixer-slider-mini" data-action="similarity" min="0" max="100" value="${Math.round((minSimilarity ?? 0.5) * 100)}" />
        </div>
      </div>
    `;
  }

  #renderSortSection(sortOrder) {
    return `
      <div class="mixer-section-compact">
        <div class="mixer-section-header-compact">
          <span class="mixer-section-title-compact">📊 Sort</span>
          <select class="mixer-select-compact" data-action="sort">
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

  #renderActionsSection() {
    return `
      <div class="mixer-section-compact">
        <div class="mixer-actions-row">
          <button class="mixer-btn-compact" data-action="archive">📦 Archive</button>
          <button class="mixer-btn-compact mixer-btn-danger" data-action="reset">↺ Reset</button>
        </div>
      </div>
    `;
  }

  #bind() {
    const panel = this.#container.querySelector('.mixer-panel');
    if (!panel) return;

    const on = (selector, event, handler) => {
      const el = panel.querySelector(selector);
      if (!el) return;
      el.addEventListener(event, handler);
      this.#boundHandlers.push(() => el.removeEventListener(event, handler));
    };

    const onAll = (selector, event, handler) => {
      panel.querySelectorAll(selector).forEach((el) => {
        el.addEventListener(event, handler);
        this.#boundHandlers.push(() => el.removeEventListener(event, handler));
      });
    };

    panel.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      this.#handleAction(action, btn);
    });

    on('[data-action="specificity"]', 'input', (e) => {
      this.#updateSettings({ specificity: parseInt(e.target.value, 10) });
    });

    on('[data-action="similarity"]', 'input', (e) => {
      this.#updateSettings({ minSimilarity: parseInt(e.target.value, 10) / 100 });
    });

    on('[data-action="sort"]', 'change', (e) => {
      this.#updateSettings({ sortOrder: e.target.value });
    });

    onAll('[data-preset]', 'click', (e) => {
      const preset = PRESETS[e.target.dataset.preset];
      if (preset) {
        this.#updateSettings({
          specificity: preset.specificity,
          minSimilarity: preset.minSimilarity,
        });
        toasts.success(`Applied ${preset.name} preset`);
      }
    });

    onAll('[data-view-mode]', 'click', (e) => {
      const mode = e.target.dataset.viewMode;
      this.#updateSettings({ viewMode: mode });
      this.#dispatch('mixer:view-change', { mode });
    });

    onAll('[data-filter]', 'click', (e) => {
      const filterType = e.target.dataset.filter;
      const settings = this.#getSettings();
      this.#updateSettings({
        filters: { ...settings.filters, [filterType]: !settings.filters?.[filterType] },
      });
    });
  }

  #handleAction(action, btn) {
    switch (action) {
      case 'expand':
        channelSettingsService.togglePanel(this.#channel.id, 'mixerExpanded');
        this.#render();
        this.#bind();
        break;
      case 'edit':
        this.#showEditModal();
        break;
      case 'mute':
        this.#toggleMute();
        break;
      case 'lurk':
        this.#toggleLurk();
        break;
      case 'archive':
        this.#archiveChannel();
        break;
      case 'reset':
        this.#resetSettings();
        break;
    }
  }

  #updateSettings(updates) {
    channelSettingsService.updateSettings(this.#channel.id, updates);
    this.#render();
    this.#bind();
    this.#dispatch('mixer:settings-change', updates);
  }

  #dispatch(eventName, detail) {
    this.#container.dispatchEvent(new CustomEvent(eventName, { detail, bubbles: true }));
  }

  async #toggleMute() {
    const settings = this.#getSettings();
    const action = settings.isMuted ? 'unmuteChannel' : 'muteChannel';
    channelSettingsService[action](this.#channel.id);
    toasts.info(settings.isMuted ? 'Channel unmuted' : 'Channel muted');
    this.#render();
    this.#bind();
  }

  async #toggleLurk() {
    const isLurker = this.#channel.isLurker ?? false;
    try {
      await networkService.setChannelLurkMode(this.#channel.id, !isLurker);
      toasts.info(isLurker ? 'Channel added to your vector' : 'Channel set to lurk mode');
      this.#channel = { ...this.#channel, isLurker: !isLurker };
      this.#render();
      this.#bind();
      this.#dispatch('mixer:channel-update', { channel: this.#channel });
    } catch (err) {
      toasts.error('Failed to update lurk mode: ' + err.message);
    }
  }

  async #archiveChannel() {
    const ok = await modals.confirm('Archive this channel?', {
      title: 'Archive Channel',
      confirmText: 'Archive',
    });
    if (!ok) return;
    channelSettingsService.archiveChannel(this.#channel.id);
    toasts.info('Channel archived');
    this.#dispatch('mixer:channel-archived', { channelId: this.#channel.id });
  }

  async #resetSettings() {
    const ok = await modals.confirm('Reset all settings to defaults?', {
      title: 'Reset Settings',
      confirmText: 'Reset',
      danger: true,
    });
    if (!ok) return;
    channelSettingsService.resetSettings(this.#channel.id);
    toasts.info('Settings reset');
    this.#render();
    this.#bind();
  }

  #showEditModal() {
    const langService = getMultilingualService();
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = this.#renderEditModal();
    document.body.appendChild(modal);

    const close = () => modal.remove();

    modal.querySelector('[data-action="close"]')?.addEventListener('click', close);
    modal.querySelector('[data-action="cancel"]')?.addEventListener('click', close);
    modal
      .querySelector('[data-action="save"]')
      ?.addEventListener('click', () => this.#saveEditModal(modal));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });

    let langDebounceTimer = null;
    modal.querySelector('#edit-channel-description')?.addEventListener('input', (e) => {
      clearTimeout(langDebounceTimer);
      langDebounceTimer = setTimeout(() => this.#updateLangIndicator(modal, e.target.value), 300);
    });
  }

  #renderEditModal() {
    const langService = getMultilingualService();
    const currentLang = langService.getCurrentLanguage();
    const langLabel = currentLang ? `${currentLang.flag} ${currentLang.name}` : '';

    return `
      <div class="modal-content mixer-edit-modal">
        <div class="modal-header">
          <h3>Edit Channel</h3>
          <button class="modal-close" data-action="close">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="edit-channel-name">Channel Name</label>
            <input type="text" id="edit-channel-name" class="form-input" value="${escapeHtml(this.#channel.name)}" placeholder="Channel name" autofocus />
          </div>
          <div class="form-group">
            <label for="edit-channel-description">
              Description
              <span id="lang-indicator" class="lang-indicator" style="display:none">${escapeHtml(langLabel)}</span>
            </label>
            <textarea id="edit-channel-description" class="form-textarea" rows="4" placeholder="Channel description">${escapeHtml(this.#channel.description || '')}</textarea>
            <span class="form-hint" id="edit-lang-hint" style="display:none"></span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="mixer-btn mixer-btn-secondary" data-action="cancel">Cancel</button>
          <button class="mixer-btn mixer-btn-primary" data-action="save">Save Changes</button>
        </div>
      </div>
    `;
  }

  #updateLangIndicator(modal, text) {
    const indicator = modal.querySelector('#lang-indicator');
    const hint = modal.querySelector('#edit-lang-hint');
    if (!indicator || !hint) return;

    const langService = getMultilingualService();
    const SUPPORTED_LANGS = langService.getSupportedLanguages();
    const detected = langService.detectLanguage(text);
    const lang = SUPPORTED_LANGS.find((l) => l.code === detected);

    if (lang && detected !== 'en' && text.length >= 3) {
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

  async #saveEditModal(modal) {
    const name = modal.querySelector('#edit-channel-name')?.value.trim();
    const description = modal.querySelector('#edit-channel-description')?.value.trim() || '';

    if (!name || name.length < 3) {
      toasts.error('Channel name must be at least 3 characters');
      return;
    }

    try {
      await channelService.update(this.#channel.id, { name, description });
      this.#channel = { ...this.#channel, name, description };
      modal.remove();
      toasts.success('Channel updated');
      this.#render();
      this.#bind();
      this.#dispatch('mixer:channel-update', { channel: this.#channel });
    } catch (err) {
      toasts.error('Failed to update channel: ' + err.message);
    }
  }

  refresh() {
    this.#render();
    this.#bind();
  }

  destroy() {
    this.#boundHandlers.forEach((unbind) => unbind());
    this.#boundHandlers = [];
    this.#container.innerHTML = '';
  }
}

export { MixerPanelComponent };

export function initMixerPanel(container, channel) {
  container.innerHTML = '';
  return new MixerPanelComponent(container, channel);
}

export function showEditModal(channel) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const panel = new MixerPanelComponent(container, channel);
  panel.open();
  return panel;
}
