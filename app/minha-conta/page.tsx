"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserProfile, CartItem } from "@/types";
import { getUserAvatar, saveUserAvatar } from "@/lib/avatarStore";
import { getStoredUserSync, saveStoredUser, clearStoredUser, persistUser } from "@/lib/authStore";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { JamHeader } from "@/components/JamHeader";
import { JamFooter } from "@/components/JamFooter";
import { UserSettingsView } from "@/components/UserSettingsView";
import { CartDrawer } from "@/components/CartDrawer";
import { AuthModal } from "@/components/AuthModal";
import { User, ArrowLeft } from "lucide-react";

export default function MinhaContaPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getStoredUserSync());

  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const savedCart = localStorage.getItem("central_cart");
        if (savedCart) return JSON.parse(savedCart);
      } catch {}
    }
    return [];
  });

  const [cartOpen, setCartOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialTab, setAuthInitialTab] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const user = getStoredUserSync();
    if (user) {
      setCurrentUser(user);
    }
  }, []);

  // Garante URL limpa /minha-conta caso alguém acesse com ?tab=verificacao ou ?tab=notificacoes
  useEffect(() => {
    if (typeof window !== "undefined") {
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (tab === "verificacao" || tab === "notificacoes" || tab === "perguntas" || tab === "carteira" || tab === "vendas") {
        try {
          sessionStorage.setItem("minha_conta_active_tab", tab);
        } catch {}
        window.history.replaceState({}, "", "/minha-conta");
      }
    }
  }, []);

  // Restore and sync logged user on client load
  useEffect(() => {
    const syncUser = async () => {
      const user = getStoredUserSync();
      if (!user) {
        setCurrentUser(null);
        return;
      }

      // Consulta o status real e mais recente da verificação no servidor
      let serverStatus: "none" | "pending" | "approved" | "rejected" | null = null;
      try {
        const query = new URLSearchParams();
        if (user.id) query.set("userId", user.id);
        if (user.email) query.set("email", user.email);
        const res = await fetch(`/api/verifications?${query.toString()}`);
        if (res.ok) {
          const json = await res.json();
          if (json.submission?.status) {
            serverStatus = json.submission.status;
          }
        }
      } catch {}

      if (isSupabaseConfigured && user?.email) {
        supabase
          .from("profiles")
          .select("*")
          .ilike("email", user.email)
          .maybeSingle()
          .then(({ data }: { data: any }) => {
            if (data) {
              setCurrentUser((prev) => {
                if (!prev || prev.email?.toLowerCase() !== user.email?.toLowerCase()) return prev;
                let resolvedName = data.full_name || prev.name;
                if (user.email?.toLowerCase().includes("jovitools") && (!resolvedName || resolvedName.toLowerCase().includes("jovizeira"))) {
                  resolvedName = "BuscaNinja";
                  supabase.from("profiles").update({ full_name: "BuscaNinja" }).eq("id", data.id).then();
                }
                const resolvedStatus = (data.is_verified || serverStatus === "approved")
                  ? ("approved" as const)
                  : (serverStatus || prev.verificationStatus || "none");
                const updated = {
                  ...prev,
                  avatar: data.avatar_url,
                  name: resolvedName,
                  balance: data.balance != null ? Number(data.balance) : prev.balance,
                  role: (data.role || prev.role) as "admin" | "buyer" | "seller",
                  isVerified: Boolean(data.is_verified || resolvedStatus === "approved"),
                  verificationStatus: resolvedStatus,
                  phone: data.phone || prev.phone,
                };
                saveStoredUser(updated);
                return updated;
              });
            }
          });
      } else {
        const resolvedStatus = serverStatus || user.verificationStatus || "none";
        const updated = {
          ...user,
          verificationStatus: resolvedStatus,
          isVerified: resolvedStatus === "approved",
          role: resolvedStatus === "approved" ? "seller" : (user.role === "admin" ? "admin" : "buyer"),
        };
        if (updated.verificationStatus !== user.verificationStatus || updated.isVerified !== user.isVerified) {
          saveStoredUser(updated as any);
        }
        setCurrentUser(updated as any);
      }
    };

    syncUser();

    const interval = setInterval(syncUser, 3000);
    window.addEventListener("central_auth_changed", syncUser);
    window.addEventListener("central_verifications_changed", syncUser);
    window.addEventListener("storage", syncUser);
    return () => {
      clearInterval(interval);
      window.removeEventListener("central_auth_changed", syncUser);
      window.removeEventListener("central_verifications_changed", syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  // Restore cart from localStorage
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem("central_cart");
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      }
    } catch {}
  }, []);

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-sans selection:bg-[#0066FF] selection:text-white">
      {/* Header */}
      <JamHeader
        searchQuery=""
        onSearchChange={(q) => router.push(`/?search=${encodeURIComponent(q)}`)}
        cartCount={totalCartCount}
        onOpenCart={() => router.push("/carrinho")}
        onOpenCreateListing={() => router.push("/anunciar")}
        currentUser={currentUser}
        onOpenMyProducts={() => router.push("/meus-produtos")}
        onOpenAuth={(tab) => {
          setAuthInitialTab(tab || "login");
          setAuthModalOpen(true);
        }}
        onOpenSettings={() => {
          // Already on minha-conta
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onGoHome={() => router.push("/")}
        onLogout={async () => {
          await clearStoredUser();
          setCurrentUser(null);
          router.push("/");
        }}
      />

      {/* Main Content */}
      <main className="flex-1 py-8">
        {!currentUser && (!isMounted || loading) ? (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 flex flex-col items-center justify-center min-h-[420px]">
            <div className="w-9 h-9 border-3 border-[#0066FF] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-zinc-400 font-semibold mt-3 animate-pulse">
              Carregando dados da sua conta...
            </span>
          </div>
        ) : currentUser ? (
          <UserSettingsView
            currentUser={currentUser}
            onBackToShop={() => router.push("/")}
            onUpdateProfile={(updated) => {
              setCurrentUser(updated);
              try {
                persistUser(updated);
                const raw = localStorage.getItem("central_cached_products");
                if (raw) {
                  const parsed = JSON.parse(raw);
                  const synced = parsed.map((p: any) => {
                    const isMatch =
                      p.seller?.id === updated.id ||
                      p.seller?.name?.toLowerCase() === updated.name.toLowerCase() ||
                      p.seller?.name === "Gennyson Marinho";
                    if (isMatch) {
                      return {
                        ...p,
                        seller: {
                          ...p.seller,
                          name: updated.name,
                          avatar: updated.avatar,
                        },
                      };
                    }
                    return p;
                  });
                  localStorage.setItem("central_cached_products", JSON.stringify(synced));
                }
              } catch {}
            }}
            onOpenAdmin={() => router.push("/")}
            onCreateListing={() => router.push("/")}
            onOpenMyProducts={() => router.push("/meus-produtos")}
          />
        ) : (
          <div className="max-w-md mx-auto py-20 px-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#0066FF] flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-sm">
              <User className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-black text-zinc-900 mb-2">Acesso restrito</h1>
            <p className="text-sm text-zinc-500 mb-6">
              Faça login ou cadastre-se para acessar e configurar os dados da sua conta.
            </p>
            <button
              onClick={() => {
                setAuthInitialTab("login");
                setAuthModalOpen(true);
              }}
              className="px-6 py-3 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-sm font-black transition-all shadow-md hover:shadow-lg inline-flex items-center gap-2 cursor-pointer"
            >
              Fazer Login
            </button>
          </div>
        )}
      </main>

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart}
        onRemoveItem={(id) => setCart((prev) => prev.filter((i) => i.product.id !== id))}
        onCheckout={() => {
          setCartOpen(false);
          router.push("/");
        }}
      />

      {/* Auth Modal */}
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

      {/* Footer */}
      <JamFooter />
    </div>
  );
}
