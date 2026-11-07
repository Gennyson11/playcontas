import { UserProfile, Product } from "@/types";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { GENNYSON_AVATAR_URL, clearUserAvatar } from "./avatarStore";

export const USER_STORAGE_KEY = "central_user";

/**
 * Retorna o usuário logado atualmente (ou null se deslogado).
 * NUNCA força usuário padrão quando a sessão estiver vazia.
 */
export function getStoredUserSync(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed: UserProfile = JSON.parse(raw);
    if (!parsed || !parsed.id) return null;

    // Se for Gennyson, garante papel de admin e avatar atualizado
    if (
      parsed.email?.toLowerCase().includes("gennyson") ||
      parsed.name?.toLowerCase().includes("gennyson")
    ) {
      parsed.role = "admin";
      parsed.balance = Number(parsed.balance) || 0;
      if (!parsed.avatar || parsed.avatar.includes("dicebear") || parsed.avatar.includes("avatar-bb25d258")) {
        parsed.avatar = GENNYSON_AVATAR_URL;
      }
    }

    // Se for a conta do vendedor jovitools, garante o nome BuscaNinja atualizado
    if (
      parsed.email?.toLowerCase().includes("jovitools") &&
      (!parsed.name || parsed.name.toLowerCase().includes("jovizeira"))
    ) {
      parsed.name = "BuscaNinja";
      try {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(parsed));
      } catch {}
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Grava o usuário no localStorage de forma segura.
 * Se o armazenamento estiver cheio (QuotaExceededError), libera caches que podem ser
 * recriados (produtos em cache, avatar em cache) e tenta novamente, evitando que o login falhe.
 */
function sanitizeUserForStorage(user: UserProfile): UserProfile {
  // Imagens base64 gigantes não devem ir no localStorage (o avatar real fica no IndexedDB)
  if (user.avatar && user.avatar.startsWith("data:") && user.avatar.length > 20000) {
    return {
      ...user,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
        user.name || user.email || "user"
      )}`,
    };
  }
  return user;
}

export function persistUser(user: UserProfile): boolean {
  if (typeof window === "undefined") return false;

  const toSave = sanitizeUserForStorage(user);

  const tryWrite = (): boolean => {
    try {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(toSave));
      return true;
    } catch {
      return false;
    }
  };

  if (tryWrite()) return true;

  // Libera espaço removendo apenas dados recriáveis, do mais pesado ao mais leve
  const evictable = [
    "central_cached_products",
    "central_avatar_cache",
    "central_avatar_idb_stored",
    "central_ad_code_map_v2",
  ];
  for (const key of evictable) {
    try {
      localStorage.removeItem(key);
    } catch {}
    if (tryWrite()) return true;
  }

  // Último recurso: remove perguntas em cache de anúncios
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("central_questions_"))
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
  return tryWrite();
}

/**
 * Salva o usuário no localStorage e dispara evento de sincronização
 */
export function saveStoredUser(user: UserProfile): void {
  if (typeof window === "undefined") return;
  try {
    const previous = localStorage.getItem(USER_STORAGE_KEY);
    if (previous && previous === JSON.stringify(sanitizeUserForStorage(user))) return; // nada mudou: evita loop de eventos
    persistUser(user);
    window.dispatchEvent(new CustomEvent("central_auth_changed", { detail: user }));
    window.dispatchEvent(new Event("storage"));
  } catch (err) {
    console.warn("Erro ao salvar usuário:", err);
  }
}

/**
 * Realiza o logout completo: limpa dados locais, encerra sessão no Supabase e emite evento
 */
export async function clearStoredUser(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem("central_avatar_cache");
    sessionStorage.removeItem("central_avatar_session");
    // Remove qualquer token de sessão do Supabase que possa ter ficado salvo
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("sb-") || key.includes("supabase.auth")) {
        localStorage.removeItem(key);
      }
    });
  } catch {}

  await clearUserAvatar();

  if (isSupabaseConfigured) {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (err) {
      console.warn("Aviso ao encerrar sessão:", err);
    }
  }

  try {
    window.dispatchEvent(new CustomEvent("central_auth_changed", { detail: null }));
    window.dispatchEvent(new Event("storage"));
  } catch {}
}

/**
 * Verifica se um determinado produto pertence ao usuário logado.
 * Impede que o vendedor compre o seu próprio anúncio.
 */
export function isProductOwner(
  product: Product | null | undefined,
  user: UserProfile | null | undefined
): boolean {
  if (!product || !user) return false;

  const sellerId = (product.seller?.id || "").trim();
  const sellerName = (product.seller?.name || "").toLowerCase().trim();
  const sellerEmail = ((product.seller as any)?.email || "").toLowerCase().trim();

  const userId = (user.id || "").trim();
  const userName = (user.name || "").toLowerCase().trim();
  const userEmail = (user.email || "").toLowerCase().trim();

  // 1. Se o ID for idêntico
  if (userId && sellerId && (userId === sellerId || userId.toLowerCase() === sellerId.toLowerCase())) {
    return true;
  }

  // 2. Se o nome do vendedor for idêntico
  if (userName && sellerName && userName === sellerName) {
    return true;
  }

  // 3. Se o email coincidir
  if (userEmail && sellerEmail && userEmail === sellerEmail) {
    return true;
  }

  // 4. Se for a conta do Gennyson
  const isGennysonProduct =
    sellerName.includes("gennyson") ||
    sellerId === "usr-gennyson" ||
    sellerId === "bb25d258-3152-422b-aa04-7bd34e8a5927";

  const isGennysonUser =
    userName.includes("gennyson") ||
    userEmail.includes("gennyson") ||
    userId === "usr-gennyson" ||
    userId === "bb25d258-3152-422b-aa04-7bd34e8a5927";

  if (isGennysonProduct && isGennysonUser) {
    return true;
  }

  return false;
}
