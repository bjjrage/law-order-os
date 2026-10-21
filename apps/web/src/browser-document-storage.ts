import type { LocalStorageLike } from './local-storage.js';

const KEY = 'law-order-os.local.v1', DATABASE = 'law-order-os.documents.v1', STORE = 'snapshots';
type Pointer = { format: 'LAW_ORDER_IDB_POINTER'; key: string; previous_key?: string };
function pointer(raw: string | null): Pointer | null {
  if (!raw) return null;
  try { const value = JSON.parse(raw); return value.format === 'LAW_ORDER_IDB_POINTER' && typeof value.key === 'string' ? value : null; } catch { return null; }
}
/** Small existing snapshots stay unchanged; larger cases move atomically to browser disk storage. */
export class BrowserDocumentStorage implements LocalStorageLike {
  private raw: string | null = null;
  private token: string | null = null;
  private initialized = false;
  private opening: Promise<IDBDatabase> | undefined;
  private loading: Promise<void> | undefined;
  constructor(private readonly local: LocalStorageLike) {}
  private database() {
    return this.opening ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(Error('No se pudo abrir el almacenamiento de documentos del navegador.'));
      request.onblocked = () => reject(Error('Cerrá otras pestañas del estudio para abrir el almacenamiento de documentos.'));
    });
  }
  async ready() {
    if (this.initialized) return;
    return this.loading ??= (async () => {
      const token = this.local.getItem(KEY), saved = pointer(token);
      if (saved) {
        const database = await this.database();
        this.raw = await new Promise<string>((resolve, reject) => {
          const request = database.transaction(STORE, 'readonly').objectStore(STORE).get(saved.key);
          request.onsuccess = () => typeof request.result === 'string' ? resolve(request.result) : reject(Error('No se encontró el archivo de datos local. El respaldo existente no se reemplazó.'));
          request.onerror = () => reject(Error('No se pudieron leer los documentos locales.'));
        });
      } else this.raw = token;
      if (this.local.getItem(KEY) !== token) throw Error('Los datos cambiaron en otra pestaña. Recargá antes de continuar.');
      this.token = token; this.initialized = true;
    })();
  }
  getItem(key: string) {
    if (key !== KEY) return this.local.getItem(key);
    const token = this.local.getItem(KEY);
    if (!pointer(token)) return token;
    if (!this.initialized || token !== this.token) throw Error('Los datos cambiaron en otra pestaña. Recargá antes de continuar.');
    return this.raw;
  }
  setItem(key: string, value: string) { this.local.setItem(key, value); }
  async setItemAsync(key: string, value: string) {
    if (key !== KEY) return this.local.setItem(key, value);
    const before = this.local.getItem(KEY), prior = pointer(before);
    if (value.length < 2 * 1024 * 1024 && !prior) {
      try { this.local.setItem(key, value); this.raw = value; this.token = value; return; } catch { /* Migrate on browser quota, without dropping the previous snapshot. */ }
    }
    const database = await this.database(), next = crypto.randomUUID();
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(value, next);
      tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(Error('No se pudo guardar el documento completo. El estado anterior se conservó.'));
    });
    if (this.local.getItem(KEY) !== before) throw Error('Los datos cambiaron en otra pestaña. Recargá antes de continuar.');
    const token = JSON.stringify({ format: 'LAW_ORDER_IDB_POINTER', key: next, ...(prior ? { previous_key: prior.key } : {}) });
    this.local.setItem(KEY, token); this.token = token; this.raw = value; this.initialized = true;
    // The current snapshot contains all originals/history; keep its predecessor for recovery.
    const cleanup = database.transaction(STORE, 'readwrite'), store = cleanup.objectStore(STORE), keys = store.getAllKeys();
    keys.onsuccess = () => { for (const key of keys.result) if (key !== next && key !== prior?.key) store.delete(key); };
  }
}
