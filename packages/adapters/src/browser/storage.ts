import type { StorageAdapter } from '../interfaces/storage.js';

const DB_NAME = 'isc-db';
const DB_VERSION = 1;
const STORES = ['keypairs', 'channels', 'posts', 'settings'] as const;
const LOCAL_STORAGE_PREFIX = 'isc_';
const LOCAL_STORAGE_LIMIT = 5 * 1024 * 1024;

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
    return this.db?.transaction(name, mode).objectStore(name) ?? null;
  }

  async get<T>(key: string): Promise<T | null> {
    await this.init();

    for (const storeName of STORES) {
      const store = this.getStore(storeName, 'readonly');
      if (!store) continue;
      return new Promise((resolve) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result ? (request.result.data as T) : null);
        request.onerror = () => resolve(null);
      });
    }

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
    const storeName = this.determineStore(key);

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
    const store = this.getStore(this.determineStore(key), 'readwrite');

    if (store) {
      return new Promise((resolve, reject) => {
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    this.localStorageFallback.delete(`${LOCAL_STORAGE_PREFIX}${key}`);
    try {
      localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${key}`);
    } catch {
      // Ignore errors
    }
  }

  async *keys(prefix?: string): AsyncIterable<string> {
    await this.init();
    const seen = new Set<string>();

    for (const storeName of STORES) {
      const store = this.getStore(storeName, 'readonly');
      if (!store) continue;

      const keys = await new Promise<string[]>((resolve) => {
        const request = store.getAllKeys();
        request.onsuccess = () => resolve(request.result as string[]);
        request.onerror = () => resolve([]);
      });

      for (const k of keys) {
        if (!seen.has(k) && (prefix ? k.startsWith(prefix) : true)) {
          seen.add(k);
          yield k;
        }
      }
    }

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(LOCAL_STORAGE_PREFIX)) {
        const cleanKey = key.slice(LOCAL_STORAGE_PREFIX.length);
        if (!seen.has(cleanKey) && (prefix ? cleanKey.startsWith(prefix) : true)) {
          seen.add(cleanKey);
          yield cleanKey;
        }
      }
    }
  }

  async clear(): Promise<void> {
    await this.init();
    for (const storeName of STORES) {
      const store = this.getStore(storeName, 'readwrite');
      if (store) store.clear();
    }
    this.localStorageFallback.clear();
    try {
      localStorage.clear();
    } catch {
      // Ignore errors
    }
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
      if (key) {
        const value = localStorage.getItem(key);
        if (value) size += key.length + value.length;
      }
    }
    return size;
  }
}

export const browserStorage = new BrowserStorage();
