import { Product } from "@/types";
import { getStoredUserSync } from "./authStore";
import { getStoredProducts } from "./productStore";

export interface FavoriteItem {
  productId: string;
  addedAt: string;
  cachedProduct?: Product;
}

const LS_FAVORITES_PREFIX = "central_favorites_v1_";

function resolveUserId(userId?: string): string {
  if (userId && typeof userId === "string" && userId.trim()) {
    return userId.trim();
  }
  const user = getStoredUserSync();
  if (user?.id && typeof user.id === "string" && user.id.trim()) {
    return user.id.trim();
  }
  return "guest";
}

function getStorageKey(userId?: string): string {
  return `${LS_FAVORITES_PREFIX}${resolveUserId(userId)}`;
}

/**
 * Retorna a lista de itens favoritados armazenados para o usuário.
 */
export function getStoredFavorites(userId?: string): FavoriteItem[] {
  if (typeof window === "undefined") return [];
  try {
    const key = getStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }

    // Se o usuário está logado mas ainda não tem nada na chave dele, tenta mesclar itens do 'guest'
    const resolved = resolveUserId(userId);
    if (resolved !== "guest") {
      const guestRaw = localStorage.getItem(`${LS_FAVORITES_PREFIX}guest`);
      if (guestRaw) {
        const guestParsed = JSON.parse(guestRaw);
        if (Array.isArray(guestParsed) && guestParsed.length > 0) {
          localStorage.setItem(key, guestRaw);
          localStorage.removeItem(`${LS_FAVORITES_PREFIX}guest`);
          return guestParsed;
        }
      }
    }
  } catch (e) {
    console.warn("Erro ao ler favoritos:", e);
  }
  return [];
}

/**
 * Salva a lista de favoritos e dispara evento para atualizar a interface em tempo real.
 */
export function saveStoredFavorites(items: FavoriteItem[], userId?: string): void {
  if (typeof window === "undefined") return;
  try {
    const key = getStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(items));
    window.dispatchEvent(
      new CustomEvent("central_favorites_changed", {
        detail: { count: items.length },
      })
    );
  } catch (e) {
    console.warn("Erro ao salvar favoritos:", e);
  }
}

/**
 * Verifica se um produto específico está na lista de favoritos.
 */
export function isProductFavorite(productId: string, userId?: string): boolean {
  if (!productId) return false;
  const list = getStoredFavorites(userId);
  return list.some((item) => item.productId === productId);
}

/**
 * Adiciona um produto aos favoritos.
 */
export function addFavorite(product: Product, userId?: string): void {
  if (!product || !product.id) return;
  const list = getStoredFavorites(userId);
  if (list.some((item) => item.productId === product.id)) return;

  const newItem: FavoriteItem = {
    productId: product.id,
    addedAt: new Date().toISOString(),
    cachedProduct: product,
  };

  const updated = [newItem, ...list];
  saveStoredFavorites(updated, userId);
}

/**
 * Remove um produto dos favoritos.
 */
export function removeFavorite(productId: string, userId?: string): void {
  if (!productId) return;
  const list = getStoredFavorites(userId);
  const updated = list.filter((item) => item.productId !== productId);
  saveStoredFavorites(updated, userId);
}

/**
 * Alterna o estado de favorito de um produto (liga/desliga).
 * Retorna true se agora está favoritado, false se foi removido.
 */
export function toggleFavorite(product: Product, userId?: string): boolean {
  if (!product || !product.id) return false;
  const isFav = isProductFavorite(product.id, userId);
  if (isFav) {
    removeFavorite(product.id, userId);
    return false;
  } else {
    addFavorite(product, userId);
    return true;
  }
}

/**
 * Limpa todos os produtos favoritados.
 */
export function clearAllFavorites(userId?: string): void {
  saveStoredFavorites([], userId);
}

/**
 * Retorna a quantidade total de itens favoritados.
 */
export function getFavoritesCount(userId?: string): number {
  return getStoredFavorites(userId).length;
}

/**
 * Retorna a lista completa de objetos `Product` favoritados,
 * enriquecendo com os dados mais recentes do catálogo central (preço atual, estoque, etc.).
 */
export function getFavoriteProducts(userId?: string): Product[] {
  const favorites = getStoredFavorites(userId);
  if (favorites.length === 0) return [];

  const catalog = getStoredProducts();
  const catalogMap = new Map<string, Product>();
  catalog.forEach((p) => {
    if (p && p.id) catalogMap.set(p.id, p);
  });

  const products: Product[] = [];
  for (const fav of favorites) {
    const liveProduct = catalogMap.get(fav.productId);
    if (liveProduct) {
      products.push(liveProduct);
    } else if (fav.cachedProduct) {
      products.push(fav.cachedProduct);
    }
  }

  return products;
}
