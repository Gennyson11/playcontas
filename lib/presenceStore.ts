import { useEffect, useState, useRef } from "react";
import { UserProfile } from "@/types";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { getStoredUserSync } from "./authStore";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRESENCE_CHANNEL_NAME = "presence:central_global";

export interface PresenceInfo {
  isOnline: boolean;
  label: string;
}

export interface PresencePayload {
  userId?: string;
  userEmail?: string;
  userName?: string;
  isGennyson?: boolean;
  onlineAt?: string;
}

/**
 * Formata o tempo decorrido desde a última vez em que o vendedor foi visto online.
 * Exemplos:
 * - Menos de 2 min: "Online agora"
 * - Menos de 1 hora: "Online há 15 min"
 * - Menos de 24 horas: "Online há 4 horas"
 * - 1 dia: "Online ontem"
 * - Menos de 30 dias: "Online há 3 dias"
 * - Sem data: "Offline"
 */
export function formatLastSeen(dateString?: string | number | null): PresenceInfo {
  if (!dateString) {
    return { isOnline: false, label: "Offline" };
  }

  const time = typeof dateString === "number" ? dateString : new Date(dateString).getTime();
  if (isNaN(time) || time <= 0) {
    return { isOnline: false, label: "Offline" };
  }

  const now = Date.now();
  const diffMs = Math.max(0, now - time);
  const diffMin = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  // Visto recentemente (menos de 2 minutos) => Online agora
  if (diffMin < 2) {
    return { isOnline: true, label: "Online agora" };
  }

  // Menos de 1 hora
  if (diffMin < 60) {
    return {
      isOnline: false,
      label: `Online há ${diffMin} min`,
    };
  }

  // Menos de 24 horas (ex: "Online há 4 horas")
  if (diffHours < 24) {
    return {
      isOnline: false,
      label: `Online há ${diffHours} ${diffHours === 1 ? "hora" : "horas"}`,
    };
  }

  // 1 dia atrás
  if (diffDays === 1) {
    return {
      isOnline: false,
      label: "Online ontem",
    };
  }

  // Menos de 30 dias
  if (diffDays < 30) {
    return {
      isOnline: false,
      label: `Online há ${diffDays} dias`,
    };
  }

  return { isOnline: false, label: "Offline" };
}

/**
 * Grava o timestamp de atividade do usuário no banco de dados e no cache local.
 * Como a tabela `products` permite atualização direta com chave pública,
 * atualizamos o `updated_at` dos anúncios do vendedor garantindo persistência imediata.
 */
export async function recordUserActivity(user: UserProfile | null | undefined): Promise<void> {
  if (!user) return;
  const now = new Date().toISOString();

  if (typeof window !== "undefined") {
    try {
      if (user.id) localStorage.setItem(`central_last_seen_${user.id}`, now);
      if (user.email) localStorage.setItem(`central_last_seen_${user.email.toLowerCase().trim()}`, now);
      if (user.name) localStorage.setItem(`central_last_seen_${user.name.toLowerCase().trim()}`, now);
      localStorage.setItem("central_my_last_seen", now);
    } catch {}
  }

  if (!isSupabaseConfigured) return;

  const isGennyson =
    (user.email && user.email.toLowerCase().includes("gennyson")) ||
    (user.name && user.name.toLowerCase().includes("gennyson")) ||
    user.id === "bb25d258-3152-422b-aa04-7bd34e8a5927";

  try {
    // 1. Atualiza nos anúncios do vendedor (onde o banco aceita update)
    if (isGennyson) {
      await supabase
        .from("products")
        .update({ updated_at: now })
        .eq("seller_name", "Gennyson Marinho");
    } else if (user.name) {
      await supabase
        .from("products")
        .update({ updated_at: now })
        .ilike("seller_name", user.name.trim());
    }

    // 2. Tenta atualizar também em profiles
    if (user.id && UUID_REGEX.test(user.id)) {
      await supabase
        .from("profiles")
        .update({ updated_at: now })
        .eq("id", user.id);
    } else if (user.email) {
      await supabase
        .from("profiles")
        .update({ updated_at: now })
        .ilike("email", user.email.trim());
    }
  } catch {}
}

// Singleton global de canal de presença
let globalChannel: any = null;
let isChannelSubscribed = false;
let currentTrackingPayload: PresencePayload | null = null;
let activePresences: PresencePayload[] = [];
const presenceListeners = new Set<(presences: PresencePayload[]) => void>();

function notifyPresenceListeners() {
  const snapshot = [...activePresences];
  presenceListeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch {}
  });
}

function extractPresences(state: any): PresencePayload[] {
  const items: PresencePayload[] = [];
  if (!state || typeof state !== "object") return items;

  Object.values(state).forEach((list: any) => {
    if (Array.isArray(list)) {
      list.forEach((p: any) => {
        if (p && typeof p === "object") {
          items.push({
            userId: p.userId ? String(p.userId) : undefined,
            userEmail: p.userEmail ? String(p.userEmail).toLowerCase().trim() : undefined,
            userName: p.userName ? String(p.userName).toLowerCase().trim() : undefined,
            isGennyson: Boolean(p.isGennyson),
            onlineAt: p.onlineAt,
          });
        }
      });
    }
  });

  return items;
}

function initGlobalPresenceChannel() {
  if (globalChannel || !isSupabaseConfigured || typeof window === "undefined") {
    return globalChannel;
  }

  try {
    globalChannel = supabase.channel(PRESENCE_CHANNEL_NAME);

    const onPresenceSync = () => {
      try {
        const state = globalChannel.presenceState();
        activePresences = extractPresences(state);
        notifyPresenceListeners();
      } catch {}
    };

    globalChannel
      .on("presence", { event: "sync" }, onPresenceSync)
      .on("presence", { event: "join" }, onPresenceSync)
      .on("presence", { event: "leave" }, onPresenceSync)
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          isChannelSubscribed = true;
          // Se já havia um usuário pronto para ser rastreado, envia agora
          if (currentTrackingPayload) {
            globalChannel.track(currentTrackingPayload).catch(() => {});
          }
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          isChannelSubscribed = false;
        }
      });
  } catch {}

  return globalChannel;
}

/**
 * Hook global (executado no JamHeader):
 * Rastreia a presença em tempo real do usuário logado via WebSocket.
 * Ao fechar o navegador/aba, a conexão fecha e o Supabase emite "leave" automaticamente.
 */
export function usePresenceHeartbeat(currentUser: UserProfile | null | undefined): void {
  useEffect(() => {
    const user = currentUser || getStoredUserSync();
    if (!user || !user.id) return;

    initGlobalPresenceChannel();

    const isGennyson =
      (user.email && user.email.toLowerCase().includes("gennyson")) ||
      (user.name && user.name.toLowerCase().includes("gennyson")) ||
      user.id === "bb25d258-3152-422b-aa04-7bd34e8a5927";

    const payload: PresencePayload = {
      userId: user.id,
      userEmail: user.email?.toLowerCase().trim(),
      userName: user.name?.toLowerCase().trim(),
      isGennyson,
      onlineAt: new Date().toISOString(),
    };

    currentTrackingPayload = payload;

    // Se o canal já estiver conectado, rastreia imediatamente
    if (globalChannel && isChannelSubscribed) {
      globalChannel.track(payload).catch(() => {});
    }

    // Grava timestamp de atividade inicial
    recordUserActivity(user);

    // Heartbeat a cada 30 segundos enquanto a página estiver aberta
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        recordUserActivity(user);
        if (globalChannel && isChannelSubscribed) {
          globalChannel.track({
            ...payload,
            onlineAt: new Date().toISOString(),
          }).catch(() => {});
        }
      }
    }, 30000);

    // Atualiza ao voltar para a aba
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        recordUserActivity(user);
        if (globalChannel && isChannelSubscribed) {
          globalChannel.track({
            ...payload,
            onlineAt: new Date().toISOString(),
          }).catch(() => {});
        }
      } else {
        recordUserActivity(user);
      }
    };

    // Ao fechar a aba/navegador, registra saída
    const handleUnload = () => {
      recordUserActivity(user);
      if (globalChannel && isChannelSubscribed) {
        try {
          globalChannel.untrack();
        } catch {}
      }
    };

    window.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [currentUser?.id, currentUser?.email, currentUser?.name]);
}

/**
 * Hook para consultar o status de presença em tempo real de um vendedor:
 * - Se o vendedor estiver conectado via WebSocket no site => "Online agora" (verde).
 * - Se tiver fechado a página => "Online há X min", "Online há 4 horas", etc. (cinza).
 */
export function useSellerPresence(opts: {
  sellerId?: string | null;
  sellerEmail?: string | null;
  sellerName?: string | null;
  fallbackUpdatedAt?: string | null;
  isOwner?: boolean | null;
}): PresenceInfo {
  const { sellerId, sellerEmail, sellerName, fallbackUpdatedAt, isOwner } = opts;

  const isTargetGennyson =
    Boolean(sellerId && sellerId.includes("bb25d258")) ||
    Boolean(sellerEmail && sellerEmail.toLowerCase().includes("gennyson")) ||
    Boolean(sellerName && sellerName.toLowerCase().includes("gennyson"));

  const checkIsConnected = (presences: PresencePayload[]): boolean => {
    if (isOwner) return true;
    const cleanId = (sellerId || "").toLowerCase().trim();
    const cleanEmail = (sellerEmail || "").toLowerCase().trim();
    const cleanName = (sellerName || "").toLowerCase().trim();

    return presences.some((p) => {
      if (isTargetGennyson && p.isGennyson) return true;
      if (cleanId && p.userId && p.userId.toLowerCase() === cleanId) return true;
      if (cleanEmail && p.userEmail && p.userEmail.toLowerCase() === cleanEmail) return true;
      if (cleanName && p.userName && p.userName.toLowerCase() === cleanName) return true;
      return false;
    });
  };

  const [isCurrentlyConnected, setIsCurrentlyConnected] = useState<boolean>(() => {
    if (isOwner) return true;
    return checkIsConnected(activePresences);
  });

  const [lastSeenTime, setLastSeenTime] = useState<number>(() => {
    if (isOwner) return Date.now();
    if (typeof window !== "undefined") {
      if (sellerId) {
        const cached = localStorage.getItem(`central_last_seen_${sellerId}`);
        if (cached) {
          const t = new Date(cached).getTime();
          if (!isNaN(t)) return t;
        }
      }
      if (sellerName) {
        const cached = localStorage.getItem(`central_last_seen_${sellerName.toLowerCase().trim()}`);
        if (cached) {
          const t = new Date(cached).getTime();
          if (!isNaN(t)) return t;
        }
      }
    }
    if (fallbackUpdatedAt) {
      const t = new Date(fallbackUpdatedAt).getTime();
      if (!isNaN(t)) return t;
    }
    return 0;
  });

  // 1. Escuta o canal global de presença do Supabase em tempo real
  useEffect(() => {
    initGlobalPresenceChannel();

    const handlePresencesChange = (presences: PresencePayload[]) => {
      if (isOwner) {
        setIsCurrentlyConnected(true);
        return;
      }
      const connected = checkIsConnected(presences);
      setIsCurrentlyConnected(connected);
      if (connected) {
        setLastSeenTime(Date.now());
      }
    };

    // Testa com o snapshot atual imediatamente
    handlePresencesChange(activePresences);

    presenceListeners.add(handlePresencesChange);
    return () => {
      presenceListeners.delete(handlePresencesChange);
    };
  }, [sellerId, sellerEmail, sellerName, isOwner, isTargetGennyson]);

  // 2. Consulta no Supabase a última atividade do vendedor em `products` e `profiles`
  useEffect(() => {
    if (isOwner) {
      setLastSeenTime(Date.now());
      return;
    }
    if (!isSupabaseConfigured) return;

    let cancelled = false;

    async function fetchLastSeenFromDb() {
      try {
        let pTime = 0;
        let prTime = 0;

        // A) Busca nos anúncios mais recentes do vendedor
        if (isTargetGennyson) {
          const { data } = await supabase
            .from("products")
            .select("updated_at")
            .eq("seller_name", "Gennyson Marinho")
            .order("updated_at", { ascending: false })
            .limit(1);
          if (data && data[0]?.updated_at) {
            const t = new Date(data[0].updated_at).getTime();
            if (!isNaN(t)) pTime = t;
          }
        } else if (sellerName) {
          const { data } = await supabase
            .from("products")
            .select("updated_at")
            .ilike("seller_name", sellerName.trim())
            .order("updated_at", { ascending: false })
            .limit(1);
          if (data && data[0]?.updated_at) {
            const t = new Date(data[0].updated_at).getTime();
            if (!isNaN(t)) pTime = t;
          }
        }

        // B) Busca na tabela profiles
        let profileQuery = supabase.from("profiles").select("id, updated_at");
        if (isTargetGennyson) {
          profileQuery = profileQuery.eq("id", "bb25d258-3152-422b-aa04-7bd34e8a5927");
        } else if (sellerId && UUID_REGEX.test(sellerId)) {
          profileQuery = profileQuery.eq("id", sellerId);
        } else if (sellerEmail) {
          profileQuery = profileQuery.ilike("email", sellerEmail.trim());
        } else if (sellerName) {
          profileQuery = profileQuery.ilike("full_name", sellerName.trim());
        }

        const { data: profData } = await profileQuery.limit(1).maybeSingle();
        if (profData?.updated_at) {
          const t = new Date(profData.updated_at).getTime();
          if (!isNaN(t)) prTime = t;
        }

        // Seleciona a data mais recente encontrada
        const freshest = Math.max(pTime, prTime);
        if (!cancelled && freshest > 0) {
          setLastSeenTime((prev) => Math.max(prev, freshest));
        }
      } catch {}
    }

    fetchLastSeenFromDb();

    // Reconsulta a cada 60s
    const interval = setInterval(fetchLastSeenFromDb, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sellerId, sellerEmail, sellerName, isOwner, isTargetGennyson]);

  // 3. Atualiza periodicamente o label de presença (recalcula a cada 20 segundos)
  const [presenceInfo, setPresenceInfo] = useState<PresenceInfo>(() => {
    if (isOwner || isCurrentlyConnected) {
      return { isOnline: true, label: "Online agora" };
    }
    return formatLastSeen(lastSeenTime);
  });

  useEffect(() => {
    const update = () => {
      if (isOwner || isCurrentlyConnected) {
        setPresenceInfo({ isOnline: true, label: "Online agora" });
      } else {
        setPresenceInfo(formatLastSeen(lastSeenTime));
      }
    };

    update();
    const interval = setInterval(update, 20000);
    return () => clearInterval(interval);
  }, [isOwner, isCurrentlyConnected, lastSeenTime]);

  return presenceInfo;
}
