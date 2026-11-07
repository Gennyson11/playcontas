"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Product, UserProfile, CartItem } from "@/types";
import { INITIAL_PRODUCTS } from "@/lib/data";
import {
  getStoredProducts,
  saveStoredProduct,
  deleteStoredProduct,
  deleteProductRemote,
  mergeWithSupabaseProducts,
  purgeLegacyPlaceholderProducts,
} from "@/lib/productStore";
import { getProductUrl } from "@/lib/slug";
import { getUserAvatar } from "@/lib/avatarStore";
import { getStoredUserSync, saveStoredUser, clearStoredUser } from "@/lib/authStore";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { variationFieldsFromRow, updateProductRemote, groupsFromProduct } from "@/lib/productVault";
import { syncOwnProductsToSupabase } from "@/lib/productSync";
import { JamHeader } from "@/components/JamHeader";
import { JamFooter } from "@/components/JamFooter";
import { MyProductsView } from "@/components/MyProductsView";
import { CartDrawer } from "@/components/CartDrawer";
import { AuthModal } from "@/components/AuthModal";
import { Package } from "lucide-react";

export default function MeusProdutosPage() {
  const router = useRouter();
  
  // Leitura imediata e síncrona do cache para renderização em 0ms
  const [products, setProducts] = useState<Product[]>(() => getStoredProducts());

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

  // Restore and sync logged user
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
                const updated: UserProfile = {
                  ...prev,
                  name: data.full_name || prev.name,
                  avatar: data.avatar_url || prev.avatar,
                  balance: data.balance != null ? Number(data.balance) : prev.balance,
                  role: (data.role === "admin" ? "admin" : prev.role) as "admin" | "buyer" | "seller",
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

  // Restore cart
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem("central_cart");
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      }
    } catch {}
  }, []);

  // Sincronização e listener para atualizações de produtos
  useEffect(() => {
    // Limpa anúncios de teste órfãos criados com o vendedor-padrão antigo
    if (purgeLegacyPlaceholderProducts() > 0) {
      setProducts(getStoredProducts());
    }

    const handleProductsUpdated = () => {
      setProducts(getStoredProducts());
    };

    window.addEventListener("central_products_updated", handleProductsUpdated);
    window.addEventListener("storage", handleProductsUpdated);

    async function syncSupabase() {
      if (!isSupabaseConfigured) return;
      try {
        const { data } = await supabase
          .from("products")
          .select("*")
          .neq("status", "deleted")
          .order("created_at", { ascending: false });

        if (data && data.length > 0) {
          const mapped: Product[] = data.map((d: any) => ({
            id: d.id,
            title: d.title,
            description: d.description || "",
            price: Number(d.price) || 0,
            originalPrice: d.original_price ? Number(d.original_price) : undefined,
            category: d.category || "Outros",
            image:
              d.image ||
              "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
            salesCount: d.sales_count || 0,
            stock: d.stock ?? 10,
            deliveryType: d.delivery_type?.toUpperCase() === "MANUAL" ? "MANUAL" : "AUTOMATIC",
            autoDeliveryContent: d.delivery_content ? [d.delivery_content] : ["Entrega imediata"],
            tags: [d.category || "Geral"],
            warrantyDays: d.warranty_days || d.warrantyDays || 30,
            status: d.status || ((d.stock ?? 10) <= 0 ? "paused" : "active"),
            rejectionReason: d.rejection_reason || undefined,
            reviewedAt: d.reviewed_at || undefined,
            createdAt: d.created_at || new Date().toISOString(),
            ...variationFieldsFromRow(d),
            seller: {
              id: d.seller_id || "seller-1",
              name: d.seller_name || "PlayContas",
              avatar:
                d.seller_avatar &&
                !d.seller_avatar.includes("dicebear") &&
                !d.seller_avatar.includes("avatar-bb25d258")
                  ? d.seller_avatar
                  : d.seller_name === "Gennyson Marinho" || d.seller_name?.toLowerCase().includes("gennyson")
                  ? "https://lazueuycrcqirdykdppm.supabase.co/storage/v1/object/public/avatars/avatar-gennysonmarinhodemacedo_gmail_com.gif"
                  : `https://api.dicebear.com/7.x/bottts/svg?seed=${d.seller_name || "PlayContas"}`,
              rating: 5.0,
              salesCount: d.sales_count || 10,
              isVerified: true,
              responseTime: "5 min",
              memberSince: "2026",
            },
          }));

          const merged = mergeWithSupabaseProducts(mapped);
          setProducts(merged);
        }
      } catch (err) {
        console.error("Erro ao sincronizar produtos do Supabase:", err);
      }
    }

    syncSupabase().then(async () => {
      const sent = await syncOwnProductsToSupabase(getStoredUserSync());
      if (sent > 0) syncSupabase();
    });

    const handleVisibility = () => {
      if (document.visibilityState === "visible") syncSupabase();
    };

    window.addEventListener("focus", syncSupabase);
    document.addEventListener("visibilitychange", handleVisibility);

    let channel: any = null;
    if (isSupabaseConfigured) {
      channel = supabase
        .channel("realtime:products_meus_produtos")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "products" },
          () => {
            syncSupabase();
          }
        )
        .subscribe();
    }

    return () => {
      window.removeEventListener("central_products_updated", handleProductsUpdated);
      window.removeEventListener("storage", handleProductsUpdated);
      window.removeEventListener("focus", syncSupabase);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const handleUpdateSingleProduct = async (updatedProduct: Product) => {
    const updated = saveStoredProduct(updatedProduct);
    setProducts(updated);

    if (isSupabaseConfigured) {
      try {
        await updateProductRemote(updatedProduct, {
          groups: groupsFromProduct(updatedProduct),
        });
      } catch (err) {
        console.warn("Aviso ao atualizar produto no Supabase:", err);
      }
    }
  };

  const handleDeleteProduct = async (productId: string, productObj?: Product) => {
    const target = productObj || products.find((p) => p.id === productId);
    const updated = deleteStoredProduct(productId, target);
    setProducts(updated);

    await deleteProductRemote(target || productId);
  };

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
        onOpenAuth={(tab) => {
          setAuthInitialTab(tab || "login");
          setAuthModalOpen(true);
        }}
        onOpenSettings={() => router.push("/minha-conta")}
        onOpenMyProducts={() => {
          // Already on meus-produtos
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
      <main className="flex-1 py-6">
        {!currentUser && (!isMounted || loading) ? (
          <div className="max-w-7xl mx-auto px-4 py-20 flex flex-col items-center justify-center min-h-[420px]">
            <div className="w-8 h-8 border-3 border-[#0066FF] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-zinc-400 font-semibold mt-3 animate-pulse">
              Carregando seus produtos...
            </span>
          </div>
        ) : currentUser ? (
          <MyProductsView
            products={products}
            currentUser={currentUser}
            currentUserEmail={currentUser.email}
            currentUserId={currentUser.id}
            currentUserName={currentUser.name}
            isAdmin={currentUser.role === "admin"}
            onBack={() => router.push("/")}
            onOpenCreateListing={() => router.push("/anunciar")}
            onSelectProduct={(p) => router.push(getProductUrl(p))}
            onUpdateProduct={handleUpdateSingleProduct}
            onDeleteProduct={handleDeleteProduct}
          />
        ) : (
          <div className="max-w-md mx-auto py-20 px-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#0066FF] flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-sm">
              <Package className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-black text-zinc-900 mb-2">Acesso restrito</h1>
            <p className="text-sm text-zinc-500 mb-6">
              Faça login ou cadastre-se para gerenciar seus produtos cadastrados.
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
