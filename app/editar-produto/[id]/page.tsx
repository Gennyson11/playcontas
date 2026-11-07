"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Product, ProductVariant, UserProfile, CartItem } from "@/types";
import { INITIAL_PRODUCTS } from "@/lib/data";
import {
  getStoredProducts,
  saveStoredProduct,
  findProductBySlugOrId,
  mergeWithSupabaseProducts,
} from "@/lib/productStore";
import { getProductAdCode } from "@/lib/adCode";
import { getUserAvatar } from "@/lib/avatarStore";
import { getStoredUserSync, clearStoredUser, persistUser } from "@/lib/authStore";
import { optimizeImageFile } from "@/lib/imageOptimizer";
import { uploadToSupabaseStorage } from "@/lib/supabaseStorage";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  variationFieldsFromRow,
  updateProductRemote,
  fetchProductVault,
  splitCredentialBlocks,
  VaultGroup,
  isUuid,
} from "@/lib/productVault";
import { JamHeader } from "@/components/JamHeader";
import { JamFooter } from "@/components/JamFooter";
import { CartDrawer } from "@/components/CartDrawer";
import { AuthModal } from "@/components/AuthModal";
import { ALL_CATEGORIES } from "@/lib/categories";
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  PauseCircle,
  AlertTriangle,
  FileText,
  DollarSign,
  Package,
  Clock,
  Zap,
  ChevronDown,
  Trash2,
  Plus,
  Layers,
  Image as ImageIcon,
} from "lucide-react";
import { VariantStockSection, VariantStockItem } from "@/components/VariantStockSection";

export default function EditarProdutoPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = params?.id ? String(params.id) : "";
  const productId = decodeURIComponent(rawId);

  const [products, setProducts] = useState<Product[]>(() => getStoredProducts());

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("central_user");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return null;
  });

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

  // Product being edited
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  // Form Fields
  const [editTitle, setEditTitle] = useState("");
  const [editListingType, setEditListingType] = useState<"UNICA" | "MULTIPLA">("UNICA");
  const [editVariants, setEditVariants] = useState<VariantStockItem[]>([
    { id: "v-1", name: "Padrão", price: "29,90", stock: "10", credentials: "" },
  ]);
  const [editPrice, setEditPrice] = useState("");
  const [editOriginalPrice, setEditOriginalPrice] = useState("");
  const [editStock, setEditStock] = useState("");
  const [editCategory, setEditCategory] = useState("Assinaturas Premium");
  const [editDeliveryType, setEditDeliveryType] = useState<"AUTOMATIC" | "MANUAL">("AUTOMATIC");
  const [editWarrantyDays, setEditWarrantyDays] = useState(30);
  const [editDescription, setEditDescription] = useState("");
  const [editImage, setEditImage] = useState("");
  const [editAutoDeliveryContent, setEditAutoDeliveryContent] = useState("");
  const [editSeparator, setEditSeparator] = useState("--");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);
  const [saveSuccessText, setSaveSuccessText] = useState("Anúncio atualizado com sucesso no catálogo!");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const credentialsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore user & avatar
  useEffect(() => {
    if (!currentUser) {
      const saved = getStoredUserSync();
      if (saved) setCurrentUser(saved);
    }
    getUserAvatar().then((stored) => {
      if (stored) {
        setCurrentUser((prev) => (prev ? { ...prev, avatar: stored } : prev));
      }
    });
  }, []);

  // Find product from memory, cache or Supabase
  useEffect(() => {
    const allProds = getStoredProducts();
    setProducts(allProds);

    const found = findProductBySlugOrId(allProds, productId);

    if (found) {
      setProduct(found);
      setEditTitle(found.title);
      setEditPrice(found.price.toString());
      setEditOriginalPrice(found.originalPrice ? found.originalPrice.toString() : "");
      setEditStock(found.stock.toString());
      setEditCategory(found.category || "Assinaturas Premium");
      setEditDeliveryType(found.deliveryType || "AUTOMATIC");
      setEditWarrantyDays(found.warrantyDays || 30);
      setEditDescription(found.description || "");
      setEditImage(found.image || "");
      if (found.autoDeliveryContent && Array.isArray(found.autoDeliveryContent) && found.autoDeliveryContent.length > 0) {
        setEditAutoDeliveryContent(found.autoDeliveryContent.join("\n--\n"));
      }

      // Restore Variations
      const isMulti =
        found.listingType === "MULTIPLA" ||
        found.hasVariations === true ||
        (found.variants && found.variants.length > 0) ||
        found.title.toLowerCase().includes("muse");

      setEditListingType(isMulti ? "MULTIPLA" : "UNICA");

      if (found.variants && found.variants.length > 0) {
        setEditVariants(
          found.variants.map((v) => ({
            id: v.id,
            name: v.name,
            price: v.price.toFixed(2).replace(".", ","),
            stock: String(v.stock),
            credentials: v.credentials || "",
          }))
        );
      } else if (isMulti) {
        // Fallback para produtos com variação criados anteriormente (ex: Muse AI)
        setEditVariants([
          {
            id: "v-1",
            name: "1 Bilhão de Tokens",
            price: found.price ? found.price.toFixed(2).replace(".", ",") : "29,90",
            stock: String(found.stock || 10),
          },
          {
            id: "v-2",
            name: "2 Bilhões de Tokens",
            price: found.price ? (found.price * 1.8).toFixed(2).replace(".", ",") : "49,90",
            stock: "5",
          },
        ]);
      } else {
        setEditVariants([
          {
            id: "v-1",
            name: "Padrão",
            price: found.price ? found.price.toFixed(2).replace(".", ",") : "29,90",
            stock: String(found.stock || 10),
          },
        ]);
      }

      setLoading(false);

      if (isUuid(found.id)) {
        fetchProductVault(found.id).then((vault) => {
          if (!vault.inUse) return;
          if (isMulti) {
            setEditVariants((prev) =>
              prev.map((v) => {
                const creds = vault.items[v.id];
                if (creds && creds.length > 0 && !v.credentials) {
                  return { ...v, credentials: creds.join("\n--\n") };
                }
                return v;
              })
            );
          } else {
            const single = vault.items[""];
            if (single && single.length > 0) {
              setEditAutoDeliveryContent((prev) => prev || single.join("\n--\n"));
            }
          }
        });
      }
    }

    // Silent background sync with Supabase
    async function loadFromSupabase() {
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
          const mappedList: Product[] = data.map((d: any) => ({
            id: d.id,
            title: d.title,
            description: d.description || "",
            price: Number(d.price) || 0,
            originalPrice: d.original_price ? Number(d.original_price) : undefined,
            category: d.category || "Assinaturas Premium",
            image:
              d.image ||
              "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
            salesCount: d.sales_count || 0,
            stock: d.stock ?? 10,
            deliveryType: d.delivery_type?.toUpperCase() === "MANUAL" ? "MANUAL" : "AUTOMATIC",
            autoDeliveryContent: d.delivery_content
              ? (d.delivery_content.includes("--")
                  ? d.delivery_content.split(/\s*--\s*/).filter(Boolean)
                  : d.delivery_content.split(/\n\s*\n+/).filter(Boolean))
              : undefined,
            tags: [d.category || "Geral"],
            warrantyDays: Number(d.warranty_days) || Number(d.warrantyDays) || 30,
            status: d.status || ((d.stock ?? 10) <= 0 ? "paused" : "active"),
            rejectionReason: d.rejection_reason || undefined,
            reviewedAt: d.reviewed_at || undefined,
            createdAt: d.created_at || new Date().toISOString(),
            ...variationFieldsFromRow(d),
            seller: {
              id: d.seller_id || "seller-1",
              name: d.seller_name || "CentralMarket",
              avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${d.seller_name || "CentralMarket"}`,
              rating: 5.0,
              salesCount: d.sales_count || 10,
              isVerified: true,
              responseTime: "5 min",
              memberSince: "2026",
              level: "Elite",
            },
          }));

          const finalMerged = mergeWithSupabaseProducts(mappedList);
          setProducts(finalMerged);

          if (!found) {
            const matchedFromDb = findProductBySlugOrId(finalMerged, productId);
            if (matchedFromDb) {
              setProduct(matchedFromDb);
              setEditTitle(matchedFromDb.title);
              setEditPrice(matchedFromDb.price.toString());
              setEditOriginalPrice(
                matchedFromDb.originalPrice ? matchedFromDb.originalPrice.toString() : ""
              );
              setEditStock(matchedFromDb.stock.toString());
              setEditCategory(matchedFromDb.category || "Assinaturas Premium");
              setEditDeliveryType(matchedFromDb.deliveryType || "AUTOMATIC");
              setEditWarrantyDays(matchedFromDb.warrantyDays || 30);
              setEditDescription(matchedFromDb.description || "");
              setEditImage(matchedFromDb.image || "");
              if (
                matchedFromDb.autoDeliveryContent &&
                Array.isArray(matchedFromDb.autoDeliveryContent) &&
                matchedFromDb.autoDeliveryContent.length > 0
              ) {
                setEditAutoDeliveryContent(matchedFromDb.autoDeliveryContent.join("\n--\n"));
              }

              const isMulti =
                matchedFromDb.listingType === "MULTIPLA" ||
                matchedFromDb.hasVariations === true ||
                (matchedFromDb.variants && matchedFromDb.variants.length > 0) ||
                matchedFromDb.title.toLowerCase().includes("muse");

              setEditListingType(isMulti ? "MULTIPLA" : "UNICA");

              if (matchedFromDb.variants && matchedFromDb.variants.length > 0) {
                setEditVariants(
                  matchedFromDb.variants.map((v) => ({
                    id: v.id,
                    name: v.name,
                    price: v.price.toFixed(2).replace(".", ","),
                    stock: String(v.stock),
                    credentials: v.credentials || "",
                  }))
                );
              } else if (isMulti) {
                setEditVariants([
                  {
                    id: "v-1",
                    name: "1 Bilhão de Tokens",
                    price: matchedFromDb.price ? matchedFromDb.price.toFixed(2).replace(".", ",") : "29,90",
                    stock: String(matchedFromDb.stock || 10),
                  },
                  {
                    id: "v-2",
                    name: "2 Bilhões de Tokens",
                    price: matchedFromDb.price ? (matchedFromDb.price * 1.8).toFixed(2).replace(".", ",") : "49,90",
                    stock: "5",
                  },
                ]);
              }

              if (isUuid(matchedFromDb.id)) {
                fetchProductVault(matchedFromDb.id).then((vault) => {
                  if (!vault.inUse) return;
                  if (isMulti) {
                    setEditVariants((prev) =>
                      prev.map((v) => {
                        const creds = vault.items[v.id];
                        if (creds && creds.length > 0 && !v.credentials) {
                          return { ...v, credentials: creds.join("\n--\n") };
                        }
                        return v;
                      })
                    );
                  } else {
                    const single = vault.items[""];
                    if (single && single.length > 0) {
                      setEditAutoDeliveryContent((prev) => prev || single.join("\n--\n"));
                    }
                  }
                });
              }
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar produto do Supabase:", err);
      } finally {
        setLoading(false);
      }
    }

    loadFromSupabase();
  }, [productId]);

  // Variações helpers
  const handleAddVariant = () => {
    if (editVariants.length >= 50) return;
    setEditVariants([
      ...editVariants,
      {
        id: `v-${Date.now()}`,
        name: "",
        price: editPrice || "29,90",
        stock: "0",
        credentials: "",
      },
    ]);
  };

  const handleRemoveVariant = (id: string) => {
    if (editVariants.length <= 1) return;
    setEditVariants(editVariants.filter((v) => v.id !== id));
  };

  const handleUpdateVariant = (
    id: string,
    field: keyof VariantStockItem,
    value: string
  ) => {
    setEditVariants(
      editVariants.map((v) => (v.id === id ? { ...v, [field]: value } : v))
    );
  };

  const handleUpdateFullVariant = (id: string, updates: Partial<VariantStockItem>) => {
    setEditVariants((prev) =>
      prev.map((v) => (v.id === id ? { ...v, ...updates } : v))
    );
  };

  // Credenciais helpers
  const getDetectedAccountsCount = (text: string, sep: string) => {
    if (!text || !text.trim()) return 0;
    if (sep === "\\n\\n") {
      return text.split(/\n\s*\n+/).filter((b) => b.trim().length > 0).length;
    }
    return text.split(sep).filter((b) => b.trim().length > 0).length;
  };

  const handleCredentialsChange = (val: string) => {
    setEditAutoDeliveryContent(val);
    const count = getDetectedAccountsCount(val, editSeparator);
    if (count > 0) {
      setEditStock(String(count));
    }
  };

  const handleInsertSeparator = () => {
    const textarea = credentialsTextareaRef.current;
    const sepText = editSeparator === "\\n\\n" ? "\n\n" : `\n${editSeparator}\n`;
    if (!textarea) {
      const next = editAutoDeliveryContent ? `${editAutoDeliveryContent}${sepText}` : sepText;
      handleCredentialsChange(next);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentWindowScroll = typeof window !== "undefined" ? window.scrollY : 0;
    const next =
      editAutoDeliveryContent.substring(0, start) + sepText + editAutoDeliveryContent.substring(end);
    handleCredentialsChange(next);

    requestAnimationFrame(() => {
      if (credentialsTextareaRef.current) {
        credentialsTextareaRef.current.focus({ preventScroll: true });
        const pos = start + sepText.length;
        credentialsTextareaRef.current.setSelectionRange(pos, pos);
        if (typeof window !== "undefined") {
          window.scrollTo({ top: currentWindowScroll, behavior: "instant" as ScrollBehavior });
        }
      }
    });
  };

  const detectedAccountsCount = getDetectedAccountsCount(editAutoDeliveryContent, editSeparator);

  // Handle image upload from computer (JPG, PNG, GIF animado até 20MB com otimização automática)
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      alert("A imagem ou GIF deve ter no máximo 20MB.");
      return;
    }
    const optimized = await optimizeImageFile(file);
    if (optimized) {
      setEditImage(optimized);
    }
  };

  // Save product changes
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    if (!editTitle.trim()) {
      alert("O título do anúncio é obrigatório.");
      return;
    }
    if (!editDescription.trim()) {
      alert("A descrição do anúncio é obrigatória.");
      return;
    }
    if (!editImage) {
      alert("A foto de capa do anúncio é obrigatória.");
      return;
    }

    setIsSaving(true);
    const parsedPrice = parseFloat(editPrice.replace(",", ".")) || product.price;
    const parsedOrigPrice = editOriginalPrice
      ? parseFloat(editOriginalPrice.replace(",", "."))
      : undefined;
    const parsedStock = parseInt(editStock) || 0;

    let parsedAutoDelivery: string[] | undefined = undefined;
    if (editDeliveryType === "AUTOMATIC" && editAutoDeliveryContent.trim()) {
      if (editSeparator === "\\n\\n") {
        parsedAutoDelivery = editAutoDeliveryContent
          .split(/\n\s*\n+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      } else {
        parsedAutoDelivery = editAutoDeliveryContent
          .split(editSeparator)
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      }
    }

    const isMulti = editListingType === "MULTIPLA" || editVariants.length > 1;
    let finalPrice = parsedPrice;
    let finalStock = parsedStock;
    let mappedVariants: ProductVariant[] | undefined = undefined;

    if (isMulti) {
      mappedVariants = editVariants.map((v, idx) => {
        const p = parseFloat(v.price.replace(",", ".")) || parsedPrice;
        const vCreds = (v.credentials || "").trim();
        const sep = v.separator || editSeparator || "--";
        let countFromCreds = 0;
        if (vCreds) {
          if (sep === "\\n\\n") {
            countFromCreds = vCreds.split(/\n\s*\n+/).filter((b) => b.trim().length > 0).length;
          } else if (vCreds.includes(sep)) {
            countFromCreds = vCreds.split(sep).filter((b) => b.trim().length > 0).length;
          } else {
            countFromCreds = vCreds.split("\n").filter((b) => b.trim().length > 0).length;
          }
        }
        const s =
          editDeliveryType === "AUTOMATIC" && countFromCreds > 0
            ? countFromCreds
            : parseInt(v.stock) || 0;

        return {
          id: v.id || `var-${Date.now()}-${idx}`,
          name: v.name.trim() || `Opção ${idx + 1}`,
          price: p,
          stock: s,
          originalPrice: Number((p * 1.6).toFixed(2)),
          credentials: vCreds || undefined,
        };
      });

      if (mappedVariants.length > 0) {
        finalPrice = mappedVariants[0].price;
        finalStock = mappedVariants.reduce((sum, v) => sum + v.stock, 0);
      }

      if (editDeliveryType === "AUTOMATIC") {
        const aggregated: string[] = [];
        mappedVariants.forEach((mv) => {
          if (mv.credentials) {
            const b = mv.credentials
              .split(/\n\s*--+\s*\n|\n\s*\n+/)
              .map((x) => x.trim())
              .filter(Boolean);
            if (b.length > 0) aggregated.push(...b);
            else aggregated.push(mv.credentials);
          }
        });
        if (aggregated.length > 0) {
          parsedAutoDelivery = aggregated;
        }
      }
    } else {
      // Produto de estoque único:
      // Se há credenciais detectadas, o estoque segue a quantidade de credenciais;
      // se não há credenciais digitadas, RESPEITA o estoque numérico digitado no campo de estoque (parsedStock).
      if (editDeliveryType === "AUTOMATIC") {
        if (parsedAutoDelivery && parsedAutoDelivery.length > 0) {
          finalStock = parsedAutoDelivery.length;
        } else {
          finalStock = parsedStock > 0 ? parsedStock : (product.stock || 1);
        }
      } else {
        finalStock = parsedStock;
      }
    }

    let finalImage = editImage.trim() || product.image;
    if (finalImage && finalImage.startsWith("data:")) {
      try {
        const storageUrl = await uploadToSupabaseStorage(
          finalImage,
          "products",
          `prod-${product.id}`
        );
        if (storageUrl) {
          finalImage = storageUrl;
        }
      } catch (err) {
        console.warn("Upload para Supabase Storage falhou:", err);
      }
    }

    const isCurrentlyRejected = product.status === "rejected";
    const isCurrentlyPending =
      product.status === "pending_review" || product.status === "pending_approval";

    // Se o anúncio estava reprovado ou já em análise, salvar reenvia para moderação
    const computedStatus = isCurrentlyRejected
      ? "pending_review"
      : isCurrentlyPending
      ? "pending_review"
      : finalStock <= 0
      ? "paused"
      : "active";

    const updated: Product = {
      ...product,
      title: editTitle.trim() || product.title,
      price: finalPrice,
      originalPrice: parsedOrigPrice,
      stock: finalStock,
      status: computedStatus,
      rejectionReason: isCurrentlyRejected ? undefined : product.rejectionReason,
      reviewedAt: isCurrentlyRejected ? undefined : product.reviewedAt,
      category: editCategory.trim() || product.category,
      deliveryType: editDeliveryType,
      autoDeliveryContent: parsedAutoDelivery,
      warrantyDays: editWarrantyDays,
      description: editDescription,
      image: finalImage,
      listingType: editListingType,
      hasVariations: isMulti,
      variants: isMulti ? mappedVariants : undefined,
    };

    // Salva no productStore de forma permanente (localStorage + overrides + memória + eventos)
    saveStoredProduct(updated);
    setProduct(updated);

    // Atualiza Supabase com variações e cofre seguro em segundo plano
    if (isSupabaseConfigured) {
      try {
        const vaultGroups: VaultGroup[] = [];
        if (isMulti && mappedVariants) {
          editVariants.forEach((ev, idx) => {
            const mv = mappedVariants![idx];
            const vCreds = ev.credentials || "";
            const sep = ev.separator || editSeparator || "--";
            const blocks = splitCredentialBlocks(vCreds, sep);
            vaultGroups.push({
              variantId: mv.id,
              items: blocks,
            });
          });
          vaultGroups.push({ variantId: null, items: [] });
        } else {
          const blocks = splitCredentialBlocks(editAutoDeliveryContent, editSeparator);
          vaultGroups.push({
            variantId: null,
            items: blocks,
          });
        }

        const oldVariantIds = (product.variants || []).map((v) => v.id);
        const newVariantIds = new Set((mappedVariants || []).map((v) => v.id));
        const purgeVariantIds = oldVariantIds.filter((id) => !newVariantIds.has(id));

        await updateProductRemote(updated, {
          groups: vaultGroups,
          purgeVariantIds,
        });
      } catch (err) {
        console.warn("Aviso ao atualizar no Supabase:", err);
      }
    }

    setIsSaving(false);
    if (isCurrentlyRejected) {
      setSaveSuccessText("Anúncio atualizado e reenviado para análise da moderação!");
    } else if (isCurrentlyPending) {
      setSaveSuccessText("Alterações salvas! O anúncio continua na fila de moderação.");
    } else {
      setSaveSuccessText("Anúncio atualizado com sucesso no catálogo!");
    }
    setSaveSuccessMsg(true);
    setTimeout(() => {
      router.push("/meus-produtos");
    }, 900);
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
        onOpenCreateListing={() => router.push("/?anunciar=true")}
        currentUser={currentUser}
        onOpenAuth={(tab) => {
          setAuthInitialTab(tab || "login");
          setAuthModalOpen(true);
        }}
        onOpenSettings={() => router.push("/minha-conta")}
        onOpenMyProducts={() => router.push("/meus-produtos")}
        onGoHome={() => router.push("/")}
        onLogout={async () => {
          await clearStoredUser();
          setCurrentUser(null);
          router.push("/");
        }}
      />

      {/* Main Edit View */}
      <main className="flex-1 pb-20 pt-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="py-24 text-center">
              <div className="w-8 h-8 border-3 border-[#0066FF] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs font-bold text-zinc-500">Carregando dados do produto...</p>
            </div>
          ) : !product ? (
            <div className="max-w-md mx-auto py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
                <Package className="w-8 h-8" />
              </div>
              <h1 className="text-xl font-black text-zinc-900 mb-2">Produto não encontrado</h1>
              <p className="text-xs text-zinc-500 mb-6">
                O produto solicitado não foi localizado ou foi removido.
              </p>
              <button
                type="button"
                onClick={() => router.push("/meus-produtos")}
                className="px-5 py-2.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                Voltar aos Meus Produtos
              </button>
            </div>
          ) : (
            <>
              {/* Top Bar Navigation */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <button
                  type="button"
                  onClick={() => router.push("/meus-produtos")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-bold text-zinc-700 hover:text-[#0066FF] hover:border-[#0066FF] transition-all shadow-2xs group cursor-pointer w-fit"
                >
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  <span>Voltar aos meus produtos</span>
                </button>

                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono font-black px-2.5 py-1 rounded-lg bg-blue-50 text-[#0066FF] border border-blue-200">
                    {getProductAdCode(product)}
                  </span>
                  {product.status === "rejected" ? (
                    <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Reprovado</span>
                    </span>
                  ) : product.status === "pending_review" || product.status === "pending_approval" ? (
                    <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Em Análise</span>
                    </span>
                  ) : (product.stock || 0) <= 0 || product.status === "paused" ? (
                    <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1.5">
                      <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Pausado (Sem estoque)</span>
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      ● Ativo
                    </span>
                  )}
                </div>
              </div>

              {/* Banner de Aviso: Anúncio Reprovado pela Moderação */}
              {product.status === "rejected" && (
                <div className="mb-6 rounded-2xl border border-rose-300 bg-rose-50 p-4 sm:p-5 text-xs text-rose-950 flex items-start gap-3.5 shadow-2xs">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-200 text-rose-800">
                        Anúncio Reprovado
                      </span>
                      <span className="font-bold text-sm text-rose-950">
                        Ajustes solicitados pela Moderação
                      </span>
                    </div>
                    <div className="mt-2.5 p-3 rounded-xl bg-white border border-rose-200 text-rose-900 font-medium leading-relaxed shadow-2xs">
                      <span className="font-bold text-rose-950 block text-[11px] uppercase tracking-wider mb-1">
                        Motivo:
                      </span>
                      {product.rejectionReason || "O anúncio precisa de correções para se adequar às diretrizes da plataforma."}
                    </div>
                    <p className="mt-2 text-rose-800 leading-relaxed font-semibold">
                      💡 Ajuste as informações nos campos abaixo e clique em <strong>Salvar Alterações</strong> para reenviar seu anúncio automaticamente para a fila de análise da moderação.
                    </p>
                  </div>
                </div>
              )}

              {/* Banner de Aviso: Anúncio em Análise */}
              {(product.status === "pending_review" || product.status === "pending_approval") && (
                <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950 flex items-start gap-3 shadow-2xs">
                  <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm text-amber-950">Anúncio em Análise pela Moderação</p>
                    <p className="mt-1 text-amber-800 leading-relaxed">
                      Este anúncio está aguardando revisão e aprovação pelo administrador antes de ser liberado na vitrine pública. Você pode atualizar as informações nos campos abaixo; ao salvar, as correções serão submetidas à análise.
                    </p>
                  </div>
                </div>
              )}

              {/* Banner de Aviso de Anúncio Pausado por Falta de Estoque */}
              {product.status !== "rejected" &&
                product.status !== "pending_review" &&
                product.status !== "pending_approval" &&
                ((product.stock || 0) <= 0 || product.status === "paused") && (
                  <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-3 shadow-2xs">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-sm text-amber-950">Anúncio Pausado Automaticamente</p>
                      <p className="mt-1 text-amber-800 leading-relaxed">
                        Este anúncio foi pausado automaticamente porque o estoque acabou. Para reativá-lo e voltar a vender, basta abastecer o estoque abaixo e clicar em <strong>Salvar Alterações</strong>.
                      </p>
                    </div>
                  </div>
                )}

              {/* Form Principal */}
              <form onSubmit={handleSaveProduct}>
                {saveSuccessMsg && (
                  <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-xs animate-fadeIn">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>{saveSuccessText}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* =========================================================
                      COLUNA ESQUERDA: DETALHES DO ANÚNCIO (8 cols)
                     ========================================================= */}
                  <div className="lg:col-span-8 bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/90 shadow-xs space-y-6">
                    {/* Header da Seção: Pill 1 + Detalhes do Anúncio */}
                    <div className="flex items-center gap-3 pb-5 border-b border-zinc-100">
                      <div className="w-8 h-8 rounded-xl bg-[#0066FF] text-white flex items-center justify-center font-black text-sm shadow-xs shrink-0">
                        1
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-[#0066FF]" />
                          <h2 className="text-base sm:text-lg font-black text-zinc-950">
                            Detalhes do Anúncio
                          </h2>
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Título, descrição, categoria e preço do seu produto
                        </p>
                      </div>
                    </div>

                    {/* 1. Título do Produto */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider">
                          Título do Produto *
                        </label>
                        <span className={`text-[11px] font-bold ${editTitle.length >= 61 ? "text-red-500" : editTitle.length >= 50 ? "text-amber-500" : "text-zinc-400"}`}>
                          {editTitle.length} / 61 caracteres
                        </span>
                      </div>
                      <input
                        type="text"
                        required
                        maxLength={61}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value.slice(0, 61))}
                        placeholder="Ex: BRAIN.FM | CONTA PRIVADA | 30 DIAS"
                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white text-xs sm:text-sm font-bold text-zinc-900 focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 transition-all"
                      />
                      <span className="text-[11px] text-zinc-400 mt-1.5 block">
                        Máximo de 61 caracteres (incluindo espaços e símbolos)
                      </span>
                    </div>

                    {/* 2. Descrição Completa */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider">
                          Descrição do Produto *
                        </label>
                        <span className="text-[11px] font-bold text-zinc-400">
                          {editDescription.length} / 5000
                        </span>
                      </div>

                      <div className="rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-2xs focus-within:border-[#0066FF] focus-within:ring-2 focus-within:ring-[#0066FF]/20 transition-all">
                        <textarea
                          ref={textareaRef}
                          rows={8}
                          maxLength={5000}
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Descreva detalhes, garantias, benefícios e como o comprador irá receber o produto..."
                          className="w-full text-xs sm:text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none resize-y leading-relaxed bg-transparent"
                        />
                      </div>
                      <span className="text-[11px] text-zinc-400 mt-1.5 block">
                        Seja detalhado sobre o que está vendendo. Use quebras de linha normais para organizar o texto.
                      </span>
                    </div>

                    {/* 3. Categoria */}
                    <div>
                      <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-2">
                        Categoria *
                      </label>
                      <div className="relative">
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white text-xs sm:text-sm font-bold text-zinc-900 focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 transition-all appearance-none cursor-pointer"
                        >
                          {!ALL_CATEGORIES.some((c) => c.name.toLowerCase() === editCategory.toLowerCase()) && (
                            <option value={editCategory}>{editCategory}</option>
                          )}
                          <optgroup label="Jogos Populares">
                            {ALL_CATEGORIES.filter((c) => c.group === "Jogos Populares").map((c) => (
                              <option key={c.id} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Serviços, IAs & Softwares">
                            {ALL_CATEGORIES.filter((c) => c.group === "Serviços & Softwares").map((c) => (
                              <option key={c.id} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Jogos Mobile">
                            {ALL_CATEGORIES.filter((c) => c.group === "Jogos Mobile").map((c) => (
                              <option key={c.id} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Jogos PC & Console">
                            {ALL_CATEGORIES.filter((c) => c.group === "Jogos PC & Console").map((c) => (
                              <option key={c.id} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                        <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* 4. Formato da Publicação (Único vs Variações) */}
                    <div className="space-y-3">
                      <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-[#0066FF]" />
                        <span>Formato da Publicação *</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div
                          onClick={() => setEditListingType("UNICA")}
                          className={`p-4 sm:p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                            editListingType === "UNICA"
                              ? "bg-blue-50/50 border-[#0066FF] shadow-xs"
                              : "bg-white border-zinc-200 hover:border-zinc-300"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-black text-zinc-900">Anúncio Padrão Único</span>
                            <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
                              Preço fixo
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500">
                            Um único produto com preço fixo e estoque simples.
                          </p>
                        </div>

                        <div
                          onClick={() => setEditListingType("MULTIPLA")}
                          className={`p-4 sm:p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                            editListingType === "MULTIPLA"
                              ? "bg-blue-50/50 border-[#0066FF] shadow-xs"
                              : "bg-white border-zinc-200 hover:border-zinc-300"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-black text-zinc-900">Anúncio com Variações</span>
                            <span className="text-[10px] font-bold text-[#0066FF] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              Múltiplos planos / opções
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500">
                            Permite definir opções (ex: 1 Mês, 1 Bilhão de Tokens, Vitalício) com preços e estoques diferentes.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Se for Variações Múltiplas */}
                    {editListingType === "MULTIPLA" ? (
                      <div className="p-5 sm:p-6 rounded-2xl border border-blue-200 bg-blue-50/20 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <h4 className="text-xs font-black text-zinc-950 uppercase tracking-wider flex items-center gap-1.5">
                              <Package className="w-3.5 h-3.5 text-[#0066FF]" />
                              <span>Opções e Variações do Anúncio</span>
                            </h4>
                            <p className="text-[11px] text-zinc-500 mt-0.5">
                              Defina o nome, valor e estoque de cada variação.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleAddVariant}
                            className="px-3.5 py-1.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer w-fit"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Adicionar Variação</span>
                          </button>
                        </div>

                        <div className="space-y-3">
                          {editVariants.map((v, i) => (
                            <div
                              key={v.id}
                              className="flex flex-col sm:flex-row items-center gap-3 p-3.5 rounded-xl border border-zinc-200 bg-white shadow-2xs"
                            >
                              <div className="w-full sm:flex-1">
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                                  Nome da Opção / Plano #{i + 1} *
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={v.name}
                                  onChange={(e) => handleUpdateVariant(v.id, "name", e.target.value)}
                                  placeholder="Ex: 1 Bilhão de Tokens / Plano Mensal"
                                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-zinc-50 focus:bg-white text-xs font-bold text-zinc-900 focus:outline-none focus:border-[#0066FF]"
                                />
                              </div>

                              <div className="w-full sm:w-44">
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                                  Preço (R$) *
                                </label>
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 focus-within:bg-white focus-within:border-[#0066FF]">
                                  <span className="text-xs font-bold text-zinc-400">R$</span>
                                  <input
                                    type="text"
                                    required
                                    value={v.price}
                                    onChange={(e) => handleUpdateVariant(v.id, "price", e.target.value)}
                                    placeholder="29,90"
                                    className="w-full bg-transparent text-xs font-black text-zinc-950 focus:outline-none"
                                  />
                                </div>
                              </div>

                              <div className="w-full sm:w-32">
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                                  Estoque *
                                </label>
                                <input
                                  type="number"
                                  required
                                  min={0}
                                  value={v.stock}
                                  onChange={(e) => handleUpdateVariant(v.id, "stock", e.target.value)}
                                  placeholder="10"
                                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-zinc-50 focus:bg-white text-xs font-bold text-zinc-900 focus:outline-none focus:border-[#0066FF]"
                                />
                              </div>

                              {editVariants.length > 1 && (
                                <div className="sm:pt-4">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveVariant(v.id)}
                                    className="p-2 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                    title="Remover variação"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="pt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500 font-semibold border-t border-blue-100">
                          <span>
                            Total: <strong className="text-zinc-900">{editVariants.length} opção(ões)</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Estoque total:{" "}
                            <strong className="text-zinc-900">
                              {editVariants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0)} un.
                            </strong>
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* Se for Anúncio Padrão Único: Preço (R$) e Estoque simples */
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <DollarSign className="w-3.5 h-3.5 text-[#0066FF]" />
                            <span>Preço (R$) *</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            placeholder="15.90"
                            className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white text-xs sm:text-sm font-bold text-zinc-900 focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 transition-all"
                          />
                          <div className="mt-1.5 space-y-0.5">
                            <span className="text-[11px] text-zinc-400 block">Valor em reais</span>
                            <span className="text-[10px] text-amber-600 font-bold block">
                              Preço mínimo para {editCategory || "Assinaturas Premium"}: R$ 1,00
                            </span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 text-[#0066FF]" />
                            <span>Estoque *</span>
                          </label>
                          <input
                            type="number"
                            required
                            min={0}
                            value={editStock}
                            onChange={(e) => setEditStock(e.target.value)}
                            placeholder="51"
                            className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white text-xs sm:text-sm font-bold text-zinc-900 focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 transition-all"
                          />
                          <span className="text-[11px] text-zinc-400 mt-1.5 block">Quantidade disponível</span>
                        </div>
                      </div>
                    )}

                    {/* 5. Preço De/Risco (R$) e Garantia (Dias) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-2">
                          Preço De/Risco (R$) <span className="text-zinc-400 font-normal lowercase">(opcional)</span>
                        </label>
                        <input
                          type="text"
                          value={editOriginalPrice}
                          onChange={(e) => setEditOriginalPrice(e.target.value)}
                          placeholder="Ex: 59.90"
                          className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white text-xs sm:text-sm font-medium text-zinc-900 focus:outline-none focus:border-[#0066FF] transition-all"
                        />
                        <span className="text-[11px] text-zinc-400 mt-1.5 block">
                          Preço original riscado para criar efeito de desconto
                        </span>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-2">
                          Garantia (Dias)
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={editWarrantyDays}
                          onChange={(e) => setEditWarrantyDays(parseInt(e.target.value) || 30)}
                          className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white text-xs sm:text-sm font-medium text-zinc-900 focus:outline-none focus:border-[#0066FF] transition-all"
                        />
                        <span className="text-[11px] text-zinc-400 mt-1.5 block">
                          Prazo de suporte e garantia oferecido ao comprador
                        </span>
                      </div>
                    </div>

                    {/* 6. Forma de Entrega */}
                    <div>
                      <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-2">
                        Forma de Entrega *
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <button
                          type="button"
                          onClick={() => setEditDeliveryType("AUTOMATIC")}
                          className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                            editDeliveryType === "AUTOMATIC"
                              ? "border-[#0066FF] bg-blue-50/50 ring-2 ring-[#0066FF]/20"
                              : "border-zinc-200 bg-white hover:border-zinc-300"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Zap className={`w-4 h-4 ${editDeliveryType === "AUTOMATIC" ? "text-[#0066FF] fill-[#0066FF]" : "text-zinc-500"}`} />
                            <span className="font-black text-xs sm:text-sm text-zinc-900">Automática 24/7</span>
                          </div>
                          <span className="text-xs text-zinc-500 block">
                            Entrega imediata dos dados após a aprovação do PIX
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditDeliveryType("MANUAL")}
                          className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                            editDeliveryType === "MANUAL"
                              ? "border-[#0066FF] bg-blue-50/50 ring-2 ring-[#0066FF]/20"
                              : "border-zinc-200 bg-white hover:border-zinc-300"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className={`w-4 h-4 ${editDeliveryType === "MANUAL" ? "text-[#0066FF]" : "text-zinc-500"}`} />
                            <span className="font-black text-xs sm:text-sm text-zinc-900">Manual via Chat</span>
                          </div>
                          <span className="text-xs text-zinc-500 block">
                            Você entrega o acesso diretamente ao cliente na central
                          </span>
                        </button>
                      </div>

                      {/* Bloco de Contas/Credenciais para Entrega Automática */}
                      {editDeliveryType === "AUTOMATIC" && (
                        <div className="mt-5 space-y-4 animate-fadeIn">
                          {editListingType === "MULTIPLA" || editVariants.length > 1 ? (
                            <VariantStockSection
                              variants={editVariants}
                              defaultSeparator={editSeparator}
                              onUpdateVariant={handleUpdateVariant}
                              onUpdateFullVariant={handleUpdateFullVariant}
                              onAddVariant={handleAddVariant}
                              onRemoveVariant={handleRemoveVariant}
                              onSeparatorChange={setEditSeparator}
                            />
                          ) : (
                            <>
                              {/* Separador de Credenciais */}
                              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 sm:p-5 space-y-2 shadow-2xs">
                                <label className="block text-xs font-bold text-zinc-900 uppercase tracking-wider">
                                  Separador de Credenciais
                                </label>
                                <p className="text-[11px] text-zinc-500">
                                  Cada bloco separado = 1 unidade de estoque vendável
                                </p>
                                <div className="relative pt-1">
                                  <select
                                    value={editSeparator}
                                    onChange={(e) => {
                                      const newSep = e.target.value;
                                      setEditSeparator(newSep);
                                      const count = getDetectedAccountsCount(editAutoDeliveryContent, newSep);
                                      if (count > 0) setEditStock(String(count));
                                    }}
                                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white text-xs sm:text-sm font-bold text-zinc-900 focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 transition-all appearance-none cursor-pointer pr-10"
                                  >
                                    <option value="--">Horizontal ( -- )</option>
                                    <option value="\n\n">Quebra de linha ( Enter duplo )</option>
                                    <option value="|">Barra vertical ( | )</option>
                                    <option value="---">Hífen triplo ( --- )</option>
                                  </select>
                                  <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                              </div>

                              {/* Credenciais */}
                              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 sm:p-5 space-y-3 shadow-2xs">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                      <Package className="w-4 h-4" />
                                    </div>
                                    <span className="font-bold text-xs sm:text-sm text-zinc-900">Credenciais</span>
                                  </div>
                                  {detectedAccountsCount > 0 && (
                                    <span className="text-[11px] font-bold text-[#0066FF] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs">
                                      {detectedAccountsCount} {detectedAccountsCount === 1 ? "unidade detectada" : "unidades detectadas"}
                                    </span>
                                  )}
                                </div>

                                <div className="rounded-xl border border-zinc-200 bg-white p-3 focus-within:border-[#0066FF] focus-within:ring-2 focus-within:ring-[#0066FF]/20 transition-all">
                                  <textarea
                                    ref={credentialsTextareaRef}
                                    rows={7}
                                    value={editAutoDeliveryContent}
                                    onChange={(e) => handleCredentialsChange(e.target.value)}
                                    placeholder={`Cole as credenciais separadas por: ${editSeparator === "\\n\\n" ? "Enter duplo" : editSeparator}\n\nExemplo:\nLogin: email1@mail.com\nSenha: senha123`}
                                    className="w-full text-xs font-mono text-zinc-900 placeholder:text-zinc-400 focus:outline-none resize-y leading-relaxed bg-transparent"
                                  />
                                </div>

                                <button
                                  type="button"
                                  onClick={handleInsertSeparator}
                                  className="w-full py-2.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-100/80 text-zinc-700 hover:text-zinc-900 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-[0.99]"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Inserir Separador ({editSeparator === "\\n\\n" ? "Enter duplo" : editSeparator})</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* =========================================================
                      COLUNA DIREITA: IMAGENS & AÇÕES (4 cols)
                     ========================================================= */}
                  <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
                    <div className="bg-white rounded-3xl p-6 border border-zinc-200/90 shadow-xs space-y-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <ImageIcon className="w-4 h-4 text-[#0066FF]" />
                          <h3 className="font-black text-sm text-zinc-950">Imagens</h3>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          Foto da capa (1 imagem)
                        </p>
                      </div>

                      {/* Thumbnail de Capa com Badge CAPA */}
                      {editImage ? (
                        <div className="relative aspect-video sm:aspect-square w-full rounded-2xl overflow-hidden border-2 border-[#0066FF] bg-zinc-950 shadow-md group">
                          <img
                            src={editImage}
                            alt="Capa do anúncio"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-md bg-[#0066FF] text-white text-[10px] font-black uppercase tracking-wider shadow-sm">
                            CAPA
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditImage("")}
                            className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/60 hover:bg-rose-600 text-white transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                            title="Remover imagem"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : null}

                      {/* Dropzone de Upload */}
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-zinc-300 hover:border-[#0066FF] rounded-2xl p-6 text-center transition-all bg-zinc-50/50 hover:bg-blue-50/30 cursor-pointer group"
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageFileChange}
                          className="hidden"
                        />
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0066FF] flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform border border-blue-100 shadow-2xs">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                        <span className="block text-xs font-black text-zinc-900 group-hover:text-[#0066FF] transition-colors">
                          Clique para adicionar imagens
                        </span>
                        <span className="block text-[11px] text-zinc-400 mt-1">
                          JPG, PNG, GIF ou WEBP até 15 MB
                        </span>
                      </div>

                      <div className="text-[11px] text-zinc-400 font-medium pt-1 text-center">
                        <span>{editImage ? "1/1 imagem adicionada" : "0/1 imagem adicionada"}</span>
                      </div>

                      {/* Botões de Ação */}
                      <div className="pt-4 border-t border-zinc-100 space-y-2.5">
                        <button
                          type="submit"
                          disabled={isSaving}
                          className="w-full py-3.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/25 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          <Save className="w-4 h-4" />
                          <span>{isSaving ? "Salvando..." : "Salvar Alterações"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => router.push("/meus-produtos")}
                          className="w-full py-2.5 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 font-bold text-xs transition-colors cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </>
          )}
        </div>
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
          setCurrentUser(user);
          persistUser(user);
        }}
      />

      {/* Footer */}
      <JamFooter />
    </div>
  );
}
