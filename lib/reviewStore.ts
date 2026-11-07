import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { UUID_REGEX } from "./questionStore";

/**
 * Avaliações reais dos clientes (tabela product_reviews).
 * Só o comprador do pedido pode avaliar, depois que o vendedor entregar.
 */

export interface Review {
  id: string;
  chatId: string | null;
  productId: string;
  buyerName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface ReviewSummary {
  total: number;
  average: number;
  positive: number; // 4 e 5 estrelas
  neutral: number; // 3 estrelas
  negative: number; // 1 e 2 estrelas
}

const rowToReview = (r: any): Review => {
  let buyerName = r.buyer_name || "Cliente";
  if (buyerName.toLowerCase().includes("jovizeira") || r.buyer_id === "fcaba04d-92ec-45b3-a626-013318cc0f8c") {
    buyerName = "BuscaNinja";
  }
  return {
    id: r.id,
    chatId: r.chat_id || null,
    productId: r.product_id || "",
    buyerName,
    rating: Number(r.rating) || 0,
    comment: r.comment || "",
    createdAt: r.created_at,
  };
};

export function summarizeReviews(reviews: { rating: number }[]): ReviewSummary {
  const total = reviews.length;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return {
    total,
    average: total > 0 ? sum / total : 0,
    positive: reviews.filter((r) => r.rating >= 4).length,
    neutral: reviews.filter((r) => r.rating === 3).length,
    negative: reviews.filter((r) => r.rating <= 2).length,
  };
}

export async function fetchProductReviews(productId: string): Promise<Review[]> {
  if (!isSupabaseConfigured || !productId) return [];
  try {
    const { data, error } = await supabase
      .from("product_reviews")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error || !data) return [];
    return data.map(rowToReview);
  } catch {
    return [];
  }
}

/** Todas as avaliações do vendedor (somando todos os anúncios dele). */
export async function fetchSellerReviews(sellerId?: string, sellerName?: string): Promise<Review[]> {
  if (!isSupabaseConfigured) return [];
  try {
    let query = supabase.from("product_reviews").select("*").limit(1000);
    if (sellerId && UUID_REGEX.test(sellerId)) {
      query = query.eq("seller_id", sellerId);
    } else if (sellerName) {
      query = query.ilike("seller_name", sellerName.trim());
    } else {
      return [];
    }
    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(rowToReview);
  } catch {
    return [];
  }
}

export async function getReviewForChat(chatId: string): Promise<Review | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from("product_reviews")
      .select("*")
      .eq("chat_id", chatId)
      .maybeSingle();
    if (error || !data) return null;
    return rowToReview(data);
  } catch {
    return null;
  }
}

export async function submitReview(
  chatId: string,
  rating: number,
  comment: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc("submit_review", {
      p_chat_id: chatId,
      p_rating: rating,
      p_comment: comment.trim() || null,
    });
    if (error) {
      const msg = error.message || "";
      if (
        error.code === "PGRST202" ||
        error.code === "42P01" ||
        msg.includes("Could not find the function") ||
        msg.includes("schema cache")
      ) {
        return {
          ok: false,
          error: "As avaliações ainda não foram ativadas no banco. Execute o script setup-reviews.sql no Supabase.",
        };
      }
      return { ok: false, error: msg || "Não foi possível enviar a avaliação." };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Não foi possível enviar a avaliação." };
  }
}

/* ---------------- Avaliação do COMPRADOR feita pelo vendedor (privada) ---------------- */

export interface BuyerReview {
  id: string;
  chatId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

/** Avaliação que o vendedor deu ao comprador deste pedido (só o vendedor e o admin conseguem ler). */
export async function getBuyerReviewForChat(chatId: string): Promise<BuyerReview | null> {
  if (!isSupabaseConfigured || !chatId) return null;
  try {
    const { data, error } = await supabase
      .from("buyer_reviews")
      .select("*")
      .eq("chat_id", chatId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      chatId: data.chat_id,
      rating: Number(data.rating) || 0,
      comment: data.comment || "",
      createdAt: data.updated_at || data.created_at,
    };
  } catch {
    return null;
  }
}

export async function submitBuyerReview(
  chatId: string,
  rating: number,
  comment: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc("submit_buyer_review", {
      p_chat_id: chatId,
      p_rating: rating,
      p_comment: comment.trim() || null,
    });
    if (error) {
      const msg = error.message || "";
      if (
        error.code === "PGRST202" ||
        error.code === "42P01" ||
        msg.includes("Could not find the function") ||
        msg.includes("schema cache")
      ) {
        return {
          ok: false,
          error: "A avaliação do comprador ainda não foi ativada no banco. Execute o script avaliar-comprador.sql no Supabase.",
        };
      }
      return { ok: false, error: msg || "Não foi possível enviar a avaliação." };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Não foi possível enviar a avaliação." };
  }
}

export function formatReviewTime(iso: string): string {
  const ts = Date.parse(iso);
  if (isNaN(ts)) return "";
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH} hora${diffH > 1 ? "s" : ""}`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `há ${diffD} dia${diffD > 1 ? "s" : ""}`;
  if (diffD < 30) {
    const w = Math.floor(diffD / 7);
    return `há ${w} semana${w > 1 ? "s" : ""}`;
  }
  const m = Math.floor(diffD / 30);
  if (m < 12) return `há ${m} ${m > 1 ? "meses" : "mês"}`;
  const y = Math.floor(m / 12);
  return `há ${y} ano${y > 1 ? "s" : ""}`;
}
