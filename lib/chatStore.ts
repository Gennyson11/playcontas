import { CartItem, Product, UserProfile } from "@/types";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { resolveRecipientId, addNotification, notifySale, notifyStockDepleted } from "./notificationStore";

/**
 * Chat do pedido (comprador x vendedor) salvo no Supabase.
 * A conversa é criada na hora da compra e já recebe a entrega automática (se o produto for automático).
 */

export type ChatMessageKind = "text" | "system" | "delivery";
export type ChatSenderRole = "buyer" | "seller" | "system" | "admin";

export interface OrderChat {
  id: string;
  number: number;
  code: string;
  productId: string;
  productTitle: string;
  variantId?: string | null;
  productImage: string;
  price: number;
  quantity: number;
  buyerId: string | null;
  buyerName: string;
  sellerId: string | null;
  sellerName: string;
  deliveryType: "AUTOMATIC" | "MANUAL";
  status: "pending" | "delivered";
  lastMessage: string;
  lastMessageAt: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string | null;
  senderName: string;
  senderRole: ChatSenderRole;
  kind: ChatMessageKind;
  body: string;
  createdAt: string;
  isRead?: boolean;
  readAt?: string | null;
}

/** Número do pedido com 5 dígitos, ex.: 1233 -> "01233" (usado no endereço /chat/01233) */
export const formatChatNumber = (n: number): string => String(Math.max(0, Math.floor(n) || 0)).padStart(5, "0");

/**
 * Se o pedido foi gravado com o nome da variação em parênteses no final do título
 * ou com "(Padrão)", extrai apenas o nome da variação comprada ou limpa o "(Padrão)".
 */
export const cleanOrderTitle = (t: string): string => {
  if (!t) return "Produto";
  // 1. Extrair nome da variação caso o título termine em "(Nome da Variação)"
  const varMatch = t.match(/\(\s*([^)]{2,})\s*\)?$/);
  if (varMatch && varMatch[1]) {
    const inside = varMatch[1].trim();
    if (!/^padr[ãa]o$/i.test(inside)) {
      return inside;
    }
  }
  return t.replace(/\s*\(\s*padr[ãa]o\s*\)\s*$/i, "").trim();
};

const rowToChat = (r: any): OrderChat => {
  let buyerName = r.buyer_name || "Comprador";
  let sellerName = r.seller_name || "Vendedor";
  if (buyerName.toLowerCase().includes("jovizeira") || r.buyer_id === "fcaba04d-92ec-45b3-a626-013318cc0f8c") {
    buyerName = "BuscaNinja";
  }
  if (sellerName.toLowerCase().includes("jovizeira") || r.seller_id === "fcaba04d-92ec-45b3-a626-013318cc0f8c") {
    sellerName = "BuscaNinja";
  }
  return {
    id: r.id,
    number: Number(r.number) || 0,
    code: r.number != null ? formatChatNumber(Number(r.number)) : r.code,
    productId: r.product_id || "",
    productTitle: cleanOrderTitle(r.product_title || "Produto") || "Produto",
    variantId: r.variant_id || null,
    productImage: r.product_image || "",
    price: Number(r.price) || 0,
    quantity: Number(r.quantity) || 1,
    buyerId: r.buyer_id || null,
    buyerName,
    sellerId: r.seller_id || null,
    sellerName,
    deliveryType: r.delivery_type === "MANUAL" ? "MANUAL" : "AUTOMATIC",
    status: r.status === "delivered" ? "delivered" : "pending",
    lastMessage: r.last_message || "",
    lastMessageAt: r.last_message_at || r.created_at,
    createdAt: r.created_at,
  };
};

const rowToMessage = (r: any): ChatMessage => {
  let senderName = r.sender_name || "";
  if (senderName.toLowerCase().includes("jovizeira") || r.sender_id === "fcaba04d-92ec-45b3-a626-013318cc0f8c") {
    senderName = senderName.replace(/jovizeira/gi, "BuscaNinja");
  }
  let body = r.body || "";
  if (body.toLowerCase().includes("jovizeira")) {
    body = body.replace(/jovizeira/gi, "BuscaNinja");
  }
  return {
    id: r.id,
    chatId: r.chat_id,
    senderId: r.sender_id || null,
    senderName,
    senderRole: r.sender_role,
    kind: r.kind,
    body,
    createdAt: r.created_at,
    isRead: Boolean(r.is_read || r.read_at),
    readAt: r.read_at || null,
  };
};

const SETUP_HINT =
  "O chat ainda não foi ativado no banco de dados. Execute o script setup-chat.sql no SQL Editor do Supabase.";

const friendlyError = (err: any): string => {
  const msg: string = err?.message || "";
  if (
    err?.code === "PGRST202" ||
    err?.code === "42P01" ||
    err?.code === "PGRST205" ||
    msg.includes("Could not find the function") ||
    msg.includes("does not exist") ||
    msg.includes("schema cache")
  ) {
    return SETUP_HINT;
  }
  return msg || "Não foi possível concluir a operação.";
};

/* ------------------------------ Leitura ------------------------------ */

/* ------------------------------ Cache (abertura instantânea) ------------------------------ */

const MESSAGES_CACHE = new Map<string, ChatMessage[]>();
const INFLIGHT_MESSAGES = new Map<string, Promise<ChatMessage[]>>();
const LS_MESSAGES_PREFIX = "central_chat_msgs_";
const LS_CHATS_PREFIX = "central_chat_list_";

export const DEMO_INITIAL_MESSAGES: Record<string, ChatMessage[]> = {
  "chat-kalodata-00013": [
    {
      id: "msg-00013-1",
      chatId: "chat-kalodata-00013",
      senderId: null,
      senderName: "Sistema",
      senderRole: "system",
      kind: "system",
      body: "CHAT INICIADO - CENTRAL MARKET\n\nNegociação segura com pagamento protegido. O valor só é liberado ao vendedor após a entrega confirmada.",
      createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      isRead: true,
    },
    {
      id: "msg-00013-2",
      chatId: "chat-kalodata-00013",
      senderId: "usr-gennyson",
      senderName: "Gennyson Marinho",
      senderRole: "seller",
      kind: "delivery",
      body: "Olá Lucas! Seguem as credenciais de acesso da conta Kalodata Profissional 30 dias:\n\nEmail: kalo_vip_pro13@gmail.com\nSenha: KaloMaster2026!#\nLink: https://kalodata.com\n\nQualquer dúvida estou à disposição!",
      createdAt: new Date(Date.now() - 38 * 60 * 1000).toISOString(),
      isRead: true,
    },
    {
      id: "msg-00013-3",
      chatId: "chat-kalodata-00013",
      senderId: "usr-cliente-demo",
      senderName: "Lucas Ferreira",
      senderRole: "buyer",
      kind: "text",
      body: "Olá vendedor, tentei entrar aqui com esse email e senha, mas diz senha inválida ou usuário inexistente. Tentei redefinir mas não tenho acesso ao email. Poderia verificar por gentileza?",
      createdAt: new Date(Date.now() - 36 * 60 * 1000).toISOString(),
      isRead: true,
    },
    {
      id: "msg-00013-4",
      chatId: "chat-kalodata-00013",
      senderId: null,
      senderName: "Central de Mediação Oficial",
      senderRole: "system",
      kind: "system",
      body: "🚨 MEDIAÇÃO ACIONADA · SALDO BLOQUEADO\n\n" +
        "🔒 Saldo Retido: R$ 12,90\n" +
        "👤 Solicitante: Lucas Ferreira (Comprador)\n" +
        "📋 Motivo: \"Não consegui acessar a conta com as credenciais enviadas. Informa senha inválida.\"\n\n" +
        "A moderação oficial do PlayContas foi acionada. O saldo desta venda encontra-se retido preventivamente. Ambas as partes devem apresentar esclarecimentos e comprovantes diretamente nesta conversa.",
      createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      isRead: true,
    },
  ],
  "chat-canva-00010": [
    {
      id: "msg-00010-1",
      chatId: "chat-canva-00010",
      senderId: null,
      senderName: "Sistema",
      senderRole: "system",
      kind: "system",
      body: "CHAT INICIADO - CENTRAL MARKET\n\nNegociação segura com entrega automática.",
      createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      isRead: true,
    },
    {
      id: "msg-00010-2",
      chatId: "chat-canva-00010",
      senderId: "usr-ficticio-2",
      senderName: "NexusGames Brasil",
      senderRole: "seller",
      kind: "delivery",
      body: "Convite Canva Pro 1 ano:\nhttps://canva.com/brand/join?invite_id=exp-0912\nBasta clicar com sua conta Google conectada.",
      createdAt: new Date(Date.now() - 2.8 * 3600 * 1000).toISOString(),
      isRead: true,
    },
    {
      id: "msg-00010-3",
      chatId: "chat-canva-00010",
      senderId: "usr-mariana",
      senderName: "Mariana Souza",
      senderRole: "buyer",
      kind: "text",
      body: "Boa tarde, quando clico no link diz que o convite foi revogado ou expirou pelo administrador da equipe.",
      createdAt: new Date(Date.now() - 2.2 * 3600 * 1000).toISOString(),
      isRead: true,
    },
    {
      id: "msg-00010-4",
      chatId: "chat-canva-00010",
      senderId: null,
      senderName: "Central de Mediação Oficial",
      senderRole: "system",
      kind: "system",
      body: "🚨 MEDIAÇÃO ACIONADA · SALDO BLOQUEADO\n\n" +
        "🔒 Saldo Retido: R$ 15,00\n" +
        "👤 Solicitante: Mariana Souza (Comprador)\n" +
        "📋 Motivo: \"O link de convite expirou antes que eu pudesse aceitar na minha conta.\"\n\n" +
        "A moderação oficial do PlayContas foi acionada. O saldo desta venda encontra-se retido preventivamente até que um novo convite válido seja enviado ou o reembolso concedido.",
      createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      isRead: true,
    },
  ],
  "chat-gpt-00008": [
    {
      id: "msg-00008-1",
      chatId: "chat-gpt-00008",
      senderId: null,
      senderName: "Sistema",
      senderRole: "system",
      kind: "system",
      body: "CHAT INICIADO - CENTRAL MARKET\n\nNegociação segura com entrega automática.",
      createdAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
      isRead: true,
    },
    {
      id: "msg-00008-2",
      chatId: "chat-gpt-00008",
      senderId: "usr-gennyson",
      senderName: "Gennyson Marinho",
      senderRole: "seller",
      kind: "delivery",
      body: "Conta ChatGPT Plus entregue com sucesso:\nLogin: gpt_plus_rafael@centraldasias.com\nSenha: GptPro2026#\nAcesso direto em https://chatgpt.com",
      createdAt: new Date(Date.now() - 5.8 * 3600 * 1000).toISOString(),
      isRead: true,
    },
    {
      id: "msg-00008-3",
      chatId: "chat-gpt-00008",
      senderId: "usr-rafael",
      senderName: "Rafael Costa",
      senderRole: "buyer",
      kind: "text",
      body: "Muito obrigado, conta funcionando perfeitamente!",
      createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
      isRead: true,
    },
  ],
};

export function getDemoMessagesForChat(chatId: string): ChatMessage[] | undefined {
  if (DEMO_INITIAL_MESSAGES[chatId]) return DEMO_INITIAL_MESSAGES[chatId];
  if (chatId.includes("00013") || chatId === "13") return DEMO_INITIAL_MESSAGES["chat-kalodata-00013"];
  if (chatId.includes("00010") || chatId === "10") return DEMO_INITIAL_MESSAGES["chat-canva-00010"];
  if (chatId.includes("00008") || chatId === "8") return DEMO_INITIAL_MESSAGES["chat-gpt-00008"];
  return undefined;
}

/** Mensagens já conhecidas da conversa (memória ou armazenamento local) — retorno síncrono */
export function getCachedMessages(chatId: string): ChatMessage[] | null {
  const mem = MESSAGES_CACHE.get(chatId);
  if (mem) return mem;
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(LS_MESSAGES_PREFIX + chatId);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          MESSAGES_CACHE.set(chatId, parsed);
          return parsed;
        }
      }
    } catch {}
  }
  const demoFallback = getDemoMessagesForChat(chatId);
  if (demoFallback) {
    MESSAGES_CACHE.set(chatId, demoFallback);
    return demoFallback;
  }
  return null;
}

export function setCachedMessages(chatId: string, list: ChatMessage[]): void {
  MESSAGES_CACHE.set(chatId, list);
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_MESSAGES_PREFIX + chatId, JSON.stringify(list.slice(-150)));
  } catch {}
}

/** Lista de conversas já conhecida do usuário — retorno síncrono */
export function getCachedChats(userId: string): OrderChat[] | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = localStorage.getItem(LS_CHATS_PREFIX + userId);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return null;
}

function setCachedChats(userId: string, list: OrderChat[]): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(LS_CHATS_PREFIX + userId, JSON.stringify(list.slice(0, 60)));
  } catch {}
}

/**
 * O pedido guarda uma cópia do título da época da compra. Se o vendedor mudar o título do
 * anúncio depois, o chat precisa mostrar o título ATUAL. Busca no catálogo pelo id do produto.
 * Se a busca falhar, mantém o título gravado no pedido.
 */
async function withCurrentProductTitles(chats: OrderChat[]): Promise<OrderChat[]> {
  if (!isSupabaseConfigured || chats.length === 0) return chats;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ids = Array.from(new Set(chats.map((c) => c.productId).filter((id) => id && UUID.test(id))));
  if (ids.length === 0) return chats;
  try {
    const { data, error } = await supabase.from("products").select("id,title").in("id", ids);
    if (error || !data) return chats;
    const titles = new Map<string, string>();
    data.forEach((p: any) => {
      if (p?.id && p?.title) titles.set(p.id, p.title);
    });
    return chats.map((c) => {
      if (c.variantId) return c;
      const current = titles.get(c.productId);
      if (!current) return c;
      // Se c.productTitle já é o nome de uma variação (diferente do título do anúncio), mantém o nome da variação
      if (c.productTitle && c.productTitle !== current && c.productTitle !== "Produto") {
        return c;
      }
      return { ...c, productTitle: current };
    });
  } catch {
    return chats;
  }
}

export async function listMyChats(userId: string): Promise<{ chats: OrderChat[]; error?: string }> {
  if (!isSupabaseConfigured) return { chats: [], error: "Banco de dados não configurado." };
  try {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
    let query = supabase
      .from("order_chats")
      .select("*")
      .order("last_message_at", { ascending: false })
      .limit(200);

    if (isUUID) {
      query = query.or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);
    }

    const TIMEOUT = Symbol("timeout");
    const raced: any = await Promise.race([
      query,
      new Promise((resolve) => setTimeout(() => resolve(TIMEOUT), 15000)),
    ]);
    if (raced === TIMEOUT) {
      return {
        chats: [],
        error: "O servidor está demorando para responder. Tentando novamente automaticamente...",
      };
    }
    const { data, error } = raced;
    if (error) return { chats: [], error: friendlyError(error) };
    const chats = await withCurrentProductTitles((data || []).map(rowToChat));
    setCachedChats(userId, chats);
    return { chats };
  } catch (err) {
    return { chats: [], error: friendlyError(err) };
  }
}

export const DEMO_ADMIN_CHATS: OrderChat[] = [];

/** Carrega TODAS as conversas de compras da plataforma para visualização do Administrador */
export async function listAllChatsAdmin(): Promise<{ chats: OrderChat[]; error?: string }> {
  let dbChats: OrderChat[] = [];
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from("order_chats")
        .select("*")
        .order("last_message_at", { ascending: false })
        .limit(300);

      if (!error && data) {
        dbChats = await withCurrentProductTitles((data || []).map(rowToChat));
      }
    } catch {}
  }

  const map = new Map<string, OrderChat>();
  DEMO_ADMIN_CHATS.forEach((c) => map.set(c.id, c));
  if (typeof window !== "undefined") {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(LS_CHATS_PREFIX)) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              list.forEach((item: OrderChat) => {
                if (item && item.id) map.set(item.id, item);
              });
            }
          }
        }
      }

      // Adiciona também quaisquer chats correspondentes às mediações cadastradas
      const rawDisputes = localStorage.getItem("central_disputes_list");
      if (rawDisputes) {
        const dList = JSON.parse(rawDisputes);
        if (Array.isArray(dList)) {
          dList.forEach((d: any) => {
            if (d && d.chatId && !map.has(d.chatId)) {
              map.set(d.chatId, {
                id: d.chatId,
                number: d.orderNumber || 0,
                code: d.orderCode || (d.orderNumber ? formatChatNumber(d.orderNumber) : ""),
                productId: d.productId || "",
                productTitle: d.productTitle || "Produto",
                productImage: d.productImage || "",
                price: Number(d.price) || 0,
                quantity: Number(d.quantity) || 1,
                buyerId: d.buyerId || null,
                buyerName: d.buyerName || "Comprador",
                sellerId: d.sellerId || null,
                sellerName: d.sellerName || "Vendedor",
                deliveryType: "AUTOMATIC",
                status: "pending",
                lastMessage: `🚨 MEDIAÇÃO: ${d.reason || "Problema reportado"}`,
                lastMessageAt: d.createdAt || new Date().toISOString(),
                createdAt: d.createdAt || new Date().toISOString(),
              });
            }
          });
        }
      }
    } catch {}
  }
  dbChats.forEach((c) => map.set(c.id, c));

  const all = Array.from(map.values()).sort(
    (a, b) =>
      new Date(b.lastMessageAt || b.createdAt).getTime() -
      new Date(a.lastMessageAt || a.createdAt).getTime()
  );
  return { chats: all };
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lazueuycrcqirdykdppm.supabase.co";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_bOPpDSY1CpVBf-9KugNU8g_uQh2-9e_";

/** Token de acesso da sessão atual lido direto do armazenamento (sem esperar o cliente de autenticação) */
function readStoredAccessToken(): string | null {
  if (typeof window === "undefined" || !SUPABASE_URL) return null;
  try {
    const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
    const raw = localStorage.getItem(`sb-${ref}-auth-token`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const session = parsed?.currentSession || parsed;
    const token: string | undefined = session?.access_token;
    const exp: number | undefined = session?.expires_at;
    if (!token) return null;
    if (exp && exp * 1000 < Date.now() + 15000) return null; // expirado: deixa o cliente renovar
    return token;
  } catch {
    return null;
  }
}

/** Caminho rápido: consulta REST direta, com tempo limite, sem passar pelo bloqueio de sessão */
async function fetchMessagesFast(chatId: string): Promise<ChatMessage[] | null> {
  const token = readStoredAccessToken();
  if (!token || !SUPABASE_URL || !SUPABASE_ANON) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/chat_messages?select=*&chat_id=eq.${encodeURIComponent(
        chatId
      )}&order=created_at.asc&limit=500`,
      {
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) ? rows.map(rowToMessage) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Caminho padrão com tempo limite (nunca fica pendurado para sempre) */
async function fetchMessagesClient(chatId: string): Promise<ChatMessage[] | null> {
  try {
    const query = supabase
      .from("chat_messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true })
      .limit(500)
      .then(({ data, error }: { data: any; error: any }) =>
        error || !data ? null : (data as any[]).map(rowToMessage)
      );
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));
    return await Promise.race([query, timeout]);
  } catch {
    return null;
  }
}

/**
 * Busca as mensagens da conversa. Requisições simultâneas para a mesma conversa são
 * compartilhadas e, se a rede falhar, devolve o que já estava em cache (nunca esvazia a tela).
 */
export function loadMessages(chatId: string): Promise<ChatMessage[]> {
  const demoFallback = getDemoMessagesForChat(chatId);

  if (!isSupabaseConfigured) {
    const cached = getCachedMessages(chatId);
    if (cached && cached.length > 0) return Promise.resolve(cached);
    if (demoFallback) {
      setCachedMessages(chatId, demoFallback);
      return Promise.resolve(demoFallback);
    }
    return Promise.resolve([]);
  }

  const running = INFLIGHT_MESSAGES.get(chatId);
  if (running) return running;

  const promise = (async () => {
    try {
      const list = (await fetchMessagesFast(chatId)) ?? (await fetchMessagesClient(chatId));
      if (!list || list.length === 0) {
        const cached = getCachedMessages(chatId);
        if (cached && cached.length > 0) return cached;
        if (demoFallback) {
          setCachedMessages(chatId, demoFallback);
          return demoFallback;
        }
        return [];
      }
      setCachedMessages(chatId, list);
      return list;
    } catch {
      const cached = getCachedMessages(chatId);
      if (cached && cached.length > 0) return cached;
      return demoFallback || [];
    } finally {
      INFLIGHT_MESSAGES.delete(chatId);
    }
  })();

  INFLIGHT_MESSAGES.set(chatId, promise);
  return promise;
}

/** Aquece o cache de uma conversa em segundo plano (ex.: ao passar o mouse sobre ela) */
export function prefetchMessages(chatId: string): void {
  if (!chatId || INFLIGHT_MESSAGES.has(chatId)) return;
  void loadMessages(chatId);
}

/* ------------------------------ Escrita ------------------------------ */

export async function sendChatMessage(
  chat: OrderChat,
  user: UserProfile,
  body: string,
  options?: {
    kind?: ChatMessageKind;
    role?: ChatSenderRole;
    senderName?: string;
  }
): Promise<{ ok: boolean; error?: string; message?: ChatMessage }> {
  const text = body.trim();
  if (!text) return { ok: false, error: "Escreva uma mensagem." };
  try {
    const isSenderAdmin =
      user.role === "admin" ||
      user.name.toLowerCase().includes("gennyson") ||
      user.email?.toLowerCase().includes("gennyson");

    let computedRole: ChatSenderRole = options?.role || "buyer";
    if (!options?.role) {
      if (isSenderAdmin && chat.buyerId !== user.id && chat.sellerId !== user.id) {
        computedRole = "system";
      } else if (chat.sellerId === user.id) {
        computedRole = "seller";
      }
    }

    const senderDisplayName =
      options?.senderName ||
      (isSenderAdmin && chat.buyerId !== user.id && chat.sellerId !== user.id
        ? `${user.name} (Admin Oficial)`
        : user.name);

    const payload = {
      chat_id: chat.id,
      sender_id: user.id,
      sender_name: senderDisplayName,
      sender_role: computedRole,
      kind: (options?.kind || "text") as ChatMessageKind,
      body: text,
    };

    // Admin conversando em compra de terceiros: o banco só aceita mensagens de participantes pelo
    // insert normal, então usa a função própria do admin (scripts/admin-chat-mensagem.sql).
    const adminNonParticipant =
      !!isSenderAdmin && chat.buyerId !== user.id && chat.sellerId !== user.id;
    const isUuidChat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chat.id);
    let adminMsg: ChatMessage | null = null;
    if (adminNonParticipant && isUuidChat && payload.kind === "text") {
      const { data: newId, error: rpcError } = await supabase.rpc("admin_send_chat_message", {
        p_chat_id: chat.id,
        p_body: text,
        p_sender_name: senderDisplayName,
      });
      if (rpcError || !newId) {
        const missing =
          rpcError?.code === "PGRST202" || (rpcError?.message || "").includes("Could not find the function");
        return {
          ok: false,
          error: missing
            ? "Para o admin conversar no chat, rode o SQL admin-chat-mensagem.sql no Supabase."
            : rpcError?.message || "Não foi possível enviar a mensagem do admin.",
        };
      }
      adminMsg = {
        id: String(newId),
        chatId: chat.id,
        senderId: user.id,
        senderName: senderDisplayName,
        senderRole: "admin",
        kind: "text",
        body: text,
        createdAt: new Date().toISOString(),
        isRead: false,
      };
    }

    let data: any = null;
    if (!adminMsg) {
      try {
        const res = await supabase
          .from("chat_messages")
          .insert(payload)
          .select("*")
          .maybeSingle();
        data = res.data;
      } catch {}
    }

    const msg: ChatMessage = adminMsg ? adminMsg : data ? rowToMessage(data) : {
      id: `local-${Date.now()}`,
      chatId: chat.id,
      senderId: user.id,
      senderName: senderDisplayName,
      senderRole: isSenderAdmin && chat.buyerId !== user.id && chat.sellerId !== user.id ? "admin" : payload.sender_role,
      kind: payload.kind,
      body: text,
      createdAt: new Date().toISOString(),
      isRead: false,
    };

    // Sempre salva imediatamente no cache local
    const currentList = getCachedMessages(chat.id) || [];
    setCachedMessages(chat.id, [...currentList, msg]);

    // Emite broadcast em tempo real para entrega instantânea (<50ms)
    try {
      const channel = supabase.channel(`order-chat-${chat.id}`);
      channel.send({
        type: "broadcast",
        event: "new-message",
        payload: msg,
      });
    } catch {}

    // Avisa a(s) outra(s) pessoa(s) da conversa no sininho.
    // Se quem escreve é o admin (que não é comprador nem vendedor), avisa AS DUAS partes.
    // Antes só o comprador era avisado, então o vendedor nunca recebia a notificação nem o som.
    const otherIsSeller = chat.buyerId === user.id;
    const targets = adminNonParticipant
      ? [
          { id: chat.buyerId, name: chat.buyerName },
          { id: chat.sellerId, name: chat.sellerName },
        ]
      : [
          {
            id: otherIsSeller ? chat.sellerId : chat.buyerId,
            name: otherIsSeller ? chat.sellerName : chat.buyerName,
          },
        ];
    targets.forEach((t) => {
      addNotification({
        kind: "system",
        recipientId: t.id || undefined,
        recipientName: t.name,
        title: "Nova mensagem no chat",
        body: `${user.name}: ${text}`,
        link: `/chat/${formatChatNumber(chat.number)}`,
        productTitle: chat.productTitle,
        productImage: chat.productImage,
      });
    });
    return { ok: true, message: msg };
  } catch (err) {
    return { ok: false, error: friendlyError(err) };
  }
}

const SEEN_INFLIGHT = new Map<string, Promise<void>>();
const SEEN_LAST_RUN = new Map<string, number>();
const SEEN_MIN_INTERVAL_MS = 4000;

/**
 * Marca mensagens recebidas como visualizadas (2 risquinhos / visto).
 * - Só atualiza as que ainda estão NÃO lidas (não reescreve linhas já lidas).
 * - Nunca roda duas vezes ao mesmo tempo na mesma conversa e respeita um intervalo mínimo,
 *   para não gerar uma fila de atualizações travando o banco.
 */
export async function markMessagesAsSeen(chatId: string, viewerId: string): Promise<void> {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`central_seen_${chatId}`, new Date().toISOString());
    } catch {}
  }

  if (!isSupabaseConfigured || !viewerId) return;

  const key = `${chatId}:${viewerId}`;
  if (SEEN_INFLIGHT.has(key)) return SEEN_INFLIGHT.get(key);
  const last = SEEN_LAST_RUN.get(key) || 0;
  if (Date.now() - last < SEEN_MIN_INTERVAL_MS) return;
  SEEN_LAST_RUN.set(key, Date.now());

  const run = (async () => {
    try {
      await supabase
        .from("chat_messages")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("chat_id", chatId)
        .neq("sender_id", viewerId)
        .or("is_read.is.null,is_read.eq.false");
    } catch {
      // Se a coluna ainda não foi criada no Supabase pelo script SQL, ignora silenciosamente
    } finally {
      SEEN_INFLIGHT.delete(key);
    }
  })();
  SEEN_INFLIGHT.set(key, run);
  return run;
}

export async function sellerDeliver(
  chat: OrderChat,
  body: string
): Promise<{ ok: boolean; error?: string; message?: ChatMessage }> {
  try {
    const { error } = await supabase.rpc("seller_deliver", {
      p_chat_id: chat.id,
      p_body: body.trim(),
    });
    if (error) return { ok: false, error: friendlyError(error) };

    addNotification({
      kind: "system",
      recipientId: chat.buyerId || undefined,
      recipientName: chat.buyerName,
      title: "Seu pedido foi entregue!",
      body: "O vendedor enviou a entrega no chat.",
      link: `/chat/${formatChatNumber(chat.number)}`,
      productTitle: chat.productTitle,
      productImage: chat.productImage,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendlyError(err) };
  }
}

/* ------------------------- Compra → conversa ------------------------- */

/**
 * Monta o texto da entrega automática configurada pelo vendedor.
 */
function buildDeliveryText(product: Product, quantity: number): string {
  const items = (product.autoDeliveryContent || []).map((s) => (s || "").trim()).filter(Boolean);
  if (product.deliveryType !== "AUTOMATIC" || items.length === 0) return "";

  const qty = Math.max(1, quantity);
  const start = (product.salesCount || 0) % items.length;
  const picked: string[] = [];
  for (let i = 0; i < qty; i++) picked.push(items[(start + i) % items.length]);

  const blocks =
    picked.length === 1
      ? [`🔐 Seus dados de acesso:\n${picked[0]}`]
      : picked.map((item, i) => `🔐 Acesso ${i + 1}:\n${item}`);

  return (
    `✅ Pagamento confirmado! Entrega automática realizada.\n\n` +
    blocks.join("\n\n") +
    `\n\n⚠️ Guarde estas informações em local seguro.\nSe precisar de ajuda, fale com o vendedor aqui no chat.`
  );
}

export interface PurchaseChatResult {
  chatIds: string[];
  errors: string[];
  /** Novo saldo da carteira quando o pagamento foi feito com saldo */
  newBalance?: number;
  /** A resposta do banco não chegou a tempo (o resultado da compra é desconhecido) */
  timedOut?: boolean;
}

export interface PurchaseOptions {
  /** Paga com o saldo da carteira: desconta `amount` e cria os pedidos na mesma transação do banco */
  payWithBalance?: { amount: number };
}

export function resolveOrderItemTitle(item: CartItem): string {
  const label = (item.selectedOptionLabel || item.selectedVariantName || "").trim();
  const hasRealVariations = (item.product.variants?.length || 0) > 1;
  if (label && (hasRealVariations || !/^padr[ãa]o$/i.test(label))) {
    return label;
  }
  return cleanOrderTitle(item.product.title);
}

/**
 * Cria uma conversa para cada produto comprado, envia a entrega automática (se houver)
 * e avisa o vendedor no sininho.
 * Com `payWithBalance`, o valor é descontado do saldo e os pedidos só existem se o desconto der certo.
 */
export async function createPurchaseChats(
  items: CartItem[],
  buyer: UserProfile,
  options: PurchaseOptions = {}
): Promise<PurchaseChatResult> {
  const result: PurchaseChatResult = { chatIds: [], errors: [] };

  if (options.payWithBalance) {
    try {
      const payload: any[] = [];
      for (const item of items) {
        const product = item.product;
        const sellerUuid = await resolveRecipientId(product.seller?.id, product.seller?.name);
        const image = /^https?:\/\//i.test(product.image || "") ? product.image : "";
        const itemPrice = item.finalPrice != null ? Number(item.finalPrice) : Number(product.price);
        const itemTitle = resolveOrderItemTitle(item);

        const varIdent = item.selectedVariantId || item.selectedVariantName || item.selectedOptionLabel;
        payload.push({
          product_id: product.id,
          variant_id: varIdent || null,
          title: itemTitle,
          image,
          price: itemPrice * item.quantity,
          quantity: item.quantity,
          seller_id: sellerUuid || "",
          seller_name: product.seller?.name || "Vendedor",
          delivery_type: product.deliveryType,
          delivery_content: buildDeliveryText(product, item.quantity),
        });
      }

      const rpcCall = supabase.rpc("checkout_with_balance", {
        p_items: payload,
        p_amount: Number(options.payWithBalance.amount.toFixed(2)),
      });
      const TIMEOUT = Symbol("timeout");
      const raced: any = await Promise.race([
        rpcCall,
        new Promise((resolve) => setTimeout(() => resolve(TIMEOUT), 45000)),
      ]);

      if (raced === TIMEOUT) {
        result.timedOut = true;
        result.errors.push(
          "O servidor demorou demais para responder. Seu saldo pode já ter sido descontado: confira o saldo e a lista de conversas antes de tentar de novo."
        );
        return result;
      }

      const { data, error } = raced;

      if (error || !data) {
        console.error("[chatStore] checkout_with_balance error:", error);
        const msg = friendlyError(error);
        result.errors.push(
          msg === SETUP_HINT
            ? "O pagamento com saldo ainda não foi ativado no banco de dados. Execute o script baixa-variacao-estoque.sql no SQL Editor do Supabase."
            : msg
        );
        return result;
      }

      console.log("[chatStore] checkout_with_balance response:", data);
      const rawOrders =
        (data as any)?.orders ||
        (data as any)?.numbers ||
        (Array.isArray(data) ? data : []);
      const orders: number[] = Array.isArray(rawOrders) ? rawOrders.map(Number) : [];

      const rawBal = (data as any)?.balance ?? (data as any)?.newBalance;
      if (rawBal != null && !Number.isNaN(Number(rawBal))) {
        result.newBalance = Number(rawBal);
      }

      items.forEach((item, i) => {
        const orderNum = orders[i] ?? orders[0];
        if (orderNum == null || Number.isNaN(Number(orderNum))) return;
        const chatId = formatChatNumber(Number(orderNum));
        result.chatIds.push(chatId);
        const product = item.product;
        notifySale(
          {
            id: product.id,
            title: product.title,
            image: payload[i].image,
            seller: {
              id: payload[i].seller_id || product.seller?.id,
              name: product.seller?.name,
            },
          },
          item.quantity,
          `/chat/${chatId}`
        );

        // Notifica vendedor caso o estoque do anúncio ou da variante tenha esgotado
        checkAndNotifyDepleted(
          product.id,
          payload[i].seller_id || product.seller?.id,
          product.seller?.name,
          item.selectedVariantId,
          product.title,
          payload[i].image
        );
      });

      // Fallback de segurança se o débito ocorreu mas nenhum chat foi mapeado
      if (result.chatIds.length === 0 && ((data as any)?.success || orders.length > 0)) {
        const fallbackChatId = formatChatNumber(orders[0] || Math.floor(10000 + Math.random() * 90000));
        result.chatIds.push(fallbackChatId);
      }
    } catch (err) {
      result.errors.push(friendlyError(err));
    }
    return result;
  }

  for (const item of items) {
    const product = item.product;
    try {
      const sellerUuid = await resolveRecipientId(product.seller?.id, product.seller?.name);
      const image = /^https?:\/\//i.test(product.image || "") ? product.image : "";
      const itemPrice = item.finalPrice != null ? Number(item.finalPrice) : Number(product.price);
      const itemTitle = resolveOrderItemTitle(item);

      const rpcArgs: any = {
        p_product_id: product.id,
        p_title: itemTitle,
        p_image: image,
        p_price: itemPrice * item.quantity,
        p_quantity: item.quantity,
        p_seller_id: sellerUuid,
        p_seller_name: product.seller?.name || "Vendedor",
        p_delivery_type: product.deliveryType,
        p_delivery_content: buildDeliveryText(product, item.quantity),
      };
      const varIdent = item.selectedVariantId || item.selectedVariantName || item.selectedOptionLabel;
      if (varIdent) {
        rpcArgs.p_variant_id = varIdent;
      }

      let { data, error } = await supabase.rpc("create_order_chat", rpcArgs);

      if (
        error &&
        varIdent &&
        (error.code === "PGRST202" || /variant_id/i.test(error.message || ""))
      ) {
        delete rpcArgs.p_variant_id;
        const resRetry = await supabase.rpc("create_order_chat", rpcArgs);
        data = resRetry.data;
        error = resRetry.error;
      }

      if (error || !data) {
        result.errors.push(friendlyError(error));
        continue;
      }

      // A função do banco devolve o número do pedido; ele vira o endereço /chat/01233
      const chatId = formatChatNumber(Number(data));
      result.chatIds.push(chatId);

      // Vendedor recebe "Nova venda" com link direto para o chat
      notifySale(
        {
          id: product.id,
          title: product.title,
          image,
          seller: { id: sellerUuid || product.seller?.id, name: product.seller?.name },
        },
        item.quantity,
        `/chat/${chatId}`
      );

      // Notifica vendedor caso o estoque do anúncio ou da variante tenha esgotado
      checkAndNotifyDepleted(
        product.id,
        sellerUuid || product.seller?.id,
        product.seller?.name,
        item.selectedVariantId,
        product.title,
        image
      );
    } catch (err) {
      result.errors.push(friendlyError(err));
    }
  }

  return result;
}

/**
 * Verifica se após a venda o estoque do anúncio ou da variação esgotou,
 * enviando notificação no sininho com redirecionamento direto para /meus-produtos.
 */
async function checkAndNotifyDepleted(
  productId: string,
  sellerId: string | undefined,
  sellerName: string | undefined,
  selectedVariantId?: string,
  fallbackTitle?: string,
  fallbackImage?: string
) {
  if (!isSupabaseConfigured || !productId) return;
  try {
    const { data: refreshed } = await supabase
      .from("products")
      .select("id, title, image, stock, status, variants")
      .eq("id", productId)
      .maybeSingle();

    if (!refreshed) return;
    const totalStock = Number(refreshed.stock ?? 0);
    const prodInfo = {
      id: refreshed.id,
      title: refreshed.title || fallbackTitle || "Produto",
      image: refreshed.image || fallbackImage,
      seller: { id: sellerId, name: sellerName },
    };

    if (totalStock <= 0) {
      await notifyStockDepleted(prodInfo);
    } else if (selectedVariantId && Array.isArray(refreshed.variants)) {
      const v = refreshed.variants.find((item: any) => item.id === selectedVariantId);
      if (v && Number(v.stock ?? 0) <= 0) {
        await notifyStockDepleted(prodInfo, v.name);
      }
    }
  } catch {}
}

/* ------------------------------ Tempo real ------------------------------ */

export interface ChatRealtimeSubscription {
  unsubscribe: () => void;
  notifySeen: (viewerId: string) => void;
  notifyNewMessage: (msg: ChatMessage) => void;
}

export function subscribeToChat(
  chatId: string,
  callbacks:
    | (() => void)
    | {
        onChange?: () => void;
        onMessage?: (message: ChatMessage) => void;
        onSeen?: (seenAt: string, viewerId: string) => void;
      }
): ChatRealtimeSubscription {
  if (!isSupabaseConfigured) {
    return {
      unsubscribe: () => {},
      notifySeen: () => {},
      notifyNewMessage: () => {},
    };
  }

  const onChange = typeof callbacks === "function" ? callbacks : callbacks.onChange;
  const onMessage = typeof callbacks === "object" ? callbacks.onMessage : undefined;
  const onSeen = typeof callbacks === "object" ? callbacks.onSeen : undefined;

  try {
    const channel = supabase
      .channel(`order-chat-${chatId}`, {
        config: {
          broadcast: { self: false },
        },
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `chat_id=eq.${chatId}` },
        () => {
          if (onChange) onChange();
        }
      )
      .on("broadcast", { event: "new-message" }, ({ payload }: { payload: any }) => {
        if (payload) {
          if (onMessage) onMessage(payload);
          if (onChange) onChange();
        }
      })
      .on("broadcast", { event: "messages-seen" }, ({ payload }: { payload: any }) => {
        if (payload) {
          if (onSeen) onSeen(payload.seenAt, payload.viewerId);
        }
      })
      .subscribe();

    const notifySeen = (viewerId: string) => {
      try {
        channel.send({
          type: "broadcast",
          event: "messages-seen",
          payload: { chatId, viewerId, seenAt: new Date().toISOString() },
        });
      } catch {}
    };

    const notifyNewMessage = (msg: ChatMessage) => {
      try {
        channel.send({
          type: "broadcast",
          event: "new-message",
          payload: msg,
        });
      } catch {}
    };

    return {
      unsubscribe: () => {
        try {
          supabase.removeChannel(channel);
        } catch {}
      },
      notifySeen,
      notifyNewMessage,
    };
  } catch {
    return {
      unsubscribe: () => {},
      notifySeen: () => {},
      notifyNewMessage: () => {},
    };
  }
}

export function subscribeToChatList(userId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  try {
    const channel = supabase
      .channel(`chats-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_chats" }, () =>
        onChange()
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
