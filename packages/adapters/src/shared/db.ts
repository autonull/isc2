/**
 * IndexedDB transaction utilities for consistent error handling and reduced duplication
 */

export interface DBTransactionOptions {
  mode: IDBTransactionMode;
  store: string;
}

/**
 * Execute a database operation with consistent error handling
 */
export async function dbTransaction<T>(
  db: IDBDatabase,
  store: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = operation(tx.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get operation wrapper
 */
export async function dbGet<T>(db: IDBDatabase, store: string, key: string): Promise<T | null> {
  const result = await dbTransaction(db, store, 'readonly', (os) => os.get(key));
  return (result === undefined ? null : result) as T | null;
}

/**
 * Get all operation wrapper
 */
export async function dbGetAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return dbTransaction(db, store, 'readonly', (os) => os.getAll()) as Promise<T[]>;
}

/**
 * Put operation wrapper
 */
export async function dbPut<T>(db: IDBDatabase, store: string, value: T): Promise<void> {
  await dbTransaction(db, store, 'readwrite', (os) => os.put(value));
}

/**
 * Delete operation wrapper
 */
export async function dbDelete(db: IDBDatabase, store: string, key: string): Promise<void> {
  await dbTransaction(db, store, 'readwrite', (os) => os.delete(key));
}

/**
 * Clear operation wrapper
 */
export async function dbClear(db: IDBDatabase, store: string): Promise<void> {
  await dbTransaction(db, store, 'readwrite', (os) => os.clear());
}

/**
 * Get all keys operation wrapper
 */
export async function dbKeys(db: IDBDatabase, store: string): Promise<string[]> {
  return dbTransaction(db, store, 'readonly', (os) => os.getAllKeys()) as Promise<string[]>;
}

/**
 * Add operation wrapper (fails if key exists)
 */
export async function dbAdd<T>(db: IDBDatabase, store: string, value: T): Promise<IDBValidKey> {
  return dbTransaction(db, store, 'readwrite', (os) => os.add(value)) as Promise<IDBValidKey>;
}

/**
 * Count operation wrapper
 */
export async function dbCount(db: IDBDatabase, store: string): Promise<number> {
  return dbTransaction(db, store, 'readonly', (os) => os.count()) as Promise<number>;
}

/**
 * Filter operation wrapper - gets all and filters in memory
 */
export async function dbFilter<T>(
  db: IDBDatabase,
  store: string,
  predicate: (item: T) => boolean
): Promise<T[]> {
  const all = await dbGetAll<T>(db, store);
  return all.filter(predicate);
}

/**
 * Open a database with version management and upgrade handler
 */
export async function openDB(
  name: string,
  version: number,
  onUpgrade: (db: IDBDatabase, event: IDBVersionChangeEvent) => void
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => onUpgrade(request.result, event);
  });
}

/**
 * Create object store if it doesn't exist
 */
export function createStoreIfNotExists(
  db: IDBDatabase,
  name: string,
  keyPath: string,
  options?: IDBObjectStoreParameters
): IDBObjectStore {
  if (db.objectStoreNames.contains(name)) {
    return db.transaction(name, 'readwrite').objectStore(name);
  }
  return db.createObjectStore(name, { keyPath, ...options });
}
