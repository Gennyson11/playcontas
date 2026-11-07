"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Trash2, Clock, MessageCircle, Reply, ShoppingBag, AlertTriangle, Settings } from "lucide-react";
import { UserProfile } from "@/types";
import {
  AppNotification,
  loadNotifications,
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  clearReadNotifications,
  formatNotificationTime,
} from "@/lib/notificationStore";
import { installNotificationSoundUnlock, playNotificationSound } from "@/lib/notificationSound";
import {
  getNotificationPreferences,
  sendBrowserPushNotification,
} from "@/lib/notificationPreferences";

interface NotificationBellProps {
  currentUser?: UserProfile | null;
}

export function NotificationBell({ currentUser }: NotificationBellProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [items, setItems] = useState<AppNotification[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  // IDs de notificações já vistas nesta sessão (null = ainda não carregou a primeira vez)
  const seenIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    seenIdsRef.current = null;
    installNotificationSoundUnlock();

    const refresh = async () => {
      const list = await loadNotifications(currentUser);
      if (cancelled) return;

      // Toca o som quando chega uma notificação NÃO LIDA que ainda não tinha aparecido.
      // Na primeira carga só memoriza as existentes (não toca som ao abrir o site).
      const seen = seenIdsRef.current;
      if (seen === null) {
        seenIdsRef.current = new Set(list.map((n) => n.id));
      } else {
        const hasNew = list.some((n) => !n.read && !seen.has(n.id));
        const newUnread = list.filter((n) => !n.read && !seen.has(n.id));
        list.forEach((n) => seen.add(n.id));
        if (hasNew) {
          const prefs = getNotificationPreferences(currentUser?.id);
          if (prefs.siteNotifications) {
            playNotificationSound();
          }
          if (prefs.browserPushEnabled) {
            const latest = newUnread[0];
            if (latest) {
              sendBrowserPushNotification(
                latest.title || "PlayContas",
                {
                  body: latest.body || "Você tem uma nova notificação.",
                },
                currentUser?.id
              );
            }
          }
        }
      }

      setItems(list);
    };
    refresh();
    window.addEventListener("central_notifications_updated", refresh);
    window.addEventListener("storage", refresh);
    const unsubscribe = subscribeToNotifications(currentUser, refresh);
    const interval = setInterval(refresh, 15000);
    return () => {
      cancelled = true;
      window.removeEventListener("central_notifications_updated", refresh);
      window.removeEventListener("storage", refresh);
      unsubscribe();
      clearInterval(interval);
    };
  }, [currentUser?.id, currentUser?.name]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  if (!currentUser) return null;

  const unreadCount = items.filter((n) => !n.read).length;
  const visible = tab === "unread" ? items.filter((n) => !n.read) : items;

  const handleOpenNotification = (n: AppNotification) => {
    markNotificationRead(n.id);
    setOpen(false);
    router.push(n.link);
  };

  return (
    <div ref={containerRef} className="relative flex items-center">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-xl text-zinc-700 hover:text-black hover:bg-zinc-100 transition-colors cursor-pointer"
        title="Notificações"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[#0066FF] border-2 border-white animate-pulse" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[380px] max-w-[92vw] bg-white rounded-2xl border border-zinc-200 shadow-xl overflow-hidden z-50">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
            <div className="flex items-center gap-2 text-[#0066FF] font-black text-sm">
              <Bell className="w-4 h-4" />
              <span>Notificações</span>
              <button
                onClick={() => {
                  setOpen(false);
                  router.push("/minha-conta?tab=notificacoes");
                }}
                title="Preferências de notificação"
                className="p-1 rounded-lg text-zinc-400 hover:text-[#0066FF] hover:bg-zinc-100 transition-colors ml-1 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold text-zinc-500">
              <button
                onClick={() => markAllNotificationsRead(currentUser)}
                className="flex items-center gap-1 hover:text-[#0066FF] transition-colors cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Ler tudo</span>
              </button>
              <button
                onClick={() => clearReadNotifications(currentUser)}
                className="flex items-center gap-1 hover:text-rose-500 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar lidas</span>
              </button>
            </div>
          </div>

          {/* Abas */}
          <div className="px-4 pt-3">
            <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-100 rounded-xl text-xs font-bold">
              <button
                onClick={() => setTab("all")}
                className={`py-1.5 rounded-lg transition-colors cursor-pointer ${
                  tab === "all" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                Todas · {items.length}
              </button>
              <button
                onClick={() => setTab("unread")}
                className={`py-1.5 rounded-lg transition-colors cursor-pointer ${
                  tab === "unread" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                Não lidas · {unreadCount}
              </button>
            </div>
          </div>

          {/* Lista */}
          <div className="max-h-[420px] overflow-y-auto p-3 space-y-2">
            {visible.length === 0 ? (
              <div className="py-10 text-center text-xs font-medium text-zinc-400">
                {tab === "unread" ? "Nenhuma notificação não lida." : "Você não tem notificações."}
              </div>
            ) : (
              visible.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleOpenNotification(n)}
                  className={`w-full text-left flex gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${
                    n.read
                      ? "bg-white border-zinc-100 hover:bg-zinc-50"
                      : "bg-blue-50/60 border-blue-100 hover:bg-blue-50"
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-zinc-900 text-white flex items-center justify-center shrink-0">
                    {n.kind === "answer" ? (
                      <Reply className="w-4 h-4" />
                    ) : n.kind === "sale" ? (
                      <ShoppingBag className="w-4 h-4 text-emerald-400" />
                    ) : n.kind === "system" ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    ) : (
                      <MessageCircle className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-zinc-900 text-xs truncate">{n.title}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 border ${
                        n.kind === "system"
                          ? "text-amber-700 bg-amber-50 border-amber-200"
                          : n.kind === "sale"
                          ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                          : "text-[#0066FF] bg-blue-50 border-blue-100"
                      }`}>
                        {n.kind === "answer"
                          ? "Resposta"
                          : n.kind === "sale"
                          ? "Venda"
                          : n.kind === "system"
                          ? "Aviso"
                          : "Pergunta"}
                      </span>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-[#0066FF] shrink-0 ml-auto" />}
                    </div>

                    {/* Produto relacionado (miniatura + título do anúncio) */}
                    {n.productTitle && (
                      <div className="flex items-center gap-2 py-1">
                        {n.productImage ? (
                          <img
                            src={n.productImage}
                            alt={n.productTitle}
                            loading="lazy"
                            decoding="async"
                            className="w-9 h-9 rounded-lg object-cover border border-zinc-200 shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center shrink-0">
                            <ShoppingBag className="w-4 h-4 text-zinc-400" />
                          </div>
                        )}
                        <span className="text-[11px] font-bold text-zinc-800 line-clamp-2 break-words uppercase leading-tight">
                          {n.productTitle}
                        </span>
                      </div>
                    )}

                    <p className="text-xs text-zinc-600 line-clamp-2 break-words">{n.body}</p>
                    <div className="flex items-center gap-1 text-[11px] text-zinc-400 pt-0.5">
                      <Clock className="w-3 h-3" />
                      <span>{formatNotificationTime(n.createdAt)}</span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
