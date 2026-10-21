const databaseName = "law-order-os.workspace-recovery.v1";
function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("documents");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readRecovery(
  key: string,
): Promise<Uint8Array | undefined> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const r = db.transaction("documents").objectStore("documents").get(key);
      r.onsuccess = () =>
        resolve(r.result ? new Uint8Array(r.result) : undefined);
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}
export async function writeRecovery(key: string, value: Uint8Array) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("documents", "readwrite");
      tx.objectStore("documents").put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
