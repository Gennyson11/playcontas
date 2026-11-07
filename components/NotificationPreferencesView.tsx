"use client";

import React, { useState, useEffect } from "react";
import { UserProfile } from "@/types";
import {
  Bell,
  BellRing,
  BellOff,
  Check,
  Sparkles,
  MessageSquare,
  DollarSign,
  Wallet,
  RotateCcw,
  Scale,
  Star,
  Package,
  Send,
  ArrowLeft,
} from "lucide-react";
import { playNotificationSound } from "@/lib/notificationSound";
import {
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  getNotificationPreferences,
  saveNotificationPreferences,
} from "@/lib/notificationPreferences";

interface NotificationPreferencesViewProps {
  currentUser: UserProfile;
  onBack?: () => void;
}

export function NotificationPreferencesView({
  currentUser,
  onBack,
}: NotificationPreferencesViewProps) {
  const [prefs, setPrefs] = useState<NotificationPreferences>(() =>
    getNotificationPreferences(currentUser?.id)
  );

  useEffect(() => {
    setPrefs(getNotificationPreferences(currentUser?.id));
  }, [currentUser?.id]);

  // Sincroniza preferências no localStorage
  const updatePref = (key: keyof NotificationPreferences, value: boolean) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      saveNotificationPreferences(currentUser?.id, next);
      return next;
    });
  };

  const handleEnablePush = async () => {
    updatePref("browserPushEnabled", true);
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        try {
          await Notification.requestPermission();
        } catch {}
      }
    }
  };

  const handleDisablePush = () => {
    updatePref("browserPushEnabled", false);
  };

  // Enviar notificação de teste
  const handleTestNotification = () => {
    playNotificationSound();

    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted" &&
      prefs.browserPushEnabled
    ) {
      try {
        new Notification("PlayContas", {
          body: "Esta é uma notificação de teste do PlayContas! 🎉",
          icon: "/logo.png",
        });
      } catch {}
    }
  };

  const notificationCategories = [
    {
      key: "chatMessages" as const,
      label: "Mensagens de chat",
      desc: "Quando você receber novas mensagens no chat",
      icon: MessageSquare,
    },
    {
      key: "saleApproved" as const,
      label: "Venda aprovada",
      desc: "Quando uma venda sua for aprovada",
      icon: DollarSign,
    },
    {
      key: "balanceReleased" as const,
      label: "Saldo liberado",
      desc: "Quando o valor de uma venda sair do escrow",
      icon: Wallet,
    },
    {
      key: "refund" as const,
      label: "Reembolso",
      desc: "Quando um reembolso for realizado",
      icon: RotateCcw,
    },
    {
      key: "mediation" as const,
      label: "Mediação",
      desc: "Quando uma mediação for aberta ou encerrada",
      icon: Scale,
    },
    {
      key: "newReview" as const,
      label: "Nova avaliação",
      desc: "Quando um comprador avaliar sua venda",
      icon: Star,
    },
    {
      key: "orderUpdates" as const,
      label: "Atualizações de pedidos",
      desc: "Mudanças no status dos seus pedidos",
      icon: Package,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Card Principal */}
      <div className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
        {/* CABEÇALHO DO CARD COM BOTÃO VOLTAR */}
        <div className="flex items-center justify-between pb-6 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="w-9 h-9 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-600 hover:text-black flex items-center justify-center transition-colors cursor-pointer"
                title="Voltar para Minha Conta"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : null}
            <div>
              <h2 className="text-base sm:text-lg font-black text-zinc-950 tracking-tight">
                Notificações
              </h2>
              <p className="text-xs text-zinc-500 font-medium mt-0.5">
                Escolha o que você quer receber e configure seus alertas no PlayContas.
              </p>
            </div>
          </div>
        </div>

        {/* Notificações pelo site (Master Toggle) */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#0066FF] flex items-center justify-center shrink-0 mt-0.5">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-zinc-950">
                Notificações pelo site
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                O sino do cabeçalho e os alertas em tempo real enquanto você navega.
              </p>
            </div>
          </div>

          {/* Toggle Switch */}
          <button
            type="button"
            role="switch"
            aria-checked={prefs.siteNotifications}
            onClick={() => updatePref("siteNotifications", !prefs.siteNotifications)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
              prefs.siteNotifications ? "bg-[#0066FF]" : "bg-zinc-200"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                prefs.siteNotifications ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Lista de Categorias de Notificação */}
        <div
          className={`space-y-4 pt-2 transition-opacity duration-200 ${
            prefs.siteNotifications ? "opacity-100" : "opacity-40 pointer-events-none"
          }`}
        >
          {notificationCategories.map((item) => {
            const isChecked = prefs[item.key];
            return (
              <div
                key={item.key}
                className="flex items-center justify-between gap-4 py-2 border-t border-zinc-100 first:border-t-0"
              >
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-zinc-900">
                    {item.label}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-zinc-500 mt-0.5">
                    {item.desc}
                  </p>
                </div>

                {/* Sub Toggle Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={isChecked}
                  onClick={() => updatePref(item.key, !isChecked)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    isChecked ? "bg-[#0066FF]" : "bg-zinc-200"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      isChecked ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>

        {/* Divisor */}
        <div className="border-t border-zinc-100 pt-6">
          {/* Seção Push no Navegador */}
          <div>
            <h3 className="text-sm sm:text-base font-bold text-zinc-950">
              Notificações no navegador (push)
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
              Avisos que aparecem neste navegador mesmo com o PlayContas fechado.
            </p>

            {/* Botões Ativar / Desativar */}
            <div className="flex flex-wrap items-center gap-3 mt-4">
              <button
                type="button"
                onClick={handleEnablePush}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border ${
                  prefs.browserPushEnabled
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-2xs"
                    : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                }`}
              >
                <BellRing className="w-3.5 h-3.5" />
                <span>Ativar</span>
              </button>

              <button
                type="button"
                onClick={handleDisablePush}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border ${
                  !prefs.browserPushEnabled
                    ? "bg-rose-50 text-rose-700 border-rose-200 shadow-2xs"
                    : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                }`}
              >
                <BellOff className="w-3.5 h-3.5" />
                <span>Desativar</span>
              </button>
            </div>

            {/* Texto de Status */}
            <div className="mt-3 flex items-center gap-2">
              {prefs.browserPushEnabled ? (
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Suas notificações estão ativas.</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400">
                  <span className="w-2 h-2 rounded-full bg-zinc-300" />
                  <span>Notificações desativadas neste navegador.</span>
                </div>
              )}
            </div>

            {/* Botão Enviar Notificação de Teste */}
            <div className="mt-6 pt-4 border-t border-zinc-100">
              <button
                type="button"
                onClick={handleTestNotification}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 text-zinc-800 font-bold text-xs transition-all active:scale-[0.98] cursor-pointer inline-flex items-center gap-2 shadow-2xs"
              >
                <Bell className="w-4 h-4 text-zinc-500" />
                <span>Enviar notificação de teste</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
