/**
 * Settings Service
 *
 * Manages user preferences and app configuration.
 * Persists to localStorage for durability.
 */

import type { SettingsService as ISettingsService } from '../di/container.js';

const STORAGE_KEY = 'isc-settings';

interface SettingsData {
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
  autoDiscover: boolean;
  discoverInterval: number;
  privacy: {
    showOnline: boolean;
    allowDirectMessages: boolean;
  };
  [key: string]: any;
}

const DEFAULT_SETTINGS: SettingsData = {
  theme: 'system',
  notifications: true,
  autoDiscover: true,
  discoverInterval: 30,
  privacy: {
    showOnline: true,
    allowDirectMessages: true,
  },
};

class SettingsServiceImpl implements ISettingsService {
  private cache: SettingsData | null = null;

  private load(): SettingsData {
    if (this.cache) return this.cache;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.cache = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      } else {
        this.cache = { ...DEFAULT_SETTINGS };
      }
    } catch {
      this.cache = { ...DEFAULT_SETTINGS };
    }

    return this.cache;
  }

  private save(settings: SettingsData): void {
    this.cache = settings;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (err) {
      console.warn('[Settings] Failed to persist settings:', err);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const settings = this.load();
    return (settings[key] as T) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    const settings = this.load();
    settings[key] = value;
    this.save(settings);
  }

  async getAll(): Promise<Record<string, any>> {
    return { ...this.load() };
  }

  async update(updates: Record<string, any>): Promise<void> {
    const settings = this.load();
    Object.assign(settings, updates);
    this.save(settings);
  }
}

let _instance: SettingsServiceImpl | null = null;

export function getSettingsService(): ISettingsService {
  if (!_instance) {
    _instance = new SettingsServiceImpl();
  }
  return _instance;
}

export function createSettingsService(): ISettingsService {
  return getSettingsService();
}
