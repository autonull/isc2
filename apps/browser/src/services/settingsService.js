/* eslint-disable */
/**
 * Settings Service
 *
 * User settings management.
 */

import { logger } from '../logger.js';
import { actions } from '../state.js';

const SETTINGS_KEY = 'isc:settings';

const defaults = {
  theme: 'dark',
  notifications: true,
  soundEnabled: false,
  autoDiscover: true,
  discoverInterval: 30000,
  similarityThreshold: 0.3,
  showOnline: true,
  allowDMs: true,
};

function getSettings() {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
  } catch {
    return defaults;
  }
}

export const settingsService = {
  defaults,

  get: getSettings,

  set(updates) {
    const settings = { ...getSettings(), ...updates };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    actions.setSettings(settings);
    logger.info('Settings updated', { updates: Object.keys(updates) });
    return settings;
  },

  reset() {
    localStorage.removeItem(SETTINGS_KEY);
    actions.setSettings(defaults);
    logger.info('Settings reset to defaults');
    return defaults;
  },
};
