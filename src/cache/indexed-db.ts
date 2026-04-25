export type CacheRecord<T> = {
  key: string;
  value: T;
  savedAt: number;
  etag?: string;
  lastModified?: string;
};

const DB_NAME = 'github-repo-visibility';
const STORE = 'records';
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export async function getCache<T>(key: string, maxAgeMs: number): Promise<{ record: CacheRecord<T>; stale: boolean } | null> {
  const db = await openDb();
  const record = await requestToPromise<CacheRecord<T> | undefined>(db.transaction(STORE, 'readonly').objectStore(STORE).get(key));
  if (!record) return null;
  return { record, stale: Date.now() - record.savedAt > maxAgeMs };
}

export async function putCache<T>(key: string, value: T, validators?: { etag?: string; lastModified?: string }): Promise<CacheRecord<T>> {
  const db = await openDb();
  const record: CacheRecord<T> = {
    key,
    value,
    savedAt: Date.now(),
    etag: validators?.etag,
    lastModified: validators?.lastModified
  };
  await requestToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).put(record));
  return record;
}

export async function getValidators(key: string): Promise<{ etag?: string; lastModified?: string } | undefined> {
  const db = await openDb();
  const record = await requestToPromise<CacheRecord<unknown> | undefined>(db.transaction(STORE, 'readonly').objectStore(STORE).get(key));
  if (!record) return undefined;
  return { etag: record.etag, lastModified: record.lastModified };
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
