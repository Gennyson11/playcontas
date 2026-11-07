"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserProfile } from "@/types";
import { NotificationBell } from "@/components/NotificationBell";
import { usePresenceHeartbeat } from "@/lib/presenceStore";
import { getStoredUserSync, saveStoredUser, isUserAdmin } from "@/lib/authStore";
import {
  Search,
  ShoppingCart,
  PlusCircle,
  Shield,
  User,
  LogOut,
  ChevronDown,
  Bell,
  Compass,
  Sparkles,
  Home,
  ShoppingBag,
  Heart,
  MessageSquare,
  TrendingUp,
  Tag,
  Package,
  Settings,
  ShieldCheck,
  HelpCircle,
  Wallet,
} from "lucide-react";

interface JamHeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  cartCount: number;
  onOpenCart: () => void;
  onOpenCreateListing: () => void;
  onOpenCategories?: () => void;
  currentUser?: UserProfile | null;
  onOpenMyProducts?: () => void;
  onOpenAuth?: (tab?: "login" | "register") => void;
  onOpenAdmin?: () => void;
  onOpenSettings?: () => void;
  onLogout?: () => void;
  onGoHome?: () => void;
}

export function JamHeader({
  searchQuery,
  onSearchChange,
  cartCount,
  onOpenCart,
  onOpenCreateListing,
  onOpenCategories,
  currentUser,
  onOpenMyProducts,
  onOpenAuth,
  onOpenAdmin,
  onOpenSettings,
  onLogout,
  onGoHome,
}: JamHeaderProps) {
  const router = useRouter();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Status de verificação em tempo real
  const [liveVerifStatus, setLiveVerifStatus] = useState<"none" | "pending" | "approved" | "rejected">(() => {
    if (currentUser?.isVerified || currentUser?.verificationStatus === "approved") return "approved";
    if (currentUser?.verificationStatus) return currentUser.verificationStatus;
    return "none";
  });

  useEffect(() => {
    if (!currentUser?.id && !currentUser?.email) return;

    const checkLiveStatus = async () => {
      try {
        const query = new URLSearchParams();
        if (currentUser?.id) query.set("userId", currentUser.id);
        if (currentUser?.email) query.set("email", currentUser.email);
        const res = await fetch(`/api/verifications?${query.toString()}`);
        if (res.ok) {
          const json = await res.json();
          if (json.submission?.status) {
            const st = json.submission.status;
            setLiveVerifStatus(st);
            const cur = getStoredUserSync();
            if (cur && (cur.verificationStatus !== st || (st === "approved" && !cur.isVerified))) {
              const isAdm = isUserAdmin(cur);
              const updated = {
                ...cur,
                verificationStatus: st,
                isVerified: st === "approved",
                role: isAdm ? "admin" : (st === "approved" ? "seller" : "buyer"),
              };
              saveStoredUser(updated as any);
            }
            return;
          }
        }
      } catch {}

      if (currentUser?.isVerified || currentUser?.verificationStatus === "approved") {
        setLiveVerifStatus("approved");
      } else if (currentUser?.verificationStatus) {
        setLiveVerifStatus(currentUser.verificationStatus);
      }
    };

    checkLiveStatus();
    const interval = setInterval(checkLiveStatus, 3000);
    window.addEventListener("central_verifications_changed", checkLiveStatus);
    window.addEventListener("central_auth_changed", checkLiveStatus);
    window.addEventListener("storage", checkLiveStatus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("central_verifications_changed", checkLiveStatus);
      window.removeEventListener("central_auth_changed", checkLiveStatus);
      window.removeEventListener("storage", checkLiveStatus);
    };
  }, [currentUser?.id, currentUser?.email, currentUser?.isVerified, currentUser?.verificationStatus]);

  const effectiveVerifStatus: "none" | "pending" | "approved" | "rejected" =
    liveVerifStatus !== "none"
      ? liveVerifStatus
      : (currentUser?.isVerified || currentUser?.verificationStatus === "approved")
      ? "approved"
      : currentUser?.verificationStatus || "none";

  // Rastreamento em tempo real de presença do usuário logado
  usePresenceHeartbeat(currentUser);

  React.useEffect(() => {
    try {
      router.prefetch("/meus-produtos");
      router.prefetch("/minha-conta");
    } catch {}
  }, [router]);

  const handleMenuClick = (action?: () => void) => {
    setUserDropdownOpen(false);
    if (action) action();
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-zinc-200 shadow-xs select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between min-h-[72px] sm:min-h-[76px] py-2 sm:py-2.5 gap-3 sm:gap-6">
          {/* Logo on Left: PlayContas */}
          <div
            onClick={() => {
              if (onGoHome) onGoHome();
              else {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
            className="flex items-center shrink-0 cursor-pointer group py-1"
          >
            <img
              src="/playcontas.png"
              alt="PlayContas"
              className="h-12 sm:h-14 md:h-[58px] w-auto max-w-[220px] sm:max-w-[280px] object-contain transition-transform group-hover:scale-105 drop-shadow-xs"
            />
          </div>

          {/* Search Bar in Header */}
          <div className="flex-1 max-w-xl mx-2 sm:mx-4">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Buscar contas, serviços, ChatGPT, jogos..."
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-zinc-200 hover:border-zinc-300 focus:border-[#0066FF] bg-zinc-50/70 focus:bg-white text-xs font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none transition-all"
              />
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Right Action Icons & Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Discord Link */}
            <a
              href="https://discord.gg"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:flex items-center justify-center w-9 h-9 rounded-xl bg-zinc-50 border border-zinc-200 hover:border-[#0066FF] text-zinc-600 hover:text-[#0066FF] transition-colors"
              title="Discord Oficial"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.894a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
            </a>

            {/* Categorias Link */}
            {onOpenCategories && (
              <button
                onClick={onOpenCategories}
                className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-zinc-700 hover:text-black hover:bg-zinc-100 transition-colors"
              >
                <Compass className="w-4 h-4 text-[#0066FF]" />
                <span>Categorias</span>
              </button>
            )}

            {/* + Anunciar Button in Electric Blue - exibido apenas quando o usuário estiver cadastrado/logado */}
            {currentUser && (
              <button
                onClick={onOpenCreateListing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs shadow-md shadow-blue-500/25 transition-all active:scale-95"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Anunciar</span>
              </button>
            )}

            {/* Cart Button */}
            <button
              onClick={onOpenCart}
              className="relative p-2 rounded-xl text-zinc-700 hover:text-black hover:bg-zinc-100 transition-colors"
              title="Carrinho"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#0066FF] text-white text-[10px] font-black flex items-center justify-center border-2 border-white shadow-xs">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Bell Notification (perguntas e respostas dos anúncios) */}
            <NotificationBell currentUser={currentUser} />

            {/* Admin Panel Button if user is Admin */}
            {isUserAdmin(currentUser) && (
              <button
                onClick={() => {
                  if (onOpenAdmin) onOpenAdmin();
                  else router.push("/admin");
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#0066FF] font-black text-xs shadow-2xs transition-all active:scale-95 cursor-pointer"
                title="Abrir Painel Admin"
              >
                <Shield className="w-3.5 h-3.5 text-[#0066FF] fill-[#0066FF]/20" />
                <span>Painel Admin</span>
              </button>
            )}

            {/* User Avatar / Login */}
            {!currentUser ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onOpenAuth?.("login")}
                  className="px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold transition-colors"
                >
                  Entrar
                </button>
                <button
                  onClick={() => onOpenAuth?.("register")}
                  className="hidden sm:inline-block px-3.5 py-1.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-bold transition-all shadow-xs hover:shadow-md"
                >
                  Cadastrar
                </button>
              </div>
            ) : (
              <div className="relative">
                {/* Profile Pill Trigger Button */}
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 p-1.5 pl-2.5 rounded-xl hover:bg-zinc-100 border border-zinc-200 transition-colors"
                >
                  <span className="text-xs font-bold text-zinc-900 hidden sm:inline max-w-[110px] truncate">
                    {currentUser.name}
                  </span>
                  <img
                    src={
                      currentUser.avatar &&
                      !currentUser.avatar.includes("dicebear") &&
                      !currentUser.avatar.includes("avatar-bb25d258")
                        ? currentUser.avatar
                        : currentUser.email?.toLowerCase().includes("gennyson") ||
                          currentUser.name?.toLowerCase().includes("gennyson")
                        ? "https://lazueuycrcqirdykdppm.supabase.co/storage/v1/object/public/avatars/avatar-gennysonmarinhodemacedo_gmail_com.gif"
                        : currentUser.avatar ||
                          `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
                            currentUser.name || "User"
                          )}`
                    }
                    alt={currentUser.name}
                    className="w-7 h-7 rounded-lg border border-[#0066FF]/40 object-cover"
                  />
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${
                      userDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Dropdown Backdrop to close on outside click */}
                {userDropdownOpen && (
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserDropdownOpen(false)}
                  />
                )}

                {/* User Dropdown Menu */}
                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-zinc-200 rounded-2xl shadow-2xl py-2 z-50 animate-scaleUp text-zinc-900 select-none">
                    {/* Header Info */}
                    <div className="px-4 py-2.5 border-b border-zinc-100">
                      <span className="block text-xs font-black text-zinc-950 truncate">
                        {currentUser.name}
                      </span>
                      <span className="block text-[11px] text-zinc-400 truncate">
                        {currentUser.email}
                      </span>
                    </div>

                    {/* Saldo / Carteira */}
                    <button
                      onClick={() =>
                        handleMenuClick(() => {
                          try {
                            sessionStorage.setItem("minha_conta_active_tab", "carteira");
                          } catch {}
                          router.push("/carteira");
                        })
                      }
                      className="w-full px-4 py-2.5 border-b border-zinc-100 flex items-center justify-between text-xs hover:bg-zinc-50 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-[#0066FF]" />
                        <span className="text-zinc-600 font-semibold group-hover:text-zinc-900">Carteira & Saques:</span>
                      </div>
                      <span className="font-extrabold text-[#0066FF]">
                        R$ {currentUser.balance.toFixed(2).replace(".", ",")}
                      </span>
                    </button>

                    {/* Acesso ao Painel Admin se for Administrador */}
                    {isUserAdmin(currentUser) && (
                      <button
                        onClick={() =>
                          handleMenuClick(() => {
                            if (onOpenAdmin) onOpenAdmin();
                            else router.push("/admin");
                          })
                        }
                        className="w-full px-4 py-2.5 border-b border-zinc-100 flex items-center justify-between text-xs bg-blue-50/70 hover:bg-blue-100/70 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-[#0066FF] fill-[#0066FF]/20" />
                          <span className="text-[#0066FF] font-black">Painel do Administrador</span>
                        </div>
                        <span className="text-[10px] font-bold bg-[#0066FF] text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Admin
                        </span>
                      </button>
                    )}

                    <div className="py-1">
                      {/* GRUPO 1: INÍCIO, COMPRAS, FAVORITOS, MENSAGENS */}
                      <button
                        onClick={() =>
                          handleMenuClick(() => {
                            if (onGoHome) onGoHome();
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          })
                        }
                        className="w-full px-4 py-2 text-left text-xs font-semibold text-zinc-700 hover:text-[#0066FF] hover:bg-zinc-50 flex items-center gap-2.5 transition-colors"
                      >
                        <Home className="w-4 h-4 text-zinc-400" />
                        <span>Inicio</span>
                      </button>

                      <button
                        onClick={() =>
                          handleMenuClick(() => {
                            try {
                              sessionStorage.setItem("minha_conta_active_tab", "pedidos");
                            } catch {}
                            if (typeof window !== "undefined") {
                              window.dispatchEvent(new CustomEvent("central_tab_changed", { detail: "pedidos" }));
                            }
                            router.push("/minha-conta");
                          })
                        }
                        className="w-full px-4 py-2 text-left text-xs font-semibold text-zinc-700 hover:text-[#0066FF] hover:bg-zinc-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <ShoppingBag className="w-4 h-4 text-zinc-400" />
                        <span>Meus Pedidos</span>
                      </button>

                      <button
                        onClick={() =>
                          handleMenuClick(() => {
                            try {
                              sessionStorage.setItem("minha_conta_active_tab", "favoritos");
                            } catch {}
                            if (typeof window !== "undefined") {
                              window.dispatchEvent(new CustomEvent("central_tab_changed", { detail: "favoritos" }));
                            }
                            router.push("/minha-conta");
                          })
                        }
                        className="w-full px-4 py-2 text-left text-xs font-semibold text-zinc-700 hover:text-[#0066FF] hover:bg-zinc-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <Heart className="w-4 h-4 text-zinc-400" />
                        <span>Favoritos</span>
                      </button>

                      <button
                        onClick={() =>
                          handleMenuClick(() => {
                            window.location.href = "/chat";
                          })
                        }
                        className="w-full px-4 py-2 text-left text-xs font-semibold text-zinc-700 hover:text-[#0066FF] hover:bg-zinc-50 flex items-center gap-2.5 transition-colors"
                      >
                        <MessageSquare className="w-4 h-4 text-zinc-400" />
                        <span>Chat</span>
                      </button>
                    </div>

                    {/* DIVIDER */}
                    <div className="border-t border-zinc-100 my-1" />

                    <div className="py-1">
                      {/* GRUPO 2: ANUNCIAR, VENDAS, MEUS PRODUTOS */}
                      <div className="px-4 pt-1.5 pb-1 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                        VENDAS
                      </div>
                      <button
                        onClick={() =>
                          handleMenuClick(() => onOpenCreateListing())
                        }
                        className="w-full px-4 py-2 text-left text-xs font-bold text-[#0066FF] hover:bg-blue-50/70 flex items-center gap-2.5 transition-colors"
                      >
                        <PlusCircle className="w-4 h-4 text-[#0066FF]" />
                        <span>Anunciar</span>
                      </button>

                      <button
                        onClick={() =>
                          handleMenuClick(() => {
                            if (onOpenMyProducts) onOpenMyProducts();
                            else router.push("/meus-produtos");
                          })
                        }
                        className="w-full px-4 py-2 text-left text-xs font-semibold text-zinc-700 hover:text-[#0066FF] hover:bg-zinc-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <Package className="w-4 h-4 text-zinc-400" />
                        <span>Meus Produtos</span>
                      </button>

                      <button
                        onClick={() =>
                          handleMenuClick(() => {
                            try {
                              sessionStorage.setItem("minha_conta_active_tab", "vendas");
                            } catch {}
                            if (typeof window !== "undefined") {
                              window.dispatchEvent(new CustomEvent("central_tab_changed", { detail: "vendas" }));
                            }
                            router.push("/minha-conta");
                          })
                        }
                        className="w-full px-4 py-2 text-left text-xs font-semibold text-zinc-700 hover:text-[#0066FF] hover:bg-zinc-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <TrendingUp className="w-4 h-4 text-zinc-400" />
                        <span>Vendas</span>
                      </button>
                    </div>

                    {/* DIVIDER */}
                    <div className="border-t border-zinc-100 my-1" />

                    <div className="py-1">
                      {/* GRUPO 3: MEU PERFIL, CONFIGURAÇÕES, AJUDA */}
                      <button
                        onClick={() =>
                          handleMenuClick(() => {
                            try {
                              sessionStorage.setItem("minha_conta_active_tab", "minha-conta");
                            } catch {}
                            if (typeof window !== "undefined") {
                              window.dispatchEvent(new CustomEvent("central_tab_changed", { detail: "minha-conta" }));
                            }
                            if (onOpenSettings) onOpenSettings();
                            else router.push("/minha-conta");
                          })
                        }
                        className="w-full px-4 py-2 text-left text-xs font-semibold text-zinc-700 hover:text-[#0066FF] hover:bg-zinc-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <User className="w-4 h-4 text-zinc-400" />
                        <span>Meu Perfil</span>
                      </button>

                      <button
                        onClick={() =>
                          handleMenuClick(() => {
                            try {
                              sessionStorage.setItem("minha_conta_active_tab", "minha-conta");
                            } catch {}
                            if (typeof window !== "undefined") {
                              window.dispatchEvent(new CustomEvent("central_tab_changed", { detail: "minha-conta" }));
                            }
                            if (onOpenSettings) onOpenSettings();
                            else router.push("/minha-conta");
                          })
                        }
                        className="w-full px-4 py-2 text-left text-xs font-semibold text-zinc-700 hover:text-[#0066FF] hover:bg-zinc-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <Settings className="w-4 h-4 text-zinc-400" />
                        <span>Configurações</span>
                      </button>

                      <button
                        onClick={() =>
                          handleMenuClick(() => {
                            try {
                              sessionStorage.setItem("minha_conta_active_tab", "verificacao");
                            } catch {}
                            if (typeof window !== "undefined") {
                              window.dispatchEvent(new CustomEvent("central_tab_changed", { detail: "verificacao" }));
                            }
                            router.push("/minha-conta");
                          })
                        }
                        className="w-full px-4 py-2 text-left text-xs font-semibold text-zinc-700 hover:text-[#0066FF] hover:bg-zinc-50 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <span>Verificação</span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                            effectiveVerifStatus === "approved"
                              ? "text-emerald-600 bg-emerald-50 border-emerald-200"
                              : effectiveVerifStatus === "rejected"
                              ? "text-rose-700 bg-rose-50 border-rose-200"
                              : effectiveVerifStatus === "pending"
                              ? "text-amber-700 bg-amber-50 border-amber-200"
                              : "text-zinc-500 bg-zinc-50 border-zinc-200"
                          }`}
                        >
                          {effectiveVerifStatus === "approved"
                            ? "Aprovada"
                            : effectiveVerifStatus === "rejected"
                            ? "Recusada"
                            : effectiveVerifStatus === "pending"
                            ? "Em Análise"
                            : "Pendente"}
                        </span>
                      </button>

                      <button
                        onClick={() =>
                          handleMenuClick(() => {
                            alert("Central de Ajuda, Suporte e FAQ 24h.");
                          })
                        }
                        className="w-full px-4 py-2 text-left text-xs font-semibold text-zinc-700 hover:text-[#0066FF] hover:bg-zinc-50 flex items-center gap-2.5 transition-colors"
                      >
                        <HelpCircle className="w-4 h-4 text-zinc-400" />
                        <span>Ajuda</span>
                      </button>
                    </div>

                    {/* DIVIDER */}
                    <div className="border-t border-zinc-100 my-1" />

                    {/* GRUPO 4: SAIR */}
                    <div className="py-1">
                      <button
                        onClick={() =>
                          handleMenuClick(() => {
                            if (onLogout) onLogout();
                          })
                        }
                        className="w-full px-4 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-rose-500" />
                        <span>Sair</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
