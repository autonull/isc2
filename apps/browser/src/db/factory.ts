/* eslint-disable */
/**
 * IndexedDB Helper Factory
 * 
 * Provides reusable database initialization and CRUD operations.
 * Eliminates duplicate DB code across the codebase.
 * 
 * Usage:
 * ```typescript
 * // Simple usage with auto-initialized DB
 * const db = await getDB('my-db', 1, ['store1', 'store2']);
 * await dbPut(db, 'store1', { id: 'key', data: 'value' });
 * 
 * // Or use convenience functions
 * await dbGet('my-db', 'store1', 'key');
 * await dbGetAll('my-db', 'store1');
 * ```
 */

import { openDB, dbGet as _dbGet, dbGetAll as _dbGetAll, dbPut as _dbPut, dbDelete as _dbDelete, dbClear as _dbClear, dbKeys as _dbKeys, dbFilter as _dbFilter } from '@isc/adapters';

export interface DBConfig {
  name: string;
  version: number;
  stores: string[] | Record<string, string>; // store name or { name: keyPath }
  onUpgrade?: (db: IDBDatabase) => void;
}

// Cache for initialized databases
const dbCache = new Map<string, IDBDatabase>();

/**
 * Get or create IndexedDB database with automatic schema initialization
 */
export async function getDB(config: DBConfig | string, version?: number, stores?: string[]): Promise<IDBDatabase> {
  // Handle simple string config
  if (typeof config === 'string') {
    const name = config;
    const cacheKey = `${name}:${version || 1}`;
    
    if (dbCache.has(cacheKey)) {
      return dbCache.get(cacheKey)!;
    }

    const db = await openDB(name, version || 1, (database) => {
      stores?.forEach((store) => {
        if (!database.objectStoreNames.contains(store)) {
          database.createObjectStore(store, { keyPath: 'id' });
        }
      });
    });

    dbCache.set(cacheKey, db);
    return db;
  }

  // Handle object config
  const cacheKey = `${config.name}:${config.version}`;
  
  if (dbCache.has(cacheKey)) {
    return dbCache.get(cacheKey)!;
  }

  const db = await openDB(config.name, config.version, (database) => {
    const storeNames = Array.isArray(config.stores) 
      ? config.stores 
      : Object.keys(config.stores);
    
    storeNames.forEach((storeName) => {
      if (!database.objectStoreNames.contains(storeName)) {
        const keyPath = Array.isArray(config.stores) 
          ? 'id' 
          : config.stores[storeName];
        database.createObjectStore(storeName, { keyPath });
      }
    });

    config.onUpgrade?.(database);
  });

  dbCache.set(cacheKey, db);
  return db;
}

/**
 * Get item from store
 */
export async function dbGet<T>(db: IDBDatabase, store: string, key: string): Promise<T | null> {
  return _dbGet<T>(db, store, key);
}

/**
 * Get all items from store
 */
export async function dbGetAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return _dbGetAll<T>(db, store);
}

/**
 * Put item to store
 */
export async function dbPut<T>(db: IDBDatabase, store: string, value: T): Promise<void> {
  return _dbPut<T>(db, store, value);
}

/**
 * Add item to store (fails if key exists)
 */
export async function dbAdd<T>(db: IDBDatabase, store: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).add(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Delete item from store
 */
export async function dbDelete(db: IDBDatabase, store: string, key: string): Promise<void> {
  return _dbDelete(db, store, key);
}

/**
 * Clear all items from store
 */
export async function dbClear(db: IDBDatabase, store: string): Promise<void> {
  return _dbClear(db, store);
}

/**
 * Get all keys from store
 */
export async function dbKeys(db: IDBDatabase, store: string): Promise<string[]> {
  return _dbKeys(db, store);
}

/**
 * Filter items in store by predicate
 */
export async function dbFilter<T>(db: IDBDatabase, store: string, predicate: (item: T) => boolean): Promise<T[]> {
  return _dbFilter<T>(db, store, predicate);
}

/**
 * Count items in store
 */
export async function dbCount(db: IDBDatabase, store: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Batch put multiple items to store
 */
export async function dbPutBatch<T>(db: IDBDatabase, store: string, values: T[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const objectStore = tx.objectStore(store);
    
    for (const value of values) {
      objectStore.put(value);
    }
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Transaction helper for complex operations
 */
export async function dbTransaction<T>(
  db: IDBDatabase,
  stores: string[],
  mode: IDBTransactionMode,
  callback: (stores: Record<string, IDBObjectStore>) => Promise<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    
    const storeMap: Record<string, IDBObjectStore> = {};
    stores.forEach((storeName) => {
      storeMap[storeName] = tx.objectStore(storeName);
    });
    
    let result: T;
    
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error('Transaction aborted'));
    
    callback(storeMap).then((r) => {
      result = r;
    }).catch(reject);
  });
}

/**
 * Clear database cache (useful for testing)
 */
export function clearDBCache(): void {
  dbCache.forEach((db) => db.close());
  dbCache.clear();
}

/**
 * Get database instance from cache (if exists)
 */
export function getCachedDB(name: string): IDBDatabase | undefined {
  for (const [key, db] of dbCache.entries()) {
    if (key.startsWith(`${name}:`)) {
      return db;
    }
  }
  return undefined;
}
