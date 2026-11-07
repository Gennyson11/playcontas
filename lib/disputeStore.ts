"use client";

import { UserProfile } from "@/types";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { addNotification } from "./notificationStore";
import { sendChatMessage, OrderChat, ChatMessage, getCachedMessages, setCachedMessages } from "./chatStore";

export interface OrderDispute {
  id: string;
  chatId: string;
  orderNumber: number;
  orderCode: string;
  productId: string;
  productTitle: string;
  productImage: string;
  price: number;
  quantity: number;
  buyerId: string;
  buyerName: string;
  buyerEmail?: string;
  sellerId: string;
  sellerName: string;
  sellerEmail?: string;
  reason: string;
  status: "open" | "resolved_seller" | "resolved_refund" | "withdrawn";
  /** Quem abriu a mediação (padrão: comprador) */
  openedBy?: "buyer" | "seller";
  balanceBlocked: boolean;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
}

const LS_DISPUTES_KEY = "central_disputes_list";

const INITIAL_DEMO_DISPUTES: OrderDispute[] = [];

/** Carrega todas as disputas cadastradas (LocalStorage + fallback) */
export function getStoredDisputes(): OrderDispute[] {
  if (typeof window === "undefined") return INITIAL_DEMO_DISPUTES;
  try {
    const raw = localStorage.getItem(LS_DISPUTES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((d: OrderDispute) => {
          let sellerEmail = d.sellerEmail;
          if (!sellerEmail) {
            if (d.sellerId === "881a8911-8eaa-43ca-9e0b-be6a68b51f48" || d.sellerName?.toLowerCase() === "kilr") {
              sellerEmail = "kilr@gmail.com";
            } else if (
              d.sellerName?.toLowerCase().includes("gennyson") ||
              d.sellerId?.toLowerCase().includes("gennyson") ||
              d.sellerId === "bb25d258-3152-422b-aa04-7bd34e8a5927"
            ) {
              sellerEmail = "gennysonmarinhodemacedo@gmail.com";
            } else if (d.sellerName?.toLowerCase().includes("nexus")) {
              sellerEmail = "contato@nexusgames.com.br";
            } else if (d.sellerName?.toLowerCase().includes("buscaninja") || d.sellerId === "fcaba04d-92ec-45b3-a626-013318cc0f8c") {
              sellerEmail = "jovitoolsbr@gmail.com";
            }
          }
          let buyerEmail = d.buyerEmail;
          if (!buyerEmail) {
            if (d.buyerName?.toLowerCase().includes("buscaninja") || d.buyerId === "fcaba04d-92ec-45b3-a626-013318cc0f8c") {
              buyerEmail = "jovitoolsbr@gmail.com";
            } else if (d.buyerId === "881a8911-8eaa-43ca-9e0b-be6a68b51f48" || d.buyerName?.toLowerCase() === "kilr") {
              buyerEmail = "kilr@gmail.com";
            }
          }
          return {
            ...d,
            buyerName: d.buyerName ? d.buyerName.replace(/jovizeira/gi, "BuscaNinja") : d.buyerName,
            sellerName: d.sellerName ? d.sellerName.replace(/jovizeira/gi, "BuscaNinja") : d.sellerName,
            sellerEmail,
            buyerEmail,
          };
        }).filter((d: any) => d.id !== "disp-00013" && d.id !== "disp-00010");
      }
    }
    return [];
  } catch {
    return [];
  }
}

const DISPUTES_CHANNEL_NAME = "central-disputes-realtime";

/** Salva disputas no LocalStorage e dispara evento para atualizar a interface em tempo real */
export function saveStoredDisputes(disputes: OrderDispute[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_DISPUTES_KEY, JSON.stringify(disputes));
    window.dispatchEvent(new Event("central_disputes_changed"));

    if (isSupabaseConfigured) {
      try {
        const channel = supabase.channel(DISPUTES_CHANNEL_NAME);
        channel.send({
          type: "broadcast",
          event: "dispute-changed",
          payload: { timestamp: Date.now() },
        });
      } catch {}
    }
  } catch {}
}

/** Inscreve-se para receber atualizações de disputas em tempo real (mesma aba, outras abas e outros aparelhos) */
export function subscribeToDisputes(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onLocal = () => callback();
  window.addEventListener("central_disputes_changed", onLocal);
  const onStorage = (e: StorageEvent) => {
    if (e.key === LS_DISPUTES_KEY) callback();
  };
  window.addEventListener("storage", onStorage);

  let realtimeChannel: any = null;
  if (isSupabaseConfigured) {
    try {
      realtimeChannel = supabase
        .channel(DISPUTES_CHANNEL_NAME)
        .on("broadcast", { event: "dispute-changed" }, () => {
          callback();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "order_chats" }, () => {
          callback();
        })
        .subscribe();
    } catch {}
  }

  // Intervalo de segurança para checagem contínua em segundo plano
  const interval = setInterval(callback, 7000);

  return () => {
    window.removeEventListener("central_disputes_changed", onLocal);
    window.removeEventListener("storage", onStorage);
    if (interval) clearInterval(interval);
    if (realtimeChannel && isSupabaseConfigured) {
      try {
        supabase.removeChannel(realtimeChannel);
      } catch {}
    }
  };
}

/** Verifica se um chat específico possui disputa ativa com saldo bloqueado */
export function getDisputeForChat(chatId: string, orderNumber?: number): OrderDispute | null {
  const list = getStoredDisputes();
  return (
    list.find(
      (d) =>
        d.chatId === chatId ||
        (orderNumber != null && d.orderNumber === orderNumber) ||
        (d.orderCode && chatId.includes(d.orderCode))
    ) || null
  );
}

/** Registra um novo problema reportado (pelo comprador ou pelo vendedor): bloqueia o saldo e notifica o admin */
export async function createDispute(
  chat: OrderChat,
  buyer: UserProfile,
  reason: string,
  reporterRole: "buyer" | "seller" = "buyer"
): Promise<{ ok: boolean; dispute?: OrderDispute; error?: string }> {
  try {
    const list = getStoredDisputes();
    const existing = list.find((d) => d.chatId === chat.id || d.orderNumber === chat.number);
    if (existing && existing.status === "open") {
      return { ok: false, error: "Já existe uma mediação em andamento para esta compra." };
    }

    const bySeller = reporterRole === "seller";
    let buyerEmail: string | undefined = bySeller ? undefined : buyer.email;
    let sellerEmail: string | undefined = bySeller ? buyer.email : undefined;

    if (!sellerEmail && chat.sellerId) {
      if (chat.sellerId === "881a8911-8eaa-43ca-9e0b-be6a68b51f48" || chat.sellerName?.toLowerCase() === "kilr") {
        sellerEmail = "kilr@gmail.com";
      } else if (
        chat.sellerName?.toLowerCase().includes("gennyson") ||
        chat.sellerId?.toLowerCase().includes("gennyson") ||
        chat.sellerId === "bb25d258-3152-422b-aa04-7bd34e8a5927"
      ) {
        sellerEmail = "gennysonmarinhodemacedo@gmail.com";
      } else if (chat.sellerName?.toLowerCase().includes("buscaninja") || chat.sellerId === "fcaba04d-92ec-45b3-a626-013318cc0f8c") {
        sellerEmail = "jovitoolsbr@gmail.com";
      } else if (isSupabaseConfigured) {
        try {
          const { data: prof } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", chat.sellerId)
            .maybeSingle();
          if (prof?.email) sellerEmail = prof.email;
        } catch {}
      }
    }

    if (!buyerEmail && chat.buyerId) {
      if (chat.buyerName?.toLowerCase().includes("buscaninja") || chat.buyerId === "fcaba04d-92ec-45b3-a626-013318cc0f8c") {
        buyerEmail = "jovitoolsbr@gmail.com";
      } else if (chat.buyerId === "881a8911-8eaa-43ca-9e0b-be6a68b51f48" || chat.buyerName?.toLowerCase() === "kilr") {
        buyerEmail = "kilr@gmail.com";
      } else if (isSupabaseConfigured) {
        try {
          const { data: prof } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", chat.buyerId)
            .maybeSingle();
          if (prof?.email) buyerEmail = prof.email;
        } catch {}
      }
    }

    const newDispute: OrderDispute = {
      id: `disp-${chat.code || chat.number || Date.now()}`,
      chatId: chat.id,
      orderNumber: chat.number,
      orderCode: chat.code || String(chat.number).padStart(5, "0"),
      productId: chat.productId,
      productTitle: chat.productTitle,
      productImage: chat.productImage,
      price: chat.price,
      quantity: chat.quantity,
      buyerId: bySeller ? chat.buyerId || "desconhecido" : buyer.id,
      buyerName: bySeller ? chat.buyerName : buyer.name,
      buyerEmail,
      sellerId: chat.sellerId || "desconhecido",
      sellerName: chat.sellerName,
      sellerEmail,
      reason: reason.trim(),
      status: "open",
      openedBy: reporterRole,
      balanceBlocked: true,
      createdAt: new Date().toISOString(),
    };

    const updated = [newDispute, ...list.filter((d) => d.id !== newDispute.id)];
    saveStoredDisputes(updated);

    // Envia mensagem especial de mediação no chat
    const systemNotice = `🚨 MEDIAÇÃO ACIONADA · SALDO BLOQUEADO\n\n` +
      `🔒 Saldo Retido: R$ ${chat.price.toFixed(2).replace(".", ",")}\n` +
      `👤 Solicitante: ${buyer.name} (${bySeller ? "Vendedor" : "Comprador"})\n` +
      `📋 Motivo: "${reason.trim()}"\n\n` +
      `A moderação oficial do PlayContas foi acionada. O saldo desta venda encontra-se retido preventivamente. Ambas as partes devem apresentar esclarecimentos e comprovantes diretamente nesta conversa. O caso será analisado por um administrador para liberação ou reembolso.`;

    // IMPORTANTE: o banco (RLS) só aceita mensagens do tipo "text" enviadas pelos participantes.
    // Antes a mediação ia como "system" e era recusada em silêncio, ficando só no navegador do
    // comprador (o vendedor nunca via). Agora vai como "text" e o chat reconhece o card de mediação
    // pelo conteúdo da mensagem ("MEDIAÇÃO ACIONADA").
    // O sendChatMessage já grava a mensagem no cache local e faz o broadcast em tempo real.
    try {
      await sendChatMessage(chat, buyer, systemNotice, {
        kind: "text",
        role: "system",
        senderName: "Central de Mediação Oficial",
      });
    } catch {}

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("central_messages_changed", { detail: { chatId: chat.id } }));
    }

    // Notifica os administradores no sininho
    addNotification({
      kind: "system",
      title: "🚨 Problema Reportado em Pedido",
      body: `${buyer.name} reportou um problema no pedido #${chat.code}: "${reason.slice(0, 70)}..."`,
      link: `/chat/${chat.code}`,
      productTitle: chat.productTitle,
      productImage: chat.productImage,
    });

    return { ok: true, dispute: newDispute };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Não foi possível registrar o problema." };
  }
}

/** Quem abriu a mediação (comprador ou vendedor) retira o problema: encerra a mediação e libera o saldo da venda */
export async function withdrawDispute(
  chat: OrderChat,
  buyer: UserProfile,
  role: "buyer" | "seller" = "buyer"
): Promise<{ ok: boolean; error?: string }> {
  try {
    const roleLabel = role === "seller" ? "vendedor" : "comprador";
    const list = getStoredDisputes();
    const dispute = list.find(
      (d) => (d.chatId === chat.id || d.orderNumber === chat.number) && d.status === "open"
    );

    if (dispute) {
      const updated = list.map((d) =>
        d.id === dispute.id
          ? {
              ...d,
              status: "withdrawn" as const,
              balanceBlocked: false,
              resolvedAt: new Date().toISOString(),
              resolvedBy: buyer.name || roleLabel,
              resolutionNotes: `Problema retirado pelo ${roleLabel}.`,
            }
          : d
      );
      saveStoredDisputes(updated);
    }

    const notice =
      `✅ MEDIAÇÃO CONCLUÍDA · PROBLEMA RETIRADO PELO ${roleLabel.toUpperCase()}\n\n` +
      `${buyer.name} retirou o problema reportado. A mediação foi encerrada e o saldo ` +
      `(R$ ${chat.price.toFixed(2).replace(".", ",")}) não está mais retido por este motivo.`;

    // Vai como "text" (único tipo aceito pelo banco para participantes), igual à abertura da mediação
    const res = await sendChatMessage(chat, buyer, notice, {
      kind: "text",
      role: "system",
      senderName: "Central de Mediação Oficial",
    });
    if (!res.ok) return { ok: false, error: res.error };

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("central_messages_changed", { detail: { chatId: chat.id } }));
    }

    // Avisa os administradores no sininho
    addNotification({
      kind: "system",
      title: `Problema retirado pelo ${roleLabel}`,
      body: `${buyer.name} retirou o problema reportado no pedido #${chat.code}.`,
      link: `/chat/${chat.code}`,
      productTitle: chat.productTitle,
      productImage: chat.productImage,
    });

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Não foi possível retirar o problema." };
  }
}

/**
 * Garante que existe um registro de mediação para este chat NESTE navegador.
 * A mediação é gravada no navegador de quem reportou; o admin (outro navegador) só enxerga a
 * mensagem no chat. Aqui o registro é reconstruído a partir do chat para o admin conseguir decidir.
 */
export function ensureDisputeFromChat(chat: OrderChat, reasonHint?: string): OrderDispute {
  const list = getStoredDisputes();
  const existing = list.find(
    (d) => d.chatId === chat.id || (chat.number != null && d.orderNumber === chat.number)
  );
  if (existing) return existing;

  let sellerEmail: string | undefined;
  if (chat.sellerId === "881a8911-8eaa-43ca-9e0b-be6a68b51f48" || chat.sellerName?.toLowerCase() === "kilr") {
    sellerEmail = "kilr@gmail.com";
  } else if (
    chat.sellerName?.toLowerCase().includes("gennyson") ||
    chat.sellerId?.toLowerCase().includes("gennyson") ||
    chat.sellerId === "bb25d258-3152-422b-aa04-7bd34e8a5927"
  ) {
    sellerEmail = "gennysonmarinhodemacedo@gmail.com";
  } else if (chat.sellerName?.toLowerCase().includes("buscaninja") || chat.sellerId === "fcaba04d-92ec-45b3-a626-013318cc0f8c") {
    sellerEmail = "jovitoolsbr@gmail.com";
  }

  let buyerEmail: string | undefined;
  if (chat.buyerName?.toLowerCase().includes("buscaninja") || chat.buyerId === "fcaba04d-92ec-45b3-a626-013318cc0f8c") {
    buyerEmail = "jovitoolsbr@gmail.com";
  } else if (chat.buyerId === "881a8911-8eaa-43ca-9e0b-be6a68b51f48" || chat.buyerName?.toLowerCase() === "kilr") {
    buyerEmail = "kilr@gmail.com";
  }

  const rebuilt: OrderDispute = {
    id: `disp-${chat.code || chat.number || Date.now()}`,
    chatId: chat.id,
    orderNumber: chat.number,
    orderCode: chat.code || String(chat.number).padStart(5, "0"),
    productId: chat.productId,
    productTitle: chat.productTitle,
    productImage: chat.productImage,
    price: chat.price,
    quantity: chat.quantity,
    buyerId: chat.buyerId || "desconhecido",
    buyerName: chat.buyerName,
    buyerEmail,
    sellerId: chat.sellerId || "desconhecido",
    sellerName: chat.sellerName,
    sellerEmail,
    reason: (reasonHint || "Problema reportado pelo comprador.").trim(),
    status: "open",
    balanceBlocked: true,
    createdAt: new Date().toISOString(),
  };
  saveStoredDisputes([rebuilt, ...list]);
  return rebuilt;
}

/** Resolve a disputa pelo Administrador: libera o saldo para o vendedor ou reembolsa o comprador */
export async function resolveDispute(
  disputeId: string,
  decision: "release_seller" | "refund_buyer",
  adminUser: UserProfile,
  notes?: string
): Promise<{ ok: boolean; error?: string; warning?: string }> {
  try {
    const list = getStoredDisputes();
    const dispute = list.find((d) => d.id === disputeId);
    if (!dispute) return { ok: false, error: "Disputa não encontrada." };
    let warning: string | undefined;

    const status = decision === "release_seller" ? "resolved_seller" : "resolved_refund";
    const updatedDispute: OrderDispute = {
      ...dispute,
      status,
      balanceBlocked: false,
      resolvedAt: new Date().toISOString(),
      resolvedBy: adminUser.name || "Administrador",
      resolutionNotes: notes?.trim() || "",
    };

    const updated = list.map((d) => (d.id === disputeId ? updatedDispute : d));
    saveStoredDisputes(updated);

    // Mensagem de resolução no chat
    const resolutionMessage =
      decision === "release_seller"
        ? `✅ MEDIAÇÃO CONCLUÍDA · SALDO LIBERADO AO VENDEDOR\n\n` +
          `O saldo da venda (R$ ${dispute.price.toFixed(2).replace(".", ",")}) foi LIBERADO PARA O VENDEDOR ${dispute.sellerName}.\n` +
          (notes ? `Parecer do moderador: "${notes}"\n\n` : "\n") +
          `Caso encerrado pela Moderação Oficial.`
        : `🔄 MEDIAÇÃO CONCLUÍDA · VALOR REEMBOLSADO AO COMPRADOR\n\n` +
          `O comprador ${dispute.buyerName} foi REEMBOLSADO COM SUCESSO no valor de R$ ${dispute.price.toFixed(2).replace(".", ",")}.\n` +
          (notes ? `Parecer do moderador: "${notes}"\n\n` : "\n") +
          `Caso encerrado pela Moderação Oficial.`;

    const resMsg: ChatMessage = {
      id: `disp-res-${dispute.chatId}-${Date.now()}`,
      chatId: dispute.chatId,
      senderId: adminUser.id,
      senderName: "Central de Mediação Oficial",
      senderRole: "system",
      kind: "system",
      body: resolutionMessage,
      createdAt: new Date().toISOString(),
      isRead: true,
    };
    const currentMsgs = getCachedMessages(dispute.chatId) || [];
    setCachedMessages(dispute.chatId, [...currentMsgs, resMsg]);

    // Publica o parecer no banco para o vendedor e o comprador verem em qualquer navegador.
    // Requer rodar scripts/admin-mensagem-mediacao.sql no Supabase; se ainda não rodou (ou o
    // chat for de demonstração), o erro é ignorado e a mensagem fica só neste navegador.
    if (isSupabaseConfigured) {
      try {
        const rpc = await supabase.rpc("admin_post_chat_message", {
          p_chat_id: dispute.chatId,
          p_body: resolutionMessage,
          p_sender_name: "Central de Mediação Oficial",
        });
        if (rpc.error) {
          warning =
            "A decisão foi salva só neste navegador: o comprador e o vendedor ainda não verão o resultado no chat. " +
            `Motivo: ${rpc.error.message}`;
        }
      } catch {
        warning = "A decisão foi salva só neste navegador: não foi possível publicar o resultado no chat.";
      }
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("central_messages_changed", { detail: { chatId: dispute.chatId } }));
    }

    // Notificações
    addNotification({
      kind: "system",
      recipientId: dispute.sellerId,
      recipientName: dispute.sellerName,
      title: decision === "release_seller" ? "✅ Saldo liberado pela Moderação" : "⚠️ Pedido reembolsado pela Moderação",
      body: `A mediação do pedido #${dispute.orderCode} foi finalizada.`,
      link: `/chat/${dispute.orderCode}`,
    });

    addNotification({
      kind: "system",
      recipientId: dispute.buyerId,
      recipientName: dispute.buyerName,
      title: decision === "refund_buyer" ? "💰 Reembolso aprovado" : "ℹ️ Mediação concluída",
      body: `A mediação do pedido #${dispute.orderCode} foi finalizada pelo administrador.`,
      link: `/chat/${dispute.orderCode}`,
    });

    return { ok: true, warning };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Não foi possível resolver a disputa." };
  }
}
