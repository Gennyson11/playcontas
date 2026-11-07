/**
 * Sistema de Armazenamento Persistente de Avatar / GIF de Perfil.
 * Usa IndexedDB para suportar arquivos e GIFs animados de qualquer tamanho (sem estourar o limite de 5MB do localStorage).
 */

const DB_NAME = "CentralDasIAsDB";
const STORE_NAME = "profile_media";
const AVATAR_KEY = "user_avatar";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB not supported"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (e: any) => resolve(e.target.result);
    request.onerror = (e: any) => reject(e.target.error);
  });
}

/**
 * Salva a foto/GIF de perfil no IndexedDB e no localStorage (com fallback)
 */
export async function saveUserAvatar(avatarData: string): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // 1. Tenta salvar no IndexedDB (suporta grandes arquivos e GIFs animados sem limite)
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(avatarData, AVATAR_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("IndexedDB save failed, falling back:", err);
  }

  // 2. Se for URL curta ou imagem menor que 1.5MB, tenta salvar no localStorage também
  if (avatarData.length < 1500000) {
    try {
      localStorage.setItem("central_avatar_cache", avatarData);
    } catch {}
  } else {
    // Se for muito grande para localStorage, salva apenas flag
    try {
      localStorage.setItem("central_avatar_idb_stored", "true");
    } catch {}
  }

  return true;
}

/**
 * Remove a foto/GIF de perfil persistida (IndexedDB + localStorage).
 * Chamado no logout para que a próxima conta não herde o avatar da anterior.
 */
export async function clearUserAvatar(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("central_avatar_cache");
    localStorage.removeItem("central_avatar_idb_stored");
  } catch {}
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const req = tx.objectStore(STORE_NAME).delete(AVATAR_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {}
}

export const GENNYSON_AVATAR_URL =
  "https://lazueuycrcqirdykdppm.supabase.co/storage/v1/object/public/avatars/avatar-gennysonmarinhodemacedo_gmail_com.gif";

/**
 * Carrega a foto/GIF de perfil persistido
 */
export async function getUserAvatar(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  // 1. Tenta buscar do IndexedDB
  try {
    const db = await openDB();
    const result = await new Promise<string | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(AVATAR_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
    if (result) return result;
  } catch {}

  // 2. Fallback para localStorage
  try {
    const local = localStorage.getItem("central_avatar_cache");
    if (local && !local.includes("dicebear")) return local;
  } catch {}

  return null;
}

/**
 * Recupera o avatar sincronamente do cache para renderização instantânea (sem flash/flicker)
 */
export function getCachedAvatarSync(fallback?: string): string {
  if (typeof window === "undefined") return fallback || "";
  try {
    const cached = localStorage.getItem("central_avatar_cache");
    if (cached && !cached.startsWith("idb:") && !cached.includes("dicebear") && !cached.includes("avatar-bb25d258")) {
      return cached;
    }
    const userStr = localStorage.getItem("central_user");
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user?.avatar && !user.avatar.startsWith("idb:") && !user.avatar.includes("dicebear") && !user.avatar.includes("avatar-bb25d258")) {
        return user.avatar;
      }
      if (user?.email?.toLowerCase().includes("gennyson") || user?.name?.toLowerCase().includes("gennyson")) {
        return GENNYSON_AVATAR_URL;
      }
    }
  } catch {}
  return fallback || "";
}
