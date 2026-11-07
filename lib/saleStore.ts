import { UserProfile } from "@/types";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { formatChatNumber, OrderChat } from "./chatStore";

export interface SaleRecord {
  id: string;
  orderCode: string; // ex: "#PY3KBKWT" ou "#00013"
  chatId?: string; // id ou número do chat para abrir
  productId?: string;
  productTitle: string;
  variantName?: string;
  productImage: string;
  buyerId?: string;
  buyerName: string;
  createdAt: string; // ISO string
  formattedDate: string; // ex: "04/11 11:43"
  price: number;
  quantity: number;
  total: number;
  deliveryType: "AUTOMATIC" | "MANUAL";
  status: "delivered" | "pending" | "dispute" | "cancelled";
  statusLabel: string; // "Entregue", "Pendente", "Em mediação", "Cancelado"
}

const LS_SALES_KEY = "central_seller_sales_v2";
const LS_CHATS_PREFIX = "central_chat_list_";

export const formatSaleDate = (iso?: string): string => {
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

/** Códigos e IDs de vendas demo/fictícias que nunca devem aparecer no painel real */
const DEMO_ORDER_CODES = new Set([
  "#py3kbkwt",
  "py3kbkwt",
  "#pp8rygnx",
  "pp8rygnx",
  "#pzewj087",
  "pzewj087",
  "sale-py3kbkwt",
  "sale-pp8rygnx",
  "sale-pzewj087",
]);

/** Array vazio: nenhuma venda falsa é adicionada */
export const DEMO_SALES: SaleRecord[] = [];

/**
 * Verifica se um pedido é REALMENTE uma venda realizada pelo usuário logado (ele como vendedor).
 * Exclui compras feitas pelo usuário e vendas de outros vendedores.
 */
export function isUserSellerOfOrder(
  order: {
    id?: string;
    code?: string;
    orderCode?: string;
    seller_id?: string | null;
    seller_name?: string | null;
    sellerId?: string | null;
    sellerName?: string | null;
    buyer_id?: string | null;
    buyer_name?: string | null;
    buyerId?: string | null;
    buyerName?: string | null;
    product_title?: string | null;
    productTitle?: string | null;
  },
  user: UserProfile | null | undefined
): boolean {
  if (!user) return false;

  // 1. Elimina vendas de teste/demo hardcoded
  const rawCode = (order.orderCode || order.code || order.id || "").toLowerCase().trim();
  if (DEMO_ORDER_CODES.has(rawCode)) return false;

  const title = (order.product_title || order.productTitle || "").toLowerCase();
  if (
    title.includes("claude 3.5 sonnet") &&
    (rawCode.includes("py3") || rawCode.includes("00013"))
  ) {
    // Apenas se for a demo fixa
    if (rawCode.includes("py3")) return false;
  }

  const sId = (order.seller_id || order.sellerId || "").toLowerCase().trim();
  const sName = (order.seller_name || order.sellerName || "").toLowerCase().trim();
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

  // Se o vendedor for explicitamente outro usuário conhecido da plataforma (ex: Kilr, Kiler, NexusGames)
  if (
    sName.includes("kiler") ||
    sName.includes("kilr") ||
    sName.includes("nexusgames") ||
    sId === "881a8911-8eaa-43ca-9e0b-be6a68b51f48" ||
    sId === "usr-ficticio-2"
  ) {
    if (isGennysonUser && !sName.includes("gennyson") && sId !== uId) {
      return false;
    }
  }

  // 2. Se o usuário atual for o COMPRADOR deste pedido (e não o vendedor), é uma COMPRA, NÃO uma venda!
  const isBuyer =
    (uId && bId && uId === bId) ||
    (uName && bName && uName === bName) ||
    (isGennysonUser &&
      (bName.includes("gennyson") ||
        bId === "usr-gennyson" ||
        bId === "bb25d258-3152-422b-aa04-7bd34e8a5927"));

  // 3. Critérios para ser o VENDEDOR do pedido:
  let isSeller = false;

  if (uId && sId && uId === sId) {
    isSeller = true;
  } else if (uName && sName && (uName === sName || sName.includes(uName))) {
    isSeller = true;
  } else if (
    isGennysonUser &&
    (sName.includes("gennyson") ||
      sId === "usr-gennyson" ||
      sId === "bb25d258-3152-422b-aa04-7bd34e8a5927")
  ) {
    isSeller = true;
  }

  // Se for uma compra onde o usuário comprou de outro vendedor, nunca é venda dele
  if (!isSeller) return false;

  // Se o usuário é o vendedor e o comprador é outro (ex: BuscaNinja comprando de Gennyson), é 100% venda!
  if (isSeller && !isBuyer) return true;

  // Se comprou de si mesmo em teste local
  return isSeller;
}

export function getStoredSales(userId?: string): SaleRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${LS_SALES_KEY}_${userId || "default"}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((s) => !DEMO_ORDER_CODES.has((s.orderCode || "").toLowerCase()));
      }
    }
  } catch {}
  return [];
}

export function saveStoredSales(sales: SaleRecord[], userId?: string): void {
  if (typeof window === "undefined") return;
  try {
    const filtered = sales.filter((s) => !DEMO_ORDER_CODES.has((s.orderCode || "").toLowerCase()));
    localStorage.setItem(`${LS_SALES_KEY}_${userId || "default"}`, JSON.stringify(filtered));
    window.dispatchEvent(new Event("central_sales_updated"));
  } catch {}
}

/**
 * Converte um OrderChat em SaleRecord
 */
export function orderChatToSaleRecord(chat: OrderChat): SaleRecord {
  const code = chat.code?.startsWith("#")
    ? chat.code
    : `#${chat.code || formatChatNumber(chat.number || 0)}`;

  let variantName = chat.variantId || undefined;
  let cleanTitle = chat.productTitle || "Produto";

  // Se o título contiver variação
  if (cleanTitle.includes(">")) {
    const parts = cleanTitle.split(">");
    cleanTitle = parts[0].trim();
    if (parts[1]) variantName = parts[1].trim();
  }

  const status: "delivered" | "pending" | "dispute" | "cancelled" =
    chat.status === "delivered" ? "delivered" : "pending";

  const statusLabel = status === "delivered" ? "Entregue" : "Pendente";

  return {
    id: chat.id || `sale-${chat.number || Math.random().toString(36).substring(2, 8)}`,
    orderCode: code,
    chatId: formatChatNumber(chat.number) || chat.code || chat.id,
    productId: chat.productId,
    productTitle: cleanTitle,
    variantName,
    productImage: chat.productImage || "/categorias/gpt.webp",
    buyerId: chat.buyerId || undefined,
    buyerName: chat.buyerName || "Cliente",
    createdAt: chat.createdAt || new Date().toISOString(),
    formattedDate: formatSaleDate(chat.createdAt),
    price: chat.price || 0,
    quantity: chat.quantity || 1,
    total: (chat.price || 0) * (chat.quantity || 1),
    deliveryType: chat.deliveryType || "AUTOMATIC",
    status,
    statusLabel,
  };
}

/**
 * Busca ESTRITAMENTE as vendas realizadas pelo vendedor logado.
 */
export async function fetchSellerSales(currentUser: UserProfile): Promise<SaleRecord[]> {
  const userSalesMap = new Map<string, SaleRecord>();

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
          // Filtra ESTRITAMENTE se a venda pertence ao usuário como vendedor
          if (!isUserSellerOfOrder(row, currentUser)) {
            return;
          }

          const chatNumber = Number(row.number) || 0;
          const code = row.code || formatChatNumber(chatNumber);
          const formattedCode = code.startsWith("#") ? code : `#${code}`;

          if (DEMO_ORDER_CODES.has(formattedCode.toLowerCase())) return;

          let variantName = row.variant_id || undefined;
          let cleanTitle = row.product_title || "Produto";
          if (cleanTitle.includes(">")) {
            const parts = cleanTitle.split(">");
            cleanTitle = parts[0].trim();
            if (parts[1]) variantName = parts[1].trim();
          }

          const sale: SaleRecord = {
            id: row.id,
            orderCode: formattedCode,
            chatId: formatChatNumber(chatNumber) || code || row.id,
            productId: row.product_id,
            productTitle: cleanTitle,
            variantName,
            productImage: row.product_image || "/categorias/gpt.webp",
            buyerId: row.buyer_id,
            buyerName: row.buyer_name || "Comprador",
            createdAt: row.created_at || new Date().toISOString(),
            formattedDate: formatSaleDate(row.created_at),
            price: Number(row.price) || 0,
            quantity: Number(row.quantity) || 1,
            total: (Number(row.price) || 0) * (Number(row.quantity) || 1),
            deliveryType: row.delivery_type === "MANUAL" ? "MANUAL" : "AUTOMATIC",
            status: row.status === "delivered" ? "delivered" : "pending",
            statusLabel: row.status === "delivered" ? "Entregue" : "Pendente",
          };

          userSalesMap.set(sale.orderCode, sale);
        });
      }
    } catch (e) {
      console.warn("Erro ao buscar vendas no Supabase:", e);
    }
  }

  // 2. Lê vendas do cache local se houver chats locais salvos
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
                if (chat && isUserSellerOfOrder(chat, currentUser)) {
                  const sale = orderChatToSaleRecord(chat);
                  if (!DEMO_ORDER_CODES.has(sale.orderCode.toLowerCase())) {
                    if (!userSalesMap.has(sale.orderCode)) {
                      userSalesMap.set(sale.orderCode, sale);
                    }
                  }
                }
              });
            }
          }
        }
      }
    } catch {}
  }

  const list = Array.from(userSalesMap.values());
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Salva no cache local para carregamento síncrono rápido
  saveStoredSales(list, currentUser.id);

  return list;
}
