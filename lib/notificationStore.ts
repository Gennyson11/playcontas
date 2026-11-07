import { UserProfile } from "@/types";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

/**
 * Sistema de notificações (sininho) — perguntas e respostas dos anúncios.
 * Salvo no Supabase (tabela notifications) para chegar ao vendedor em qualquer aparelho.
 * Se o Supabase estiver indisponível, usa o armazenamento local do navegador como reserva.
 */
export type NotificationKind = "question" | "answer" | "sale" | "system";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  recipientId?: string;
  recipientName?: string;
  title: string;
  body: string;
  link: string;
  productTitle?: string;
  productImage?: string;
  createdAt: string;
  read: boolean;
}

const NOTIFICATIONS_KEY = "central_notifications";
const MAX_NOTIFICATIONS = 100;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENNYSON_PROFILE_ID = "bb25d258-3152-422b-aa04-7bd34e8a5927";

/* ---------------------------- Reserva local ---------------------------- */

function readLocal(): AppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((n) => ({
      ...n,
      title: n.title ? n.title.replace(/jovizeira/gi, "BuscaNinja") : n.title,
      body: n.body ? n.body.replace(/jovizeira/gi, "BuscaNinja") : n.body,
    }));
  } catch {
    return [];
  }
}

function writeLocal(list: AppNotification[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(list.slice(0, MAX_NOTIFICATIONS)));
  } catch {}
}

function emitUpdated(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event("central_notifications_updated"));
  } catch {}
}

export function isNotificationForUser(
  n: AppNotification,
  user: UserProfile | null | undefined
): boolean {
  if (!user) return false;
  if (n.recipientId && n.recipientId === user.id) return true;
  if (
    !n.recipientId &&
    n.recipientName &&
    user.name &&
    n.recipientName.toLowerCase() === user.name.toLowerCase()
  ) {
    return true;
  }
  return false;
}

/* ------------------------------ Supabase ------------------------------- */

function rowToNotification(row: any): AppNotification {
  return {
    id: row.id,
    kind: row.kind,
    recipientId: row.recipient_id,
    title: (row.title || "").replace(/jovizeira/gi, "BuscaNinja"),
    body: (row.body || "").replace(/jovizeira/gi, "BuscaNinja"),
    link: row.link || "/",
    productTitle: row.product_title || undefined,
    productImage: row.product_image || undefined,
    createdAt: row.created_at,
    read: !!row.read,
  };
}

/**
 * Descobre o id (uuid do Supabase) do destinatário a partir do id ou do nome.
 */
export async function resolveRecipientId(
  id?: string,
  name?: string
): Promise<string | null> {
  if (id && UUID_REGEX.test(id)) return id;
  if (name && name.toLowerCase().includes("gennyson")) return GENNYSON_PROFILE_ID;
  if (!isSupabaseConfigured || !name) return null;
  try {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .ilike("full_name", name.trim())
      .limit(1)
      .maybeSingle();
    return data?.id || null;
  } catch {
    return null;
  }
}

/* ------------------------------ API pública ---------------------------- */

export async function loadNotifications(
  user: UserProfile | null | undefined
): Promise<AppNotification[]> {
  if (!user) return [];
  const local = readLocal().filter((n) => isNotificationForUser(n, user));
  let remote: AppNotification[] = [];

  if (isSupabaseConfigured && UUID_REGEX.test(user.id)) {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(MAX_NOTIFICATIONS);
      if (!error && data) remote = data.map(rowToNotification);
    } catch {}
  }

  return [...remote, ...local].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addNotification(
  data: Omit<AppNotification, "id" | "createdAt" | "read">
): Promise<void> {
  const recipientId = await resolveRecipientId(data.recipientId, data.recipientName);

  // Imagens base64 gigantes não vão para o banco: só URLs normais
  const safeImage =
    data.productImage && /^https?:\/\//i.test(data.productImage) ? data.productImage : undefined;

  if (isSupabaseConfigured && recipientId) {
    const base = {
      recipient_id: recipientId,
      kind: data.kind,
      title: data.title,
      body: data.body,
      link: data.link,
    };
    try {
      // 1) Tenta salvar já com os dados do produto (colunas product_title / product_image)
      let { error } = await supabase.from("notifications").insert({
        ...base,
        product_title: data.productTitle || null,
        product_image: safeImage || null,
      });
      // 2) Se as colunas ainda não existirem no banco, salva sem elas (a notificação continua chegando)
      if (error) {
        const retry = await supabase.from("notifications").insert(base);
        error = retry.error;
      }
      if (!error) {
        emitUpdated();
        return;
      }
    } catch {}
  }

  // Reserva local (Supabase indisponível ou destinatário sem conta)
  const notification: AppNotification = {
    ...data,
    productImage: safeImage,
    recipientId: recipientId || data.recipientId,
    id: `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    read: false,
  };
  writeLocal([notification, ...readLocal()]);
  emitUpdated();
}

/**
 * Avisa o vendedor que o produto dele foi vendido.
 */
export function notifySale(
  product: {
    id: string;
    title: string;
    image?: string;
    seller: { id: string; name: string };
  },
  quantity: number,
  link: string
): void {
  addNotification({
    kind: "sale",
    recipientId: product.seller.id,
    recipientName: product.seller.name,
    title: "Nova venda realizada!",
    body:
      quantity > 1
        ? `Seu produto foi vendido (${quantity} unidades).`
        : "Seu produto foi vendido.",
    link,
    productTitle: product.title,
    productImage: product.image,
  });
}

/**
 * Avisa o vendedor que o estoque de um anúncio ou de uma variação acabou.
 * Ao clicar na notificação pelo sininho, abre diretamente em /meus-produtos.
 */
export async function notifyStockDepleted(
  product: {
    id: string;
    title: string;
    image?: string;
    seller: { id?: string; name?: string };
  },
  variantName?: string
): Promise<void> {
  const sellerId = product.seller?.id;
  const sellerName = product.seller?.name || "Vendedor";
  const isVariation = Boolean(variantName && variantName.trim() && variantName !== "Padrão");

  const title = isVariation ? "⚠️ Variação Esgotada!" : "⚠️ Estoque Esgotado!";
  const body = isVariation
    ? `A variação "${variantName}" do anúncio "${product.title}" esgotou. Clique para reabastecer.`
    : `O estoque do anúncio "${product.title}" esgotou e ele foi pausado. Clique para reabastecer.`;

  await addNotification({
    kind: "system",
    recipientId: sellerId,
    recipientName: sellerName,
    title,
    body,
    link: "/meus-produtos",
    productTitle: product.title,
    productImage: product.image,
  });
}

export async function markNotificationRead(id: string): Promise<void> {
  if (UUID_REGEX.test(id) && isSupabaseConfigured) {
    try {
      await supabase.from("notifications").update({ read: true }).eq("id", id);
    } catch {}
  }
  writeLocal(readLocal().map((n) => (n.id === id ? { ...n, read: true } : n)));
  emitUpdated();
}

export async function markAllNotificationsRead(
  user: UserProfile | null | undefined
): Promise<void> {
  if (!user) return;
  if (isSupabaseConfigured && UUID_REGEX.test(user.id)) {
    try {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("recipient_id", user.id)
        .eq("read", false);
    } catch {}
  }
  writeLocal(readLocal().map((n) => (isNotificationForUser(n, user) ? { ...n, read: true } : n)));
  emitUpdated();
}

export async function clearReadNotifications(
  user: UserProfile | null | undefined
): Promise<void> {
  if (!user) return;
  if (isSupabaseConfigured && UUID_REGEX.test(user.id)) {
    try {
      await supabase
        .from("notifications")
        .delete()
        .eq("recipient_id", user.id)
        .eq("read", true);
    } catch {}
  }
  writeLocal(readLocal().filter((n) => !(isNotificationForUser(n, user) && n.read)));
  emitUpdated();
}

/**
 * Escuta novas notificações em tempo real (Supabase Realtime).
 * Retorna a função para cancelar a inscrição.
 */
export function subscribeToNotifications(
  user: UserProfile | null | undefined,
  onChange: () => void
): () => void {
  if (!user || !isSupabaseConfigured || !UUID_REGEX.test(user.id)) return () => {};
  try {
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${user.id}`,
        },
        () => onChange()
      )
      .subscribe();
    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  } catch {
    return () => {};
  }
}

export function formatNotificationTime(iso: string): string {
  const ts = Date.parse(iso);
  if (isNaN(ts)) return "";
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH} hora${diffH > 1 ? "s" : ""}`;
  const diffD = Math.floor(diffH / 24);
  return `há ${diffD} dia${diffD > 1 ? "s" : ""}`;
}
