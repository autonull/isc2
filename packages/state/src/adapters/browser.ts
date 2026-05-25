/* eslint-disable */
/**
 * Browser Storage Adapters
 *
 * Browser-specific storage implementations for state persistence.
 */

import type { AppState, StateStorage } from '../types.js';

const STORAGE_KEY = 'isc-state';

/**
 * LocalStorage-based state storage
 */
export class BrowserStorage implements StateStorage {
  private key: string;

  constructor(key: string = STORAGE_KEY) {
    this.key = key;
  }

  get(): Promise<Partial<AppState> | null> {
    try {
      const data = localStorage.getItem(this.key);
      return Promise.resolve(data ? (JSON.parse(data) as Partial<AppState>) : null);
    } catch {
      return Promise.resolve(null);
    }
  }

  set(state: Partial<AppState>): Promise<void> {
    try {
      localStorage.setItem(this.key, JSON.stringify(state));
      return Promise.resolve();
    } catch {
      // Quota exceeded or storage disabled
      return Promise.resolve();
    }
  }

  clear(): Promise<void> {
    localStorage.removeItem(this.key);
    return Promise.resolve();
  }
}

/**
 * IndexedDB-based state storage
 * For larger state that exceeds localStorage limits (~5-10MB)
 */
export class IndexedDBStorage implements StateStorage {
  private db: IDBDatabase | null = null;
  private readonly dbName: string;
  private readonly storeName: string;
  private readonly version: number;
  private initPromise: Promise<void> | null = null;

  constructor(dbName = 'isc', storeName = 'state', version = 1) {
    this.dbName = dbName;
    this.storeName = storeName;
    this.version = version;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.db) {return;}
    if (this.initPromise) {return this.initPromise;}

    this.initPromise = this.init();
    return this.initPromise;
  }

  private async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(new Error(`IndexedDB open failed: ${request.error?.message ?? 'unknown error'}`));
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  async get(): Promise<Partial<AppState> | null> {
    await this.ensureInitialized();
    if (!this.db) {return null;}

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get('state');

      request.onerror = () => reject(new Error(`IndexedDB get failed: ${request.error?.message ?? 'unknown error'}`));
      request.onsuccess = () => resolve((request.result as Partial<AppState>) ?? null);
    });
  }

  async set(state: Partial<AppState>): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) {return;}

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.put(state, 'state');

      request.onerror = () => reject(new Error(`IndexedDB put failed: ${request.error?.message ?? 'unknown error'}`));
      request.onsuccess = () => resolve();
    });
  }

  async clear(): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) {return;}

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete('state');

      request.onerror = () => reject(new Error(`IndexedDB delete failed: ${request.error?.message ?? 'unknown error'}`));
      request.onsuccess = () => resolve();
    });
  }
}

/**
 * Storage observer for monitoring storage changes
 */
export class StorageObserver {
  private listeners = new Set<(key: string, newValue: unknown, oldValue: unknown) => void>();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageChange);
    }
  }

  private handleStorageChange = (event: StorageEvent): void => {
    this.listeners.forEach((listener) =>
      listener(
        event.key || '',
        event.newValue ? JSON.parse(event.newValue) : null,
        event.oldValue ? JSON.parse(event.oldValue) : null
      )
    );
  };

  subscribe(callback: (key: string, newValue: unknown, oldValue: unknown) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageChange);
    }
  }
}

/**
 * Create storage with automatic fallback
 */
export function createBrowserStorage(preferIndexedDB = false): StateStorage {
  if (preferIndexedDB && typeof indexedDB !== 'undefined') {
    return new IndexedDBStorage();
  }
  return new BrowserStorage();
}
