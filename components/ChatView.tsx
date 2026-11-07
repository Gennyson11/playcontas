"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CartItem, UserProfile } from "@/types";
import { getStoredUserSync, saveStoredUser, clearStoredUser } from "@/lib/authStore";
import {
  ChatMessage,
  OrderChat,
  listMyChats,
  loadMessages,
  getCachedMessages,
  setCachedMessages,
  getCachedChats,
  prefetchMessages,
  sendChatMessage,
  sellerDeliver,
  subscribeToChat,
  subscribeToChatList,
  formatChatNumber,
  markMessagesAsSeen,
  cleanOrderTitle,
  ChatRealtimeSubscription,
  listAllChatsAdmin,
} from "@/lib/chatStore";
import {
  createDispute,
  getDisputeForChat,
  resolveDispute,
  withdrawDispute,
  ensureDisputeFromChat,
  getStoredDisputes,
  OrderDispute,
} from "@/lib/disputeStore";
import {
  getReviewForChat,
  submitReview,
  Review,
  getBuyerReviewForChat,
  submitBuyerReview,
  BuyerReview,
} from "@/lib/reviewStore";
import { playNotificationSound } from "@/lib/notificationSound";
import {
  getNotificationPreferences,
  sendBrowserPushNotification,
} from "@/lib/notificationPreferences";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { GENNYSON_AVATAR_URL } from "@/lib/avatarStore";
import { getStoredProducts } from "@/lib/productStore";
import { getProductUrl } from "@/lib/slug";
import { JamHeader } from "@/components/JamHeader";
import { JamFooter } from "@/components/JamFooter";
import { AuthModal } from "@/components/AuthModal";
import {
  Search,
  Send,
  ArrowLeft,
  MessageSquare,
  PackageCheck,
  Clock,
  Loader2,
  AlertCircle,
  AlertTriangle,
  ShoppingBag,
  Store,
  Package,
  Copy,
  Check,
  CheckCheck,
  Zap,
  Info,
  ShieldAlert,
  ShieldCheck,
  Star,
  X,
  Crown,
  Lock,
  Unlock,
  DollarSign,
} from "lucide-react";

type ListFilter = "all" | "buy" | "sell" | "pending" | "platform";

const brl = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const initials = (name: string) => {
  const parts = (name || "?").trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name || "?").trim().slice(0, 2).toUpperCase();
};

const shortTime = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

const fullTime = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const y = new Date();
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Hoje";
  if (d.toDateString() === y.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const AVATAR_CACHE = new Map<string, string>();
AVATAR_CACHE.set("Gennyson Marinho", GENNYSON_AVATAR_URL);
AVATAR_CACHE.set("gennysonmarinhodemacedo@gmail.com", GENNYSON_AVATAR_URL);
AVATAR_CACHE.set("usr-gennyson", GENNYSON_AVATAR_URL);
AVATAR_CACHE.set("user-gennyson-admin", GENNYSON_AVATAR_URL);
AVATAR_CACHE.set("bb25d258-3152-422b-aa04-7bd34e8a5927", GENNYSON_AVATAR_URL);

const SYSTEM_SECTIONS: { icon: string; title: string; text: string }[] = [
  {
    icon: "ℹ️",
    title: "Sobre o PlayContas",
    text: "O PlayContas é um marketplace público de contas, jogos e serviços digitais, onde vendedores independentes comercializam seus produtos. O vendedor é o responsável definitivo pela entrega e manutenção do produto adquirido.",
  },
  {
    icon: "⚠️",
    title: "Teve algum problema?",
    text: "Fale com o vendedor aqui neste chat e explique o que aconteceu. Se não for resolvido, entre em contato com o suporte do PlayContas informando o código do pedido.",
  },
  {
    icon: "🛡️",
    title: "Garantia:",
    text: "A garantia do produto é a informada no anúncio. Se houver qualquer problema, avise o vendedor por aqui dentro do prazo e finalize todos os trâmites da negociação neste chat.",
  },
  {
    icon: "🚫",
    title: "Contato por fora da plataforma é PROIBIDO!",
    text: "Proibido passar WhatsApp, Instagram ou outro contato externo: a conta será banida. Não aceite pedidos para conversar ou realizar pagamentos por WhatsApp, Telegram, Discord, Instagram ou outro meio externo.",
  },
];

function SystemCard({ message, chat }: { message: ChatMessage; chat: OrderChat }) {
  const isStart = message.body.startsWith("CHAT INICIADO");
  const lines = message.body.split("\n").filter((l) => l.trim() !== "");
  const [headline, ...rest] = lines;

  return (
    <div className="max-w-2xl rounded-2xl border border-blue-100 bg-white shadow-xs overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-2.5 bg-blue-50/70 border-b border-blue-100">
        <Info className="w-3.5 h-3.5 text-[#0066FF]" />
        <span className="text-[11px] font-black tracking-wider text-[#0066FF] uppercase">Sistema</span>
      </div>

      <div className="px-5 py-4 space-y-4 text-xs sm:text-[13px] text-zinc-700 leading-relaxed">
        {isStart ? (
          <>
            <div className="rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-black text-zinc-900">Pedido #{chat.code}</span>
              <span className="text-zinc-300">•</span>
              <span className="font-semibold text-zinc-600 uppercase truncate max-w-full">
                {cleanOrderTitle(chat.productTitle)}
              </span>
              <span className="text-zinc-300">•</span>
              <span className="font-black text-emerald-600">{brl(chat.price)}</span>
            </div>

            {SYSTEM_SECTIONS.map((s) => (
              <div key={s.title}>
                <div className="font-black text-zinc-950 flex items-center gap-1.5">
                  <span>{s.icon}</span>
                  <span>{s.title}</span>
                </div>
                <p className="mt-0.5 break-words">{s.text}</p>
              </div>
            ))}
          </>
        ) : (
          <div>
            {headline && <div className="font-black text-zinc-950">{headline}</div>}
            {rest.length > 0 && (
              <p className="mt-0.5 whitespace-pre-wrap break-words">{rest.join("\n")}</p>
            )}
          </div>
        )}

        <span className="block text-[10px] text-zinc-400">{shortTime(message.createdAt)}</span>
      </div>
    </div>
  );
}

function MediationCard({
  message,
  chat,
  dispute,
  isAdmin,
  onResolve,
}: {
  message?: ChatMessage;
  chat: OrderChat;
  dispute?: OrderDispute | null;
  isAdmin?: boolean;
  onResolve?: (decision: "release_seller" | "refund_buyer") => void;
}) {
  const isResolvedSeller =
    dispute?.status === "resolved_seller" ||
    (message && (message.body.includes("LIBERADO PARA O VENDEDOR") || message.body.includes("SALDO LIBERADO")));
  const isResolvedRefund =
    dispute?.status === "resolved_refund" ||
    (message && (message.body.includes("REEMBOLSADO") || message.body.includes("VALOR REEMBOLSADO")));
  const isWithdrawn =
    dispute?.status === "withdrawn" || !!message?.body.includes("PROBLEMA RETIRADO");
  const isWithdrawMessage = !!message?.body.includes("PROBLEMA RETIRADO");
  // Mensagem de encerramento (retirada pelo comprador OU decisão do admin)
  const isResultMessage = !!message?.body.includes("MEDIAÇÃO CONCLUÍDA");
  const resultText = isWithdrawMessage
    ? `${message?.body.includes("PELO VENDEDOR") ? "O vendedor" : "O comprador"} retirou o problema reportado e a mediação foi encerrada.`
    : (message?.body || "")
        .split("\n")
        .slice(1)
        .map((l) => l.trim())
        .filter(Boolean)
        .join(" ");
  const isResolved = isResolvedSeller || isResolvedRefund || isWithdrawn;

  const rawReason =
    dispute?.reason ||
    message?.body.match(/Motivo:\s*"([^"]+)"/i)?.[1] ||
    message?.body.match(/Motivo:\s*([^\n]+)/i)?.[1] ||
    "Não foi possível acessar a conta com as credenciais enviadas.";

  return (
    <div className="w-full max-w-2xl mx-auto my-3 rounded-2xl border-2 border-amber-400/80 bg-white shadow-md overflow-hidden ring-4 ring-amber-400/10">
      {/* Header com gradiente */}
      <div
        className={`px-5 py-3 text-white flex flex-wrap items-center justify-between gap-2 ${
          isResolvedSeller
            ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700"
            : isResolvedRefund
            ? "bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700"
            : isWithdrawn
            ? "bg-gradient-to-r from-zinc-500 to-zinc-600"
            : "bg-gradient-to-r from-amber-600 via-rose-600 to-amber-700"
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
            {isResolved ? (
              <ShieldCheck className="w-4 h-4 text-white" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-white animate-pulse" />
            )}
          </div>
          <div>
            <h4 className="text-xs sm:text-[13px] font-black uppercase tracking-wider leading-tight">
              Central de Mediação & Suporte Oficial
            </h4>
            <p className="text-[10px] text-white/80 font-medium">
              Intervenção de Moderação · PlayContas
            </p>
          </div>
        </div>

        <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-black/25 backdrop-blur-xs border border-white/20 flex items-center gap-1.5 shadow-2xs">
          {isResolvedSeller ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-300" />
              <span>SALDO LIBERADO</span>
            </>
          ) : isResolvedRefund ? (
            <>
              <Check className="w-3.5 h-3.5 text-blue-300" />
              <span>REEMBOLSADO</span>
            </>
          ) : isWithdrawn ? (
            <>
              <Check className="w-3.5 h-3.5 text-zinc-200" />
              <span>PROBLEMA RETIRADO</span>
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5 text-amber-300" />
              <span>SALDO RETIDO: {brl(chat.price)}</span>
            </>
          )}
        </span>
      </div>

      {/* Corpo da Mediação */}
      <div className="p-4 sm:p-5 space-y-3.5 bg-zinc-50/50 text-xs sm:text-[13px]">
        {/* Motivo do problema */}
        <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200">
          <div className="flex items-center justify-between text-[11px] font-extrabold text-amber-900 mb-1">
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> {isResultMessage ? "Resultado da mediação:" : "Motivo do problema relatado:"}
            </span>
            <span className="text-[10px] text-amber-700 font-semibold">
              {shortTime(message?.createdAt || dispute?.createdAt || new Date().toISOString())}
            </span>
          </div>
          <p className="text-zinc-800 font-semibold italic text-xs sm:text-sm pl-2 border-l-2 border-amber-400">
            {isResultMessage ? resultText : `"${rawReason}"`}
          </p>
        </div>

        {/* Informações e Instruções */}
        {isResultMessage ? (
          <div className="space-y-2 text-zinc-600 text-xs leading-relaxed">
            <div className="flex items-start gap-2">
              <Unlock className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <p>
                {isResolvedRefund ? (
                  <>
                    <strong className="text-zinc-900">Valor Reembolsado:</strong> O valor de{" "}
                    <strong className="text-emerald-700 font-bold">{brl(chat.price)}</strong> foi devolvido
                    ao comprador.
                  </>
                ) : isResolvedSeller ? (
                  <>
                    <strong className="text-zinc-900">Saldo Liberado:</strong> O valor de{" "}
                    <strong className="text-emerald-700 font-bold">{brl(chat.price)}</strong> foi liberado
                    ao vendedor.
                  </>
                ) : (
                  <>
                    <strong className="text-zinc-900">Saldo Liberado:</strong> O valor de{" "}
                    <strong className="text-emerald-700 font-bold">{brl(chat.price)}</strong> não está mais
                    retido por este motivo e a venda segue o fluxo normal.
                  </>
                )}
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p>
                <strong className="text-zinc-900">Caso Encerrado:</strong> Nenhuma ação adicional da
                moderação do PlayContas é necessária.
              </p>
            </div>
          </div>
        ) : (
        <div className="space-y-2 text-zinc-600 text-xs leading-relaxed">
          <div className="flex items-start gap-2">
            <Lock className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
            <p>
              <strong className="text-zinc-900">Saldo Protegido:</strong> O valor de{" "}
              <strong className="text-emerald-700 font-bold">{brl(chat.price)}</strong> está
              congelado na custódia e nenhum saque pode ser realizado pelo vendedor até a conclusão do caso.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
            <p>
              <strong className="text-zinc-900">Instrução às Partes:</strong> Comprador e vendedor
              devem utilizar exclusivamente este chat para esclarecimentos, envio de novas credenciais ou acordo.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <p>
              <strong className="text-zinc-900">Moderação Ativa:</strong> A equipe oficial de moderação do
              PlayContas acompanha este chat e tem a autoridade final para liberação ou estorno da compra.
            </p>
          </div>
        </div>
        )}

        {/* Se o Admin estiver no chat e a disputa estiver aberta, exibe os botões de ação de mediação */}
        {isAdmin && !isResolved && onResolve && (
          <div className="mt-3 pt-3 border-t border-zinc-200/80 flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-white p-3 rounded-xl border border-zinc-200 shadow-2xs">
            <div className="flex items-center gap-1.5 text-[11px] font-black text-zinc-700">
              <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
              <span>Painel de Decisão da Moderação:</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => onResolve("release_seller")}
                className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Liberar ao Vendedor</span>
              </button>
              <button
                type="button"
                onClick={() => onResolve("refund_buyer")}
                className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Reembolsar Comprador</span>
              </button>
            </div>
          </div>
        )}

        {isResolved && (
          <div className="mt-2 p-2.5 rounded-xl bg-zinc-100 border border-zinc-200 text-center text-xs font-bold text-zinc-700">
            {isResolvedSeller ? (
              <span className="text-emerald-700 flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4" /> Mediação Encerrada: Saldo de {brl(chat.price)} liberado para o vendedor.
              </span>
            ) : (
              <span className="text-blue-700 flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4" /> Mediação Encerrada: Valor de {brl(chat.price)} estornado ao comprador.
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatView({ initialChatId }: { initialChatId?: string }) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getStoredUserSync());
  const [isMounted, setIsMounted] = useState(false);
  const [cart] = useState<CartItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("central_cart");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialTab, setAuthInitialTab] = useState<"login" | "register">("login");

  const [chats, setChats] = useState<OrderChat[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileConversation, setMobileConversation] = useState(false);
  const [filter, setFilter] = useState<ListFilter>("all");
  const [query, setQuery] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [asDelivery, setAsDelivery] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Comprador: reportar problema / avaliar
  const [reportOpen, setReportOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [modalText, setModalText] = useState("");
  const [rating, setRating] = useState(0);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState("");
  const [myReview, setMyReview] = useState<Review | null>(null);
  // Vendedor: avaliação que ele deu ao comprador deste pedido
  const [myBuyerReview, setMyBuyerReview] = useState<BuyerReview | null>(null);
  const [avatarVersion, setAvatarVersion] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const initialChatFromUrl = useRef<string | null>(null);
  const isListRefreshed = useRef(false);
  const realtimeRef = useRef<ChatRealtimeSubscription | null>(null);

  // Usuário logado (sincroniza login/logout entre abas)
  useEffect(() => {
    setIsMounted(true);
    const sync = () => setCurrentUser(getStoredUserSync());
    sync();
    window.addEventListener("central_auth_changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("central_auth_changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Conversa pedida na URL: /chat/ID (ou o formato antigo /chat?c=ID)
  useEffect(() => {
    let id = initialChatId || "";
    if (!id) {
      try {
        id = new URLSearchParams(window.location.search).get("c") || "";
      } catch {}
    }
    if (id) {
      // O endereço traz o número do pedido ou o id da conversa
      initialChatFromUrl.current = id;
      setMobileConversation(true);
    }
  }, [initialChatId]);

  const findMatchingChat = useCallback((wantedStr: string, list: OrderChat[]): OrderChat | null => {
    if (!wantedStr || !list || list.length === 0) return null;
    const clean = wantedStr.replace(/^#/, "").trim().toLowerCase();
    const cleanNoDisp = clean.replace(/^disp-/, "");
    const cleanNo0 = cleanNoDisp.replace(/^0+/, "");
    const asNum = Number(cleanNoDisp);

    // 1. Busca exata por ID
    let found = list.find((c) => c.id && c.id.toLowerCase() === clean);
    if (found) return found;

    // 2. Busca exata por código do pedido (ex.: 00013)
    found = list.find((c) => c.code && c.code.toLowerCase() === clean);
    if (found) return found;

    // 3. Busca por código sem os zeros à esquerda (ex.: 13 com 00013)
    if (cleanNo0) {
      found = list.find((c) => {
        const cCodeNo0 = (c.code || "").toLowerCase().replace(/^0+/, "");
        return cCodeNo0 === cleanNo0;
      });
      if (found) return found;
    }

    // 4. Busca por número do pedido (ex.: number 13)
    if (Number.isFinite(asNum) && asNum > 0) {
      found = list.find((c) => c.number === asNum);
      if (found) return found;
    }

    // 5. Busca se o ID contém o termo procurado (ex.: "chat-kalodata-00013" contém "00013")
    found = list.find((c) => {
      const cid = (c.id || "").toLowerCase();
      return cid.includes(clean) || (clean.length >= 4 && clean.includes(cid));
    });
    if (found) return found;

    if (cleanNo0 && cleanNo0.length >= 2) {
      found = list.find((c) => {
        const cid = (c.id || "").toLowerCase();
        return cid.includes(cleanNo0);
      });
      if (found) return found;
    }

    return null;
  }, []);

  // Abre a conversa pedida na URL assim que a lista de conversas chegar
  useEffect(() => {
    const wanted = initialChatFromUrl.current;
    if (!wanted) return;

    // 1. Tenta encontrar a conversa dentro da lista atual de chats
    const found = findMatchingChat(wanted, chats);
    if (found) {
      setSelectedId(found.id);
      setMobileConversation(true);
      initialChatFromUrl.current = null;
      try {
        window.history.replaceState(null, "", `/chat/${formatChatNumber(found.number) || found.code || found.id}`);
      } catch {}
      return;
    }

    // 2. Tenta localizar nas mediações salvas (central_disputes_list)
    const clean = wanted.replace(/^#/, "").trim().toLowerCase();
    const cleanNoDisp = clean.replace(/^disp-/, "");
    const cleanNo0 = cleanNoDisp.replace(/^0+/, "");
    const asNum = Number(cleanNoDisp);

    const storedDisputes = getStoredDisputes();
    const matchedDispute = storedDisputes.find((d) => {
      const dId = (d.id || "").toLowerCase();
      const dChatId = (d.chatId || "").toLowerCase();
      const dCode = (d.orderCode || "").toLowerCase();
      return (
        dId === clean ||
        dChatId === clean ||
        dCode === clean ||
        dChatId.includes(clean) ||
        (cleanNoDisp && (dId.includes(cleanNoDisp) || dCode.includes(cleanNoDisp) || dChatId.includes(cleanNoDisp))) ||
        (cleanNo0 && (dId.includes(cleanNo0) || dCode.includes(cleanNo0) || dChatId.includes(cleanNo0))) ||
        (Number.isFinite(asNum) && asNum > 0 && d.orderNumber === asNum)
      );
    });

    if (matchedDispute) {
      const synChat: OrderChat = {
        id: matchedDispute.chatId,
        number: matchedDispute.orderNumber || 0,
        code: matchedDispute.orderCode || (matchedDispute.orderNumber ? formatChatNumber(matchedDispute.orderNumber) : ""),
        productId: matchedDispute.productId || "",
        productTitle: matchedDispute.productTitle || "Produto",
        productImage: matchedDispute.productImage || "",
        price: Number(matchedDispute.price) || 0,
        quantity: Number(matchedDispute.quantity) || 1,
        buyerId: matchedDispute.buyerId || null,
        buyerName: matchedDispute.buyerName || "Comprador",
        sellerId: matchedDispute.sellerId || null,
        sellerName: matchedDispute.sellerName || "Vendedor",
        deliveryType: "AUTOMATIC",
        status: "pending",
        lastMessage: `🚨 MEDIAÇÃO: ${matchedDispute.reason || "Problema reportado"}`,
        lastMessageAt: matchedDispute.createdAt || new Date().toISOString(),
        createdAt: matchedDispute.createdAt || new Date().toISOString(),
      };
      setChats((prev) => [synChat, ...prev.filter((c) => c.id !== synChat.id)]);
      setSelectedId(synChat.id);
      setMobileConversation(true);
      initialChatFromUrl.current = null;
      try {
        window.history.replaceState(null, "", `/chat/${formatChatNumber(synChat.number) || synChat.code || synChat.id}`);
      } catch {}
      return;
    }

    // 3. Se ainda está carregando a lista do servidor, aguarda o término do refreshList() antes de desistir
    if (loadingList || !isListRefreshed.current) {
      return;
    }

    // 4. Se a lista já carregou do servidor e não encontramos, tenta consultar direto no Supabase por segurança
    if (isSupabaseConfigured) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(wanted);
      let q = supabase.from("order_chats").select("*");
      if (isUuid) {
        q = q.eq("id", wanted);
      } else if (Number.isFinite(asNum) && asNum > 0) {
        q = q.or(`code.eq.${wanted},number.eq.${asNum}`);
      } else {
        q = q.eq("code", wanted);
      }
      q.maybeSingle()
        .then(({ data }: any) => {
          if (data) {
            const fetched: OrderChat = {
              id: data.id,
              number: Number(data.number) || 0,
              code: data.number != null ? formatChatNumber(Number(data.number)) : data.code,
              productId: data.product_id || "",
              productTitle: cleanOrderTitle(data.product_title || "Produto") || "Produto",
              variantId: data.variant_id || null,
              productImage: data.product_image || "",
              price: Number(data.price) || 0,
              quantity: Number(data.quantity) || 1,
              buyerId: data.buyer_id || null,
              buyerName: data.buyer_name || "Comprador",
              sellerId: data.seller_id || null,
              sellerName: data.seller_name || "Vendedor",
              deliveryType: data.delivery_type === "MANUAL" ? "MANUAL" : "AUTOMATIC",
              status: data.status === "delivered" ? "delivered" : "pending",
              lastMessage: data.last_message || "",
              lastMessageAt: data.last_message_at || data.created_at,
              createdAt: data.created_at,
            };
            setChats((prev) => [fetched, ...prev.filter((c) => c.id !== fetched.id)]);
            setSelectedId(fetched.id);
            setMobileConversation(true);
            initialChatFromUrl.current = null;
          } else {
            initialChatFromUrl.current = null;
            setMobileConversation(false);
            try {
              window.history.replaceState(null, "", "/chat");
            } catch {}
          }
        })
        .catch(() => {
          initialChatFromUrl.current = null;
        });
    } else {
      initialChatFromUrl.current = null;
      setMobileConversation(false);
      try {
        window.history.replaceState(null, "", "/chat");
      } catch {}
    }
  }, [chats, loadingList, findMatchingChat]);

  const refreshList = useCallback(async () => {
    if (!currentUser) {
      setChats([]);
      setLoadingList(false);
      isListRefreshed.current = true;
      return;
    }
    const isUserAdmin =
      currentUser.role === "admin" ||
      currentUser.name.toLowerCase().includes("gennyson") ||
      currentUser.email?.toLowerCase().includes("gennyson");

    const { chats: list, error } = isUserAdmin
      ? await listAllChatsAdmin()
      : await listMyChats(currentUser.id);
    // Se a rede falhar, mantém a lista que já está na tela em vez de esvaziá-la
    if (error && list.length === 0) {
      setListError(error);
      setLoadingList(false);
      isListRefreshed.current = true;
      // Servidor lento ou fora do ar: tenta de novo em poucos segundos
      setTimeout(() => refreshListRef.current?.(), 6000);
      return;
    }
    setChats(list);
    setListError(error || "");
    setLoadingList(false);
    isListRefreshed.current = true;

    // Aquece o cache das outras conversas depois que a atual já começou a carregar
    setTimeout(() => list.slice(0, 6).forEach((c) => prefetchMessages(c.id)), 1200);
  }, [currentUser?.id]);

  const refreshListRef = useRef<(() => void) | null>(null);
  refreshListRef.current = refreshList;

  // Mostra na hora a lista salva da última visita enquanto a atualização chega do servidor
  useEffect(() => {
    if (!currentUser?.id) return;
    const cached = getCachedChats(currentUser.id);
    if (cached && cached.length > 0) {
      setChats((prev) => (prev.length > 0 ? prev : cached));
      setLoadingList(false);
      // Já dispara a busca da conversa mais recente sem esperar a lista chegar do servidor
      prefetchMessages(cached[0].id);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!getCachedChats(currentUser?.id || "")) setLoadingList(true);
    refreshList();
    if (!currentUser) return;
    const unsub = subscribeToChatList(currentUser.id, refreshList);
    const interval = setInterval(refreshList, 20000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [refreshList, currentUser?.id]);

  // Seleciona a primeira conversa no desktop quando nada foi pedido
  useEffect(() => {
    if (selectedId || chats.length === 0 || initialChatFromUrl.current) return;
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setSelectedId(chats[0].id);
    }
  }, [chats, selectedId]);

  const selected = useMemo(
    () => chats.find((c) => c.id === selectedId) || null,
    [chats, selectedId]
  );

  // Sempre aponta para a conversa que está aberta AGORA (respostas atrasadas de outra conversa são descartadas)
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  const refreshMessages = useCallback(async () => {
    if (!selectedId) return;
    const requestedId = selectedId;
    try {
      const list = await loadMessages(requestedId);
      // O usuário já trocou de conversa enquanto isso carregava: ignora, senão as mensagens misturam
      if (selectedIdRef.current !== requestedId) return;
      setMessages((prev) => {
        // Evita re-renderizar (e piscar) quando nada mudou
        if (
          prev.length === list.length &&
          prev.length > 0 &&
          prev[prev.length - 1].id === list[list.length - 1].id &&
          prev.every((m, i) => m.isRead === list[i].isRead)
        ) {
          return prev;
        }
        return list;
      });
      setLoadingMessages(false);
    } catch {
      if (selectedIdRef.current === requestedId) setLoadingMessages(false);
    }
  }, [selectedId]);

  useEffect(() => {
    setSendError("");
    setAsDelivery(false);
    if (!selectedId) {
      setMessages([]);
      return;
    }

    // Abertura instantânea: mostra o que já está em cache e atualiza em segundo plano
    const cached = getCachedMessages(selectedId);
    setMessages(cached || []);
    setLoadingMessages(!cached);
    refreshMessages();

    // Marca como lido uma vez ao abrir a conversa
    if (currentUser?.id) {
      markMessagesAsSeen(selectedId, currentUser.id);
    }

    // Inscrição Realtime para mensagens novas
    const sub = subscribeToChat(selectedId, {
      onMessage: (msg) => {
        if (msg.chatId && msg.chatId !== selectedIdRef.current) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        if (currentUser?.id && msg.senderId !== currentUser.id) {
          markMessagesAsSeen(selectedId, currentUser.id);
          sub.notifySeen(currentUser.id);
        }
      },
      onSeen: (_seenAt, viewerId) => {
        if (currentUser?.id && viewerId !== currentUser.id) {
          setMessages((prev) =>
            prev.map((m) => (m.senderId === currentUser.id ? { ...m, isRead: true } : m))
          );
        }
      },
      onChange: () => {
        refreshMessages();
      },
    });

    realtimeRef.current = sub;

    // Polling seguro de 5 segundos para contingência
    const interval = setInterval(() => {
      refreshMessages();
    }, 5000);

    return () => {
      sub.unsubscribe();
      realtimeRef.current = null;
      clearInterval(interval);
    };
  }, [selectedId]);

  // Som quando chega mensagem de outra pessoa na conversa que está aberta
  // (o sininho só toca para conversas fora da tela; aqui cobre a conversa aberta).
  const soundStateRef = useRef<{ chatId: string | null; ids: Set<string>; since: number }>({
    chatId: null,
    ids: new Set(),
    since: 0,
  });
  useEffect(() => {
    if (!selectedId) return;
    const st = soundStateRef.current;
    if (st.chatId !== selectedId) {
      st.chatId = selectedId;
      st.ids = new Set(messages.map((m) => m.id));
      st.since = Date.now();
      return;
    }
    const fresh = messages.filter((m) => !st.ids.has(m.id));
    if (fresh.length === 0) return;
    fresh.forEach((m) => st.ids.add(m.id));
    // Ignora os primeiros segundos após abrir a conversa (mensagens antigas ainda chegando)
    if (Date.now() - st.since < 3000) return;
    const incoming = fresh.filter((m) => m.senderId !== currentUser?.id);
    if (incoming.length > 0) {
      const prefs = getNotificationPreferences(currentUser?.id);
      if (prefs.siteNotifications && prefs.chatMessages) {
        playNotificationSound();
      }
      if (prefs.browserPushEnabled) {
        const last = incoming[incoming.length - 1];
        sendBrowserPushNotification(
          "Nova mensagem no chat",
          {
            body: last?.body || "Você recebeu uma nova mensagem.",
          },
          currentUser?.id
        );
      }
    }
  }, [messages, selectedId, currentUser?.id]);

  // Mantém o cache sempre atualizado (mensagens novas, enviadas e visualizações)
  useEffect(() => {
    if (!selectedId || messages.length === 0) return;
    if (messages[0].chatId !== selectedId) return;
    setCachedMessages(selectedId, messages);
  }, [messages, selectedId]);

  // Sincroniza fotos de perfil do cliente e do vendedor sem loops
  useEffect(() => {
    if (!selected) return;

    // Popula com dados locais imediatos do produto
    try {
      const prods = getStoredProducts();
      const p = prods.find((prod) => prod.id === selected.productId);
      if (p?.seller?.avatar) {
        if (p.seller.id) AVATAR_CACHE.set(p.seller.id, p.seller.avatar);
        if (p.seller.name) AVATAR_CACHE.set(p.seller.name, p.seller.avatar);
      }
    } catch {}

    if (currentUser?.avatar) {
      if (currentUser.id) AVATAR_CACHE.set(currentUser.id, currentUser.avatar);
      if (currentUser.name) AVATAR_CACHE.set(currentUser.name, currentUser.avatar);
    }

    if (!isSupabaseConfigured) return;

    const isUUID = (str?: string | null) =>
      Boolean(
        str &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str)
      );

    const idsToQuery = [selected.buyerId, selected.sellerId].filter(
      (id): id is string => Boolean(id && isUUID(id) && !AVATAR_CACHE.has(id))
    );

    if (idsToQuery.length === 0) return;

    supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", idsToQuery)
      .then(({ data }: { data: any }) => {
        if (data && data.length > 0) {
          let updated = false;
          data.forEach((p: any) => {
            if (p.avatar_url) {
              if (p.id && !AVATAR_CACHE.has(p.id)) {
                AVATAR_CACHE.set(p.id, p.avatar_url);
                updated = true;
              }
              if (p.full_name && !AVATAR_CACHE.has(p.full_name)) {
                AVATAR_CACHE.set(p.full_name, p.avatar_url);
                updated = true;
              }
              if (p.email && !AVATAR_CACHE.has(p.email)) {
                AVATAR_CACHE.set(p.email, p.avatar_url);
                updated = true;
              }
            }
          });
          if (updated) {
            setAvatarVersion((v) => v + 1);
          }
        }
      })
      .catch(() => {});
  }, [selected?.id, selected?.buyerId, selected?.sellerId]);

  const getSenderAvatar = useCallback(
    (m: ChatMessage): string => {
      // 1. Mensagem minha
      const isMine =
        (m.senderId && currentUser?.id && m.senderId === currentUser.id) ||
        (currentUser?.name && m.senderName === currentUser.name);

      if (isMine) {
        if (currentUser?.avatar) return currentUser.avatar;
        if (
          currentUser?.email?.toLowerCase().includes("gennyson") ||
          currentUser?.name?.toLowerCase().includes("gennyson")
        ) {
          return GENNYSON_AVATAR_URL;
        }
      }

      // 2. Gennyson Marinho
      if (
        m.senderName?.toLowerCase().includes("gennyson") ||
        (m.senderRole === "seller" && selected?.sellerName?.toLowerCase().includes("gennyson"))
      ) {
        return GENNYSON_AVATAR_URL;
      }

      // 3. Busca no cache
      if (m.senderId && AVATAR_CACHE.has(m.senderId)) return AVATAR_CACHE.get(m.senderId)!;
      if (m.senderName && AVATAR_CACHE.has(m.senderName)) return AVATAR_CACHE.get(m.senderName)!;

      // 4. Vendedor
      if (m.senderRole === "seller" && selected) {
        if (selected.sellerId && AVATAR_CACHE.has(selected.sellerId)) {
          return AVATAR_CACHE.get(selected.sellerId)!;
        }
        if (selected.sellerName && AVATAR_CACHE.has(selected.sellerName)) {
          return AVATAR_CACHE.get(selected.sellerName)!;
        }
      }

      // 5. Comprador
      if (m.senderRole === "buyer" && selected) {
        if (selected.buyerId && AVATAR_CACHE.has(selected.buyerId)) {
          return AVATAR_CACHE.get(selected.buyerId)!;
        }
        if (selected.buyerName && AVATAR_CACHE.has(selected.buyerName)) {
          return AVATAR_CACHE.get(selected.buyerName)!;
        }
      }

      // 6. Fallback seguro com Dicebear
      const seed = m.senderName || (m.senderRole === "seller" ? "Vendedor" : "Comprador");
      return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}`;
    },
    [currentUser, selected, avatarVersion]
  );

  const getMyAvatar = useCallback((): string => {
    if (currentUser?.avatar) return currentUser.avatar;
    if (
      currentUser?.email?.toLowerCase().includes("gennyson") ||
      currentUser?.name?.toLowerCase().includes("gennyson")
    ) {
      return GENNYSON_AVATAR_URL;
    }
    return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
      currentUser?.name || "Eu"
    )}`;
  }, [currentUser]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, selectedId]);

  /** Endereço do anúncio do pedido (usa o título atual do anúncio, se ele ainda existir) */
  const productHref = (chat: OrderChat): string => {
    try {
      const current = getStoredProducts().find((p) => p.id === chat.productId);
      if (current) return getProductUrl(current);
    } catch {}
    return getProductUrl({ id: chat.productId, title: chat.productTitle });
  };

  const goToProduct = (e: React.MouseEvent, chat: OrderChat) => {
    // Ctrl/Cmd/Shift/botão do meio: deixa o navegador abrir em nova aba normalmente
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    router.push(productHref(chat));
  };

  const openChat = (id: string) => {
    // O usuário escolheu manualmente: cancela qualquer abertura automática pendente pela URL
    initialChatFromUrl.current = null;
    setSelectedId(id);
    setMobileConversation(true);
    const target = chats.find((c) => c.id === id);
    try {
      window.history.replaceState(
        null,
        "",
        target ? `/chat/${formatChatNumber(target.number)}` : "/chat"
      );
    } catch {}
  };

  const isSellerOfSelected = !!selected && !!currentUser && selected.sellerId === currentUser.id;
  const isUserAdmin =
    !!currentUser &&
    (currentUser.role === "admin" ||
      currentUser.name.toLowerCase().includes("gennyson") ||
      currentUser.email?.toLowerCase().includes("gennyson"));
  const canDeliver = (isSellerOfSelected || isUserAdmin) && selected?.status === "pending";

  const activeDispute = selected ? getDisputeForChat(selected.id, selected.number) : null;
  // A disputa fica salva só no navegador de quem abriu; o vendedor enxerga a mediação pela mensagem no chat
  const mediationOpenedInChat = (() => {
    let lastOpened = -1;
    let lastClosed = -1;
    messages.forEach((m, i) => {
      if (m.body.includes("MEDIAÇÃO ACIONADA")) lastOpened = i;
      if (m.body.includes("MEDIAÇÃO CONCLUÍDA")) lastClosed = i;
    });
    return lastOpened > lastClosed;
  })();
  const isDisputed = activeDispute ? activeDispute.status === "open" : mediationOpenedInChat;
  // Quem abriu a mediação: só essa pessoa pode retirar o problema
  const mediationOpenedBy: "buyer" | "seller" = (() => {
    const openMsg = [...messages].reverse().find((m) => m.body.includes("MEDIAÇÃO ACIONADA"));
    if (openMsg) return openMsg.body.includes("(Vendedor)") ? "seller" : "buyer";
    return activeDispute?.openedBy === "seller" ? "seller" : "buyer";
  })();
  const myRoleInChat: "buyer" | "seller" = isSellerOfSelected ? "seller" : "buyer";
  // Avaliação "ativa" do usuário neste pedido: o comprador avalia o vendedor; o vendedor avalia o comprador
  const activeReview: { rating: number; comment: string } | null = isSellerOfSelected
    ? myBuyerReview
    : myReview;
  const [withdrawing, setWithdrawing] = useState(false);

  // Quem abriu o problema retira a mediação (mesmo botão de "Reportar Problema")
  const handleWithdrawProblem = async () => {
    if (!selected || !currentUser || withdrawing) return;
    if (!confirm("Retirar o problema reportado? A mediação será encerrada.")) return;
    setWithdrawing(true);
    const res = await withdrawDispute(selected, currentUser, myRoleInChat);
    setWithdrawing(false);
    if (!res.ok) {
      alert(res.error || "Não foi possível retirar o problema.");
      return;
    }
    await refreshMessages();
    refreshList();
  };

  const handleSend = async () => {
    if (!selected || !currentUser || sending) return;
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setSendError("");

    const res =
      asDelivery && canDeliver
        ? await sellerDeliver(selected, text)
        : await sendChatMessage(selected, currentUser, text);

    setSending(false);
    if (!res.ok) {
      setSendError(res.error || "Não foi possível enviar.");
      return;
    }
    setDraft("");
    setAsDelivery(false);
    if ("message" in res && res.message) {
      const sentMsg = res.message;
      setMessages((prev) => {
        if (prev.some((m) => m.id === sentMsg.id)) return prev;
        return [...prev, sentMsg];
      });
      realtimeRef.current?.notifyNewMessage(sentMsg);
    } else {
      await refreshMessages();
    }
    refreshList();
  };

  const copyText = (id: string, text: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1800);
    } catch {}
  };

  // Descobre se este pedido já foi avaliado (uma avaliação por compra)
  useEffect(() => {
    setMyReview(null);
    setMyBuyerReview(null);
    if (!selectedId) return;
    let cancelled = false;
    getReviewForChat(selectedId).then((r) => {
      if (!cancelled) setMyReview(r);
    });
    // Se eu sou o vendedor deste pedido, carrega também a avaliação que dei ao comprador
    const sellerHere = chats.find((c) => c.id === selectedId)?.sellerId === currentUser?.id;
    if (sellerHere) {
      getBuyerReviewForChat(selectedId).then((r) => {
        if (!cancelled) setMyBuyerReview(r);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [selectedId]);
  const closeModals = () => {
    if (modalBusy) return;
    setReportOpen(false);
    setRateOpen(false);
    setModalText("");
    setRating(0);
    setModalError("");
  };

  // Envia o relato / a avaliação como mensagem na conversa (o vendedor é avisado no sininho)
  const submitModal = async () => {
    if (!selected || !currentUser || modalBusy) return;
    const text = modalText.trim();

    if (reportOpen && text.length < 5) {
      setModalError("Descreva o problema com um pouco mais de detalhe.");
      return;
    }
    if (rateOpen && rating < 1) {
      setModalError("Escolha de 1 a 5 estrelas.");
      return;
    }

    if (reportOpen) {
      setModalBusy(true);
      setModalError("");
      const dispRes = await createDispute(selected, currentUser, text, myRoleInChat);
      setModalBusy(false);
      if (!dispRes.ok) {
        setModalError(dispRes.error || "Não foi possível registrar o problema.");
        return;
      }
      setReportOpen(false);
      setModalText("");
      await refreshMessages();
      refreshList();
      return;
    }

    // Vendedor avaliando o comprador: avaliação privada (não vai para o chat nem para o anúncio)
    if (rateOpen && isSellerOfSelected) {
      setModalBusy(true);
      setModalError("");
      const rev = await submitBuyerReview(selected.id, rating, text);
      setModalBusy(false);
      if (!rev.ok) {
        setModalError(rev.error || "Não foi possível enviar a avaliação.");
        return;
      }
      setMyBuyerReview({
        id: "novo",
        chatId: selected.id,
        rating,
        comment: text,
        createdAt: new Date().toISOString(),
      });
      setRateOpen(false);
      setModalText("");
      setRating(0);
      return;
    }

    const isEditingReview = rateOpen && !!myReview;
    const body = reportOpen
      ? `⚠️ PROBLEMA REPORTADO\n${text}`
      : `⭐ ${isEditingReview ? "AVALIAÇÃO EDITADA" : "AVALIAÇÃO"}: ${rating}/5 ${"★".repeat(rating)}${"☆".repeat(5 - rating)}${text ? `\n${text}` : ""}`;

    setModalBusy(true);
    setModalError("");

    // Avaliação: grava a nota no anúncio (aparece para todos) antes de avisar o vendedor no chat
    if (rateOpen) {
      const rev = await submitReview(selected.id, rating, text);
      if (!rev.ok) {
        setModalBusy(false);
        setModalError(rev.error || "Não foi possível enviar a avaliação.");
        return;
      }
      setMyReview({
        id: "novo",
        chatId: selected.id,
        productId: selected.productId,
        buyerName: currentUser.name,
        rating,
        comment: text,
        createdAt: new Date().toISOString(),
      });
    }

    const res = await sendChatMessage(selected, currentUser, body);
    setModalBusy(false);

    if (!res.ok) {
      setModalError(res.error || "Não foi possível enviar.");
      return;
    }
    setReportOpen(false);
    setRateOpen(false);
    setModalText("");
    setRating(0);
    await refreshMessages();
    refreshList();
  };

  const handleResolveDispute = async (decision: "release_seller" | "refund_buyer") => {
    if (!selected) return;

    // O registro da mediação fica no navegador de quem reportou. Se o admin abriu o chat em
    // outro navegador, reconstrói o registro a partir do chat e da mensagem de mediação.
    let dispute = activeDispute;
    if (!dispute) {
      const openMsg = messages.find((m) => m.body.includes("MEDIAÇÃO ACIONADA"));
      const reasonHint =
        openMsg?.body.match(/Motivo:\s*"([^"]+)"/i)?.[1] ||
        openMsg?.body.match(/Motivo:\s*([^\n]+)/i)?.[1];
      dispute = ensureDisputeFromChat(selected, reasonHint);
    }

    const confirmMsg =
      decision === "release_seller"
        ? `Confirmar a liberação do saldo de ${brl(selected?.price || 0)} para o vendedor?`
        : `Confirmar o estorno/reembolso de ${brl(selected?.price || 0)} para o comprador?`;
    if (!confirm(confirmMsg)) return;

    const res = await resolveDispute(
      dispute.id,
      decision,
      currentUser || {
        id: "admin",
        name: "Gennyson Marinho",
        email: "gennyson@centraldasias.com",
        role: "admin",
        balance: 0,
        avatar: "",
        isVerified: true,
        createdAt: "",
      },
      decision === "release_seller"
        ? "Liberado pelo moderador no chat."
        : "Reembolsado pelo moderador no chat."
    );
    if (!res.ok) {
      alert(res.error || "Erro ao resolver mediação.");
      return;
    }
    if (res.warning) alert(res.warning);
    await refreshMessages();
    refreshList();
  };

  // Atualiza mensagens e disputas caso outro componente mude
  useEffect(() => {
    const handleSync = () => {
      refreshMessages();
      refreshList();
    };
    window.addEventListener("central_disputes_changed", handleSync);
    window.addEventListener("central_messages_changed", handleSync);
    return () => {
      window.removeEventListener("central_disputes_changed", handleSync);
      window.removeEventListener("central_messages_changed", handleSync);
    };
  }, [refreshMessages, refreshList]);

  // Venda da plataforma = conversa real (id do banco) da qual o admin NÃO é comprador nem vendedor.
  // Serve para o admin acompanhar as mensagens entre clientes e vendedores.
  const isPlatformChat = useCallback(
    (c: OrderChat) =>
      !!isUserAdmin &&
      c.buyerId !== currentUser?.id &&
      c.sellerId !== currentUser?.id &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c.id),
    [isUserAdmin, currentUser?.id]
  );

  const visibleChats = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chats.filter((c) => {
      const iBuy = c.buyerId === currentUser?.id;
      if (filter === "buy" && !iBuy) return false;
      if (filter === "sell" && (isUserAdmin ? c.sellerId !== currentUser?.id : iBuy)) return false;
      if (filter === "platform" && !isPlatformChat(c)) return false;
      if (filter === "pending" && c.status !== "pending") return false;
      if (!q) return true;
      return (
        c.productTitle.toLowerCase().includes(q) ||
        c.buyerName.toLowerCase().includes(q) ||
        c.sellerName.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q)
      );
    });
  }, [chats, filter, query, currentUser?.id, isUserAdmin, isPlatformChat]);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const counterpartOf = (c: OrderChat) =>
    c.buyerId === currentUser?.id ? c.sellerName : c.buyerName;

  /* --------------------------------- Render --------------------------------- */

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-sans selection:bg-[#0066FF] selection:text-white">
      <JamHeader
        searchQuery=""
        onSearchChange={(q) => router.push(`/?search=${encodeURIComponent(q)}`)}
        cartCount={cartCount}
        onOpenCart={() => router.push("/carrinho")}
        onOpenCreateListing={() => router.push("/?anunciar=true")}
        currentUser={currentUser}
        onOpenAuth={(tab) => {
          setAuthInitialTab(tab || "login");
          setAuthModalOpen(true);
        }}
        onOpenMyProducts={() => router.push("/meus-produtos")}
        onOpenAdmin={() => router.push("/?admin=true")}
        onOpenSettings={() => router.push("/minha-conta")}
        onGoHome={() => router.push("/")}
        onLogout={async () => {
          await clearStoredUser();
          setCurrentUser(null);
          router.push("/");
        }}
      />

      <main className="flex-1 py-6">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8">
          {!isMounted ? (
            <div className="flex flex-col items-center justify-center min-h-[460px] py-20 text-center">
              <div className="w-9 h-9 border-3 border-[#0066FF] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-zinc-400 font-semibold mt-3 animate-pulse">
                Carregando suas conversas...
              </span>
            </div>
          ) : !currentUser ? (
            <div className="max-w-md mx-auto py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#0066FF] flex items-center justify-center mx-auto mb-4 border border-blue-100">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h1 className="text-xl font-black text-zinc-900 mb-2">Entre para ver suas conversas</h1>
              <p className="text-sm text-zinc-500 mb-6">
                Seus pedidos e mensagens com vendedores e compradores ficam aqui.
              </p>
              <button
                onClick={() => {
                  setAuthInitialTab("login");
                  setAuthModalOpen(true);
                }}
                className="px-6 py-3 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-sm font-black transition-all shadow-md cursor-pointer"
              >
                Fazer login
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5 h-[calc(100vh-190px)] min-h-[560px]">
              {/* ----------------------------- Lista ----------------------------- */}
              <aside
                className={`${
                  mobileConversation ? "hidden lg:flex" : "flex"
                } flex-col bg-white rounded-3xl border border-zinc-200 shadow-xs overflow-hidden min-h-0`}
              >
                <div className="p-4 space-y-3 border-b border-zinc-100">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-[#0066FF]" />
                    <h1 className="text-base font-black text-zinc-950">Mensagens</h1>
                    <span className="ml-auto text-[11px] font-bold text-zinc-400">
                      {chats.length} conversa{chats.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="relative">
                    <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Buscar por nome ou produto..."
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-[#0066FF] text-xs font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { key: "all", label: "Todos" },
                        ...(isUserAdmin
                          ? [{ key: "platform", label: "Plataforma" }]
                          : []),
                        { key: "buy", label: "Compras" },
                        { key: "sell", label: "Vendas" },
                        { key: "pending", label: "Pendentes" },
                      ] as { key: ListFilter; label: string }[]
                    ).map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-black border transition-colors cursor-pointer ${
                          filter === f.key
                            ? "bg-zinc-950 text-white border-zinc-950"
                            : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                  {loadingList ? (
                    <div className="py-12 flex items-center justify-center gap-2 text-xs font-bold text-zinc-500">
                      <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                    </div>
                  ) : listError ? (
                    <div className="m-2 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs font-semibold text-rose-800">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                      <span>{listError}</span>
                    </div>
                  ) : visibleChats.length === 0 ? (
                    <div className="py-14 px-6 text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto">
                        <ShoppingBag className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-semibold text-zinc-500">
                        {filter === "platform"
                          ? "Nenhuma venda realizada na plataforma ainda. Quando alguém comprar, o chat aparece aqui para você acompanhar."
                          : chats.length === 0
                          ? "Você ainda não tem conversas. Quando comprar ou vender um produto, o chat aparece aqui."
                          : "Nenhuma conversa corresponde à busca ou ao filtro."}
                      </p>
                    </div>
                  ) : (
                    visibleChats.map((c) => {
                      const active = c.id === selectedId;
                      const iBuy = c.buyerId === currentUser.id;
                      return (
                        <button
                          key={c.id}
                          onClick={() => openChat(c.id)}
                          onMouseEnter={() => prefetchMessages(c.id)}
                          onTouchStart={() => prefetchMessages(c.id)}
                          className={`w-full text-left flex gap-3 p-3 rounded-2xl border transition-colors cursor-pointer ${
                            active
                              ? "bg-blue-50/70 border-blue-200"
                              : "bg-white border-transparent hover:bg-zinc-50 hover:border-zinc-200"
                          }`}
                        >
                          {c.productImage ? (
                            <img
                              src={c.productImage}
                              alt={c.productTitle}
                              loading="lazy"
                              className="w-12 h-12 rounded-xl object-cover border border-zinc-200 shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-zinc-900 text-white flex items-center justify-center text-xs font-black shrink-0">
                              {initials(counterpartOf(c))}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <img
                                  src={
                                    counterpartOf(c).toLowerCase().includes("gennyson")
                                      ? GENNYSON_AVATAR_URL
                                      : AVATAR_CACHE.get(
                                          c.buyerId === currentUser.id
                                            ? c.sellerId || c.sellerName
                                            : c.buyerId || c.buyerName
                                        ) ||
                                        `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
                                          counterpartOf(c)
                                        )}`
                                  }
                                  alt=""
                                  className="w-4 h-4 rounded-full object-cover border border-zinc-200 shrink-0"
                                />
                                <span className="font-black text-zinc-900 text-sm truncate">
                                  {isPlatformChat(c) ? `${c.buyerName} → ${c.sellerName}` : counterpartOf(c)}
                                </span>
                                {counterpartOf(c).toLowerCase().includes("gennyson") && (
                                  <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />
                                )}
                              </div>
                              <span className="text-[10px] font-semibold text-zinc-400 shrink-0">
                                {shortTime(c.lastMessageAt)}
                              </span>
                            </div>
                            <div className="text-[11px] font-bold text-zinc-500 uppercase truncate">
                              {cleanOrderTitle(c.productTitle)}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span
                                className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${
                                  c.status === "delivered"
                                    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                    : "text-amber-700 bg-amber-50 border-amber-200"
                                }`}
                              >
                                {c.status === "delivered" ? "Entregue" : "Aguardando entrega"}
                              </span>
                              <span className="text-[10px] font-bold text-zinc-400">
                                {isPlatformChat(c) ? "Venda da plataforma" : iBuy ? "Compra" : "Venda"}
                              </span>
                            </div>
                            {c.lastMessage && (
                              <div className="text-[11px] text-zinc-500 truncate mt-1">
                                {c.lastMessage.replace(/\s+/g, " ")}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </aside>

              {/* --------------------------- Conversa --------------------------- */}
              <section
                className={`${
                  mobileConversation ? "flex" : "hidden lg:flex"
                } flex-col bg-white rounded-3xl border border-zinc-200 shadow-xs overflow-hidden min-h-0`}
              >
                {!selected ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
                    <div className="w-16 h-16 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center">
                      <MessageSquare className="w-8 h-8" />
                    </div>
                    <p className="text-sm font-bold text-zinc-500">Selecione uma conversa</p>
                  </div>
                ) : (
                  <>
                    {/* Cabeçalho do pedido */}
                    <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-start gap-3">
                      <button
                        onClick={() => {
                          setMobileConversation(false);
                          try {
                            window.history.replaceState(null, "", "/chat");
                          } catch {}
                        }}
                        className="lg:hidden p-2 -ml-1 rounded-xl hover:bg-zinc-100 text-zinc-600 cursor-pointer"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      {selected.productImage ? (
                        <a
                          href={productHref(selected)}
                          onClick={(e) => goToProduct(e, selected)}
                          title="Ver anúncio"
                          className="shrink-0"
                        >
                          <img
                            src={selected.productImage}
                            alt={selected.productTitle}
                            className="w-14 h-14 rounded-xl object-cover border border-zinc-200 hover:border-[#0066FF] transition-colors"
                          />
                        </a>
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-zinc-100 text-zinc-400 flex items-center justify-center shrink-0">
                          <Package className="w-6 h-6" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-black text-zinc-950 text-sm sm:text-base uppercase truncate max-w-full">
                            <a
                              href={productHref(selected)}
                              onClick={(e) => goToProduct(e, selected)}
                              title="Abrir o anúncio"
                              className="hover:text-[#0066FF] hover:underline underline-offset-2 transition-colors cursor-pointer"
                            >
                              {cleanOrderTitle(selected.productTitle)}
                            </a>
                          </h2>
                          {isDisputed ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full border text-rose-700 bg-rose-50 border-rose-200 animate-pulse">
                              <Lock className="w-3 h-3 text-rose-600" />
                              Em Mediação
                            </span>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full border ${
                                selected.status === "delivered"
                                  ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                  : "text-amber-700 bg-amber-50 border-amber-200"
                              }`}
                            >
                              {selected.status === "delivered" ? (
                                <PackageCheck className="w-3 h-3" />
                              ) : (
                                <Clock className="w-3 h-3" />
                              )}
                              {selected.status === "delivered" ? "Entregue" : "Aguardando entrega"}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] sm:text-xs text-zinc-500 font-medium mt-0.5 flex flex-wrap items-center gap-x-2">
                          <span>{fullTime(selected.createdAt)}</span>
                          <span>•</span>
                          <span className="font-black text-[#0066FF]">{brl(selected.price)}</span>
                          <span>•</span>
                          <span className="font-mono text-zinc-400">#{selected.code}</span>
                        </div>

                        {/* Aviso de Modo Moderação Oficial para o Administrador (fica abaixo do aviso de contato externo) */}
                        <div className="w-full text-xs font-semibold text-zinc-600 mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-2">
                          {isSellerOfSelected ? (
                            <span className="inline-flex items-center gap-1.5">
                              <ShoppingBag className="w-3.5 h-3.5 text-zinc-400" /> Comprador:{" "}
                              <img
                                src={
                                  (selected.buyerId && AVATAR_CACHE.get(selected.buyerId)) ||
                                  AVATAR_CACHE.get(selected.buyerName) ||
                                  (selected.buyerName.toLowerCase().includes("gennyson")
                                    ? GENNYSON_AVATAR_URL
                                    : `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
                                        selected.buyerName
                                      )}`)
                                }
                                alt={selected.buyerName}
                                className="w-4 h-4 rounded-full object-cover border border-zinc-200 inline-block shadow-2xs"
                              />
                              <b className="text-zinc-900">{selected.buyerName?.toLowerCase().includes("jovizeira") ? "BuscaNinja" : selected.buyerName}</b>
                              {selected.buyerName.toLowerCase().includes("gennyson") && (
                                <span title="Administrador Oficial" className="inline-flex shrink-0">
                                  <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400 drop-shadow-2xs" />
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5">
                              <Store className="w-3.5 h-3.5 text-zinc-400" /> Vendedor:{" "}
                              <img
                                src={
                                  selected.sellerName.toLowerCase().includes("gennyson")
                                    ? GENNYSON_AVATAR_URL
                                    : (selected.sellerId && AVATAR_CACHE.get(selected.sellerId)) ||
                                      AVATAR_CACHE.get(selected.sellerName) ||
                                      `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
                                        selected.sellerName
                                      )}`
                                }
                                alt={selected.sellerName}
                                className="w-4 h-4 rounded-full object-cover border border-zinc-200 inline-block shadow-2xs"
                              />
                              <b className="text-zinc-900">{selected.sellerName?.toLowerCase().includes("jovizeira") ? "BuscaNinja" : selected.sellerName}</b>
                              {selected.sellerName.toLowerCase().includes("gennyson") && (
                                <span title="Administrador Oficial" className="inline-flex shrink-0">
                                  <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400 drop-shadow-2xs" />
                                </span>
                              )}
                            </span>
                          )}
                          {(isSellerOfSelected || selected.buyerId === currentUser.id || !isUserAdmin) && (
                            <div className="flex items-center gap-2 ml-auto">
                              {isDisputed && mediationOpenedBy === myRoleInChat ? (
                                <button
                                  type="button"
                                  disabled={withdrawing}
                                  onClick={handleWithdrawProblem}
                                  title="Retirar o problema reportado e encerrar a mediação"
                                  className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-white hover:bg-red-50 border border-red-600 text-red-600 font-black text-xs whitespace-nowrap transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                  <ShieldAlert className="w-3.5 h-3.5" />
                                  {withdrawing ? "Retirando..." : "Retirar Problema"}
                                </button>
                              ) : isDisputed ? (
                                <button
                                  type="button"
                                  disabled
                                  title={`Já existe uma mediação aberta pelo ${mediationOpenedBy === "seller" ? "vendedor" : "comprador"}`}
                                  className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-zinc-100 border border-zinc-200 text-zinc-400 font-black text-xs whitespace-nowrap cursor-not-allowed"
                                >
                                  <ShieldAlert className="w-3.5 h-3.5" />
                                  Em mediação
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setModalError("");
                                    setModalText("");
                                    setReportOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-red-600 hover:bg-red-700 border border-red-600 text-white font-black text-xs whitespace-nowrap transition-colors cursor-pointer"
                                >
                                  <ShieldAlert className="w-3.5 h-3.5" />
                                  Reportar Problema
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={selected.status !== "delivered"}
                                title={
                                  activeReview
                                    ? "Clique para editar sua avaliação"
                                    : selected.status !== "delivered"
                                    ? isSellerOfSelected
                                      ? "Disponível depois que você entregar o pedido"
                                      : "Disponível depois que o vendedor entregar o pedido"
                                    : isSellerOfSelected
                                    ? "Avaliar o comprador"
                                    : "Avaliar o vendedor"
                                }
                                onClick={() => {
                                  setModalError("");
                                  // Editar: já abre com a nota e o comentário que a pessoa deu antes
                                  setModalText(activeReview ? activeReview.comment : "");
                                  setRating(activeReview ? activeReview.rating : 0);
                                  setRateOpen(true);
                                }}
                                className={`inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg border font-black text-xs whitespace-nowrap transition-colors ${
                                  activeReview
                                    ? "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700 cursor-pointer"
                                    : selected.status === "delivered"
                                    ? "bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white cursor-pointer"
                                    : "bg-zinc-100 border-zinc-200 text-zinc-400 cursor-not-allowed"
                                }`}
                              >
                                <Star
                                  className={`w-3.5 h-3.5 ${
                                    activeReview
                                      ? "fill-amber-400 text-amber-400"
                                      : selected.status === "delivered"
                                      ? "fill-white"
                                      : ""
                                  }`}
                                />
                                {activeReview ? `Avaliado ${activeReview.rating}/5 · Editar` : "Avaliar"}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Aviso de Modo Moderação Oficial para o Administrador (fica acima do aviso de contato externo) */}
                    {isUserAdmin && selected.sellerId !== currentUser.id && selected.buyerId !== currentUser.id && (
                      <div className="flex items-center justify-between gap-2.5 px-4 sm:px-5 py-2.5 bg-amber-50 border-b border-amber-200">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Crown className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" />
                          <p className="text-[11px] sm:text-xs font-bold text-amber-900 leading-snug">
                            Você está intermediando este atendimento como <strong>ADMIN</strong>.
                          </p>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-black shrink-0">
                          Acesso Admin
                        </span>
                      </div>
                    )}

                    {/* Aviso fixo: proibido contato externo */}
                    <div className="flex items-center gap-2.5 px-4 sm:px-5 py-2.5 bg-rose-50 border-b border-rose-100">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                      <p className="text-[11px] sm:text-xs font-bold text-rose-700 leading-snug">
                        Proibido passar WhatsApp, Instagram ou outro contato externo: a conta será banida.
                      </p>
                    </div>

                    {/* Mensagens */}
                    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-3 bg-zinc-50/60">
                      {loadingMessages && messages.length === 0 ? (
                        <div className="py-12 flex items-center justify-center gap-2 text-xs font-bold text-zinc-500">
                          <Loader2 className="w-4 h-4 animate-spin" /> Carregando mensagens...
                        </div>
                      ) : (
                        messages.map((m, idx) => {
                          const prev = messages[idx - 1];
                          const showDay = !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt);
                          const mine = !!currentUser && m.senderId === currentUser.id && m.kind === "text";

                          return (
                            <React.Fragment key={m.id}>
                              {showDay && (
                                <div className="flex justify-center py-1">
                                  <span className="text-[10px] font-black text-zinc-400 bg-white border border-zinc-200 rounded-full px-3 py-1">
                                    {dayLabel(m.createdAt)}
                                  </span>
                                </div>
                              )}

                              {m.body.includes("MEDIAÇÃO") ||
                              m.body.includes("PROBLEMA REPORTADO") ||
                              m.body.includes("SALDO BLOQUEADO") ||
                              m.senderName?.includes("Mediação") ? (
                                <MediationCard
                                  message={m}
                                  chat={selected}
                                  dispute={activeDispute}
                                  isAdmin={isUserAdmin}
                                  onResolve={handleResolveDispute}
                                />
                              ) : m.kind === "system" ? (
                                <SystemCard message={m} chat={selected} />
                              ) : m.kind === "delivery" ? (
                                <div className="max-w-xl rounded-2xl border border-emerald-200 bg-white shadow-xs overflow-hidden">
                                  <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-emerald-50 border-b border-emerald-100">
                                    <span className="flex items-center gap-1.5 text-[11px] font-black text-emerald-700 uppercase tracking-wider">
                                      <img
                                        src={getSenderAvatar(m)}
                                        alt=""
                                        className="w-4 h-4 rounded-full object-cover border border-emerald-300"
                                      />
                                      <Zap className="w-3.5 h-3.5" />
                                      Entrega do vendedor
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => copyText(m.id, m.body)}
                                      className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                                    >
                                      {copiedId === m.id ? (
                                        <>
                                          <Check className="w-3.5 h-3.5" /> Copiado
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3.5 h-3.5" /> Copiar
                                        </>
                                      )}
                                    </button>
                                  </div>
                                  <p className="px-4 py-3.5 text-xs sm:text-[13px] text-zinc-800 leading-relaxed whitespace-pre-wrap break-words select-text">
                                    {m.body}
                                  </p>
                                  <div className="flex items-center justify-between px-4 pb-2.5 text-[10px] text-zinc-400">
                                    <span>{shortTime(m.createdAt)}</span>
                                    {mine && (
                                      m.isRead ? (
                                        <span className="inline-flex items-center gap-1 text-[#0066FF] font-bold" title="Visualizada pelo comprador">
                                          <span>Visualizada</span>
                                          <CheckCheck className="w-3.5 h-3.5 text-[#0066FF]" />
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-zinc-400" title="Entregue">
                                          <span>Entregue</span>
                                          <CheckCheck className="w-3.5 h-3.5 text-zinc-400" />
                                        </span>
                                      )
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                                  <div className="max-w-[85%] sm:max-w-[70%]">
                                    {(() => {
                                      const isMsgAdmin =
                                        (mine && (
                                          currentUser?.role === "admin" ||
                                          currentUser?.name?.toLowerCase().includes("gennyson") ||
                                          currentUser?.email?.toLowerCase().includes("gennyson")
                                        )) ||
                                        m.senderRole === "admin" ||
                                        m.senderName?.toLowerCase().includes("gennyson") ||
                                        (m.senderName?.toLowerCase().includes("admin") && !m.senderName?.toLowerCase().includes("modera"));

                                      const isMsgMod =
                                        !isMsgAdmin && (
                                          (mine && (currentUser as any)?.role === "moderator") ||
                                          m.senderRole === "system" ||
                                          m.senderName?.toLowerCase().includes("modera")
                                        );

                                      const staffRole = isMsgAdmin ? "admin" : isMsgMod ? "moderador" : null;

                                      const cleanOtherName = (m.senderName || (m.senderRole === "seller" ? "Vendedor" : "Comprador"))
                                        .replace(/\s*\((?:Admin|Moderador|Admin Oficial)[^)]*\)/gi, "").replace(/jovizeira/gi, "BuscaNinja").trim();

                                      const cleanMyName = (currentUser?.name || m.senderName || "Você")
                                        .replace(/\s*\((?:Admin|Moderador|Admin Oficial)[^)]*\)/gi, "").replace(/jovizeira/gi, "BuscaNinja").trim();

                                      if (!mine) {
                                        return (
                                          <div className="text-[11px] font-bold text-zinc-500 mb-1.5 ml-1 flex items-center gap-2">
                                            <img
                                              src={getSenderAvatar(m)}
                                              alt={cleanOtherName}
                                              className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover border border-zinc-200 shadow-2xs shrink-0 bg-zinc-100 ring-1 ring-zinc-200/50"
                                            />
                                            {isMsgAdmin && (
                                              <span title="Administrador Oficial" className="inline-flex shrink-0">
                                                <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400 drop-shadow-2xs" />
                                              </span>
                                            )}
                                            <span className="font-extrabold text-zinc-900">
                                              {cleanOtherName}
                                            </span>
                                            {staffRole ? (
                                              <span
                                                className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-300 shrink-0 select-none"
                                                title={staffRole === "admin" ? "Administrador da Plataforma" : "Moderador da Plataforma"}
                                              >
                                                {staffRole}
                                              </span>
                                            ) : (
                                              <span
                                                className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                                  m.senderRole === "seller"
                                                    ? "bg-blue-100 text-[#0066FF] border border-blue-200"
                                                    : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                                                }`}
                                              >
                                                {m.senderRole === "seller" ? "VENDEDOR" : "COMPRADOR"}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      } else {
                                        return (
                                          <div className="text-[11px] font-bold text-zinc-500 mb-1.5 mr-1 flex items-center justify-end gap-2">
                                            {staffRole ? (
                                              <span
                                                className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-300 shrink-0 select-none"
                                                title={staffRole === "admin" ? "Administrador da Plataforma" : "Moderador da Plataforma"}
                                              >
                                                {staffRole}
                                              </span>
                                            ) : (
                                              <span
                                                className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                                  m.senderRole === "seller"
                                                    ? "bg-blue-100 text-[#0066FF] border border-blue-200"
                                                    : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                                                }`}
                                              >
                                                {m.senderRole === "seller" ? "VENDEDOR" : "COMPRADOR"}
                                              </span>
                                            )}
                                            {isMsgAdmin && (
                                              <span title="Administrador Oficial" className="inline-flex shrink-0">
                                                <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400 drop-shadow-2xs" />
                                              </span>
                                            )}
                                            <span className="font-extrabold text-zinc-900">
                                              {cleanMyName}
                                            </span>
                                            <img
                                              src={getMyAvatar()}
                                              alt={cleanMyName}
                                              className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover border border-zinc-200 shadow-2xs shrink-0 bg-zinc-100 ring-1 ring-zinc-200/50"
                                            />
                                          </div>
                                        );
                                      }
                                    })()}
                                    <div
                                      className={`px-4 py-2.5 rounded-2xl text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap break-words select-text ${
                                        m.body?.includes("PROBLEMA REPORTADO") || m.body?.includes("SALDO BLOQUEADO")
                                          ? "bg-rose-50 text-rose-950 border border-rose-300 shadow-xs"
                                          : m.body?.includes("MEDIAÇÃO CONCLUÍDA")
                                          ? "bg-emerald-50 text-emerald-950 border border-emerald-300 shadow-xs"
                                          : m.senderName?.includes("Moderação") || m.body?.includes("MODERAÇÃO")
                                          ? "bg-amber-50 text-amber-950 border border-amber-300 shadow-xs"
                                          : mine
                                          ? "bg-[#0066FF] text-white rounded-br-md"
                                          : "bg-white text-zinc-800 border border-zinc-200 rounded-bl-md"
                                      }`}
                                    >
                                      {m.body}
                                    </div>
                                    {mine ? (
                                      <div className="flex items-center justify-end gap-1.5 text-[10px] text-zinc-400 mt-1 mr-1 select-none">
                                        <span>{shortTime(m.createdAt)}</span>
                                        {m.isRead ? (
                                          <span className="inline-flex items-center text-[#0066FF]" title="Visualizada">
                                            <CheckCheck className="w-3.5 h-3.5" />
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center text-zinc-400" title="Entregue">
                                            <CheckCheck className="w-3.5 h-3.5" />
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="block text-[10px] text-zinc-400 mt-1 ml-1 select-none">
                                        {shortTime(m.createdAt)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}

                      {/* Se houver disputa aberta/registrada para este pedido e ainda não renderizou nenhum card de mediação nos balões, exibe o Card de Mediação */}
                      {activeDispute &&
                        !messages.some(
                          (m) =>
                            m.body.includes("MEDIAÇÃO") ||
                            m.body.includes("SALDO BLOQUEADO") ||
                            m.body.includes("PROBLEMA REPORTADO") ||
                            m.senderName?.includes("Mediação")
                        ) && (
                          <MediationCard
                            chat={selected}
                            dispute={activeDispute}
                            isAdmin={isUserAdmin}
                            onResolve={handleResolveDispute}
                          />
                        )}

                      <div ref={bottomRef} />
                    </div>

                    {/* Campo de mensagem */}
                    <div className="p-3 sm:p-4 border-t border-zinc-100 bg-white space-y-2">
                      {sendError && (
                        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                          <span>{sendError}</span>
                        </div>
                      )}
                      {canDeliver && (
                        <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 cursor-pointer w-fit">
                          <input
                            type="checkbox"
                            checked={asDelivery}
                            onChange={(e) => setAsDelivery(e.target.checked)}
                            className="w-4 h-4 accent-[#0066FF]"
                          />
                          <PackageCheck className="w-4 h-4 text-emerald-600" />
                          Enviar como entrega (conclui o pedido)
                        </label>
                      )}
                      <div className="flex items-end gap-2">
                        <textarea
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSend();
                            }
                          }}
                          rows={asDelivery ? 4 : 1}
                          placeholder={
                            asDelivery ? "Cole aqui os dados da entrega..." : "Digite sua mensagem..."
                          }
                          className="flex-1 resize-none max-h-40 px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-[#0066FF] text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
                        />
                        <button
                          onClick={handleSend}
                          disabled={sending || !draft.trim()}
                          className="h-11 px-5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs inline-flex items-center gap-2 transition-colors cursor-pointer shrink-0"
                        >
                          {sending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                          <span className="hidden sm:inline">{asDelivery ? "Entregar" : "Enviar"}</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </section>
            </div>
          )}
        </div>
      </main>

      {(reportOpen || rateOpen) && selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModals();
          }}
        >
          <div className="w-full max-w-md bg-white rounded-3xl border border-zinc-200 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-zinc-100">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    reportOpen ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                  }`}
                >
                  {reportOpen ? <ShieldAlert className="w-5 h-5" /> : <Star className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-zinc-950 text-sm">
                    {reportOpen
                      ? "Reportar Problema"
                      : activeReview
                      ? "Editar avaliação"
                      : isSellerOfSelected
                      ? "Avaliar o comprador"
                      : "Avaliar o vendedor"}
                  </h3>
                  <p className="text-[11px] text-zinc-500 truncate uppercase">
                    #{selected.code} • {cleanOrderTitle(selected.productTitle)}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModals}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {rateOpen && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-zinc-700">
                    {isSellerOfSelected ? "Como foi atender este cliente?" : "Como foi sua experiência?"}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRating(n)}
                        className="p-1 cursor-pointer"
                        aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
                      >
                        <Star
                          className={`w-8 h-8 transition-colors ${
                            n <= rating ? "text-amber-400 fill-amber-400" : "text-zinc-300"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-zinc-500 block mb-1.5">
                  {reportOpen ? "O que aconteceu?" : "Comentário (opcional)"}
                </label>
                <textarea
                  value={modalText}
                  onChange={(e) => setModalText(e.target.value)}
                  rows={4}
                  maxLength={600}
                  autoFocus
                  placeholder={
                    reportOpen
                      ? isSellerOfSelected
                        ? "Descreva o problema com o comprador ou com o pedido..."
                        : "Descreva o problema com o produto ou com a entrega..."
                      : isSellerOfSelected
                      ? "Conte como foi a negociação e o atendimento a este cliente..."
                      : "Conte como foi a compra e o atendimento..."
                  }
                  className="w-full resize-none px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-[#0066FF] text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
                />
              </div>

              {reportOpen && (
                <div className="flex items-start gap-3 rounded-xl border border-red-400 bg-red-50 px-4 py-3">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-800 leading-relaxed font-medium">
                    Esta ação notificará um administrador sobre o problema. Certifique-se de fornecer informações precisas.
                  </p>
                </div>
              )}

              {rateOpen && (
                <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-800 leading-relaxed font-medium">
                    {isSellerOfSelected
                      ? "Esta avaliação é privada: só você e a moderação do PlayContas conseguem vê-la. Você pode editá-la quando quiser."
                      : myReview
                      ? "Você pode editar sua avaliação quando quiser. Ao salvar, a nota e o comentário anteriores serão substituídos."
                      : "Depois de enviar, você poderá editar sua avaliação sempre que quiser, caso mude de ideia."}
                  </p>
                </div>
              )}

              {modalError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                  <span>{modalError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 bg-zinc-50 border-t border-zinc-100">
              <button
                onClick={closeModals}
                disabled={modalBusy}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={submitModal}
                disabled={modalBusy}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-black transition-colors cursor-pointer disabled:opacity-50 ${
                  reportOpen ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {modalBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {reportOpen ? "Enviar relato" : activeReview ? "Salvar alterações" : "Enviar avaliação"}
              </button>
            </div>
          </div>
        </div>
      )}

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialTab={authInitialTab}
        onLoginSuccess={(user) => {
          if (user.email?.toLowerCase() === "gennysonmarinhodemacedo@gmail.com") {
            user.role = "admin";
          }
          saveStoredUser(user);
          setCurrentUser(user);
          setAuthModalOpen(false);
        }}
      />

      <JamFooter />
    </div>
  );
}
