import { Product, UserProfile } from "@/types";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { getStoredProducts, deleteStoredProduct } from "./productStore";
import { uploadToSupabaseStorage } from "./supabaseStorage";
import { createProductRemote, updateProductRemote, groupsFromProduct } from "./productVault";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const norm = (s?: string) => (s || "").trim().toLowerCase();

/**
 * Monta a linha da tabela `products` a partir de um anúncio do site.
 * (Mesmo formato usado ao publicar um anúncio.)
 */
export function buildProductInsertPayload(p: Product, sellerId: string, sellerName: string) {
  const payload: any = {
    title: p.title,
    description: p.description,
    category: p.category,
    price: p.price,
    original_price: p.originalPrice || p.price * 1.3,
    stock: p.stock ?? 10,
    sales_count: p.salesCount || 0,
    image: /^https?:\/\//i.test(p.image || "") ? p.image : null,
    delivery_type: p.deliveryType?.toLowerCase() || "automatic",
    delivery_content:
      p.autoDeliveryContent?.[0] || "Acesso entregue automaticamente após confirmação PIX.",
    seller_name: sellerName,
    seller_id: sellerId,
    seller_avatar: p.seller?.avatar || null,
    warranty_days: p.warrantyDays || 30,
    status: "active",
  };
  if (UUID_RE.test(p.id)) payload.id = p.id;
  return payload;
}

/**
 * Anúncios criados antes do banco estar preparado ficaram só no navegador do vendedor.
 * Esta função copia para o Supabase os anúncios DO USUÁRIO LOGADO que ainda não existem lá
 * (compara por vendedor + título), para que estoque e vendas passem a funcionar.
 * Retorna quantos anúncios foram enviados.
 */
export async function syncOwnProductsToSupabase(user: UserProfile | null): Promise<number> {
  if (!isSupabaseConfigured || !user?.id || !UUID_RE.test(user.id)) return 0;

  try {
    const mine = getStoredProducts().filter((p) => {
      const s = p.seller;
      if (!s) return false;
      return (
        s.id === user.id ||
        (!!s.email && norm(s.email) === norm(user.email)) ||
        (!!s.name && norm(s.name) === norm(user.name))
      );
    });
    if (mine.length === 0) return 0;

    const { data: existing, error } = await supabase
      .from("products")
      .select("id, title, has_variations, variants, listing_type")
      .eq("seller_id", user.id);
    if (error) return 0;

    const existingByTitle = new Map<string, any>();
    const existingById = new Map<string, any>();
    (existing || []).forEach((r: any) => {
      if (r.id) existingById.set(r.id, r);
      if (r.title) existingByTitle.set(norm(r.title), r);
    });

    let sent = 0;

    for (const p of mine) {
      if (!p.title) continue;

      const matched = existingById.get(p.id) || existingByTitle.get(norm(p.title));

      const hasLocalVariations =
        Boolean(p.hasVariations) ||
        p.listingType === "MULTIPLA" ||
        (Array.isArray(p.variants) && p.variants.length > 0);

      // Se o anúncio já existe no banco:
      if (matched) {
        if (p.id !== matched.id) {
          // Remove ID temporário local para evitar duplicidade ou status pendente obsoleto
          deleteStoredProduct(p.id, p);
        }
        const hasRemoteVariations =
          Boolean(matched.has_variations) ||
          (Array.isArray(matched.variants) && matched.variants.length > 0);

        // Se localmente temos variações mas o banco ainda não tinha:
        if (hasLocalVariations && !hasRemoteVariations) {
          const productToUpdate = { ...p, id: matched.id };
          const groups = p.vaultGroups || groupsFromProduct(productToUpdate);
          const updateRes = await updateProductRemote(productToUpdate, { groups });
          if (updateRes.ok) {
            sent++;
          }
        }
        continue;
      }

      // Imagem só no navegador (base64): sobe para o Storage para o banco guardar um link
      let product = p;
      if (p.image && p.image.startsWith("data:")) {
        try {
          const url = await uploadToSupabaseStorage(p.image, "products", `prod-${Date.now()}`);
          if (url) product = { ...p, image: url };
        } catch {}
      }

      const groups = p.vaultGroups || groupsFromProduct(product);
      const res = await createProductRemote(product, {
        sellerId: user.id,
        sellerName: user.name || p.seller?.name || "Vendedor",
        sellerAvatar: p.seller?.avatar || null,
        groups,
      });

      if (res.ok) {
        if (res.id) existingById.set(res.id, { id: res.id, title: product.title });
        existingByTitle.set(norm(product.title), { id: res.id, title: product.title });
        sent++;
      } else {
        console.warn("Não foi possível enviar o anúncio ao banco:", p.title, res.error);
        if (res.error?.includes("does not exist")) break;
      }
    }
    return sent;
  } catch (err) {
    console.warn("Sincronização de anúncios falhou:", err);
    return 0;
  }
}
