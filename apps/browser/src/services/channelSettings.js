/* eslint-disable */
/**
 * Channel Settings Persistence Service
 *
 * Handles localStorage persistence for per-channel Mixer UI settings.
 */

import { getState, actions } from '../state.js';

const STORAGE_PREFIX = 'isc_channel_settings_';

const DEFAULT_FILTERS = {
  showMe: true,
  showOthers: true,
  showTrusted: true,
  showHighAlignment: true,
  showLowAlignment: true,
};

const DEFAULT_PANELS_EXPANDED = {
  mixerExpanded: false,
};

/**
 * @typedef {Object} ChannelSettings
 * @property {'list'|'space'|'grid'} viewMode - Display mode for posts
 * @property {number} specificity - 0-100, maps to cosine threshold
 * @property {Object} filters
 * @property {boolean} filters.showMe
 * @property {boolean} filters.showOthers
 * @property {boolean} filters.showTrusted
 * @property {boolean} filters.showHighAlignment
 * @property {boolean} filters.showLowAlignment
 * @property {number} minSimilarity - 0-1
 * @property {'recency'|'similarity'|'activity'} sortOrder
 * @property {boolean} sortDescending
 * @property {boolean} isArchived
 * @property {boolean} isMuted
 * @property {Object} panelsExpanded
 * @property {boolean} panelsExpanded.mixerExpanded
 * @property {number} lastViewedAt
 * @property {number} viewCount
 */

/**
 * @type {ChannelSettings}
 */
export const DEFAULT_CHANNEL_SETTINGS = {
  viewMode: 'list',
  specificity: 50,
  filters: DEFAULT_FILTERS,
  minSimilarity: 0.55,
  sortOrder: 'recency',
  sortDescending: true,
  isArchived: false,
  isMuted: false,
  panelsExpanded: DEFAULT_PANELS_EXPANDED,
  lastViewedAt: 0,
  viewCount: 0,
};

function getStorageKey(channelId) {
  return `${STORAGE_PREFIX}${channelId}`;
}

function loadFromStorage(channelId) {
  try {
    const stored = localStorage.getItem(getStorageKey(channelId));
    return stored ? JSON.parse(stored) : null;
  } catch (err) {
    console.warn('[ChannelSettings] Load failed:', err);
    return null;
  }
}

function saveToStorage(channelId, settings) {
  try {
    localStorage.setItem(getStorageKey(channelId), JSON.stringify(settings));
  } catch (err) {
    console.warn('[ChannelSettings] Save failed:', err);
  }
}

function getMergedSettings(channelId) {
  const stored = loadFromStorage(channelId);
  if (!stored) return { ...DEFAULT_CHANNEL_SETTINGS };

  return {
    ...DEFAULT_CHANNEL_SETTINGS,
    ...stored,
    filters: { ...DEFAULT_FILTERS, ...stored.filters },
    panelsExpanded: { ...DEFAULT_PANELS_EXPANDED, ...stored.panelsExpanded },
  };
}

export const channelSettingsService = {
  /**
   * Get settings for a channel
   * @param {string} channelId
   * @returns {ChannelSettings}
   */
  getSettings(channelId) {
    return getMergedSettings(channelId);
  },

  /**
   * Update settings for a channel
   * @param {string} channelId
   * @param {Partial<ChannelSettings>} updates
   * @returns {ChannelSettings}
   */
  updateSettings(channelId, updates) {
    const current = getMergedSettings(channelId);
    const updated = {
      ...current,
      ...updates,
      filters: updates.filters ? { ...current.filters, ...updates.filters } : current.filters,
      panelsExpanded: updates.panelsExpanded
        ? { ...current.panelsExpanded, ...updates.panelsExpanded }
        : current.panelsExpanded,
    };

    saveToStorage(channelId, updated);
    actions.setChannelSettings(channelId, updated);
    return updated;
  },

  /**
   * Get a single setting value
   * @param {string} channelId
   * @param {keyof ChannelSettings} key
   * @returns {*}
   */
  getSetting(channelId, key) {
    return this.getSettings(channelId)[key];
  },

  /**
   * Set a single setting value
   * @param {string} channelId
   * @param {keyof ChannelSettings} key
   * @param {*} value
   * @returns {ChannelSettings}
   */
  setSetting(channelId, key, value) {
    return this.updateSettings(channelId, { [key]: value });
  },

  /**
   * Toggle a panel's expanded state
   * @param {string} channelId
   * @param {keyof typeof DEFAULT_PANELS_EXPANDED} panelKey
   * @returns {ChannelSettings}
   */
  togglePanel(channelId, panelKey) {
    const current = getMergedSettings(channelId);
    const isExpanded = !current.panelsExpanded[panelKey];
    return this.updateSettings(channelId, {
      panelsExpanded: { ...current.panelsExpanded, [panelKey]: isExpanded },
    });
  },

  /**
   * Archive a channel
   * @param {string} channelId
   * @returns {ChannelSettings}
   */
  archiveChannel(channelId) {
    return this.updateSettings(channelId, { isArchived: true });
  },

  /**
   * Unarchive a channel
   * @param {string} channelId
   * @returns {ChannelSettings}
   */
  unarchiveChannel(channelId) {
    return this.updateSettings(channelId, { isArchived: false });
  },

  /**
   * Mute a channel
   * @param {string} channelId
   * @returns {ChannelSettings}
   */
  muteChannel(channelId) {
    return this.updateSettings(channelId, { isMuted: true });
  },

  /**
   * Unmute a channel
   * @param {string} channelId
   * @returns {ChannelSettings}
   */
  unmuteChannel(channelId) {
    return this.updateSettings(channelId, { isMuted: false });
  },

  /**
   * Record a view
   * @param {string} channelId
   * @returns {ChannelSettings}
   */
  recordView(channelId) {
    const current = getMergedSettings(channelId);
    return this.updateSettings(channelId, {
      lastViewedAt: Date.now(),
      viewCount: current.viewCount + 1,
    });
  },

  /**
   * Reset settings to defaults
   * @param {string} channelId
   * @returns {ChannelSettings}
   */
  resetSettings(channelId) {
    localStorage.removeItem(getStorageKey(channelId));
    actions.resetChannelSettings(channelId);
    return { ...DEFAULT_CHANNEL_SETTINGS };
  },

  /**
   * Get all archived channel IDs
   * @returns {string[]}
   */
  getArchivedChannels() {
    const archived = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(STORAGE_PREFIX)) continue;

      try {
        const settings = JSON.parse(localStorage.getItem(key) || '{}');
        if (settings.isArchived) archived.push(key.replace(STORAGE_PREFIX, ''));
      } catch {
        // Skip invalid entries
      }
    }
    return archived;
  },
};

/**
 * Convert specificity (0-100) to cosine threshold (0.3-0.9)
 * @param {number} specificity
 * @returns {number}
 */
export function specificityToCosineThreshold(specificity) {
  return 0.3 + (specificity / 100) * 0.6;
}

/**
 * Convert cosine threshold to specificity
 * @param {number} cosine
 * @returns {number}
 */
export function cosineThresholdToSpecificity(cosine) {
  return Math.round(((cosine - 0.3) / 0.6) * 100);
}

/**
 * Format specificity as human-readable label
 * @param {number} specificity
 * @returns {{label: string, icon: string}}
 */
export function getSpecificityLabel(specificity) {
  if (specificity < 30) return { label: 'Broad', icon: '🌍' };
  if (specificity < 70) return { label: 'Focused', icon: '🎯' };
  return { label: 'Narrow', icon: '🔬' };
}
