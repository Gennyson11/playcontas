/**
 * Armazenamento de Imagens de Produtos em Alta Resolução e GIFs via IndexedDB.
 * Não possui limite de 5MB do localStorage, garantindo que a imagem original do usuário
 * (ex: Muse AI) NUNCA seja perdida ou substituída por imagens de terceiros.
 */

const DB_NAME = "CentralDasIAsDB";
const STORE_NAME = "product_images";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB não suportado no ambiente atual"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains("profile_media")) {
        db.createObjectStore("profile_media");
      }
    };
    request.onsuccess = (e: any) => resolve(e.target.result);
    request.onerror = (e: any) => reject(e.target.error);
  });
}

/**
 * Salva a imagem completa do produto no IndexedDB
 */
export async function saveProductImage(productId: string, imageData: string): Promise<boolean> {
  if (typeof window === "undefined" || !imageData) return false;

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(imageData, productId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    return true;
  } catch (err) {
    console.warn("Erro ao salvar imagem no IndexedDB:", err);
    return false;
  }
}

/**
 * Carrega a imagem persistida de um produto pelo ID ou código
 */
export async function getProductImage(productId: string): Promise<string | null> {
  if (typeof window === "undefined") return null;

  try {
    const db = await openDB();
    return await new Promise<string | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(productId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Carrega todas as imagens de produtos persistidas no IndexedDB
 */
export async function getAllProductImages(): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {};

  try {
    const db = await openDB();
    return await new Promise<Record<string, string>>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      const results: Record<string, string> = {};

      req.onsuccess = (e: any) => {
        const cursor = e.target.result;
        if (cursor) {
          results[String(cursor.key)] = cursor.value;
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      req.onerror = () => resolve({});
    });
  } catch {
    return {};
  }
}
