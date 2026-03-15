/**
 * ISC Network - Browser Storage Adapter
 * 
 * IndexedDB-based storage for browser persistence.
 * Implements the Storage interface for cross-platform compatibility.
 */

export interface Storage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
  clear(): Promise<void>;
}

interface DBStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
  clear(): Promise<void>;
}

/**
 * IndexedDB storage implementation
 */
export class BrowserStorage implements Storage {
  private dbName: string;
  private db: IDBDatabase | null = null;
  private storeName: string;
  private openPromise: Promise<void> | null = null;

  constructor(dbName: string = 'isc-storage', storeName: string = 'data') {
    this.dbName = dbName;
    this.storeName = storeName;
  }

  /**
   * Open the database connection
   */
  private async open(): Promise<void> {
    if (this.db) return;
    if (this.openPromise) return this.openPromise;

    this.openPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
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

  /**
   * Get a value by key
   */
  async get<T>(key: string): Promise<T | null> {
    await this.open();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result ?? null);
    });
  }

  /**
   * Set a value
   */
  async set<T>(key: string, value: T): Promise<void> {
    await this.open();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.put(value, key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Delete a value
   */
  async delete(key: string): Promise<void> {
    await this.open();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * List all keys with a prefix
   */
  async list(prefix: string): Promise<string[]> {
    await this.open();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAllKeys();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const keys = request.result as string[];
        resolve(keys.filter(k => k.startsWith(prefix)));
      };
    });
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    await this.open();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

/**
 * In-memory storage (for testing/fallback)
 */
export class MemoryStorage implements Storage {
  private data: Map<string, any> = new Map();

  async get<T>(key: string): Promise<T | null> {
    return this.data.get(key) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async list(prefix: string): Promise<string[]> {
    return Array.from(this.data.keys()).filter(k => k.startsWith(prefix));
  }

  async clear(): Promise<void> {
    this.data.clear();
  }
}

/**
 * LocalStorage wrapper (simple key-value)
 */
export class LocalStorage implements Storage {
  async get<T>(key: string): Promise<T | null> {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // localStorage not available or full
    }
  }

  async delete(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore errors
    }
  }

  async list(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          keys.push(key);
        }
      }
    } catch {
      // localStorage not available
    }
    return keys;
  }

  async clear(): Promise<void> {
    const keys = await this.list('isc-');
    for (const key of keys) {
      try {
        localStorage.removeItem(key);
      } catch {
        // Ignore errors
      }
    }
  }
}

/**
 * Create appropriate storage for current environment
 */
export function createStorage(): Storage {
  // Check if we're in a browser with IndexedDB
  if (typeof indexedDB !== 'undefined') {
    return new BrowserStorage();
  }
  // Check if localStorage is available (browser without IndexedDB)
  if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
    return new LocalStorage();
  }
  // Fallback to in-memory storage (Node.js, tests)
  return new MemoryStorage();
}
