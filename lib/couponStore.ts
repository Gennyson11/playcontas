import { Coupon, CartItem } from "@/types";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

const COUPONS_STORAGE_KEY = "central_seller_coupons";
const DELETED_COUPONS_KEY = "central_deleted_coupons";

export function getDeletedCouponIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DELETED_COUPONS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

const INITIAL_COUPONS: Coupon[] = [
  {
    id: "coup-central5",
    code: "CENTRAL5",
    sellerId: "bb25d258-3152-422b-aa04-7bd34e8a5927",
    sellerName: "Gennyson Marinho",
    scope: "store",
    discountType: "fixed",
    discountValue: 5,
    usageLimit: 100,
    usageCount: 14,
    expiresAt: null,
    isActive: true,
    createdAt: "2026-10-26T18:00:00.000Z",
  },
  {
    id: "coup-vip10",
    code: "VIP10",
    sellerId: "bb25d258-3152-422b-aa04-7bd34e8a5927",
    sellerName: "Gennyson Marinho",
    scope: "store",
    discountType: "percentage",
    discountValue: 10,
    usageLimit: 50,
    usageCount: 8,
    expiresAt: null,
    isActive: true,
    createdAt: "2026-10-28T14:30:00.000Z",
  },
];

function rowToCoupon(row: any): Coupon {
  return {
    id: String(row.id),
    code: String(row.code || "").toUpperCase(),
    sellerId: String(row.seller_id || ""),
    sellerName: String(row.seller_name || ""),
    scope: row.scope === "product" ? "product" : "store",
    productId: row.product_id ? String(row.product_id) : undefined,
    productTitle: row.product_title ? String(row.product_title) : undefined,
    discountType: row.discount_type === "fixed" ? "fixed" : "percentage",
    discountValue: Number(row.discount_value) || 0,
    usageLimit: row.usage_limit != null ? Number(row.usage_limit) : null,
    usageCount: Number(row.usage_count) || 0,
    expiresAt: row.expires_at || null,
    isActive: row.is_active ?? true,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export function getStoredCoupons(): Coupon[] {
  if (typeof window === "undefined") return INITIAL_COUPONS;
  try {
    const deletedSet = getDeletedCouponIds();
    const raw = localStorage.getItem(COUPONS_STORAGE_KEY);
    if (raw === null) {
      const initial = INITIAL_COUPONS.filter(
        (c) => !deletedSet.has(c.id) && !deletedSet.has(c.code.toUpperCase())
      );
      localStorage.setItem(COUPONS_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (c) => !deletedSet.has(c.id) && !deletedSet.has(c.code.toUpperCase())
      );
    }
    return [];
  } catch {
    return [];
  }
}

export function saveAllCoupons(coupons: Coupon[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COUPONS_STORAGE_KEY, JSON.stringify(coupons));
    window.dispatchEvent(new Event("central_coupons_changed"));
  } catch (err) {
    console.error("Erro ao salvar cupons:", err);
  }
}

export function getSellerCoupons(sellerId?: string, sellerName?: string): Coupon[] {
  const all = getStoredCoupons();
  if (!sellerId && !sellerName) return all;

  const sId = (sellerId || "").trim();
  const sName = (sellerName || "").toLowerCase().trim();

  const isGennyson =
    sName.includes("gennyson") ||
    sId === "usr-gennyson" ||
    sId === "bb25d258-3152-422b-aa04-7bd34e8a5927";

  return all.filter((c) => {
    if (isGennyson && (c.sellerName?.toLowerCase().includes("gennyson") || c.sellerId === "bb25d258-3152-422b-aa04-7bd34e8a5927")) {
      return true;
    }
    if (sId && c.sellerId === sId) return true;
    if (sName && c.sellerName?.toLowerCase().trim() === sName) return true;
    return false;
  });
}

/**
 * Busca cupons do Supabase e sincroniza no cache local
 */
export async function fetchRemoteCoupons(sellerId?: string, sellerName?: string): Promise<Coupon[]> {
  if (!isSupabaseConfigured) {
    return getSellerCoupons(sellerId, sellerName);
  }

  try {
    let query = supabase.from("coupons").select("*");
    const sId = (sellerId || "").trim();
    const sName = (sellerName || "").toLowerCase().trim();

    if (sId && sId.length > 20) {
      query = query.or(`seller_id.eq.${sId},seller_name.ilike.%${sName || ""}%`);
    } else if (sName) {
      query = query.ilike("seller_name", `%${sName}%`);
    }

    const { data, error } = await query.order("created_at", { ascending: false });
    if (!error && data && Array.isArray(data)) {
      const deletedSet = getDeletedCouponIds();
      const remoteMapped = data
        .map(rowToCoupon)
        .filter((c) => !deletedSet.has(c.id) && !deletedSet.has(c.code));

      // Mescla com cupons locais
      const local = getStoredCoupons();
      const map = new Map<string, Coupon>();
      local.forEach((c) => map.set(c.code.toUpperCase(), c));
      remoteMapped.forEach((c) => map.set(c.code.toUpperCase(), c));

      const merged = Array.from(map.values());
      saveAllCoupons(merged);
      return getSellerCoupons(sellerId, sellerName);
    }
  } catch (err) {
    console.warn("Aviso ao sincronizar cupons do Supabase:", err);
  }

  return getSellerCoupons(sellerId, sellerName);
}

export interface NewCouponInput {
  code: string;
  sellerId: string;
  sellerName: string;
  scope: "store" | "product";
  productId?: string;
  productTitle?: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  usageLimit?: number | null;
  expiresAt?: string | null;
}

export function createCoupon(input: NewCouponInput): Coupon {
  const all = getStoredCoupons();
  const cleanCode = input.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");

  // Remove do conjunto de deletados caso tenha sido excluído anteriormente
  if (typeof window !== "undefined") {
    try {
      const deletedSet = getDeletedCouponIds();
      deletedSet.delete(cleanCode);
      localStorage.setItem(DELETED_COUPONS_KEY, JSON.stringify(Array.from(deletedSet)));
    } catch {}
  }

  // Se já existir com esse código para esse vendedor, atualiza ou sobrescreve
  const existingIdx = all.findIndex(
    (c) => c.code.toUpperCase() === cleanCode && (c.sellerId === input.sellerId || c.sellerName === input.sellerName)
  );

  const newCoupon: Coupon = {
    id: existingIdx >= 0 ? all[existingIdx].id : `coup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    code: cleanCode,
    sellerId: input.sellerId,
    sellerName: input.sellerName,
    scope: input.scope,
    productId: input.productId,
    productTitle: input.productTitle,
    discountType: input.discountType,
    discountValue: Math.max(0.01, input.discountValue),
    usageLimit: input.usageLimit ? Math.max(1, input.usageLimit) : null,
    usageCount: existingIdx >= 0 ? all[existingIdx].usageCount : 0,
    expiresAt: input.expiresAt || null,
    isActive: true,
    createdAt: existingIdx >= 0 ? all[existingIdx].createdAt : new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    all[existingIdx] = newCoupon;
  } else {
    all.unshift(newCoupon);
  }

  saveAllCoupons(all);

  // Sincroniza no Supabase (se configurado)
  if (isSupabaseConfigured) {
    try {
      supabase
        .from("coupons")
        .upsert(
          {
            code: cleanCode,
            seller_id: input.sellerId,
            seller_name: input.sellerName,
            scope: input.scope,
            product_id: input.productId || null,
            product_title: input.productTitle || null,
            discount_type: input.discountType,
            discount_value: input.discountValue,
            usage_limit: input.usageLimit || null,
            expires_at: input.expiresAt || null,
            is_active: true,
          },
          { onConflict: "code" }
        )
        .then();
    } catch {}
  }

  return newCoupon;
}

export function toggleCouponActive(couponId: string): boolean {
  const all = getStoredCoupons();
  const idx = all.findIndex((c) => c.id === couponId || c.code.toUpperCase() === couponId.toUpperCase());
  if (idx === -1) return false;

  all[idx] = {
    ...all[idx],
    isActive: !all[idx].isActive,
  };

  saveAllCoupons(all);

  if (isSupabaseConfigured) {
    try {
      supabase
        .from("coupons")
        .update({ is_active: all[idx].isActive })
        .or(`id.eq.${couponId},code.ilike.${all[idx].code}`)
        .then();
    } catch {}
  }

  return true;
}

export function deleteCoupon(couponId: string): boolean {
  const all = getStoredCoupons();
  const target = all.find(
    (c) => c.id === couponId || c.code.toUpperCase() === couponId.toUpperCase()
  );

  // Registra no conjunto persistente de excluídos
  if (typeof window !== "undefined") {
    try {
      const deletedSet = getDeletedCouponIds();
      deletedSet.add(couponId);
      if (target) {
        deletedSet.add(target.id);
        deletedSet.add(target.code.toUpperCase());
      }
      localStorage.setItem(DELETED_COUPONS_KEY, JSON.stringify(Array.from(deletedSet)));
    } catch {}
  }

  const filtered = all.filter(
    (c) => c.id !== couponId && c.code.toUpperCase() !== couponId.toUpperCase()
  );

  saveAllCoupons(filtered);

  if (isSupabaseConfigured) {
    try {
      supabase
        .from("coupons")
        .delete()
        .or(`id.eq.${couponId},code.ilike.${target?.code || couponId}`)
        .then();
    } catch {}
  }

  return true;
}

export function recordCouponUsage(couponId: string): void {
  const all = getStoredCoupons();
  const idx = all.findIndex((c) => c.id === couponId || c.code.toUpperCase() === couponId.toUpperCase());
  if (idx !== -1) {
    all[idx] = {
      ...all[idx],
      usageCount: (all[idx].usageCount || 0) + 1,
    };
    saveAllCoupons(all);
  }

  if (isSupabaseConfigured) {
    try {
      supabase.rpc("increment_coupon_usage", { coupon_id: couponId }).catch(() => {
        supabase
          .from("coupons")
          .select("usage_count")
          .or(`id.eq.${couponId},code.ilike.${couponId}`)
          .maybeSingle()
          .then(({ data }: any) => {
            if (data) {
              supabase
                .from("coupons")
                .update({ usage_count: (data.usage_count || 0) + 1 })
                .or(`id.eq.${couponId},code.ilike.${couponId}`)
                .then();
            }
          });
      });
    } catch {}
  }
}

export interface CouponValidationResult {
  valid: boolean;
  discount: number;
  message: string;
  coupon?: Coupon;
}

/**
 * Validação síncrona com base no cache
 */
export function validateCoupon(
  code: string,
  cartItems: CartItem[]
): CouponValidationResult {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) {
    return { valid: false, discount: 0, message: "Digite um código de cupom." };
  }

  const all = getStoredCoupons();
  const coupon = all.find((c) => c.code.toUpperCase() === cleanCode);

  if (!coupon) {
    // Cupons globais legados de teste
    if (cleanCode === "CENTRAL5" || cleanCode === "DESCONTO" || cleanCode === "PRIMEIRACOMPRA") {
      const subtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
      const discount = Math.min(subtotal, 5.0);
      return {
        valid: true,
        discount,
        message: "Cupom de R$ 5,00 aplicado com sucesso!",
      };
    }
    if (cleanCode === "VIP" || cleanCode === "VIP10") {
      const subtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
      const discount = Math.round(subtotal * 0.1 * 100) / 100;
      return {
        valid: true,
        discount,
        message: "Cupom VIP de 10% aplicado com sucesso!",
      };
    }
    return { valid: false, discount: 0, message: "Cupom inválido ou não encontrado." };
  }

  return evaluateCouponDiscount(coupon, cartItems);
}

/**
 * Validação assíncrona que consulta também o Supabase em tempo real caso não esteja no cache
 */
export async function validateCouponAsync(
  code: string,
  cartItems: CartItem[]
): Promise<CouponValidationResult> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) {
    return { valid: false, discount: 0, message: "Digite um código de cupom." };
  }

  // 1. Tenta encontrar no cache local
  const all = getStoredCoupons();
  let coupon = all.find((c) => c.code.toUpperCase() === cleanCode);

  // 2. Se não encontrou no cache e o Supabase está ativo, busca na nuvem
  if (!coupon && isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .ilike("code", cleanCode)
        .maybeSingle();

      if (!error && data) {
        coupon = rowToCoupon(data);
        // Atualiza cache local
        all.unshift(coupon);
        saveAllCoupons(all);
      }
    } catch {}
  }

  if (!coupon) {
    return validateCoupon(code, cartItems);
  }

  return evaluateCouponDiscount(coupon, cartItems);
}

function evaluateCouponDiscount(coupon: Coupon, cartItems: CartItem[]): CouponValidationResult {
  if (!coupon.isActive) {
    return { valid: false, discount: 0, message: "Este cupom está pausado ou inativo no momento." };
  }

  // Verifica expiração
  if (coupon.expiresAt) {
    const expDate = new Date(coupon.expiresAt);
    if (!isNaN(expDate.getTime()) && expDate.getTime() < Date.now()) {
      return { valid: false, discount: 0, message: "Este cupom expirou." };
    }
  }

  // Verifica limite de uso
  if (coupon.usageLimit && coupon.usageLimit > 0 && (coupon.usageCount || 0) >= coupon.usageLimit) {
    return { valid: false, discount: 0, message: "Este cupom atingiu o limite máximo de utilizações." };
  }

  // Calcula o valor elegível no carrinho
  let eligibleSubtotal = 0;
  if (coupon.scope === "store") {
    const sName = (coupon.sellerName || "").toLowerCase().trim();
    const sId = (coupon.sellerId || "").trim();
    const isGennysonCoupon =
      sName.includes("gennyson") ||
      sId === "bb25d258-3152-422b-aa04-7bd34e8a5927" ||
      sId === "usr-gennyson";

    eligibleSubtotal = cartItems.reduce((sum, item) => {
      const itemSellerName = (item.product.seller?.name || "").toLowerCase().trim();
      const itemSellerId = (item.product.seller?.id || "").trim();
      const isItemGennyson =
        itemSellerName.includes("gennyson") ||
        itemSellerId === "bb25d258-3152-422b-aa04-7bd34e8a5927" ||
        itemSellerId === "usr-gennyson";

      const matchesSeller =
        (isGennysonCoupon && isItemGennyson) ||
        (sId && itemSellerId && sId === itemSellerId) ||
        (sName && itemSellerName && sName === itemSellerName);

      if (matchesSeller || !sId) {
        return sum + (item.finalPrice ?? item.product.price) * item.quantity;
      }
      return sum;
    }, 0);

    if (eligibleSubtotal <= 0) {
      return {
        valid: false,
        discount: 0,
        message: `Este cupom é válido apenas em compras na loja de "${coupon.sellerName}".`,
      };
    }
  } else if (coupon.scope === "product") {
    const matchingItems = cartItems.filter(
      (item) => item.product.id === coupon.productId
    );
    if (matchingItems.length === 0) {
      return {
        valid: false,
        discount: 0,
        message: `Este cupom é válido apenas para o anúncio: "${coupon.productTitle || "escolhido"}".`,
      };
    }
    eligibleSubtotal = matchingItems.reduce(
      (sum, item) => sum + (item.finalPrice ?? item.product.price) * item.quantity,
      0
    );
  }

  if (eligibleSubtotal <= 0) {
    return {
      valid: false,
      discount: 0,
      message: "Nenhum produto no carrinho é elegível para este cupom.",
    };
  }

  let calculatedDiscount = 0;
  if (coupon.discountType === "percentage") {
    calculatedDiscount = Math.round(((eligibleSubtotal * coupon.discountValue) / 100) * 100) / 100;
  } else {
    calculatedDiscount = Math.min(eligibleSubtotal, coupon.discountValue);
  }

  return {
    valid: true,
    discount: calculatedDiscount,
    message:
      coupon.discountType === "percentage"
        ? `Cupom de ${coupon.discountValue}% aplicado!`
        : `Cupom de R$ ${coupon.discountValue.toFixed(2).replace(".", ",")} aplicado!`,
    coupon,
  };
}
