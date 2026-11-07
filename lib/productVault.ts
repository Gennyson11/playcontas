import { Product, ProductVariant } from "@/types";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

/**
 * Variações + cofre seguro de credenciais.
 *
 * - As VARIAÇÕES (nome, preço, estoque) ficam na tabela pública `products` (coluna `variants`),
 *   para aparecerem em todas as contas.
 * - As CREDENCIAIS (contas/senhas) NUNCA vão para a tabela pública: ficam em `product_stock_items`,
 *   que só o dono do anúncio e os administradores conseguem ler. A entrega na compra é feita pelo banco.
 *
 * Requer rodar scripts/variacoes-e-cofre-seguro.sql no Supabase.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s?: string | null): boolean => !!s && UUID_RE.test(s);

export const SETUP_COFRE_HINT =
  "Para as variações e o estoque aparecerem em todas as contas, rode o SQL variacoes-e-cofre-seguro.sql no SQL Editor do Supabase.";

/** Um grupo de contas do estoque: de uma variação (variantId) ou do anúncio único (variantId = null) */
export interface VaultGroup {
  variantId: string | null;
  items: string[];
}

/* ----------------------------- Utilidades ----------------------------- */

/** Textos que o site usava como "enchimento" quando não havia credencial: nunca são contas de verdade. */
export function isPlaceholderCredential(s?: string): boolean {
  const t = (s || "").trim().toLowerCase();
  return (
    t === "" ||
    t === "entrega imediata" ||
    t.startsWith("acesso entregue automaticamente") ||
    t.startsWith("conta_demo_acesso")
  );
}

/** Separa o texto digitado pelo vendedor em uma lista de contas (mesma regra da contagem na tela) */
export function splitCredentialBlocks(text?: string, sep = "--"): string[] {
  const t = (text || "").trim();
  if (!t) return [];
  let blocks: string[];
  if (sep === "\\n\\n") {
    blocks = t.split(/\n\s*\n+/);
  } else if (sep && t.includes(sep)) {
    blocks = t.split(sep);
  } else {
    blocks = t.split("\n");
  }
  return blocks.map((b) => b.trim()).filter((b) => b.length > 0 && !isPlaceholderCredential(b));
}

/** Descobre o separador de um texto antigo quando ele não foi guardado junto */
function guessSeparator(text: string): string {
  if (text.includes("--")) return "--";
  if (/\n\s*\n/.test(text)) return "\\n\\n";
  return "\n";
}

/** Variações sem as credenciais (é o que pode ir para a tabela pública) */
export function stripVariantSecrets(variants?: ProductVariant[]): ProductVariant[] | undefined {
  if (!variants || variants.length === 0) return undefined;
  return variants.map((v) => ({
    id: v.id,
    name: v.name,
    price: v.price,
    stock: v.stock,
    originalPrice: v.originalPrice,
    description: v.description,
  }));
}

/** Copia do anúncio sem nenhuma credencial (é o que fica guardado no navegador depois que o cofre confirmou) */
export function withoutSecrets(p: Product): Product {
  return {
    ...p,
    autoDeliveryContent: undefined,
    variants: stripVariantSecrets(p.variants),
  };
}

/** Monta os grupos do cofre a partir de um anúncio local (usado ao sincronizar anúncios antigos) */
export function groupsFromProduct(p: Product): VaultGroup[] {
  if (p.deliveryType !== "AUTOMATIC") return [];
  const multi = (p.hasVariations || p.listingType === "MULTIPLA") && !!p.variants && p.variants.length > 0;
  if (multi) {
    const groups: VaultGroup[] = p.variants!.map((v) => ({
      variantId: v.id,
      items: splitCredentialBlocks(v.credentials, guessSeparator(v.credentials || "")),
    }));
    groups.push({ variantId: null, items: [] });
    return groups;
  }
  return [
    {
      variantId: null,
      items: (p.autoDeliveryContent || []).map((s) => (s || "").trim()).filter((s) => !isPlaceholderCredential(s)),
    },
  ];
}

/** Variações lidas de uma linha da tabela `products` (para o site montar o anúncio em qualquer conta) */
export function variationFieldsFromRow(d: any): Partial<Product> {
  let list: any[] = [];
  if (Array.isArray(d?.variants)) {
    list = d.variants;
  } else if (typeof d?.variants === "string" && d.variants.trim().length > 0) {
    try {
      const parsed = JSON.parse(d.variants);
      if (Array.isArray(parsed)) list = parsed;
    } catch {}
  }

  const isMulti =
    Boolean(d?.has_variations) ||
    d?.listing_type === "MULTIPLA" ||
    list.length > 0;

  if (!isMulti || list.length === 0) {
    return d?.listing_type === "UNICA" ? { listingType: "UNICA", hasVariations: false } : {};
  }

  const variants: ProductVariant[] = list.map((v: any, i: number) => ({
    id: String(v?.id ?? `v-${i + 1}`),
    name: String(v?.name ?? `Opção ${i + 1}`),
    price: Number(v?.price) || 0,
    stock: Math.max(0, Number(v?.stock) || 0),
    originalPrice: v?.originalPrice != null ? Number(v.originalPrice) : undefined,
    description: v?.description || undefined,
  }));

  return {
    listingType: "MULTIPLA",
    hasVariations: true,
    variants,
  };
}

const isMissingColumnError = (err: any): boolean =>
  !!err &&
  (err.code === "42703" ||
    err.code === "PGRST204" ||
    /column .* does not exist|could not find the .* column/i.test(err.message || ""));

const isMissingFunctionError = (err: any): boolean =>
  !!err &&
  (err.code === "PGRST202" ||
    err.code === "42883" ||
    err.code === "42P01" ||
    /could not find the function|schema cache|does not exist/i.test(err.message || ""));

/* ------------------------------- Cofre -------------------------------- */

/**
 * Grava o estoque de credenciais no cofre. Para cada grupo, SUBSTITUI as contas ainda disponíveis
 * (contas já vendidas nunca são apagadas). `purgeVariantIds` zera variações que deixaram de existir.
 */
export async function saveProductVault(
  productId: string,
  groups: VaultGroup[],
  purgeVariantIds: string[] = []
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !isUuid(productId)) return { ok: false, error: "Anúncio ainda não está no banco." };

  const all: VaultGroup[] = [...groups];
  const known = new Set(groups.map((g) => g.variantId));
  purgeVariantIds.forEach((id) => {
    if (!known.has(id)) {
      all.push({ variantId: id, items: [] });
      known.add(id);
    }
  });

  // Se todos os grupos estiverem vazios (ex: anúncio de estoque manual migrado para automático sem credenciais cadastradas ainda),
  // não sobrescreve nem apaga o estoque no banco para não zerar/pausar o produto indevidamente.
  const hasAnyItems = all.some((g) => g.items && g.items.length > 0);
  if (!hasAnyItems && purgeVariantIds.length === 0) {
    return { ok: true };
  }

  try {
    for (const g of all) {
      // Se for o grupo geral (variantId null) e estiver vazio, só chama se houver algum item ou se for purge intencional
      if (!g.variantId && (!g.items || g.items.length === 0) && !hasAnyItems) {
        continue;
      }
      const { error } = await supabase.rpc("set_product_stock", {
        p_product_id: productId,
        p_variant_id: g.variantId,
        p_items: g.items,
      });
      if (error) {
        return {
          ok: false,
          error: isMissingFunctionError(error) ? SETUP_COFRE_HINT : error.message || "Não foi possível salvar o estoque.",
        };
      }
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Não foi possível salvar o estoque." };
  }
}

/**
 * Lê o estoque disponível do cofre (só o dono do anúncio e admins conseguem).
 * `inUse` = o anúncio já usa o cofre (mesmo que todas as contas tenham sido vendidas).
 * `items` = contas disponíveis por variação (chave "" = anúncio único).
 */
export async function fetchProductVault(
  productId: string
): Promise<{ inUse: boolean; items: Record<string, string[]> }> {
  const empty = { inUse: false, items: {} as Record<string, string[]> };
  if (!isSupabaseConfigured || !isUuid(productId)) return empty;
  try {
    const items: Record<string, string[]> = {};
    const PAGE = 1000;
    for (let page = 0; page < 20; page++) {
      const { data, error } = await supabase
        .from("product_stock_items")
        .select("variant_id, content")
        .eq("product_id", productId)
        .eq("status", "available")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      if (error || !data) break;
      data.forEach((r: any) => {
        const key = r.variant_id || "";
        (items[key] = items[key] || []).push(r.content);
      });
      if (data.length < PAGE) break;
    }

    let inUse = Object.keys(items).length > 0;
    if (!inUse) {
      const { data } = await supabase
        .from("product_stock_items")
        .select("id")
        .eq("product_id", productId)
        .limit(1);
      inUse = !!data && data.length > 0;
    }
    return { inUse, items };
  } catch {
    return empty;
  }
}

/* ----------------------- Criar / atualizar anúncio ----------------------- */

export type RemoteMode = "vault" | "legacy" | "local" | "failed";

function variationColumns(p: Product) {
  const stripped = stripVariantSecrets(p.variants);
  const multi = !!stripped && stripped.length > 0 && (p.hasVariations || p.listingType === "MULTIPLA");
  return {
    listing_type: multi ? "MULTIPLA" : "UNICA",
    has_variations: multi,
    variants: multi ? stripped : null,
  };
}

/**
 * Cria o anúncio no banco. As variações vão na tabela pública; as credenciais vão para o cofre.
 * Se o SQL do cofre ainda não foi rodado, cria o anúncio sem variações/credenciais (nada vaza) e avisa.
 */
export async function createProductRemote(
  product: Product,
  opts: {
    sellerId?: string | null;
    sellerName: string;
    sellerAvatar?: string | null;
    groups: VaultGroup[];
  }
): Promise<{ ok: boolean; mode: RemoteMode; id?: string; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, mode: "local", error: "Banco não configurado." };

  const wantsVault = product.deliveryType === "AUTOMATIC" && opts.groups.some((g) => g.items.length > 0);

  const base: any = {
    title: product.title,
    description: product.description,
    category: product.category,
    price: product.price,
    original_price: product.originalPrice || product.price * 1.3,
    stock: product.stock ?? 0,
    sales_count: product.salesCount || 0,
    image: product.image,
    delivery_type: product.deliveryType?.toLowerCase() || "automatic",
    // Credenciais NUNCA vão aqui: ficam no cofre. Esta coluna recebe só um texto neutro.
    delivery_content: null,
    seller_name: opts.sellerName,
    seller_id: opts.sellerId || null,
    seller_avatar: opts.sellerAvatar || null,
    warranty_days: product.warrantyDays || 30,
    status:
      product.status === "rejected"
        ? "rejected"
        : product.status === "pending_review" || product.status === "pending_approval"
        ? "pending_review"
        : product.status === "paused" || (product.stock ?? 0) <= 0
        ? "paused"
        : (product.status || "pending_review"),
    rejection_reason: product.rejectionReason || null,
    reviewed_at: product.reviewedAt || null,
  };
  if (isUuid(product.id)) base.id = product.id;

  try {
    let usedNewColumns = true;
    let res: any = await supabase
      .from("products")
      .insert({ ...base, ...variationColumns(product) })
      .select("id")
      .maybeSingle();

    if (res.error && isMissingColumnError(res.error)) {
      usedNewColumns = false;
      res = await supabase.from("products").insert(base).select("id").maybeSingle();
    }

    if (res.error) {
      return { ok: false, mode: "failed", error: res.error.message || "O banco recusou o anúncio." };
    }

    const id: string | undefined = res.data?.id || (isUuid(product.id) ? product.id : undefined);

    if (!usedNewColumns) {
      return { ok: true, mode: "legacy", id, error: SETUP_COFRE_HINT };
    }

    if (wantsVault && id) {
      const vault = await saveProductVault(id, opts.groups);
      if (!vault.ok) return { ok: true, mode: "failed", id, error: vault.error };
    }
    return { ok: true, mode: "vault", id };
  } catch (err: any) {
    return { ok: false, mode: "failed", error: err?.message || "Não foi possível salvar o anúncio." };
  }
}

/**
 * Atualiza o anúncio no banco (dono do anúncio). Variações vão na tabela pública;
 * credenciais vão para o cofre. O campo antigo `delivery_content` é limpo (credenciais públicas).
 */
export async function updateProductRemote(
  product: Product,
  opts: { groups: VaultGroup[]; purgeVariantIds?: string[] }
): Promise<{ ok: boolean; mode: RemoteMode; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, mode: "local" };

  let targetId = isUuid(product.id) ? product.id : null;
  if (!targetId && product.title) {
    try {
      const { data: found } = await supabase
        .from("products")
        .select("id")
        .ilike("title", product.title.trim())
        .limit(1)
        .maybeSingle();
      if (found?.id) targetId = found.id;
    } catch {}
  }
  if (!targetId) return { ok: false, mode: "local" };

  const resolvedStatus =
    product.status === "rejected"
      ? "rejected"
      : product.status === "pending_review" || product.status === "pending_approval"
      ? "pending_review"
      : product.status === "paused" || (product.stock ?? 0) <= 0
      ? "paused"
      : (product.status || "active");

  const base: any = {
    title: product.title,
    description: product.description,
    price: product.price,
    original_price: product.originalPrice,
    stock: product.stock,
    status: resolvedStatus,
    rejection_reason: product.rejectionReason || null,
    reviewed_at: product.reviewedAt || null,
    category: product.category,
    delivery_type: product.deliveryType.toLowerCase(),
    image: product.image,
    warranty_days: product.warrantyDays,
  };

  try {
    let usedNewColumns = true;
    let res: any = await supabase
      .from("products")
      .update({ ...base, ...variationColumns(product), delivery_content: null })
      .eq("id", targetId)
      .select("id");

    if (res.error && isMissingColumnError(res.error)) {
      usedNewColumns = false;
      res = await supabase.from("products").update(base).eq("id", targetId).select("id");
    }

    if (res.error) {
      return { ok: false, mode: "failed", error: res.error.message || "Não foi possível atualizar o anúncio." };
    }
    if (!res.data || res.data.length === 0) {
      // Anúncio que só existe no navegador (ou sem permissão): nada a gravar no banco
      return { ok: false, mode: "local" };
    }
    if (!usedNewColumns) {
      return { ok: true, mode: "legacy", error: SETUP_COFRE_HINT };
    }

    const vault = await saveProductVault(product.id, opts.groups, opts.purgeVariantIds || []);
    if (!vault.ok) return { ok: true, mode: "failed", error: vault.error };
    return { ok: true, mode: "vault" };
  } catch (err: any) {
    return { ok: false, mode: "failed", error: err?.message || "Não foi possível atualizar o anúncio." };
  }
}
