"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Product, CartItem, UserProfile } from "@/types";
import { JamHeader } from "@/components/JamHeader";
import { JamFooter } from "@/components/JamFooter";
import { CreateListingView } from "@/components/CreateListingView";
import { CartModal } from "@/components/CartModal";
import { AuthModal } from "@/components/AuthModal";
import { getStoredUserSync, clearStoredUser, isUserAdmin, saveStoredUser } from "@/lib/authStore";
import { saveStoredProduct, getStoredProducts, deleteStoredProduct } from "@/lib/productStore";
import { getStoredVerification } from "@/lib/verificationStore";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { createProductRemote, groupsFromProduct } from "@/lib/productVault";
import { getProductUrl } from "@/lib/slug";
import { uploadToSupabaseStorage } from "@/lib/supabaseStorage";
import { ShieldCheck, Clock, AlertTriangle, ArrowRight, PlusCircle } from "lucide-react";

export default function AnunciarPage() {
  const router = useRouter();

  // User state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getStoredUserSync());
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authInitialTab, setAuthInitialTab] = useState<"login" | "register">("register");

  // Cart state
  const [cartModalOpen, setCartModalOpen] = useState<boolean>(false);
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const savedCart = localStorage.getItem("central_cart");
        if (savedCart) return JSON.parse(savedCart);
      } catch {}
    }
    return [];
  });

  // Verification prompt
  const [verificationNotice, setVerificationNotice] = useState<{
    isOpen: boolean;
    type: "unverified" | "pending";
  } | null>(null);

  // Sync user state
  useEffect(() => {
    const syncUser = () => {
      const user = getStoredUserSync();
      setCurrentUser(user);

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
                const isAdm = isUserAdmin(user) || isUserAdmin(prev) || data.role === "admin";
                const updated: UserProfile = {
                  ...prev,
                  name: data.full_name || prev.name,
                  avatar: data.avatar_url || prev.avatar,
                  balance: data.balance != null ? Number(data.balance) : prev.balance,
                  role: isAdm ? "admin" : ((data.role || prev.role) as "admin" | "buyer" | "seller"),
                  isVerified: Boolean(data.is_verified),
                  verificationStatus: data.is_verified ? ("approved" as const) : (prev.verificationStatus || "none"),
                };
                saveStoredUser(updated);
                return updated;
              });
            }
          });
      }
    };

    syncUser();

    window.addEventListener("central_auth_changed", syncUser);
    window.addEventListener("storage", syncUser);
    return () => {
      window.removeEventListener("central_auth_changed", syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  // Sync cart
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem("central_cart");
      if (savedCart) setCart(JSON.parse(savedCart));
    } catch {}
  }, []);

  // Checagem de permissão
  const isVerifiedSeller =
    currentUser?.role === "admin" ||
    currentUser?.role === "seller" ||
    Boolean(currentUser?.isVerified);

  const handleAddProduct = async (newProduct: Product) => {
    const finalImage = newProduct.image;

    // 2. O vendedor é SEMPRE o usuário logado (nome, foto e data de criação da conta dele)
    const user = currentUser || getStoredUserSync();
    const sellerName = user?.name || newProduct.seller?.name || "Vendedor";
    const sellerAvatar =
      user?.avatar ||
      newProduct.seller?.avatar ||
      `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(sellerName)}`;
    const memberSince = new Date(user?.createdAt || Date.now()).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const productWithSeller: Product = {
      ...newProduct,
      image: finalImage,
      status: user?.role === "admin" ? (newProduct.status || "active") : "pending_review",
      seller: {
        id: user?.id || newProduct.seller?.id || `seller-${Date.now()}`,
        name: sellerName,
        avatar: sellerAvatar,
        email: user?.email,
        isVerified: true,
        salesCount: 0,
        rating: 5.0,
        responseTime: "5 min",
        memberSince,
        level: "Bronze",
      },
    };

    // Salva IMEDIATAMENTE no armazenamento local (aparece em Meus Produtos na hora)
    saveStoredProduct(productWithSeller);

    // Upload da imagem para o Supabase Storage em segundo plano, se for base64
    if (finalImage && finalImage.startsWith("data:")) {
      try {
        const storageUrl = await uploadToSupabaseStorage(finalImage, "products", `prod-${Date.now()}`);
        if (storageUrl) {
          productWithSeller.image = storageUrl;
          saveStoredProduct(productWithSeller);
        }
      } catch (err) {
        console.warn("Upload para Supabase Storage falhou, usando imagem direta:", err);
      }
    }
    // 3. Salva no banco Supabase em segundo plano com variações e cofre seguro
    if (isSupabaseConfigured) {
      try {
        const groups = productWithSeller.vaultGroups || groupsFromProduct(productWithSeller);
        const res = await createProductRemote(productWithSeller, {
          sellerId: user?.id,
          sellerName,
          sellerAvatar,
          groups,
        });
        if (res.ok && res.id && res.id !== productWithSeller.id) {
          deleteStoredProduct(productWithSeller.id, productWithSeller);
          const updatedWithDbId = { ...productWithSeller, id: res.id };
          saveStoredProduct(updatedWithDbId);
        }
        if (!res.ok) {
          console.warn("Aviso ao salvar produto no Supabase:", res.error);
        }
      } catch (err) {
        console.warn("Aviso ao salvar produto no Supabase:", err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-zinc-900 flex flex-col font-sans antialiased selection:bg-[#0066FF] selection:text-white">
      <JamHeader
        searchQuery=""
        onSearchChange={() => {}}
        cartCount={cart.reduce((acc, i) => acc + i.quantity, 0)}
        onOpenCart={() => setCartModalOpen(true)}
        onOpenCreateListing={() => {}}
        currentUser={currentUser}
        onOpenAuth={(tab) => {
          setAuthInitialTab(tab || "register");
          setAuthModalOpen(true);
        }}
        onOpenAdmin={() => router.push("/")}
        onOpenSettings={() => router.push("/minha-conta")}
        onOpenMyProducts={() => router.push("/meus-produtos")}
        onGoHome={() => router.push("/")}
        onLogout={async () => {
          await clearStoredUser();
          setCurrentUser(null);
          router.push("/");
        }}
      />

      <main className="flex-1 py-8">
        {!currentUser ? (
          /* NÃO LOGADO */
          <div className="max-w-xl mx-auto px-4 py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-4 text-[#0066FF]">
              <PlusCircle className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-zinc-900 mb-2">
              Faça login para anunciar
            </h1>
            <p className="text-sm text-zinc-500 mb-6">
              Você precisa estar conectado à sua conta para criar novos anúncios e vender no marketplace.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  setAuthInitialTab("login");
                  setAuthModalOpen(true);
                }}
                className="px-6 py-2.5 rounded-xl bg-white border border-zinc-200 text-zinc-800 font-bold text-sm hover:bg-zinc-50 transition shadow-sm"
              >
                Entrar
              </button>
              <button
                onClick={() => {
                  setAuthInitialTab("register");
                  setAuthModalOpen(true);
                }}
                className="px-6 py-2.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-sm transition shadow-md shadow-blue-500/25"
              >
                Criar Conta Grátis
              </button>
            </div>
          </div>
        ) : !isVerifiedSeller ? (
          /* NÃO VERIFICADO */
          <div className="max-w-xl mx-auto px-4 py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-4 text-amber-500">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-zinc-900 mb-2">
              Verificação necessária para anunciar
            </h1>
            <p className="text-sm text-zinc-600 mb-6 max-w-md mx-auto">
              Para garantir a segurança de todos os compradores e vendedores da nossa plataforma, você precisa verificar sua conta antes de publicar anúncios.
            </p>
            <button
              onClick={() => {
                try {
                  sessionStorage.setItem("minha_conta_active_tab", "verificacao");
                } catch {}
                router.push("/minha-conta");
              }}
              className="px-6 py-3 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-sm transition shadow-md shadow-blue-500/25 inline-flex items-center gap-2 cursor-pointer"
            >
              <span>Verificar Minha Conta</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* FORMULÁRIO DE ANÚNCIO */
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <CreateListingView
              onBack={() => router.push("/meus-produtos")}
              onListingCreated={(newProd) => {
                handleAddProduct(newProd);
              }}
              onViewProduct={(newProd) => {
                router.push(getProductUrl(newProd));
              }}
            />
          </div>
        )}
      </main>

      <JamFooter />

      {/* Cart Modal */}
      <CartModal
        isOpen={cartModalOpen}
        onClose={() => setCartModalOpen(false)}
        onCheckout={() => {
          setCartModalOpen(false);
          router.push("/finalizar-compra");
        }}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        initialTab={authInitialTab}
        onClose={() => setAuthModalOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setAuthModalOpen(false);
        }}
      />
    </div>
  );
}
