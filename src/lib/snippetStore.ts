// Durable storage for snippet "buckets" and their snippets.
//
// Uses IndexedDB (not localStorage) because that's the only script-writable
// store that reliably survives leaving + returning on iOS/Brave — it's the same
// mechanism the Whisper model cache already relies on. We also request
// persistent storage so the browser is asked not to evict our data.
//
// Honest limitation: a browser configured to "clear data on close" (or Brave
// Shields set aggressively) can still wipe IndexedDB. We can request, but not
// guarantee, retention.

export interface Bucket {
  id: string;
  name: string;
  createdAt: number;
}

export interface Snippet {
  id: string;
  bucketId: string;
  text: string;
  createdAt: number;
  expiresAt: number;
}

const DB_NAME = 'voicetranscriber-snippets';
const DB_VERSION = 1;
const STORE_BUCKETS = 'buckets';
const STORE_SNIPPETS = 'snippets';
const STORE_META = 'meta';

// How long snippets are retained before being pruned. Set to 7 days — well
// beyond the 48-hour minimum requirement, with margin against a browser that
// evicts a little early. Tune this single constant to change retention.
export const SNIPPET_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

// Soft cap on the number of buckets a user can create.
export const MAX_BUCKETS = 12;

export const ACTIVE_BUCKET_KEY = 'activeBucketId';

export function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* fall through */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function now(): number {
  return Date.now();
}

// Returns true if IndexedDB is usable in this environment (not SSR, not a
// browser that has disabled it, e.g. some private modes).
function idbAvailable(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDB(): Promise<IDBDatabase | null> {
  if (!idbAvailable()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_BUCKETS)) {
        db.createObjectStore(STORE_BUCKETS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SNIPPETS)) {
        const s = db.createObjectStore(STORE_SNIPPETS, { keyPath: 'id' });
        s.createIndex('bucketId', 'bucketId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });

  return dbPromise;
}

function tx<T>(
  db: IDBDatabase,
  stores: string | string[],
  mode: IDBTransactionMode,
  run: (t: IDBTransaction) => IDBRequest<T> | void,
): Promise<T | undefined> {
  return new Promise<T | undefined>((resolve) => {
    let request: IDBRequest<T> | void;
    try {
      const t = db.transaction(stores, mode);
      request = run(t);
      t.oncomplete = () => resolve(request ? (request as IDBRequest<T>).result : undefined);
      t.onerror = () => resolve(undefined);
      t.onabort = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

function getAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise<T[]>((resolve) => {
    try {
      const t = db.transaction(store, 'readonly');
      const req = t.objectStore(store).getAll();
      req.onsuccess = () => resolve((req.result as T[]) ?? []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

// Ask the browser to keep our data from being evicted. Best-effort; resolves
// regardless of outcome.
export async function requestPersistence(): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      await navigator.storage.persist();
    }
  } catch { /* ignore */ }
}

export interface SnapshotData {
  buckets: Bucket[];
  snippets: Snippet[];
  activeBucketId: string | null;
}

// Load everything, pruning any snippets whose retention window has passed.
export async function loadAll(): Promise<SnapshotData> {
  const db = await openDB();
  if (!db) return { buckets: [], snippets: [], activeBucketId: null };

  await pruneExpired(db);

  const [buckets, snippets, meta] = await Promise.all([
    getAll<Bucket>(db, STORE_BUCKETS),
    getAll<Snippet>(db, STORE_SNIPPETS),
    getAll<{ key: string; value: string }>(db, STORE_META),
  ]);

  buckets.sort((a, b) => a.createdAt - b.createdAt);
  snippets.sort((a, b) => b.createdAt - a.createdAt);
  const active = meta.find((m) => m.key === ACTIVE_BUCKET_KEY)?.value ?? null;

  return { buckets, snippets, activeBucketId: active };
}

async function pruneExpired(db: IDBDatabase): Promise<void> {
  const cutoff = now();
  await new Promise<void>((resolve) => {
    try {
      const t = db.transaction(STORE_SNIPPETS, 'readwrite');
      const store = t.objectStore(STORE_SNIPPETS);
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) return;
        const snip = cursor.value as Snippet;
        if (snip.expiresAt && snip.expiresAt < cutoff) cursor.delete();
        cursor.continue();
      };
      t.oncomplete = () => resolve();
      t.onerror = () => resolve();
      t.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function putBucket(bucket: Bucket): Promise<void> {
  const db = await openDB();
  if (!db) return;
  await tx(db, STORE_BUCKETS, 'readwrite', (t) => t.objectStore(STORE_BUCKETS).put(bucket));
}

export async function deleteBucket(bucketId: string): Promise<void> {
  const db = await openDB();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const t = db.transaction([STORE_BUCKETS, STORE_SNIPPETS], 'readwrite');
      t.objectStore(STORE_BUCKETS).delete(bucketId);
      // Remove all snippets belonging to this bucket.
      const idx = t.objectStore(STORE_SNIPPETS).index('bucketId');
      const cursorReq = idx.openCursor(IDBKeyRange.only(bucketId));
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) return;
        cursor.delete();
        cursor.continue();
      };
      t.oncomplete = () => resolve();
      t.onerror = () => resolve();
      t.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function putSnippet(snippet: Snippet): Promise<void> {
  const db = await openDB();
  if (!db) return;
  await tx(db, STORE_SNIPPETS, 'readwrite', (t) => t.objectStore(STORE_SNIPPETS).put(snippet));
}

export async function deleteSnippet(snippetId: string): Promise<void> {
  const db = await openDB();
  if (!db) return;
  await tx(db, STORE_SNIPPETS, 'readwrite', (t) => t.objectStore(STORE_SNIPPETS).delete(snippetId));
}

export async function setActiveBucketId(bucketId: string | null): Promise<void> {
  const db = await openDB();
  if (!db) return;
  await tx(db, STORE_META, 'readwrite', (t) =>
    t.objectStore(STORE_META).put({ key: ACTIVE_BUCKET_KEY, value: bucketId }),
  );
}
