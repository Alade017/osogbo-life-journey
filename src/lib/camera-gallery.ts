/**
 * On-device photo gallery for the in-game Camera. Photos stay in this browser (IndexedDB) and
 * never reach the server. When IndexedDB is unavailable, photos are kept in memory for the session.
 */
export type CapturedPhoto = {
  id: string;
  label: string;
  createdAt: number;
  blob: Blob;
};

const DB_NAME = "osogbo-camera";
const STORE = "photos";

const memoryPhotos = new Map<string, CapturedPhoto>();
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> | null {
  if (typeof indexedDB === "undefined") return null;
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch((error: unknown) => {
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const opened = openDb();
  if (!opened) return Promise.reject(new Error("IndexedDB unavailable"));
  return opened.then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = action(transaction.objectStore(STORE));
        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      }),
  );
}

export async function savePhoto(blob: Blob, label: string): Promise<CapturedPhoto> {
  const photo: CapturedPhoto = {
    id: crypto.randomUUID(),
    label,
    createdAt: Date.now(),
    blob,
  };
  try {
    await run("readwrite", (store) => store.put(photo));
  } catch {
    memoryPhotos.set(photo.id, photo);
  }
  return photo;
}

export async function listPhotos(): Promise<CapturedPhoto[]> {
  let stored: CapturedPhoto[] = [];
  try {
    stored = await run<CapturedPhoto[]>("readonly", (store) => store.getAll());
  } catch {
    stored = [];
  }
  const all = [...stored, ...memoryPhotos.values()];
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deletePhoto(id: string): Promise<void> {
  memoryPhotos.delete(id);
  try {
    await run("readwrite", (store) => store.delete(id));
  } catch {
    // Already removed from memory above; nothing is stored in IndexedDB in that case.
  }
}
