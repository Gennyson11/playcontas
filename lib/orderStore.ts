import { UserProfile } from "@/types";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { formatChatNumber, OrderChat } from "./chatStore";

export interface PurchaseRecord {
  id: string;
  orderCode: string; // ex: "#00022" ou "#00021"
  chatId?: string; // id ou número do chat para abrir
  productId?: string;
  productTitle: string;
  variantName?: string;
  productImage: string;
  sellerId?: string;
  sellerName: string;
  createdAt: string; // ISO string
  formattedDate: string; // ex: "31/10 01:04"
  price: number;
  quantity: number;
  total: number;
  deliveryType: "AUTOMATIC" | "MANUAL";
  status: "delivered" | "pending" | "dispute" | "cancelled";
  statusLabel: string; // "Entregue", "Pendente", "Em mediação", "Cancelado"
}

const LS_PURCHASES_KEY = "central_buyer_purchases_v1";
const LS_CHATS_PREFIX = "central_chat_list_";

export const formatPurchaseDate = (iso?: string): string => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month} ${hours}:${minutes}`;
  } catch {
    return iso;
  }
};

export const formatCurrencyBRL = (val: number): string => {
  return Number(val || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Verifica se um pedido é uma COMPRA realizada pelo usuário atual (ele como comprador).
 */
export function isUserBuyerOfOrder(
  order: {
    buyer_id?: string | null;
    buyer_name?: string | null;
    buyerId?: string | null;
    buyerName?: string | null;
    seller_id?: string | null;
    seller_name?: string | null;
    sellerId?: string | null;
    sellerName?: string | null;
  },
  user: UserProfile | null | undefined
): boolean {
  if (!user) return false;

  const bId = (order.buyer_id || order.buyerId || "").toLowerCase().trim();
  const bName = (order.buyer_name || order.buyerName || "").toLowerCase().trim();

  const uId = (user.id || "").toLowerCase().trim();
  const uName = (user.name || "").toLowerCase().trim();
  const uEmail = (user.email || "").toLowerCase().trim();

  const isGennysonUser =
    uName.includes("gennyson") ||
    uEmail.includes("gennyson") ||
    uId === "usr-gennyson" ||
    uId === "bb25d258-3152-422b-aa04-7bd34e8a5927";

  if (uId && bId && uId === bId) return true;
  if (uName && bName && (uName === bName || bName.includes(uName))) return true;

  if (
    isGennysonUser &&
    (bName.includes("gennyson") ||
      bId === "usr-gennyson" ||
      bId === "bb25d258-3152-422b-aa04-7bd34e8a5927")
  ) {
    return true;
  }

  // Se for conta com nome de comprador específico (ex: BuscaNinja)
  if (uName === "buscaninja" && (bName.includes("buscaninja") || bId === "fcaba04d-92ec-45b3-a626-013318cc0f8c")) {
    return true;
  }

  return false;
}

export function getStoredPurchases(userId?: string): PurchaseRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${LS_PURCHASES_KEY}_${userId || "default"}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveStoredPurchases(purchases: PurchaseRecord[], userId?: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${LS_PURCHASES_KEY}_${userId || "default"}`, JSON.stringify(purchases));
    window.dispatchEvent(new Event("central_purchases_updated"));
  } catch {}
}

/**
 * Busca todas as compras (pedidos feitos) pelo usuário logado no Supabase e no cache local.
 */
export async function fetchMyPurchases(currentUser: UserProfile): Promise<PurchaseRecord[]> {
  const purchasesMap = new Map<string, PurchaseRecord>();

  if (!currentUser) return [];

  // 1. Tenta carregar do Supabase se configurado
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from("order_chats")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (!error && data && Array.isArray(data)) {
        data.forEach((row) => {
          if (!isUserBuyerOfOrder(row, currentUser)) {
            return;
          }

          const chatNumber = Number(row.number) || 0;
          const code = row.code || formatChatNumber(chatNumber);
          const formattedCode = code.startsWith("#") ? code : `#${code}`;

          let variantName = row.variant_id || undefined;
          let cleanTitle = row.product_title || "Produto";
          if (cleanTitle.includes(">")) {
            const parts = cleanTitle.split(">");
            cleanTitle = parts[0].trim();
            if (parts[1]) variantName = parts[1].trim();
          }

          const record: PurchaseRecord = {
            id: row.id,
            orderCode: formattedCode,
            chatId: formatChatNumber(chatNumber) || code || row.id,
            productId: row.product_id,
            productTitle: cleanTitle,
            variantName,
            productImage: row.product_image || "/categorias/gpt.webp",
            sellerId: row.seller_id,
            sellerName: row.seller_name || "Vendedor",
            createdAt: row.created_at || new Date().toISOString(),
            formattedDate: formatPurchaseDate(row.created_at),
            price: Number(row.price) || 0,
            quantity: Number(row.quantity) || 1,
            total: (Number(row.price) || 0) * (Number(row.quantity) || 1),
            deliveryType: row.delivery_type === "MANUAL" ? "MANUAL" : "AUTOMATIC",
            status: row.status === "delivered" ? "delivered" : "pending",
            statusLabel: row.status === "delivered" ? "Entregue" : "Pendente",
          };

          purchasesMap.set(record.orderCode, record);
        });
      }
    } catch (e) {
      console.warn("Erro ao buscar compras no Supabase:", e);
    }
  }

  // 2. Lê compras registradas no cache local de chats
  if (typeof window !== "undefined") {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(LS_CHATS_PREFIX)) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              list.forEach((chat: OrderChat) => {
                if (chat && isUserBuyerOfOrder(chat, currentUser)) {
                  const code = chat.code?.startsWith("#")
                    ? chat.code
                    : `#${chat.code || formatChatNumber(chat.number || 0)}`;

                  let variantName = chat.variantId || undefined;
                  let cleanTitle = chat.productTitle || "Produto";
                  if (cleanTitle.includes(">")) {
                    const parts = cleanTitle.split(">");
                    cleanTitle = parts[0].trim();
                    if (parts[1]) variantName = parts[1].trim();
                  }

                  const record: PurchaseRecord = {
                    id: chat.id,
                    orderCode: code,
                    chatId: formatChatNumber(chat.number) || chat.code || chat.id,
                    productId: chat.productId,
                    productTitle: cleanTitle,
                    variantName,
                    productImage: chat.productImage || "/categorias/gpt.webp",
                    sellerId: chat.sellerId || undefined,
                    sellerName: chat.sellerName || "Vendedor",
                    createdAt: chat.createdAt || new Date().toISOString(),
                    formattedDate: formatPurchaseDate(chat.createdAt),
                    price: chat.price || 0,
                    quantity: chat.quantity || 1,
                    total: (chat.price || 0) * (chat.quantity || 1),
                    deliveryType: chat.deliveryType || "AUTOMATIC",
                    status: chat.status === "delivered" ? "delivered" : "pending",
                    statusLabel: chat.status === "delivered" ? "Entregue" : "Pendente",
                  };

                  if (!purchasesMap.has(record.orderCode)) {
                    purchasesMap.set(record.orderCode, record);
                  }
                }
              });
            }
          }
        }
      }
    } catch {}
  }

  const list = Array.from(purchasesMap.values());
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  saveStoredPurchases(list, currentUser.id);
  return list;
}
