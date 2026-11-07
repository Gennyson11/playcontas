"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Product, CartItem, UserProfile } from "@/types";
import {
  getStoredProducts,
  findProductBySlugOrId,
  mergeWithSupabaseProducts,
} from "@/lib/productStore";
import { getStoredUserSync, saveStoredUser, clearStoredUser, isProductOwner } from "@/lib/authStore";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { variationFieldsFromRow } from "@/lib/productVault";
import { JamHeader } from "@/components/JamHeader";
import { JamFooter } from "@/components/JamFooter";
import { ProductDetailView } from "@/components/ProductDetailView";
import { CheckoutModal } from "@/components/CheckoutModal";
import { CartModal } from "@/components/CartModal";
import { CartDrawer } from "@/components/CartDrawer";
import { AuthModal } from "@/components/AuthModal";
import { addToCart, getStoredCart } from "@/lib/cartStore";
import { ArrowLeft, AlertCircle } from "lucide-react";

interface AnuncioClientViewProps {
  initialProduct: Product | null;
  slug: string;
}

export function AnuncioClientView({ initialProduct, slug }: AnuncioClientViewProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  // Produtos armazenados
  const [products, setProducts] = useState<Product[]>(() => getStoredProducts());

  // Produto ativo: prioriza o produto já carregado pelo servidor ou cache local
  const [activeProduct, setActiveProduct] = useState<Product | null>(() => {
    if (initialProduct) return initialProduct;
    if (typeof window !== "undefined") {
      const all = getStoredProducts();
      return findProductBySlugOrId(all, slug) || null;
    }
    return null;
  });

  // Loading: só é true se NÃO tiver produto nenhum disponível
  const [loading, setLoading] = useState<boolean>(() => !initialProduct && !activeProduct);

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getStoredUserSync());
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartModalOpen, setCartModalOpen] = useState(false);
  const [cartWarning, setCartWarning] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutProduct, setCheckoutProduct] = useState<Product | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialTab, setAuthInitialTab] = useState<"login" | "register">("register");

  // Sincroniza usuário logado
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
            if (data && data.avatar_url) {
              setCurrentUser((prev) => {
                if (!prev || prev.email?.toLowerCase() !== user.email?.toLowerCase()) return prev;
                const updated = {
                  ...prev,
                  avatar: data.avatar_url,
                  name: data.full_name || prev.name,
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

  // Sincroniza carrinho
  useEffect(() => {
    setCart(getStoredCart());
    const sync = () => setCart(getStoredCart());
    window.addEventListener("central_cart_updated", sync);
    return () => window.removeEventListener("central_cart_updated", sync);
  }, []);

  // Atualização silenciosa em background (sem travar a tela)
  useEffect(() => {
    const syncCurrentProduct = () => {
      const all = getStoredProducts();
      setProducts(all);
      const found = findProductBySlugOrId(all, slug);
      if (found) {
        setActiveProduct(found);
        setLoading(false);
      }
    };

    syncCurrentProduct();

    window.addEventListener("central_products_updated", syncCurrentProduct);
    window.addEventListener("storage", syncCurrentProduct);

    async function loadSupabase() {
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await supabase
          .from("products")
          .select("*")
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
            warrantyDays: Number(d.warranty_days) || Number(d.warrantyDays) || 30,
            status: d.status || ((d.stock ?? 10) <= 0 ? "paused" : "active"),
            rejectionReason: d.rejection_reason || undefined,
            reviewedAt: d.reviewed_at || undefined,
            createdAt: d.created_at || new Date().toISOString(),
            ...variationFieldsFromRow(d),
            seller: {
              id: d.seller_id || "seller-1",
              name: d.seller_name || "PlayContas",
              avatar:
                d.seller_avatar && !d.seller_avatar.includes("dicebear")
                  ? d.seller_avatar
                  : d.seller_name === "Gennyson Marinho" || d.seller_name?.toLowerCase().includes("gennyson")
                  ? "https://lazueuycrcqirdykdppm.supabase.co/storage/v1/object/public/avatars/avatar-bb25d258-3152-422b-aa04-7bd34e8a5927.gif"
                  : `https://api.dicebear.com/7.x/bottts/svg?seed=${d.seller_name || "PlayContas"}`,
              rating: 5.0,
              salesCount: d.sales_count || 0,
              isVerified: true,
              responseTime: "5 min",
              memberSince: "2026",
              level: "Elite",
            },
          }));

          const merged = mergeWithSupabaseProducts(mapped);
          setProducts(merged);
          try {
            localStorage.setItem("central_cached_products", JSON.stringify(merged));
          } catch {}

          const match = findProductBySlugOrId(merged, slug);
          if (match) {
            setActiveProduct(match);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar do Supabase:", err);
      } finally {
        setLoading(false);
      }
    }

    loadSupabase();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") loadSupabase();
    };

    window.addEventListener("focus", loadSupabase);
    document.addEventListener("visibilitychange", handleVisibility);

    let channel: any = null;
    if (isSupabaseConfigured) {
      channel = supabase
        .channel(`realtime:product_${slug}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "products" },
          () => {
            loadSupabase();
          }
        )
        .subscribe();
    }

    return () => {
      window.removeEventListener("central_products_updated", syncCurrentProduct);
      window.removeEventListener("storage", syncCurrentProduct);
      window.removeEventListener("focus", loadSupabase);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [slug]);

  // Bloqueio de auto-compra e adição ao carrinho
  const handleBuyNow = (
    product: Product,
    selectedOptionLabel: string,
    finalPrice: number,
    selectedVariantId?: string
  ) => {
    const user = currentUser || getStoredUserSync();
    if (user && isProductOwner(product, user)) {
      setCartWarning(`Você não pode comprar produtos do seu próprio anúncio ("${product.title}").`);
      setCartModalOpen(true);
      return;
    }

    addToCart(product, 1, selectedOptionLabel, finalPrice, selectedVariantId);
    setCartModalOpen(true);
  };

  const handleCheckoutFromModal = () => {
    setCartModalOpen(false);
    router.push("/finalizar-compra");
  };

  const handlePurchaseSuccess = () => {
    setCheckoutProduct(null);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans selection:bg-[#0066FF] selection:text-white">
      <JamHeader
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          router.push(`/?search=${encodeURIComponent(q)}`);
        }}
        cartCount={cart.reduce((acc, item) => acc + item.quantity, 0)}
        onOpenCart={() => setCartOpen(true)}
        onOpenCreateListing={() => router.push("/anunciar")}
        onOpenMyProducts={() => router.push("/meus-produtos")}
        currentUser={currentUser}
        onOpenAuth={(tab) => {
          setAuthInitialTab(tab || "login");
          setAuthModalOpen(true);
        }}
        onOpenAdmin={() => router.push("/admin")}
        onOpenSettings={() => router.push("/minha-conta")}
        onLogout={async () => {
          await clearStoredUser();
          setCurrentUser(null);
        }}
        onGoHome={() => router.push("/")}
      />

      <main className="flex-1 w-full">
        {activeProduct ? (
          <div className="w-full">
            <ProductDetailView
              product={activeProduct}
              allProducts={products}
              currentUser={currentUser}
              onBack={() => router.push("/")}
              onBuyNow={handleBuyNow}
            />
          </div>
        ) : loading ? (
          <div className="max-w-5xl mx-auto px-4 py-12 animate-pulse space-y-6">
            <div className="h-6 w-48 bg-zinc-100 rounded-lg" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="aspect-square bg-zinc-100 rounded-3xl" />
              <div className="space-y-4">
                <div className="h-8 w-3/4 bg-zinc-100 rounded-xl" />
                <div className="h-5 w-1/3 bg-zinc-100 rounded-lg" />
                <div className="h-10 w-1/2 bg-zinc-100 rounded-2xl" />
                <div className="h-32 bg-zinc-50 rounded-2xl border border-zinc-100" />
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-lg mx-auto px-4 py-20 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 text-[#0066FF] flex items-center justify-center mx-auto shadow-xs">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-black text-zinc-950">Anúncio não encontrado</h1>
            <p className="text-xs text-zinc-500 leading-relaxed">
              O anúncio que você procura pode ter sido removido, pausado ou a URL foi digitada incorretamente.
            </p>
            <button
              onClick={() => router.push("/")}
              className="px-6 py-2.5 rounded-xl bg-[#0066FF] hover:bg-[#0052cc] text-white font-bold text-xs shadow-md shadow-blue-500/25 transition-all inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar para a Página Inicial</span>
            </button>
          </div>
        )}
      </main>

      <JamFooter />

      <CartModal
        isOpen={cartModalOpen}
        onClose={() => {
          setCartModalOpen(false);
          setCartWarning(null);
        }}
        warningNotice={cartWarning}
        onClearWarning={() => setCartWarning(null)}
        onCheckout={handleCheckoutFromModal}
      />

      {checkoutProduct && (
        <CheckoutModal
          product={checkoutProduct}
          onClose={() => setCheckoutProduct(null)}
          onPurchaseSuccess={handlePurchaseSuccess}
        />
      )}

      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart}
        onRemoveItem={(id) => setCart((prev) => prev.filter((i) => i.product.id !== id))}
        onCheckout={() => {
          if (cart.length > 0) {
            setCheckoutProduct(cart[0].product);
            setCartOpen(false);
          }
        }}
      />

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
    </div>
  );
}
