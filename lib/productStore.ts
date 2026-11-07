import { Product, CartItem } from "@/types";
import { INITIAL_PRODUCTS } from "./data";
import { getProductAdCode } from "./adCode";
import { slugify, getProductUrl, getProductShortId } from "./slug";
import { saveProductImage, getProductImage, getAllProductImages } from "./productImageStore";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { notifyStockDepleted, addNotification } from "./notificationStore";
import { variationFieldsFromRow } from "./productVault";

const CACHE_KEY = "central_cached_products";
const OVERRIDES_KEY = "central_product_overrides";
export const DELETED_PRODUCTS_KEY = "central_deleted_product_ids";

let memoryDeletedSet: Set<string> = new Set();

export function getDeletedProductSet(): Set<string> {
  if (typeof window === "undefined") return memoryDeletedSet;
  try {
    const raw = localStorage.getItem(DELETED_PRODUCTS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        const cleaned: string[] = [];
        arr.forEach((k) => {
          if (!k || typeof k !== "string") return;
          const trimmed = k.toLowerCase().trim();
          // Ignora códigos sequenciais (#01, 01, #04, 04) que nunca devem ser usados como IDs deletados
          if (/^#?\d{1,4}$/.test(trimmed)) return;
          if (trimmed.length < 3) return;
          cleaned.push(trimmed);
          memoryDeletedSet.add(trimmed);
        });
        if (cleaned.length !== arr.length) {
          try {
            localStorage.setItem(DELETED_PRODUCTS_KEY, JSON.stringify(cleaned));
          } catch {}
        }
      }
    }
  } catch {}
  return memoryDeletedSet;
}

export function isProductDeleted(
  productOrId: Product | string,
  title?: string,
  code?: string
): boolean {
  const deletedSet = getDeletedProductSet();
  if (typeof productOrId === "string") {
    const idLower = productOrId.toLowerCase().trim();
    if (/^#?\d{1,4}$/.test(idLower)) return false;
    return deletedSet.has(idLower);
  }
  const p = productOrId;
  if (!p) return false;

  // Se o anúncio está com status 'active' e estoque > 0, ele NUNCA é considerado excluído
  if (p.status === "active" && Number(p.stock ?? 0) > 0) {
    if (p.id && deletedSet.has(p.id.toLowerCase().trim())) {
      deletedSet.delete(p.id.toLowerCase().trim());
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(DELETED_PRODUCTS_KEY, JSON.stringify(Array.from(deletedSet)));
        } catch {}
      }
    }
    return false;
  }

  if (p.status === "deleted") return true;

  if (p.id && deletedSet.has(p.id.toLowerCase().trim())) {
    return true;
  }

  return false;
}

/**
 * Verifica se um produto está ativo e disponível para exibição e compra na vitrine pública.
 * Retorna false se o anúncio estiver pausado, desativado, sem estoque ou com todas as variações esgotadas.
 */
export function isProductAvailableForSale(p: Product): boolean {
  if (!p) return false;
  if (isProductDeleted(p)) return false;

  // Status pausado, excluído, pendente de aprovação ou reprovado
  if (
    p.status === "paused" ||
    p.status === "deleted" ||
    p.status === "pending_review" ||
    p.status === "pending_approval" ||
    p.status === "rejected"
  ) {
    return false;
  }

  // Verifica se o anúncio possui variações
  const hasVariants =
    (Boolean(p.hasVariations) ||
      p.listingType === "MULTIPLA" ||
      (Array.isArray(p.variants) && p.variants.length > 0)) &&
    Boolean(p.variants && p.variants.length > 0);

  if (hasVariants) {
    const hasAnyStock = p.variants!.some((v) => Number(v.stock ?? 0) > 0);
    if (!hasAnyStock) return false;
    const totalVarStock = p.variants!.reduce((sum, v) => sum + Number(v.stock ?? 0), 0);
    if (totalVarStock <= 0) return false;
    return true;
  }

  // Anúncio padrão de estoque único
  if (p.stock !== undefined && Number(p.stock) <= 0) {
    return false;
  }

  return true;
}

// Lista de IDs de produtos demo/exemplos antigos para expurgo definitivo
const DUMMY_PRODUCT_IDS = new Set([
  "prime-video-6m",
  "cod-bo4",
  "ffxiv-collector",
  "absolver-downfall",
  "dead-by-daylight",
  "skyrim-special",
  "battlefield-1",
  "gta-v-eu",
  "battlefield-5",
  "gemini-pro-18m",
  "chatgpt-plus",
  "midjourney-pro",
  "claude-sonnet",
  "cursor-pro",
  "capcut-pro",
  "canva-pro",
  "nordvpn-2y",
  "youtube-premium",
  "duolingo-plus",
]);

// In-memory cache for ultra-fast, quota-immune access
let memoryProducts: Product[] = [];
let memoryOverrides: Record<string, Product> = {};
let isHydratedFromIdb = false;

// Async hydration helper to restore full-res base64 images from IndexedDB
export async function hydrateFromIndexedDB(): Promise<Product[]> {
  if (typeof window === "undefined") return memoryProducts;
  try {
    const idbImages = await getAllProductImages();
    const hasKeys = Object.keys(idbImages).length > 0;
    if (!hasKeys) return memoryProducts;

    let changed = false;
    memoryProducts = memoryProducts.map((p) => {
      const code = getProductAdCode(p);
      const codeClean = code.replace("#", "");
      const realImage =
        idbImages[p.id] ||
        idbImages[code] ||
        idbImages[codeClean] ||
        (p.title.toLowerCase().includes("muse") ? idbImages["muse-ai-pro"] || idbImages["01"] : null);

      if (realImage && realImage !== p.image) {
        changed = true;
        return { ...p, image: realImage };
      }
      return p;
    });

    if (changed) {
      window.dispatchEvent(new Event("central_products_updated"));
    }
  } catch (err) {
    console.warn("Erro ao hidratar imagens do IndexedDB:", err);
  }
  return memoryProducts;
}

// Helper to safely serialize products without throwing QuotaExceededError
function sanitizeProductForStorage(product: Product): Product {
  const img = product.image || "";
  // Se for base64 gigante (> 200KB), não colocamos o payload gigante no localStorage
  // pois o IndexedDB e a memória já mantêm a imagem original completa com 100% de qualidade.
  if (img.startsWith("data:") && img.length > 200000) {
    return {
      ...product,
      image: `idb:${product.id}`,
    };
  }
  return product;
}

const GENNYSON_AVATAR =
  "https://lazueuycrcqirdykdppm.supabase.co/storage/v1/object/public/avatars/avatar-gennysonmarinhodemacedo_gmail_com.gif";
const MUSE_PROD_IMAGE =
  "https://lazueuycrcqirdykdppm.supabase.co/storage/v1/object/public/products/prod-0c8ec785-d1e7-42cd-9125-e379921bc797.png";

export function normalizeProductMedia(p: Product): Product {
  let updated = { ...p };
  if (
    updated.seller &&
    (updated.seller.name === "Gennyson Marinho" || updated.seller.name?.toLowerCase().includes("gennyson")) &&
    (!updated.seller.avatar || updated.seller.avatar.includes("dicebear") || updated.seller.avatar.includes("avatar-bb25d258"))
  ) {
    updated.seller = { ...updated.seller, avatar: GENNYSON_AVATAR };
  }
  if (updated.id === "muse-ai-pro" && (!updated.image || updated.image.includes("unsplash"))) {
    updated.image = MUSE_PROD_IMAGE;
  }
  return updated;
}

/**
 * Remove produtos repetidos (mesmo id), mantendo a primeira ocorrência.
 * Os overrides são gravados com 3 chaves por anúncio (id, código "#0003" e "0003"),
 * então Object.values(overrides) devolve o MESMO anúncio 3 vezes — daí os anúncios triplicados.
 */
function uniqueById<T extends { id: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of list) {
    if (!item || !item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

export function getStoredOverrides(): Record<string, Product> {
  if (typeof window === "undefined") return memoryOverrides;
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        // Remove quaisquer overrides residuais de produtos demo
        DUMMY_PRODUCT_IDS.forEach((id) => {
          delete parsed[id];
        });

        // Remove quaisquer chaves numéricas ou de códigos sequenciais (#01, 01, etc.)
        for (const k of Object.keys(parsed)) {
          if (/^#?\d{1,4}$/.test(k.trim())) {
            delete parsed[k];
          }
        }

        // Remove quaisquer overrides residuais de produtos excluídos
        const deletedSet = getDeletedProductSet();
        for (const [k, v] of Object.entries(parsed)) {
          const p = v as Product;
          if (
            deletedSet.has(k.toLowerCase().trim()) ||
            (p && isProductDeleted(p))
          ) {
            delete parsed[k];
          }
        }

        memoryOverrides = { ...parsed, ...memoryOverrides };
        for (const [k, v] of Object.entries(memoryOverrides)) {
          if (
            /^#?\d{1,4}$/.test(k.trim()) ||
            deletedSet.has(k.toLowerCase().trim()) ||
            (v && isProductDeleted(v))
          ) {
            delete memoryOverrides[k];
          }
        }

        return memoryOverrides;
      }
    }
  } catch (err) {
    console.warn("Erro ao ler overrides de produtos do localStorage:", err);
  }
  return memoryOverrides;
}

export function getStoredProducts(): Product[] {
  if (typeof window === "undefined") {
    return INITIAL_PRODUCTS.filter((p) => !isProductDeleted(p));
  }

  // Inicia hidratação em segundo plano se ainda não foi feita
  if (!isHydratedFromIdb) {
    isHydratedFromIdb = true;
    hydrateFromIndexedDB().catch(() => {});
  }

  // Se já temos em memória durante a sessão e não está vazio, retorne filtrando deletados
  if (memoryProducts.length > 0) {
    return memoryProducts.filter((p) => !isProductDeleted(p));
  }

  const overrides = getStoredOverrides();

  // Tenta ler do cache do localStorage
  let baseList: Product[] = INITIAL_PRODUCTS.filter((p) => !isProductDeleted(p));
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Filtra e elimina qualquer anúncio fictício antigo ou deletado
        const cleaned = parsed.filter(
          (p: any) => p && p.id && !DUMMY_PRODUCT_IDS.has(p.id) && !isProductDeleted(p)
        );
        if (cleaned.length > 0) {
          baseList = uniqueById(cleaned);
        }
      }
    }
  } catch {}

  // Mescla com os overrides locais (as edições do usuário SEMPRE têm prioridade)
  const merged = baseList.map((p) => {
    // Override buscado estritamente pelo ID único do produto
    const override = overrides[p.id];

    let prod = p;
    if (override) {
      // Se a imagem no override for um ponteiro idb, preserve a imagem que já temos em memória se existir
      const finalImage =
        override.image && override.image.startsWith("idb:")
          ? p.image && !p.image.startsWith("idb:")
            ? p.image
            : override.image
          : override.image || p.image;

      const resolvedStatus =
        p.status === "active"
          ? (Number(prod.stock ?? override.stock ?? 1) <= 0 ? "paused" : "active")
          : p.status === "rejected"
          ? "rejected"
          : override.status === "rejected"
          ? "rejected"
          : p.status === "pending_review" || p.status === "pending_approval"
          ? "pending_review"
          : override.status || p.status;

      const resolvedRejectionReason =
        resolvedStatus === "active"
          ? undefined
          : p.status === "rejected"
          ? p.rejectionReason || override.rejectionReason
          : override.status === "rejected"
          ? override.rejectionReason || p.rejectionReason
          : undefined;

      if (override && p.status === "active" && override.status !== resolvedStatus) {
        override.status = resolvedStatus;
        override.rejectionReason = undefined;
      }

      prod = {
        ...p,
        ...override,
        status: resolvedStatus,
        rejectionReason: resolvedRejectionReason,
        image: finalImage,
      };
    }

    // Se o produto possui estoque positivo, garante que status não fique travado em paused
    if (prod.stock !== undefined && Number(prod.stock) > 0 && prod.status === "paused") {
      prod = { ...prod, status: "active" };
    }

    return prod;
  });

  // Inclui novos produtos criados localmente que ainda não estavam na lista base
  const existingIds = new Set(merged.map((p) => p.id));
  const existingTitles = new Set(
    merged.map((p) => (p.title || "").trim().toLowerCase()).filter(Boolean)
  );
  const newOnes = uniqueById(Object.values(overrides)).filter(
    (o) =>
      !existingIds.has(o.id) &&
      !existingTitles.has((o.title || "").trim().toLowerCase()) &&
      !DUMMY_PRODUCT_IDS.has(o.id) &&
      !isProductDeleted(o)
  );
  const result = uniqueById([...merged, ...newOnes])
    .filter((p) => p && p.id && !DUMMY_PRODUCT_IDS.has(p.id) && !isProductDeleted(p))
    .map(normalizeProductMedia);

  memoryProducts = result;
  
  // Salva no localStorage a lista higienizada sem nenhum anúncio demo indesejado
  try {
    const safeList = result.map(sanitizeProductForStorage);
    localStorage.setItem(CACHE_KEY, JSON.stringify(safeList));
  } catch {}

  return result;
}

export function saveStoredProduct(updatedProduct: Product): Product[] {
  // Desmarca dos deletados caso tenha o mesmo id
  const deletedSet = getDeletedProductSet();
  deletedSet.delete(updatedProduct.id.toLowerCase().trim());
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(DELETED_PRODUCTS_KEY, JSON.stringify(Array.from(deletedSet)));
    } catch {}
  }

  // Se este produto possui um ID oficial (UUID), remove qualquer rascunho anterior com ID temporário e mesmo título
  if (updatedProduct.id && !updatedProduct.id.startsWith("prod-") && updatedProduct.title) {
    const targetTitle = updatedProduct.title.trim().toLowerCase();
    for (const [k, v] of Object.entries(memoryOverrides)) {
      if (k !== updatedProduct.id && v && v.title && v.title.trim().toLowerCase() === targetTitle) {
        delete memoryOverrides[k];
      }
    }
  }

  // Salva no mapa de overrides em memória com a imagem original intacta pelo ID
  memoryOverrides[updatedProduct.id] = updatedProduct;

  // Salva no IndexedDB imediatamente para nunca perder a imagem
  if (typeof window !== "undefined" && updatedProduct.image) {
    saveProductImage(updatedProduct.id, updatedProduct.image);
  }

  if (typeof window !== "undefined") {
    try {
      // Salva os overrides de forma segura (sem estourar quota)
      const safeOverrides: Record<string, Product> = {};
      for (const [k, v] of Object.entries(memoryOverrides)) {
        safeOverrides[k] = sanitizeProductForStorage(v);
      }
      localStorage.setItem(OVERRIDES_KEY, JSON.stringify(safeOverrides));
    } catch (err) {
      console.warn("Aviso ao salvar overrides no localStorage:", err);
    }

    try {
      // Atualiza a lista principal em cache
      const currentList = getStoredProducts();
      const idx = currentList.findIndex(
        (p) => p.id === updatedProduct.id
      );

      let newList: Product[];
      if (idx >= 0) {
        newList = currentList.map((p, i) => (i === idx ? updatedProduct : p));
      } else {
        newList = [updatedProduct, ...currentList];
      }

      memoryProducts = uniqueById(newList).filter((p) => !isProductDeleted(p));
      const safeList = memoryProducts.map(sanitizeProductForStorage);
      localStorage.setItem(CACHE_KEY, JSON.stringify(safeList));
    } catch (err) {
      console.warn("Aviso ao salvar central_cached_products:", err);
    }

    // Dispara evento global para sincronizar todas as páginas e componentes instantaneamente
    try {
      window.dispatchEvent(
        new CustomEvent("central_products_updated", { detail: updatedProduct })
      );
      window.dispatchEvent(new Event("storage"));
    } catch {}
  }

  return memoryProducts;
}

export function deleteStoredProduct(productId: string, productObj?: Product): Product[] {
  const currentList = getStoredProducts();
  const target = productObj || currentList.find((p) => p.id === productId);

  // 1. Marca no set de excluídos persistente apenas o ID do anúncio
  const deletedSet = getDeletedProductSet();
  if (productId) deletedSet.add(productId.toLowerCase().trim());
  if (target?.id) deletedSet.add(target.id.toLowerCase().trim());

  // 2. Remove de memoryOverrides todas as referências ao produto pelo ID
  delete memoryOverrides[productId];
  if (target?.id) delete memoryOverrides[target.id];

  for (const [key, prod] of Object.entries(memoryOverrides)) {
    const k = key.toLowerCase().trim();
    if (
      k === productId.toLowerCase().trim() ||
      (target && k === target.id.toLowerCase().trim()) ||
      prod.id === productId ||
      (target && prod.id === target.id)
    ) {
      delete memoryOverrides[key];
    }
  }

  if (typeof window !== "undefined") {
    // 3. Salva a lista de excluídos no localStorage para persistir entre reloads
    try {
      localStorage.setItem(DELETED_PRODUCTS_KEY, JSON.stringify(Array.from(deletedSet)));
    } catch {}

    // 4. Limpa do OVERRIDES_KEY no localStorage
    try {
      const raw = localStorage.getItem(OVERRIDES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        delete parsed[productId];
        if (target?.id) delete parsed[target.id];
        for (const [key, prod] of Object.entries(parsed)) {
          const k = key.toLowerCase().trim();
          const p = prod as any;
          if (
            k === productId.toLowerCase().trim() ||
            (target && k === target.id.toLowerCase().trim()) ||
            (p && (p.id === productId || (target && p.id === target.id)))
          ) {
            delete parsed[key];
          }
        }
        localStorage.setItem(OVERRIDES_KEY, JSON.stringify(parsed));
      }
    } catch {}

    // 5. Atualiza a lista filtrando o excluído
    const updated = currentList.filter(
      (p) => p.id !== productId && (!target || p.id !== target.id)
    );
    memoryProducts = updated;

    try {
      const safeList = updated.map(sanitizeProductForStorage);
      localStorage.setItem(CACHE_KEY, JSON.stringify(safeList));
    } catch {}

    // 6. Notifica outros componentes e abas
    try {
      window.dispatchEvent(
        new CustomEvent("central_products_updated", { detail: { deletedId: productId } })
      );
      window.dispatchEvent(new Event("storage"));
    } catch {}
  }

  return memoryProducts;
}

/**
 * Limpeza única: remove anúncios de teste criados recentemente com o vendedor-padrão
 * antigo ("me-seller" / "Central das IAs"), que ficaram órfãos no navegador e não
 * pertencem a nenhum usuário real. Só considera anúncios dos últimos 3 dias.
 */
export function purgeLegacyPlaceholderProducts(): number {
  if (typeof window === "undefined") return 0;
  const limit = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const targets = getStoredProducts().filter((p) => {
    if (p.seller?.id !== "me-seller") return false;
    const t = new Date(p.createdAt || 0).getTime();
    return !isNaN(t) && t >= limit;
  });
  targets.forEach((p) => deleteStoredProduct(p.id, p));
  return targets.length;
}

export async function deleteProductRemote(productOrId: string | Product): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const id = typeof productOrId === "string" ? productOrId : productOrId.id;
    const title = typeof productOrId === "object" ? productOrId.title : undefined;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    // 1. Deleta por ID se for UUID válido
    if (isUuid) {
      await supabase.from("products").delete().eq("id", id);
      await supabase.from("products").update({ status: "deleted" }).eq("id", id);
    }

    // 2. Se temos o título, remove e atualiza status para 'deleted'
    if (title) {
      await supabase.from("products").delete().eq("title", title);
      await supabase.from("products").update({ status: "deleted" }).eq("title", title);
    }
  } catch (err) {
    console.warn("Aviso ao remover produto do Supabase:", err);
  }
}

export function mergeWithSupabaseProducts(supabaseList: Product[]): Product[] {
  const overrides = getStoredOverrides();
  const cleanedSupabase = supabaseList.filter(
    (sp) => sp && !DUMMY_PRODUCT_IDS.has(sp.id) && !isProductDeleted(sp)
  );

  // Lista do Supabase mesclada com overrides locais (edições do usuário nunca são sobrescritas!)
  const mergedFromDb = cleanedSupabase.map((sp) => {
    // Override só é válido se for para o MESMO produto (pelo id exato)
    const override = overrides[sp.id];

    if (override) {
      const isDbActiveWithStock = sp.status === "active" && Number(sp.stock ?? 0) > 0;

      // Se no Supabase o produto está ATIVO com estoque, mas o override local residual
      // estava pausado ou zerado (ex: por edições anteriores manuais/automáticas),
      // purga o override corrompido para que o produto fique disponível para venda!
      if (isDbActiveWithStock && (override.status === "paused" || Number(override.stock ?? 0) <= 0)) {
        delete overrides[sp.id];
        delete memoryOverrides[sp.id];
        if (typeof window !== "undefined") {
          try {
            const raw = localStorage.getItem(OVERRIDES_KEY);
            if (raw) {
              const parsed = JSON.parse(raw);
              delete parsed[sp.id];
              localStorage.setItem(OVERRIDES_KEY, JSON.stringify(parsed));
            }
          } catch {}
        }
        return sp;
      }

      // Se a imagem no override for um ponteiro idb quebrado ou vazia, mantém a imagem real do Supabase
      const validImage =
        override.image && !override.image.startsWith("idb:")
          ? override.image
          : sp.image && !sp.image.startsWith("idb:")
          ? sp.image
          : override.image || sp.image;

      // Mescla as variações: se o estoque zerou localmente ou no banco, o menor valor (0) sempre prevalece
      let resolvedVariants = override.variants || sp.variants;
      if (override.variants && sp.variants) {
        resolvedVariants = override.variants.map((ov) => {
          const spV = sp.variants?.find(
            (sv) =>
              sv.id === ov.id ||
              sv.name.toLowerCase().trim() === ov.name.toLowerCase().trim()
          );
          if (!spV) return ov;
          return {
            ...ov,
            stock: Math.min(Number(ov.stock ?? 0), Number(spV.stock ?? 0)),
          };
        });
      }

      const totalVarStock =
        resolvedVariants && resolvedVariants.length > 0
          ? resolvedVariants.reduce((sum, v) => sum + Number(v.stock || 0), 0)
          : undefined;

      const dbSales = Number(sp.salesCount) || 0;
      const localSales = Number(override.salesCount) || 0;
      const salesFromDb =
        dbSales > localSales ? { stock: sp.stock, salesCount: sp.salesCount } : {};

      // Se o produto está ativo no Supabase com estoque, o estoque do banco prevalece se o override for 0
      let finalStock: number;
      if (totalVarStock !== undefined) {
        finalStock = totalVarStock;
      } else if (isDbActiveWithStock) {
        finalStock = override.stock !== undefined && override.stock > 0 ? override.stock : Number(sp.stock);
      } else {
        finalStock = salesFromDb.stock ?? override.stock ?? sp.stock ?? 0;
      }

      const isRejectedInDb = sp.status === "rejected";
      const isPendingInDb = sp.status === "pending_review" || sp.status === "pending_approval";
      const isActiveInDb = sp.status === "active";
      const isPausedInDb = sp.status === "paused";

      // A aprovação ou reprovação vinda do Supabase é soberana sobre o override local
      let finalStatus: Product["status"];
      if (isActiveInDb) {
        finalStatus = finalStock <= 0 ? "paused" : "active";
      } else if (isRejectedInDb) {
        finalStatus = "rejected";
      } else if (isPendingInDb) {
        finalStatus = "pending_review";
      } else if (isPausedInDb || finalStock <= 0) {
        finalStatus = "paused";
      } else if (override.status === "rejected") {
        finalStatus = "rejected";
      } else if (override.status === "pending_review" || override.status === "pending_approval") {
        finalStatus = "pending_review";
      } else if (override.status === "paused") {
        finalStatus = "paused";
      } else {
        finalStatus = sp.status || "active";
      }

      const finalRejectionReason =
        finalStatus === "active"
          ? undefined
          : isRejectedInDb
          ? sp.rejectionReason || override.rejectionReason
          : override.status === "rejected"
          ? override.rejectionReason || sp.rejectionReason
          : undefined;

      // Se o produto foi aprovado ou rejeitado no Supabase, atualiza o override para não conflitar
      if (override) {
        override.status = finalStatus;
        override.rejectionReason = finalRejectionReason;
        try {
          const raw = localStorage.getItem(OVERRIDES_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed[sp.id]) {
              parsed[sp.id].status = finalStatus;
              parsed[sp.id].rejectionReason = finalRejectionReason;
              localStorage.setItem(OVERRIDES_KEY, JSON.stringify(parsed));
            }
          }
        } catch {}
      }

      return {
        ...sp,
        ...override,
        ...salesFromDb,
        variants: resolvedVariants,
        stock: finalStock,
        status: finalStatus,
        rejectionReason: finalRejectionReason,
        image: validImage,
      };
    }
    return sp;
  });

  // Purga overrides locais órfãos ou temporários cujo título coincide com um produto do Supabase
  const dbTitlesMap = new Map<string, Product>();
  mergedFromDb.forEach((p) => {
    if (p.title) dbTitlesMap.set(p.title.trim().toLowerCase(), p);
  });

  let overridesModified = false;
  for (const [k, ov] of Object.entries(overrides)) {
    if (!ov || !ov.title) continue;
    const match = dbTitlesMap.get(ov.title.trim().toLowerCase());
    if (match && match.id !== ov.id) {
      delete overrides[k];
      delete memoryOverrides[k];
      overridesModified = true;
    }
  }

  if (overridesModified && typeof window !== "undefined") {
    try {
      localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
    } catch {}
  }

  // Novos produtos locais (apenas se ID e Título forem inéditos no banco)
  const existingIds = new Set(mergedFromDb.map((p) => p.id));
  const existingTitles = new Set(
    mergedFromDb.map((p) => (p.title || "").trim().toLowerCase()).filter(Boolean)
  );
  const newLocals = uniqueById(Object.values(overrides)).filter(
    (o) =>
      !existingIds.has(o.id) &&
      !existingTitles.has((o.title || "").trim().toLowerCase()) &&
      !DUMMY_PRODUCT_IDS.has(o.id) &&
      !isProductDeleted(o)
  );

  // Os produtos oficiais do Supabase (mergedFromDb) têm precedência sobre rascunhos locais não salvos
  const combined = uniqueById([...mergedFromDb, ...newLocals])
    .filter((p) => p && !DUMMY_PRODUCT_IDS.has(p.id) && !isProductDeleted(p))
    .map(normalizeProductMedia);

  memoryProducts = combined;

  // Atualiza também o cache local com a lista higienizada
  if (typeof window !== "undefined") {
    try {
      const safeList = combined.map(sanitizeProductForStorage);
      localStorage.setItem(CACHE_KEY, JSON.stringify(safeList));
    } catch {}
  }

  return combined;
}

export function findProductBySlugOrId(
  products: Product[],
  slugOrId: string
): Product | undefined {
  if (!slugOrId) return undefined;
  const decoded = decodeURIComponent(slugOrId).trim().toLowerCase();

  // 1. Busca por ID completo exato (ex: UUID ou "muse-ai-pro")
  const byExactId = products.find((p) => p.id.toLowerCase() === decoded);
  if (byExactId) return byExactId;

  // 2. Busca pela URL exata gerada para o produto
  const byExactUrl = products.find((p) => {
    const fullUrl = getProductUrl(p).toLowerCase();
    return fullUrl === `/anuncio/${decoded}` || fullUrl.replace("/anuncio/", "") === decoded;
  });
  if (byExactUrl) return byExactUrl;

  // 3. Busca pelo ID único (shortId) no final do slug (ex: "anuncio-teste-0c8ec785" -> "0c8ec785")
  const parts = decoded.split("-");
  const candidateShortId = parts[parts.length - 1];
  if (candidateShortId && candidateShortId.length >= 4) {
    const byShortId = products.find((p) => {
      const sId = getProductShortId(p.id).toLowerCase();
      return (
        sId === candidateShortId ||
        p.id.toLowerCase().startsWith(candidateShortId) ||
        p.id.toLowerCase().endsWith(candidateShortId)
      );
    });
    if (byShortId) return byShortId;
  }

  // 4. Busca por código sequencial (#01, #02, 01, 02)
  const byAdCode = products.find(
    (p) => getProductAdCode(p).replace("#", "").toLowerCase() === decoded
  );
  if (byAdCode) return byAdCode;

  // 5. Fallback por slug legado do título (retrocompatibilidade para links antigos sem ID)
  const byTitleSlug = products.find((p) => slugify(p.title) === decoded);
  if (byTitleSlug) return byTitleSlug;

  // 6. Fallback por título exato ou inclusão
  return (
    products.find((p) => p.title.toLowerCase() === decoded) ||
    products.find((p) => p.title.toLowerCase().includes(decoded))
  );
}

/**
 * Desconta o estoque dos produtos e variantes após a conclusão de uma compra.
 * Se a variante possuir credenciais cadastradas, a conta entregue é consumida.
 */
export function consumePurchasedStock(items: CartItem[]): void {
  if (!items || items.length === 0) return;
  const currentProds = getStoredProducts();

  for (const item of items) {
    const pId = item.product?.id;
    const prod =
      currentProds.find(
        (p) =>
          (pId && p.id === pId) ||
          (p.title && item.product?.title && p.title.toLowerCase().trim() === item.product.title.toLowerCase().trim()) ||
          (p.title && item.product?.title && (p.title.toLowerCase().includes(item.product.title.toLowerCase()) || item.product.title.toLowerCase().includes(p.title.toLowerCase())))
      ) || item.product;
    if (!prod) continue;

    const qty = Math.max(1, item.quantity || 1);
    let updatedVariants = prod.variants ? prod.variants.map((v) => ({ ...v })) : undefined;
    let depletedVariantName: string | undefined;

    if (updatedVariants && updatedVariants.length > 0) {
      const vIdx = updatedVariants.findIndex(
        (v) =>
          (item.selectedVariantId && v.id === item.selectedVariantId) ||
          (item.selectedVariantName && v.name.toLowerCase().trim() === item.selectedVariantName.toLowerCase().trim()) ||
          (item.selectedOptionLabel && v.name.toLowerCase().trim() === item.selectedOptionLabel.toLowerCase().trim()) ||
          (item.selectedOptionLabel && v.name.toLowerCase().includes(item.selectedOptionLabel.toLowerCase())) ||
          (item.selectedOptionLabel && item.selectedOptionLabel.toLowerCase().includes(v.name.toLowerCase())) ||
          (item.product?.title && item.product.title.toLowerCase().includes(v.name.toLowerCase()))
      );

      if (vIdx >= 0) {
        const v = updatedVariants[vIdx];
        const oldStock = Number(v.stock ?? 0);
        v.stock = Math.max(0, oldStock - qty);
        if (v.stock === 0 && oldStock > 0) {
          depletedVariantName = v.name;
        }

        // Desconta as credenciais do estoque desta variante se houver
        if (v.credentials && v.credentials.trim().length > 0) {
          const raw = v.credentials.trim();
          const sep = raw.includes("\n--\n")
            ? "\n--\n"
            : raw.includes("--")
            ? "--"
            : raw.includes("\n\n")
            ? "\n\n"
            : "\n";

          let blocks =
            sep === "\n\n"
              ? raw.split(/\n\s*\n+/)
              : sep === "\n--\n" || sep === "--"
              ? raw.split(/\n?\s*--\s*\n?/)
              : raw.split("\n");

          blocks = blocks.map((b) => b.trim()).filter(Boolean);
          // Remove as contas que foram entregues
          blocks.splice(0, qty);
          v.credentials = blocks.join(sep === "\n\n" ? "\n\n" : "\n--\n");
        }
      }
    }

    const newTotalStock =
      updatedVariants && updatedVariants.length > 0
        ? updatedVariants.reduce((sum, v) => sum + (v.stock || 0), 0)
        : Math.max(0, (prod.stock || 0) - qty);

    let updatedAutoDelivery = prod.autoDeliveryContent
      ? [...prod.autoDeliveryContent]
      : undefined;
    if (updatedAutoDelivery && updatedAutoDelivery.length > 0) {
      updatedAutoDelivery.splice(0, qty);
    }

    const updatedProduct: Product = {
      ...prod,
      stock: newTotalStock,
      status: newTotalStock <= 0 ? "paused" : "active",
      salesCount: (prod.salesCount || 0) + qty,
      variants: updatedVariants,
      autoDeliveryContent: updatedAutoDelivery,
    };

    saveStoredProduct(updatedProduct);

    // Notifica vendedor pelo sininho se a variação ou o anúncio zerou o estoque
    try {
      if (depletedVariantName) {
        notifyStockDepleted(prod, depletedVariantName).catch(() => {});
      }
      if (newTotalStock <= 0 && (prod.stock || 0) > 0) {
        notifyStockDepleted(prod).catch(() => {});
      }
    } catch {}

    if (isSupabaseConfigured) {
      try {
        const dbUpdate: any = {
          stock: newTotalStock,
          status: newTotalStock <= 0 ? "paused" : "active",
          sales_count: updatedProduct.salesCount,
        };
        if (updatedVariants) {
          dbUpdate.variants = updatedVariants;
        }
        supabase
          .from("products")
          .update(dbUpdate)
          .eq("id", prod.id)
          .then(() => {});
      } catch {}
    }
  }
}

/**
 * Aprova um anúncio enviado para revisão (Ação exclusiva do Administrador).
 * Define status como 'active', remove motivo de rejeição e notifica o vendedor.
 */
export function approveProduct(productId: string, productObj?: Product): Product | undefined {
  const currentList = getStoredProducts();
  const product = productObj || currentList.find((p) => p.id === productId);
  if (!product) {
    if (isSupabaseConfigured) {
      try {
        supabase
          .from("products")
          .update({
            status: "active",
            rejection_reason: null,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", productId)
          .then();
      } catch {}
    }
    return undefined;
  }

  const updated: Product = {
    ...product,
    status: "active",
    rejectionReason: undefined,
    reviewedAt: new Date().toISOString(),
  };

  saveStoredProduct(updated);

  if (isSupabaseConfigured) {
    try {
      supabase
        .from("products")
        .update({
          status: "active",
          rejection_reason: null,
          reviewed_at: updated.reviewedAt,
        })
        .eq("id", productId)
        .then();
    } catch {}
  }

  // Notifica o vendedor
  try {
    addNotification({
      kind: "system",
      title: "🎉 Anúncio Aprovado!",
      body: `Seu anúncio "${product.title}" foi aprovado pela moderação e já está disponível para venda no catálogo.`,
      link: `/anuncio/${product.id}`,
      recipientId: product.seller.id,
      recipientName: product.seller.name,
      productTitle: product.title,
      productImage: product.image,
    });
  } catch {}

  return updated;
}

/**
 * Reprova um anúncio e registra o motivo para o vendedor ajustar (Ação do Administrador).
 */
export function rejectProduct(productId: string, reason: string, productObj?: Product): Product | undefined {
  const currentList = getStoredProducts();
  const product = productObj || currentList.find((p) => p.id === productId);
  if (!product) {
    if (isSupabaseConfigured) {
      try {
        supabase
          .from("products")
          .update({
            status: "rejected",
            rejection_reason: reason.trim(),
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", productId)
          .then();
      } catch {}
    }
    return undefined;
  }

  const updated: Product = {
    ...product,
    status: "rejected",
    rejectionReason: reason.trim(),
    reviewedAt: new Date().toISOString(),
  };

  saveStoredProduct(updated);

  if (isSupabaseConfigured) {
    try {
      supabase
        .from("products")
        .update({
          status: "rejected",
          rejection_reason: reason.trim(),
          reviewed_at: updated.reviewedAt,
        })
        .eq("id", productId)
        .then();
    } catch {}
  }

  // Notifica o vendedor com o motivo detalhado
  try {
    addNotification({
      kind: "system",
      title: "⚠️ Anúncio precisa de ajustes",
      body: `O seu anúncio "${product.title}" foi reprovado pela moderação. Motivo: ${reason.trim()}. Acesse "Meus Produtos" para editar e reenviar para análise.`,
      link: `/meus-produtos`,
      recipientId: product.seller.id,
      recipientName: product.seller.name,
      productTitle: product.title,
      productImage: product.image,
    });
  } catch {}

  return updated;
}

/**
 * Reenvia um anúncio reprovado de volta para a fila de moderação após o vendedor ajustar.
 */
export function resubmitProductForReview(productId: string): Product | undefined {
  const currentList = getStoredProducts();
  const product = currentList.find((p) => p.id === productId);
  if (!product) return undefined;

  const updated: Product = {
    ...product,
    status: "pending_review",
    reviewedAt: undefined,
  };

  saveStoredProduct(updated);

  if (isSupabaseConfigured) {
    try {
      supabase
        .from("products")
        .update({
          status: "pending_approval",
        })
        .eq("id", productId)
        .then();
    } catch {}
  }

  return updated;
}

/**
 * Busca um produto diretamente no servidor pelo slug ou ID (para SSR em 0ms).
 */
export async function fetchProductBySlugServer(slug: string): Promise<Product | null> {
  if (!slug) return null;
  const decoded = decodeURIComponent(slug).trim().toLowerCase();

  // 1. Tenta buscar nos produtos locais/memória
  const localMatch = findProductBySlugOrId(getStoredProducts(), slug);
  if (localMatch) return localMatch;

  // 2. Busca no Supabase
  if (isSupabaseConfigured) {
    try {
      const parts = decoded.split("-");
      const shortId = parts[parts.length - 1];

      // Busca todos os produtos do Supabase
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        const mappedList: Product[] = data.map((d: any) => ({
          id: d.id,
          title: d.title,
          description: d.description || "",
          price: Number(d.price) || 0,
          originalPrice: d.original_price ? Number(d.original_price) : undefined,
          category: d.category || "Outros",
          image:
            d.image ||
            "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
          salesCount: d.sales_count || 0,
          stock: d.stock ?? 10,
          deliveryType: d.delivery_type?.toUpperCase() === "MANUAL" ? "MANUAL" : "AUTOMATIC",
          autoDeliveryContent: d.delivery_content ? [d.delivery_content] : ["Entrega imediata"],
          tags: [d.category || "Geral"],
          warrantyDays: Number(d.warranty_days) || Number(d.warrantyDays) || 30,
          status: d.status || ((d.stock ?? 10) <= 0 ? "paused" : "active"),
          rejectionReason: d.rejection_reason || undefined,
          reviewedAt: d.reviewed_at || undefined,
          createdAt: d.created_at || new Date().toISOString(),
          ...variationFieldsFromRow(d),
          seller: {
            id: d.seller_id || "seller-1",
            name: d.seller_name || "PlayContas",
            avatar:
              d.seller_avatar && !d.seller_avatar.includes("dicebear")
                ? d.seller_avatar
                : d.seller_name === "Gennyson Marinho" || d.seller_name?.toLowerCase().includes("gennyson")
                ? "https://lazueuycrcqirdykdppm.supabase.co/storage/v1/object/public/avatars/avatar-bb25d258-3152-422b-aa04-7bd34e8a5927.gif"
                : `https://api.dicebear.com/7.x/bottts/svg?seed=${d.seller_name || "PlayContas"}`,
            rating: 5.0,
            salesCount: d.sales_count || 0,
            isVerified: true,
            responseTime: "5 min",
            memberSince: "2026",
            level: "Elite",
          },
        }));

        const match = findProductBySlugOrId(mappedList, slug);
        if (match) return match;
      }
    } catch (e) {
      console.warn("Erro ao buscar produto no servidor Supabase:", e);
    }
  }

  return null;
}
