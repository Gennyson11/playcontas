"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Product, CartItem, UserProfile } from "@/types";
import { INITIAL_PRODUCTS } from "@/lib/data";
import {
  getStoredProducts,
  saveStoredProduct,
  deleteStoredProduct,
  deleteProductRemote,
  mergeWithSupabaseProducts,
  isProductAvailableForSale,
} from "@/lib/productStore";
import { ALL_CATEGORIES } from "@/lib/categories";
import { getProductUrl } from "@/lib/slug";
import { JamHeader } from "@/components/JamHeader";
import { JamHero } from "@/components/JamHero";
import { PopularCategoriesSection } from "@/components/PopularCategoriesSection";
import { JamProductsSection } from "@/components/JamProductsSection";
import { HomeCategorySections } from "@/components/HomeCategorySections";
import { syncOwnProductsToSupabase } from "@/lib/productSync";
import { TopSellersSection } from "@/components/TopSellersSection";
import { AboutMarketSection } from "@/components/AboutMarketSection";
import { JamFooter } from "@/components/JamFooter";
import { ProductDetailView } from "@/components/ProductDetailView";
import { CreateListingView } from "@/components/CreateListingView";
import { CheckoutModal } from "@/components/CheckoutModal";
import { CartModal } from "@/components/CartModal";
import { CartDrawer } from "@/components/CartDrawer";
import { AuthModal } from "@/components/AuthModal";
import { AdminDashboard } from "@/components/AdminDashboard";
import { UserSettingsView } from "@/components/UserSettingsView";
import { MyProductsView } from "@/components/MyProductsView";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { variationFieldsFromRow, createProductRemote, groupsFromProduct } from "@/lib/productVault";
import { getUserAvatar, saveUserAvatar } from "@/lib/avatarStore";
import { getStoredUserSync, saveStoredUser, clearStoredUser, persistUser, isProductOwner, isUserAdmin } from "@/lib/authStore";
import { uploadToSupabaseStorage } from "@/lib/supabaseStorage";
import { addToCart, getStoredCart, removeFromCart } from "@/lib/cartStore";
import { getStoredVerification } from "@/lib/verificationStore";
import { Flame, Search, X, ShieldCheck, Clock, AlertTriangle, ArrowRight } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(() => getStoredProducts());
  const [selectedCategory, setSelectedCategory] = useState<string>("TODOS");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Views state:
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [isCreatingListing, setIsCreatingListing] = useState<boolean>(false);
  const [categoriesModalOpen, setCategoriesModalOpen] = useState<boolean>(false);
  const [modalSearch, setModalSearch] = useState<string>("");

  // Modals & Drawers
  const [checkoutProduct, setCheckoutProduct] = useState<Product | null>(null);
  const [cartModalOpen, setCartModalOpen] = useState<boolean>(false);
  const [cartOpen, setCartOpen] = useState<boolean>(false);
  const [cart, setCart] = useState<CartItem[]>([]);

  // User & Admin & Supabase Auth state:
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getStoredUserSync());
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authInitialTab, setAuthInitialTab] = useState<"login" | "register">("register");
  const [isAdminView, setIsAdminView] = useState<boolean>(false);
  const [isSettingsView, setIsSettingsView] = useState<boolean>(false);
  const [isMyProductsView, setIsMyProductsView] = useState<boolean>(false);
  const [verificationNotice, setVerificationNotice] = useState<{
    isOpen: boolean;
    type: "unverified" | "pending";
  } | null>(null);

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

                const isAdm = isUserAdmin(user) || isUserAdmin(prev) || data.role === "admin";
                // Garante que o banco do Supabase mantenha role: 'admin' para o administrador
                if (isAdm && data.role !== "admin") {
                  supabase.from("profiles").update({ role: "admin" }).eq("id", data.id).then();
                }

                const resolvedStatus = (data.is_verified || serverStatus === "approved")
                  ? ("approved" as const)
                  : (serverStatus || prev.verificationStatus || "none");
                const updated: UserProfile = {
                  ...prev,
                  name: resolvedName,
                  avatar: data.avatar_url || prev.avatar,
                  balance: data.balance != null ? Number(data.balance) : prev.balance,
                  role: isAdm ? "admin" : ((data.role || prev.role) as "admin" | "buyer" | "seller"),
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
        const isAdm = isUserAdmin(user);
        const resolvedStatus = serverStatus || user.verificationStatus || "none";
        const updated = {
          ...user,
          verificationStatus: resolvedStatus,
          isVerified: resolvedStatus === "approved",
          role: isAdm ? "admin" : (resolvedStatus === "approved" ? "seller" : "buyer"),
        };
        if (updated.verificationStatus !== user.verificationStatus || updated.isVerified !== user.isVerified || updated.role !== user.role) {
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



  // 1. Sincronização com o productStore e escuta de eventos em tempo real
  useEffect(() => {
    const handleProductsUpdated = () => {
      setProducts(getStoredProducts());
    };

    window.addEventListener("central_products_updated", handleProductsUpdated);
    window.addEventListener("storage", handleProductsUpdated);

    // 2. Carregar produtos do Supabase e mesclar sem sobrescrever edições locais
    async function loadSupabaseProducts() {
      if (!isSupabaseConfigured) return;
      try {
        const { data } = await supabase
          .from("products")
          .select("*")
          .neq("status", "deleted")
          .order("created_at", { ascending: false })
          .limit(60);

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
            tags: [
              d.category || "Geral",
              ...(d.title?.toLowerCase().includes("chatgpt") ? ["ChatGPT", "IA", "Inteligência Artificial"] : []),
              ...(d.title?.toLowerCase().includes("claude") ? ["Claude", "IA", "Inteligência Artificial"] : []),
              ...(d.title?.toLowerCase().includes("gemini") ? ["Gemini", "IA", "Inteligência Artificial"] : []),
              ...(d.title?.toLowerCase().includes("cursor") ? ["Cursor", "IA"] : []),
              ...(d.title?.toLowerCase().includes("minecraft") ? ["Minecraft"] : []),
              ...(d.title?.toLowerCase().includes("roblox") ? ["Roblox"] : []),
              ...(d.title?.toLowerCase().includes("steam") ? ["Steam"] : []),
            ],
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
              level: "Elite",
            },
          }));

          const merged = mergeWithSupabaseProducts(mapped);
          setProducts(merged);
        }
      } catch (err) {
        console.error("Erro ao carregar produtos do Supabase:", err);
      }
    }

    loadSupabaseProducts().then(async () => {
      // Anúncios do usuário logado que ainda só existem no navegador são copiados para o banco
      const sent = await syncOwnProductsToSupabase(getStoredUserSync());
      if (sent > 0) loadSupabaseProducts();
    });

    // 3. Carrega o perfil do Supabase garantindo que a foto/GIF de perfil nunca suma
    //    (somente para o usuário atualmente logado — nunca sobrescreve outra conta)
    async function loadUserProfileFromSupabase() {
      if (!isSupabaseConfigured) return;
      try {
        const loggedUser = getStoredUserSync();
        if (!loggedUser?.email) return;
        const email = loggedUser.email;
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .ilike("email", email)
          .maybeSingle();

        if (data && data.avatar_url) {
          setCurrentUser((prev) => {
            if (!prev || prev.email?.toLowerCase() !== email.toLowerCase()) return prev;
            const isAdm = isUserAdmin(prev) || isUserAdmin(loggedUser) || data.role === "admin";
            const updated = {
              ...prev,
              avatar: data.avatar_url,
              name: data.full_name || prev.name,
              balance: data.balance != null ? Number(data.balance) : prev.balance,
              role: (isAdm ? "admin" : (data.role || prev.role)) as "admin" | "buyer" | "seller",
            };
            try {
              persistUser(updated);
            } catch {}
            return updated;
          });
          saveUserAvatar(data.avatar_url);
        }
      } catch (err) {
        console.warn("Aviso ao carregar perfil do Supabase:", err);
      }
    }

    loadUserProfileFromSupabase();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") loadSupabaseProducts();
    };

    window.addEventListener("focus", loadSupabaseProducts);
    document.addEventListener("visibilitychange", handleVisibility);

    let channel: any = null;
    if (isSupabaseConfigured) {
      channel = supabase
        .channel("realtime:products_home")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "products" },
          () => {
            loadSupabaseProducts();
          }
        )
        .subscribe();
    }

    return () => {
      window.removeEventListener("central_products_updated", handleProductsUpdated);
      window.removeEventListener("storage", handleProductsUpdated);
      window.removeEventListener("focus", loadSupabaseProducts);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // Load and sync cart from cartStore
  useEffect(() => {
    setCart(getStoredCart());
    const syncCart = () => setCart(getStoredCart());
    window.addEventListener("central_cart_updated", syncCart);
    return () => window.removeEventListener("central_cart_updated", syncCart);
  }, []);

  // Cart operations
  const handleAddToCart = (product: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isProductOwner(product, currentUser)) {
      alert("Você é o vendedor deste anúncio e não pode adicionar seu próprio produto ao carrinho.");
      return;
    }
    if (
      product.status === "rejected" ||
      product.status === "paused" ||
      product.status === "pending_review" ||
      product.status === "pending_approval"
    ) {
      return;
    }
    addToCart(product, 1);
    setCart(getStoredCart());
    setCartModalOpen(true);
  };

  const handleRemoveFromCart = (productId: string) => {
    removeFromCart(productId);
    setCart(getStoredCart());
  };

  const handleBuyNow = (
    product: Product,
    selectedOptionLabel?: string,
    finalPrice?: number,
    selectedVariantId?: string
  ) => {
    if (isProductOwner(product, currentUser)) {
      alert("Você é o vendedor deste anúncio e não pode comprar seu próprio produto.");
      return;
    }
    if (
      product.status === "rejected" ||
      product.status === "paused" ||
      product.status === "pending_review" ||
      product.status === "pending_approval"
    ) {
      return;
    }
    addToCart(product, 1, selectedOptionLabel, finalPrice, selectedVariantId);
    setCart(getStoredCart());
    setCartModalOpen(true);
  };

  const handleCheckoutFromModal = () => {
    setCartModalOpen(false);
    router.push("/finalizar-compra");
  };

  const handlePurchaseSuccess = async (productId: string) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          const newStock = Math.max(0, (p.stock || 1) - 1);
          const newSales = (p.salesCount || 0) + 1;
          const status = newStock <= 0 ? "paused" : "active";
          return { ...p, stock: newStock, status, salesCount: newSales };
        }
        return p;
      })
    );

    setActiveProduct((prev) => {
      if (prev && prev.id === productId) {
        const newStock = Math.max(0, (prev.stock || 1) - 1);
        const newSales = (prev.salesCount || 0) + 1;
        const status = newStock <= 0 ? "paused" : "active";
        return { ...prev, stock: newStock, status, salesCount: newSales };
      }
      return prev;
    });

    try {
      const raw = localStorage.getItem("central_cached_products");
      if (raw) {
        const parsed = JSON.parse(raw);
        const updated = parsed.map((p: Product) => {
          if (p.id === productId) {
            const newStock = Math.max(0, (p.stock || 1) - 1);
            const newSales = (p.salesCount || 0) + 1;
            const status = newStock <= 0 ? "paused" : "active";
            return { ...p, stock: newStock, status, salesCount: newSales };
          }
          return p;
        });
        localStorage.setItem("central_cached_products", JSON.stringify(updated));
      }
    } catch {}

    if (isSupabaseConfigured) {
      try {
        const current = products.find((p) => p.id === productId);
        if (current) {
          const newStock = Math.max(0, (current.stock || 1) - 1);
          const newSales = (current.salesCount || 0) + 1;
          const status = newStock <= 0 ? "paused" : "active";
          await supabase
            .from("products")
            .update({ stock: newStock, status, sales_count: newSales })
            .eq("id", productId);
        }
      } catch (err) {
        console.error("Erro ao sincronizar compra no Supabase:", err);
      }
    }
  };

  const handleAddProduct = async (newProduct: Product) => {
    // 1. Tenta fazer upload da imagem para o Supabase Storage se for base64
    let finalImage = newProduct.image;
    if (newProduct.image && newProduct.image.startsWith("data:")) {
      try {
        const storageUrl = await uploadToSupabaseStorage(
          newProduct.image,
          "products",
          `prod-${Date.now()}`
        );
        if (storageUrl) {
          finalImage = storageUrl;
        }
      } catch (err) {
        console.warn("Upload para Supabase Storage falhou, usando imagem direta:", err);
      }
    }

    const sellerName = currentUser?.name || newProduct.seller?.name || "PlayContas";
    const sellerAvatar =
      currentUser?.avatar ||
      newProduct.seller?.avatar ||
      `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(sellerName)}`;

    const productWithStorage: Product = {
      ...newProduct,
      image: finalImage,
      seller: {
        id: currentUser?.id || newProduct.seller?.id || `seller-${Date.now()}`,
        name: sellerName,
        avatar: sellerAvatar,
        email: currentUser?.email,
        isVerified: true,
        salesCount: 0,
        rating: 5.0,
        responseTime: "5 min",
        memberSince: new Date(currentUser?.createdAt || Date.now()).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
        level: "Bronze",
      },
    };
    const updated = saveStoredProduct(productWithStorage);
    setProducts(updated);
    setIsCreatingListing(false);

    // Salva no banco de dados Supabase em segundo plano com variações e cofre seguro
    if (isSupabaseConfigured) {
      try {
        const groups = productWithStorage.vaultGroups || groupsFromProduct(productWithStorage);
        const res = await createProductRemote(productWithStorage, {
          sellerId: currentUser?.id,
          sellerName,
          sellerAvatar,
          groups,
        });
        if (res.ok && res.id && res.id !== productWithStorage.id) {
          const updatedWithDbId = { ...productWithStorage, id: res.id };
          saveStoredProduct(updatedWithDbId);
          setProducts((prev) => prev.map((p) => (p.id === productWithStorage.id ? updatedWithDbId : p)));
        }
        if (!res.ok) {
          console.warn("Aviso ao salvar produto no Supabase:", res.error);
        }
      } catch (err) {
        console.warn("Aviso ao salvar produto no Supabase:", err);
      }
    }
  };

  const handleUpdateProducts = (updated: Product[]) => {
    setProducts(updated);
  };

  const handleUpdateSingleProduct = (updatedProduct: Product) => {
    const updated = saveStoredProduct(updatedProduct);
    setProducts(updated);
  };

  const handleDeleteProduct = async (productId: string) => {
    const target = products.find((p) => p.id === productId);
    const updated = deleteStoredProduct(productId, target);
    setProducts(updated);

    await deleteProductRemote(target || productId);
  };

  // Apenas produtos disponíveis para venda (ativos, com estoque e não pausados)
  const activeProducts = products.filter(isProductAvailableForSale);

  // Filtered products (pesquisa e categoria aplicadas sobre produtos ativos)
  const filteredProducts = activeProducts.filter((p) => {
    if (selectedCategory !== "TODOS") {
      const cat = selectedCategory.toLowerCase().trim();
      const matchesCat = (p.category || "").toLowerCase().includes(cat);
      const matchesTitle = (p.title || "").toLowerCase().includes(cat);
      const matchesTags = (p.tags || []).some((t) => t.toLowerCase().includes(cat));
      const matchesDesc = (p.description || "").toLowerCase().includes(cat);
      if (!matchesCat && !matchesTitle && !matchesTags && !matchesDesc) {
        return false;
      }
    }
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      const matchesTitle = (p.title || "").toLowerCase().includes(q);
      const matchesDesc = (p.description || "").toLowerCase().includes(q);
      const matchesCat = (p.category || "").toLowerCase().includes(q);
      const matchesTags = (p.tags || []).some((t) => t.toLowerCase().includes(q));
      return matchesTitle || matchesDesc || matchesCat || matchesTags;
    }
    return true;
  });

  const modalFilteredCategories = ALL_CATEGORIES.filter((c) =>
    c.name.toLowerCase().includes(modalSearch.toLowerCase())
  );

  const isAdminUser = isUserAdmin(currentUser);

  // If user requested Admin Dashboard and is logged in as admin
  if (isAdminView && isAdminUser) {
    return (
      <AdminDashboard
        currentUser={currentUser!}
        products={products}
        onBackToShop={() => setIsAdminView(false)}
        onUpdateProducts={handleUpdateProducts}
        onCreateProduct={() => {
          setIsAdminView(false);
          setIsCreatingListing(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-zinc-900 flex flex-col font-sans antialiased selection:bg-[#0066FF] selection:text-white">
      {/* 1. Header with White, Black and Blue scheme */}
      <JamHeader
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          if (activeProduct) setActiveProduct(null);
          if (isCreatingListing) setIsCreatingListing(false);
        }}
        cartCount={cart.reduce((acc, i) => acc + i.quantity, 0)}
        onOpenCart={() => setCartModalOpen(true)}
        onOpenCreateListing={() => {
          router.push("/anunciar");
        }}
        onOpenMyProducts={() => {
          router.push("/meus-produtos");
        }}
        onOpenCategories={() => setCategoriesModalOpen(true)}
        currentUser={currentUser}
        onOpenAuth={(tab) => {
          setAuthInitialTab(tab || "register");
          setAuthModalOpen(true);
        }}
        onOpenAdmin={() => {
          router.push("/admin");
        }}
        onOpenSettings={() => {
          router.push("/minha-conta");
        }}
        onGoHome={() => {
          setIsSettingsView(false);
          setIsAdminView(false);
          setIsCreatingListing(false);
          setIsMyProductsView(false);
          setActiveProduct(null);
          setSearchQuery("");
          setSelectedCategory("TODOS");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onLogout={async () => {
          await clearStoredUser();
          setCurrentUser(null);
          setIsAdminView(false);
          setIsSettingsView(false);
          setIsMyProductsView(false);
        }}
      />

      <main className="flex-1">
        {/* VIEW 0: USER SETTINGS PAGE (Configurações / Minha Conta) */}
        {isSettingsView && currentUser ? (
          <UserSettingsView
            currentUser={currentUser}
            onBackToShop={() => setIsSettingsView(false)}
            onUpdateProfile={(updated) => {
              setCurrentUser(updated);
              persistUser(updated);

              // Sincroniza a foto/GIF e nome do vendedor em todos os seus anúncios em tempo real
              setProducts((prev) =>
                prev.map((p) => {
                  const isMatch =
                    p.seller.id === updated.id ||
                    p.seller.name.toLowerCase() === updated.name.toLowerCase() ||
                    (currentUser && p.seller.name.toLowerCase() === currentUser.name.toLowerCase()) ||
                    p.seller.name === "Gennyson Marinho";
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
                })
              );

              setActiveProduct((prev) => {
                if (!prev) return null;
                const isMatch =
                  prev.seller.id === updated.id ||
                  prev.seller.name.toLowerCase() === updated.name.toLowerCase() ||
                  (currentUser && prev.seller.name.toLowerCase() === currentUser.name.toLowerCase()) ||
                  prev.seller.name === "Gennyson Marinho";
                if (isMatch) {
                  return {
                    ...prev,
                    seller: {
                      ...prev.seller,
                      name: updated.name,
                      avatar: updated.avatar,
                    },
                  };
                }
                return prev;
              });

              try {
                const raw = localStorage.getItem("central_cached_products");
                if (raw) {
                  const parsed = JSON.parse(raw);
                  const synced = parsed.map((p: Product) => {
                    const isMatch =
                      p.seller.id === updated.id ||
                      p.seller.name.toLowerCase() === updated.name.toLowerCase() ||
                      (currentUser && p.seller.name.toLowerCase() === currentUser.name.toLowerCase()) ||
                      p.seller.name === "Gennyson Marinho";
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
            onOpenAdmin={() => {
              router.push("/admin");
            }}
            onCreateListing={() => {
              router.push("/anunciar");
            }}
          />
        ) : isMyProductsView ? (
          <MyProductsView
            products={products}
            currentUser={currentUser}
            currentUserEmail={currentUser?.email}
            currentUserId={currentUser?.id}
            currentUserName={currentUser?.name}
            isAdmin={isAdminUser}
            onBack={() => setIsMyProductsView(false)}
            onOpenCreateListing={() => {
              router.push("/anunciar");
            }}
            onSelectProduct={(p) => {
              setIsMyProductsView(false);
              router.push(getProductUrl(p));
            }}
            onUpdateProduct={handleUpdateSingleProduct}
            onDeleteProduct={handleDeleteProduct}
          />
        ) : isCreatingListing ? (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
            <CreateListingView
              onBack={() => setIsCreatingListing(false)}
              onListingCreated={(newProd) => {
                handleAddProduct(newProd);
              }}
              onViewProduct={(newProd) => {
                setIsCreatingListing(false);
                router.push(getProductUrl(newProd));
              }}
            />
          </div>
        ) : activeProduct ? (
          /* VIEW 2: PRODUCT DETAIL PAGE */
          <div className="w-full">
            <ProductDetailView
              product={activeProduct}
              allProducts={products}
              currentUser={currentUser}
              onBack={() => {
                setActiveProduct(null);
                router.push("/");
              }}
              onBuyNow={handleBuyNow}
            />
          </div>
        ) : (
          /* VIEW 3: HOME FEED (Matching uploaded reference images 1 & 2) */
          <>
            {/* 1. Hero Section: GameMarket Header & Trust Card */}
            <JamHero
              onSelectCategory={(cat) => {
                setSelectedCategory(cat);
                const el = document.getElementById("em-destaque");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              onOpenAllCategories={() => setCategoriesModalOpen(true)}
              onSearchSubmit={(q) => setSearchQuery(q)}
            />

            {/* 2. Categorias Populares (Matching the exact uploaded screenshot) */}
            <PopularCategoriesSection
              selectedCategory={selectedCategory}
              onSelectCategory={(cat) => {
                setSelectedCategory(cat);
                const el = document.getElementById("em-destaque");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              onOpenAllCategories={() => setCategoriesModalOpen(true)}
            />

            {/* 3. "Em Destaque" Products Section */}
            <JamProductsSection
              products={filteredProducts}
              onSelectProduct={(p) => router.push(getProductUrl(p))}
              onAddToCart={handleAddToCart}
              onOpenAllCategories={() => setCategoriesModalOpen(true)}
            />

            {/* 4. Seções por categoria: só aparecem no início e quando existe anúncio da categoria */}
            {selectedCategory === "TODOS" && searchQuery.trim() === "" && (
              <HomeCategorySections
                products={activeProducts}
                onSelectProduct={(p) => router.push(getProductUrl(p))}
                onAddToCart={handleAddToCart}
                onViewCategory={(name) => {
                  setSelectedCategory(name);
                  const el = document.getElementById("em-destaque");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                afterServicosDigitais={
                  <>
                    <TopSellersSection products={activeProducts} />
                    <AboutMarketSection
                      onLearnMore={() => {
                        const el = document.getElementById("em-destaque");
                        el?.scrollIntoView({ behavior: "smooth" });
                      }}
                    />
                  </>
                }
              />
            )}
          </>
        )}
      </main>

      {/* 3. Footer */}
      <JamFooter />

      {/* MODAL DO CARRINHO (ESTILO EXATO DA REFERÊNCIA) */}
      <CartModal
        isOpen={cartModalOpen}
        onClose={() => setCartModalOpen(false)}
        onCheckout={handleCheckoutFromModal}
      />

      {/* PIX CHECKOUT MODAL */}
      {checkoutProduct && (
        <CheckoutModal
          product={checkoutProduct}
          onClose={() => setCheckoutProduct(null)}
          onPurchaseSuccess={handlePurchaseSuccess}
        />
      )}

      {/* CART DRAWER */}
      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart}
        onRemoveItem={handleRemoveFromCart}
        onCheckout={() => {
          if (cart.length > 0) {
            setCheckoutProduct(cart[0].product);
          }
        }}
      />

      {/* ALL CATEGORIES MODAL (+100 CATEGORIAS) */}
      {categoriesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fadeIn select-none">
          <div className="relative w-full max-w-4xl bg-white text-zinc-900 rounded-3xl shadow-2xl overflow-hidden my-6 max-h-[85vh] flex flex-col border border-zinc-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-zinc-50">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-6 rounded-full bg-[#0066FF]" />
                <h3 className="font-black text-zinc-950 text-base">
                  Todas as Categorias ({ALL_CATEGORIES.length})
                </h3>
              </div>
              <button
                onClick={() => setCategoriesModalOpen(false)}
                className="p-1.5 rounded-xl bg-white border border-zinc-200 text-zinc-600 hover:text-black transition-colors shadow-xs"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-zinc-200 bg-white">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Pesquisar categoria (ex: Fortnite, Roblox, Steam, Valorant, GTA V, Cursos...)"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#0066FF] focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 bg-zinc-50/50">
              {modalFilteredCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.name);
                    setCategoriesModalOpen(false);
                    const el = document.getElementById("em-destaque");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="p-3.5 rounded-xl bg-white hover:bg-blue-50/60 border border-zinc-200 hover:border-[#0066FF] text-left transition-all cursor-pointer shadow-xs group"
                >
                  <span className="font-bold text-xs text-zinc-800 group-hover:text-[#0066FF] block truncate">
                    {cat.name}
                  </span>
                  <span className="text-[10px] text-zinc-400 block mt-0.5">
                    {cat.group}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE AVISO: VERIFICAÇÃO DE VENDEDOR NECESSÁRIA */}
      {verificationNotice && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setVerificationNotice(null)}
        >
          <div
            className="bg-white rounded-3xl border border-zinc-200 shadow-2xl max-w-md w-full p-6 text-center space-y-5 animate-scaleUp relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setVerificationNotice(null)}
              className="absolute top-4 right-4 p-2 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {verificationNotice.type === "pending" ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200 shadow-inner">
                  <Clock className="w-8 h-8 animate-pulse" />
                </div>

                <div>
                  <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-black uppercase tracking-wider">
                    Análise em Andamento
                  </span>
                  <h3 className="text-lg font-black text-zinc-950 mt-2">
                    Verificação em Análise
                  </h3>
                  <p className="text-xs text-zinc-500 leading-relaxed mt-2">
                    Seus dados e documentos já foram enviados e estão aguardando aprovação pelo administrador. Assim que forem aprovados no painel, a criação de anúncios será liberada imediatamente!
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVerificationNotice(null);
                      try {
                        sessionStorage.setItem("minha_conta_active_tab", "verificacao");
                      } catch {}
                      router.push("/minha-conta");
                    }}
                    className="w-full py-3 rounded-xl bg-black hover:bg-zinc-800 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Acompanhar Verificação</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerificationNotice(null)}
                    className="w-full py-2.5 rounded-xl border border-zinc-200 text-zinc-600 font-bold text-xs hover:bg-zinc-100 transition-colors cursor-pointer"
                  >
                    Entendido
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#0066FF] flex items-center justify-center mx-auto border border-blue-200 shadow-inner">
                  <ShieldCheck className="w-8 h-8" />
                </div>

                <div>
                  <span className="px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#0066FF] text-[10px] font-black uppercase tracking-wider">
                    Exclusivo para Vendedores
                  </span>
                  <h3 className="text-lg font-black text-zinc-950 mt-2">
                    Verificação de Identidade Necessária
                  </h3>
                  <p className="text-xs text-zinc-500 leading-relaxed mt-2">
                    Para garantir a segurança de todos no PlayContas, você precisa primeiro verificar sua identidade enviando seus dados e documentos para virar vendedor.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVerificationNotice(null);
                      try {
                        sessionStorage.setItem("minha_conta_active_tab", "verificacao");
                      } catch {}
                      router.push("/minha-conta");
                    }}
                    className="w-full py-3 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Verificar Minha Conta Agora</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerificationNotice(null)}
                    className="w-full py-2.5 rounded-xl border border-zinc-200 text-zinc-600 font-bold text-xs hover:bg-zinc-100 transition-colors cursor-pointer"
                  >
                    Agora não
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 5. AUTH MODAL (LOGIN & CADASTRO DE CLIENTES COM SUPABASE) */}
      <AuthModal
        isOpen={authModalOpen}
        initialTab={authInitialTab}
        onClose={() => setAuthModalOpen(false)}
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
