import type { StorageAdapter } from '../interfaces/storage.js';

const DB_NAME = 'isc-db';
const DB_VERSION = 1;

const STORES = ['keypairs', 'channels', 'posts', 'settings'] as const;

const LOCAL_STORAGE_PREFIX = 'isc_';
const LOCAL_STORAGE_LIMIT = 5 * 1024 * 1024; // 5MB

export class BrowserStorage implements StorageAdapter {
  private db: IDBDatabase | null = null;
  private localStorageFallback = new Map<string, string>();

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        STORES.forEach((store) => {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: 'id' });
          }
        });
      };
    });
  }

  private getStore(name: string, mode: IDBTransactionMode): IDBObjectStore | null {
    if (!this.db) return null;
    const transaction = this.db.transaction(name, mode);
    return transaction.objectStore(name);
  }

  async get<T>(key: string): Promise<T | null> {
    await this.init();

    // Try IndexedDB first
    const stores: typeof STORES = STORES;
    for (const storeName of stores) {
      const store = this.getStore(storeName, 'readonly');
      if (!store) continue;

      return new Promise((resolve) => {
        const request = store.get(key);
        request.onsuccess = () => {
          const result = request.result;
          resolve(result ? (result.data as T) : null);
        };
        request.onerror = () => resolve(null);
      });
    }

    // Fallback to localStorage
    const lsValue = this.localStorageFallback.get(`${LOCAL_STORAGE_PREFIX}${key}`);
    if (lsValue) {
      try {
        return JSON.parse(lsValue) as T;
      } catch {
        return null;
      }
    }

    return null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.init();

    // Determine store based on key prefix
    const storeName = this.determineStore(key);

    // Try IndexedDB first
    if (this.db) {
      const store = this.getStore(storeName, 'readwrite');
      if (store) {
        return new Promise((resolve, reject) => {
          const request = store.put({ id: key, data: value, timestamp: Date.now() });
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }
    }

    // Fallback to localStorage for small data
    const serialized = JSON.stringify(value);
    const totalSize = this.estimateLocalStorageSize() + serialized.length;

    if (totalSize <= LOCAL_STORAGE_LIMIT) {
      this.localStorageFallback.set(`${LOCAL_STORAGE_PREFIX}${key}`, serialized);
      try {
        localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${key}`, serialized);
      } catch (e) {
        if ((e as DOMException).name === 'QuotaExceededError') {
          console.warn('LocalStorage quota exceeded, using in-memory fallback only');
        }
      }
    }
  }

  async delete(key: string): Promise<void> {
    await this.init();

    const storeName = this.determineStore(key);
    const store = this.getStore(storeName, 'readwrite');

    if (store) {
      return new Promise((resolve, reject) => {
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    // Also delete from localStorage
    this.localStorageFallback.delete(`${LOCAL_STORAGE_PREFIX}${key}`);
    try {
      localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${key}`);
    } catch {
      // Ignore errors
    }
  }

  async *keys(prefix?: string): AsyncIterable<string> {
    await this.init();

    const stores: typeof STORES = STORES;
    const seen = new Set<string>();

    for (const storeName of stores) {
      const store = this.getStore(storeName, 'readonly');
      if (!store) continue;

      yield* new Promise<Iterable<string>>((resolve) => {
        const request = store.getAllKeys();
        request.onsuccess = () => {
          const keys = request.result as string[];
          resolve(keys);
        };
        request.onerror = () => resolve([]);
      }).then((keys) => keys.filter((k) => !seen.has(k) && (prefix ? k.startsWith(prefix) : true)));
    }

    // Also yield localStorage keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(LOCAL_STORAGE_PREFIX)) {
        const cleanKey = key.slice(LOCAL_STORAGE_PREFIX.length);
        if (!seen.has(cleanKey) && (prefix ? cleanKey.startsWith(prefix) : true)) {
          yield cleanKey;
        }
      }
    }
  }

  async clear(): Promise<void> {
    await this.init();

    const stores: typeof STORES = STORES;
    for (const storeName of stores) {
      const store = this.getStore('readwrite');
      if (store) {
        store.clear();
      }
    }

    this.localStorageFallback.clear();
    localStorage.clear();
  }

  private determineStore(key: string): string {
    if (key.startsWith('keypair:')) return 'keypairs';
    if (key.startsWith('channel:')) return 'channels';
    if (key.startsWith('post:')) return 'posts';
    return 'settings';
  }

  private estimateLocalStorageSize(): number {
    let size = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      if (key && value) {
        size += key.length + value.length;
      }
    }
    return size;
  }
}

export const browserStorage = new BrowserStorage();
