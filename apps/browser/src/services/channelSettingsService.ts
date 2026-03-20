/**
 * Channel Settings Service
 *
 * Persists per-channel UI settings and attention data.
 * Settings are stored in IndexedDB and include:
 * - View mode (list, space, grid)
 * - Filter preferences (show me, others, trusted, alignment)
 * - Sort order (recency, similarity, activity)
 * - Specificity/cosine threshold
 * - Visualization parameters
 * - Panel expansion state (progressive disclosure)
 */

export type ChannelViewMode = 'list' | 'space' | 'grid';
export type ChannelSortOrder = 'recency' | 'similarity' | 'activity' | 'alphabetical';
export type ChannelFilterType =
  | 'showMe'
  | 'showOthers'
  | 'showTrusted'
  | 'showHighAlignment'
  | 'showLowAlignment';

export interface ChannelSettings {
  channelId: string;
  // View
  viewMode: ChannelViewMode;
  // Filters
  filters: Record<ChannelFilterType, boolean>;
  minSimilarity: number;
  // Sort
  sortOrder: ChannelSortOrder;
  sortDescending: boolean;
  // Channel-specific
  specificity: number; // 0-100, maps to cosine threshold
  isArchived: boolean;
  isMuted: boolean;
  // UI state
  panelsExpanded: Record<string, boolean>;
  // Metadata
  lastViewedAt: number;
  viewCount: number;
}

const DEFAULT_SETTINGS: Omit<ChannelSettings, 'channelId'> = {
  viewMode: 'list',
  filters: {
    showMe: true,
    showOthers: true,
    showTrusted: true,
    showHighAlignment: true,
    showLowAlignment: true,
  },
  minSimilarity: 0.55,
  sortOrder: 'recency',
  sortDescending: true,
  specificity: 50,
  isArchived: false,
  isMuted: false,
  panelsExpanded: {
    basic: true,
    filters: false,
    sort: false,
    view: false,
    advanced: false,
  },
  lastViewedAt: 0,
  viewCount: 0,
};

const STORAGE_KEY_PREFIX = 'isc_channel_settings_';

export interface ChannelSettingsService {
  getSettings(channelId: string): Promise<ChannelSettings>;
  updateSettings(channelId: string, updates: Partial<ChannelSettings>): Promise<ChannelSettings>;
  getSetting<K extends keyof ChannelSettings>(
    channelId: string,
    key: K
  ): Promise<ChannelSettings[K]>;
  setSetting<K extends keyof ChannelSettings>(
    channelId: string,
    key: K,
    value: ChannelSettings[K]
  ): Promise<void>;
  togglePanel(channelId: string, panelKey: string): Promise<void>;
  archiveChannel(channelId: string): Promise<void>;
  unarchiveChannel(channelId: string): Promise<void>;
  muteChannel(channelId: string): Promise<void>;
  unmuteChannel(channelId: string): Promise<void>;
  recordView(channelId: string): Promise<void>;
  getArchivedChannels(): Promise<string[]>;
  resetSettings(channelId: string): Promise<void>;
}

export function createChannelSettingsService(): ChannelSettingsService {
  const storage = typeof localStorage !== 'undefined' ? localStorage : null;

  const getStorageKey = (channelId: string) => `${STORAGE_KEY_PREFIX}${channelId}`;

  const loadSettings = (channelId: string): ChannelSettings => {
    if (!storage) {
      return { channelId, ...DEFAULT_SETTINGS };
    }

    try {
      const stored = storage.getItem(getStorageKey(channelId));
      if (!stored) {
        return { channelId, ...DEFAULT_SETTINGS };
      }

      const parsed = JSON.parse(stored);
      // Merge with defaults to ensure all fields exist
      return {
        channelId,
        ...DEFAULT_SETTINGS,
        ...parsed,
        filters: { ...DEFAULT_SETTINGS.filters, ...parsed.filters },
        panelsExpanded: { ...DEFAULT_SETTINGS.panelsExpanded, ...parsed.panelsExpanded },
      };
    } catch (err) {
      console.error('[ChannelSettings] Failed to load settings:', err);
      return { channelId, ...DEFAULT_SETTINGS };
    }
  };

  const saveSettings = (settings: ChannelSettings): void => {
    if (!storage) return;

    try {
      storage.setItem(getStorageKey(settings.channelId), JSON.stringify(settings));
    } catch (err) {
      console.error('[ChannelSettings] Failed to save settings:', err);
    }
  };

  return {
    async getSettings(channelId: string): Promise<ChannelSettings> {
      return loadSettings(channelId);
    },

    async updateSettings(
      channelId: string,
      updates: Partial<ChannelSettings>
    ): Promise<ChannelSettings> {
      const current = loadSettings(channelId);
      const updated = {
        ...current,
        ...updates,
        channelId,
        filters: { ...current.filters, ...updates.filters },
        panelsExpanded: { ...current.panelsExpanded, ...updates.panelsExpanded },
      };
      saveSettings(updated);
      return updated;
    },

    async getSetting<K extends keyof ChannelSettings>(
      channelId: string,
      key: K
    ): Promise<ChannelSettings[K]> {
      const settings = loadSettings(channelId);
      return settings[key];
    },

    async setSetting<K extends keyof ChannelSettings>(
      channelId: string,
      key: K,
      value: ChannelSettings[K]
    ): Promise<void> {
      const current = loadSettings(channelId);
      const updated = { ...current, [key]: value, channelId };
      saveSettings(updated);
    },

    async togglePanel(channelId: string, panelKey: string): Promise<void> {
      const current = loadSettings(channelId);
      const updated = {
        ...current,
        panelsExpanded: {
          ...current.panelsExpanded,
          [panelKey]: !current.panelsExpanded[panelKey],
        },
      };
      saveSettings(updated);
    },

    async archiveChannel(channelId: string): Promise<void> {
      const current = loadSettings(channelId);
      saveSettings({ ...current, isArchived: true, channelId });
    },

    async unarchiveChannel(channelId: string): Promise<void> {
      const current = loadSettings(channelId);
      saveSettings({ ...current, isArchived: false, channelId });
    },

    async muteChannel(channelId: string): Promise<void> {
      const current = loadSettings(channelId);
      saveSettings({ ...current, isMuted: true, channelId });
    },

    async unmuteChannel(channelId: string): Promise<void> {
      const current = loadSettings(channelId);
      saveSettings({ ...current, isMuted: false, channelId });
    },

    async recordView(channelId: string): Promise<void> {
      const current = loadSettings(channelId);
      saveSettings({
        ...current,
        lastViewedAt: Date.now(),
        viewCount: current.viewCount + 1,
        channelId,
      });
    },

    async getArchivedChannels(): Promise<string[]> {
      if (!storage) return [];

      const archived: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key?.startsWith(STORAGE_KEY_PREFIX)) {
          try {
            const settings = JSON.parse(storage.getItem(key) || '{}');
            if (settings.isArchived) {
              archived.push(settings.channelId);
            }
          } catch {
            // Skip invalid entries
          }
        }
      }
      return archived;
    },

    async resetSettings(channelId: string): Promise<void> {
      if (storage) {
        storage.removeItem(getStorageKey(channelId));
      }
    },
  };
}

/**
 * Get cosine threshold from specificity setting
 * Specificity 0 = very broad (cosine ~0.3)
 * Specificity 100 = very specific (cosine ~0.9)
 */
export function specificityToCosineThreshold(specificity: number): number {
  // Linear mapping: 0 -> 0.3, 100 -> 0.9
  return 0.3 + (specificity / 100) * 0.6;
}

/**
 * Get specificity from cosine threshold
 */
export function cosineThresholdToSpecificity(cosine: number): number {
  // Inverse mapping: 0.3 -> 0, 0.9 -> 100
  return Math.round(((cosine - 0.3) / 0.6) * 100);
}
