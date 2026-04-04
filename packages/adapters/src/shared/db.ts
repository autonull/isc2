/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await, @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-imports, @typescript-eslint/prefer-promise-reject-errors, @typescript-eslint/ban-ts-comment, @typescript-eslint/no-redundant-type-constituents */
export interface DBTransactionOptions {
  mode: IDBTransactionMode;
  store: string;
}

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
    req.onerror = () => reject(new Error('IndexedDB operation failed'));
  });
}

export async function dbGet<T>(db: IDBDatabase, store: string, key: string): Promise<T | null> {
  const result = await dbTransaction(db, store, 'readonly', (os) => os.get(key));
  return (result === undefined ? null : result) as T | null;
}

export async function dbGetAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return dbTransaction(db, store, 'readonly', (os) => os.getAll()) as Promise<T[]>;
}

export async function dbPut<T>(db: IDBDatabase, store: string, value: T): Promise<void> {
  await dbTransaction(db, store, 'readwrite', (os) => os.put(value));
}

export async function dbDelete(db: IDBDatabase, store: string, key: string): Promise<void> {
  await dbTransaction(db, store, 'readwrite', (os) => os.delete(key));
}

export async function dbClear(db: IDBDatabase, store: string): Promise<void> {
  await dbTransaction(db, store, 'readwrite', (os) => os.clear());
}

export async function dbKeys(db: IDBDatabase, store: string): Promise<string[]> {
  return dbTransaction(db, store, 'readonly', (os) => os.getAllKeys()) as Promise<string[]>;
}

export async function dbAdd<T>(db: IDBDatabase, store: string, value: T): Promise<IDBValidKey> {
  return dbTransaction(db, store, 'readwrite', (os) => os.add(value));
}

export async function dbCount(db: IDBDatabase, store: string): Promise<number> {
  return dbTransaction(db, store, 'readonly', (os) => os.count());
}

export async function dbFilter<T>(
  db: IDBDatabase,
  store: string,
  predicate: (item: T) => boolean
): Promise<T[]> {
  const all = await dbGetAll<T>(db, store);
  return all.filter(predicate);
}

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
