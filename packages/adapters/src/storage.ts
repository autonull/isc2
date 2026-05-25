/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await, @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-imports, @typescript-eslint/prefer-promise-reject-errors, @typescript-eslint/ban-ts-comment, @typescript-eslint/no-redundant-type-constituents */
/**
 * Storage Adapters
 *
 * Universal storage interface with browser (IndexedDB) and node (file-based) implementations.
 */

import type { StorageAdapter as CoreStorageAdapter } from '@isc/core';

export type StorageAdapter = CoreStorageAdapter;

/**
 * Browser Storage - IndexedDB implementation
 */
export class BrowserStorage implements StorageAdapter {
  private dbName: string;
  private db: IDBDatabase | null = null;
  private storeName: string;
  private openPromise: Promise<void> | null = null;

  constructor(dbName: string = 'isc-storage', storeName: string = 'data') {
    this.dbName = dbName;
    this.storeName = storeName;
  }

  private async open(): Promise<void> {
    if (this.db) {return;}
    if (this.openPromise) {return this.openPromise;}

    this.openPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(new Error('IndexedDB operation failed'));
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

    return this.openPromise;
  }

  async get<T>(key: string): Promise<T | null> {
    await this.open();
    if (!this.db) {return null;}

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(key);

      request.onerror = () => reject(new Error('IndexedDB operation failed'));
      request.onsuccess = () => resolve(request.result ?? null);
    });
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.open();
    if (!this.db) {return;}

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.put(value, key);

      request.onerror = () => reject(new Error('IndexedDB operation failed'));
      request.onsuccess = () => resolve();
    });
  }

  async delete(key: string): Promise<void> {
    await this.open();
    if (!this.db) {return;}

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete(key);

      request.onerror = () => reject(new Error('IndexedDB operation failed'));
      request.onsuccess = () => resolve();
    });
  }

  async list(prefix: string): Promise<string[]> {
    await this.open();
    if (!this.db) {return [];}

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAllKeys();

      request.onerror = () => reject(new Error('IndexedDB operation failed'));
      request.onsuccess = () => {
        const keys = request.result as string[];
        resolve(prefix ? keys.filter((k) => k.startsWith(prefix)) : keys);
      };
    });
  }

  async clear(): Promise<void> {
    await this.open();
    if (!this.db) {return;}

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.clear();

      request.onerror = () => reject(new Error('IndexedDB operation failed'));
      request.onsuccess = () => resolve();
    });
  }
}

/**
 * Node Storage - File-based implementation
 */
export class NodeStorage implements StorageAdapter {
  private dataDir: string;
  private fs: typeof import('fs/promises') | null = null;
  private path: typeof import('path') | null = null;
  private cache: Map<string, unknown> = new Map();

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  private async init(): Promise<void> {
    if (!this.fs) {
      const fsPromises = await import('fs/promises');
      const pathModule = await import('path');
      this.fs = fsPromises;
      this.path = pathModule;

      try {
        await this.fs.mkdir(this.dataDir, { recursive: true });
      } catch {
        // Directory may already exist
      }
    }
  }

  private getKeyPath(key: string): string {
    if (!this.path) {throw new Error('Storage not initialized');}
    const safeKey = key.replace(/[/\\]/g, '_');
    return this.path.join(this.dataDir, `${safeKey}.json`);
  }

  async get<T>(key: string): Promise<T | null> {
    await this.init();

    if (this.cache.has(key)) {
      return this.cache.get(key) as T;
    }

    try {
      if (!this.fs) {throw new Error('Storage not initialized');}
      const data = await this.fs.readFile(this.getKeyPath(key), 'utf-8');
      const value = JSON.parse(data) as T;
      this.cache.set(key, value);
      return value;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.init();
    if (!this.fs) {throw new Error('Storage not initialized');}

    this.cache.set(key, value);
    await this.fs.writeFile(this.getKeyPath(key), JSON.stringify(value, null, 2), 'utf-8');
  }

  async delete(key: string): Promise<void> {
    await this.init();
    if (!this.fs) {throw new Error('Storage not initialized');}

    this.cache.delete(key);
    try {
      await this.fs.unlink(this.getKeyPath(key));
    } catch {
      // File may not exist
    }
  }

  async list(prefix: string): Promise<string[]> {
    await this.init();
    if (!this.fs || !this.path) {throw new Error('Storage not initialized');}

    const files = await this.fs.readdir(this.dataDir);
    const keys = files
      .filter((f: string) => f.endsWith('.json'))
      .map((f: string) => f.replace('.json', ''));

    return prefix ? keys.filter((k: string) => k.startsWith(prefix)) : keys;
  }

  async clear(): Promise<void> {
    await this.init();
    if (!this.fs || !this.path) {throw new Error('Storage not initialized');}

    const files = await this.fs.readdir(this.dataDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        await this.fs.unlink(this.path.join(this.dataDir, file));
      }
    }
    this.cache.clear();
  }
}

/**
 * Memory Storage - In-memory implementation for testing
 */
export class MemoryStorage implements StorageAdapter {
  private store: Map<string, unknown> = new Map();

  async get<T>(key: string): Promise<T | null> {
    return (this.store.get(key) as T) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(prefix: string): Promise<string[]> {
    const keys = Array.from(this.store.keys());
    return prefix ? keys.filter((k) => k.startsWith(prefix)) : keys;
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

/**
 * Factory function to create appropriate storage based on environment
 */
export function createStorage(dataDir?: string): StorageAdapter {
  // Check if running in browser
  if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
    return new BrowserStorage();
  }

  // Node.js environment
  return new NodeStorage(dataDir ?? './isc-data');
}
