"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Product, UserProfile } from "@/types";
import { ALL_CATEGORIES } from "@/lib/categories";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { getProductAdCode } from "@/lib/adCode";
import {
  ArrowLeft,
  Plus,
  Search,
  Edit3,
  Eye,
  Trash2,
  Zap,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  X,
  Package,
  PauseCircle,
  Layers,
  TrendingUp,
  AlertCircle,
  Save,
  Sparkles,
  Info,
  Globe,
  Archive,
  EyeOff,
  AlertTriangle,
  DollarSign,
  FileText,
  ChevronDown,
  Image as ImageIcon,
  Play,
  Power,
} from "lucide-react";

interface MyProductsViewProps {
  products: Product[];
  currentUser?: UserProfile | null;
  currentUserEmail?: string;
  currentUserId?: string;
  currentUserName?: string;
  isAdmin?: boolean;
  onBack: () => void;
  onOpenCreateListing: () => void;
  onSelectProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (productId: string, product?: Product) => void;
}

export function formatProductCategory(p: Product): string {
  if (!p.category || p.category.trim() === "") {
    return "Assinaturas · Conta";
  }
  const cat = p.category.trim();
  if (cat.includes("·")) return cat;
  if (cat.includes("•")) return cat.replace("•", "·");
  if (cat.includes("/")) return cat.split("/").map((s) => s.trim()).join(" · ");
  if (cat.includes("-") && !cat.startsWith("-")) return cat.split("-").map((s) => s.trim()).join(" · ");

  if (p.tags && p.tags.length > 0) {
    const sub = p.tags.find((t) => t.toLowerCase() !== cat.toLowerCase());
    if (sub) return `${cat} · ${sub}`;
  }

  return `${cat} · Conta`;
}

export function MyProductsView({
  products,
  currentUser,
  currentUserEmail,
  currentUserId,
  currentUserName,
  isAdmin = false,
  onBack,
  onOpenCreateListing,
  onSelectProduct,
  onUpdateProduct,
  onDeleteProduct,
}: MyProductsViewProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState<"TODOS" | "AUTOMATIC" | "MANUAL">("TODOS");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Status Tab & Sub-filters (Matching uploaded reference image)
  type StatusTab = "TODOS" | "ATIVOS" | "PENDENTES" | "REJEITADOS" | "DESATIVADOS" | "ARQUIVADOS";
  const [statusTab, setStatusTab] = useState<StatusTab>("TODOS");
  const [sortByMostSold, setSortByMostSold] = useState(false);
  const [filterOutOfStock, setFilterOutOfStock] = useState(false);
  const [filterVariantOutOfStock, setFilterVariantOutOfStock] = useState(false);

  // Form states for the Edit Modal
  const [editTitle, setEditTitle] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editOriginalPrice, setEditOriginalPrice] = useState("");
  const [editStock, setEditStock] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDeliveryType, setEditDeliveryType] = useState<"AUTOMATIC" | "MANUAL">("AUTOMATIC");
  const [editWarrantyDays, setEditWarrantyDays] = useState(30);
  const [editDescription, setEditDescription] = useState("");
  const [editImage, setEditImage] = useState("");
  const [editAutoDeliveryContent, setEditAutoDeliveryContent] = useState("");
  const [editSeparator, setEditSeparator] = useState("--");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{ type: "success" | "warning"; msg: string } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const credentialsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert("A imagem ou GIF deve ter no máximo 15MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setEditImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Open edit page with sequential product code /editar-produto/[01, 02...]
  const handleStartEdit = (product: Product) => {
    const code = getProductAdCode(product).replace("#", "");
    router.push(`/editar-produto/${code}`);
  };

  // Close edit modal
  const handleCloseEdit = () => {
    setEditingProduct(null);
    setIsSaving(false);
    setSaveSuccessMsg(false);
  };

  // Save changes
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

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
    const parsedPrice = parseFloat(editPrice.replace(",", ".")) || editingProduct.price;
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

    const calcStock =
      editDeliveryType === "AUTOMATIC" && parsedAutoDelivery && parsedAutoDelivery.length > 0
        ? parsedAutoDelivery.length
        : (parsedStock > 0 ? parsedStock : (editingProduct.stock || 1));

    const isCurrentlyRejected = editingProduct.status === "rejected";
    const isCurrentlyPending =
      editingProduct.status === "pending_review" ||
      editingProduct.status === "pending_approval";

    // Se estava reprovado, ao salvar as correções ele volta para a fila de moderação
    const finalStatus = isCurrentlyRejected
      ? "pending_review"
      : isCurrentlyPending
      ? "pending_review"
      : calcStock <= 0
      ? "paused"
      : editingProduct.status || "active";

    const updated: Product = {
      ...editingProduct,
      title: editTitle.trim() || editingProduct.title,
      price: parsedPrice,
      originalPrice: parsedOrigPrice,
      stock: calcStock,
      status: finalStatus,
      rejectionReason: isCurrentlyRejected ? undefined : editingProduct.rejectionReason,
      category: editCategory.trim() || editingProduct.category,
      deliveryType: editDeliveryType,
      autoDeliveryContent: parsedAutoDelivery,
      warrantyDays: editWarrantyDays,
      description: editDescription,
      image: editImage.trim() || editingProduct.image,
    };

    // Atualiza estado local e cache
    onUpdateProduct(updated);

    if (isCurrentlyRejected) {
      setStatusFeedback({
        type: "success",
        msg: "Anúncio atualizado e reenviado para análise da moderação!",
      });
    }

    // Atualiza no banco Supabase se configurado
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from("products")
          .update({
            title: updated.title,
            description: updated.description,
            price: updated.price,
            original_price: updated.originalPrice,
            stock: updated.stock,
            status: updated.status,
            category: updated.category,
            delivery_type: updated.deliveryType.toLowerCase(),
            delivery_content: parsedAutoDelivery?.join("\n--\n") || null,
            image: updated.image,
            warranty_days: updated.warrantyDays,
          })
          .eq("id", updated.id);
      } catch (err) {
        console.error("Erro ao atualizar no Supabase:", err);
      }
    }

    setIsSaving(false);
    setSaveSuccessMsg(true);
    setTimeout(() => {
      handleCloseEdit();
    }, 900);
  };

  const email = (currentUser?.email || currentUserEmail || "").toLowerCase().trim();
  const userId = currentUser?.id || currentUserId || "";
  const userName = (currentUser?.name || currentUserName || "").toLowerCase().trim();

  const isGennyson =
    email.includes("gennyson") ||
    userName.includes("gennyson") ||
    userId === "bb25d258-3152-422b-aa04-7bd34e8a5927";

  // Filtra produtos pertencentes exclusivamente ao usuário logado
  const myOwnProducts = products.filter((p) => {
    // Se não há usuário logado identificado, não exibe produtos de vendedor
    if (!email && !userId && !userName) return false;

    // Se o usuário logado for Gennyson (admin principal):
    if (isGennyson) {
      return (
        (userId && p.seller?.id === userId) ||
        p.seller?.id === "usr-gennyson" ||
        p.seller?.id === "bb25d258-3152-422b-aa04-7bd34e8a5927" ||
        (p.seller?.name && p.seller.name.toLowerCase().includes("gennyson")) ||
        p.id === "muse-ai-pro" ||
        (p.seller?.id === "me-seller" && (!p.seller?.email || p.seller.email.toLowerCase().includes("gennyson")))
      );
    }

    // Para QUALQUER OUTRO USUÁRIO (ex: jovitoolsbr@gmail.com):
    // Jamais exibe produtos padrão ou de teste do Gennyson / Muse AI!
    const isGennysonProduct =
      p.seller?.id === "usr-gennyson" ||
      p.seller?.id === "bb25d258-3152-422b-aa04-7bd34e8a5927" ||
      (p.seller?.name && p.seller.name.toLowerCase().includes("gennyson")) ||
      p.id === "muse-ai-pro";

    if (isGennysonProduct) return false;

    // Verifica correspondência por ID, e-mail do vendedor ou nome público
    const matchId = Boolean(userId && p.seller?.id && p.seller.id === userId);
    const matchEmail = Boolean(email && p.seller?.email && p.seller.email.toLowerCase().trim() === email);
    const matchName = Boolean(userName && p.seller?.name && p.seller.name.toLowerCase().trim() === userName);

    return matchId || matchEmail || matchName;
  });

  // Determina se o produto possui variações configuradas
  const hasVariants = (p: Product) =>
    (Boolean(p.hasVariations) ||
      p.listingType === "MULTIPLA" ||
      (Array.isArray(p.variants) && p.variants.length > 0)) &&
    Boolean(p.variants && p.variants.length > 0);

  // Calcula o estoque total real do produto (somando variantes se houver)
  const getProductTotalStock = (p: Product) => {
    if (hasVariants(p)) {
      return (p.variants || []).reduce((sum, v) => sum + Number(v.stock ?? 0), 0);
    }
    return Number(p.stock ?? 0);
  };

  // Anúncio sem estoque: estoque total zerado (ou todas as variantes zeradas)
  const isProductOutOfStock = (p: Product) => {
    return getProductTotalStock(p) <= 0;
  };

  // Possui pelo menos uma variação sem estoque
  const hasVariantOutOfStock = (p: Product) => {
    if (!hasVariants(p)) return false;
    return (p.variants || []).some((v) => Number(v.stock ?? 0) <= 0);
  };

  // Funções de status
  const isProductActive = (p: Product) => {
    if (
      p.status === "paused" ||
      p.status === "pending_review" ||
      p.status === "pending_approval" ||
      p.status === "rejected"
    ) {
      return false;
    }
    return !isProductOutOfStock(p);
  };

  const isProductPaused = (p: Product) => {
    if (
      p.status === "pending_review" ||
      p.status === "pending_approval" ||
      p.status === "rejected"
    ) {
      return false;
    }
    return p.status === "paused" || isProductOutOfStock(p);
  };

  // Calculate Metrics & Status Counts baseados apenas nos produtos do usuário
  const totalCount = myOwnProducts.length;
  const activeCount = myOwnProducts.filter(isProductActive).length;
  const outOfStockCount = myOwnProducts.filter((p) => isProductActive(p) && isProductOutOfStock(p)).length;
  const variantOutOfStockCount = myOwnProducts.filter(hasVariantOutOfStock).length;
  const pendingCount = myOwnProducts.filter(
    (p) => p.status === "pending_review" || p.status === "pending_approval"
  ).length;
  const rejectedCount = myOwnProducts.filter((p) => p.status === "rejected").length;
  const disabledCount = myOwnProducts.filter(isProductPaused).length;
  const archivedCount = 0;

  // Handlers para abas de status e botões de filtro sem conflito
  const handleSelectStatusTab = (tabId: StatusTab) => {
    setStatusTab(tabId);
    if (tabId === "ATIVOS") {
      setFilterOutOfStock(false);
    }
  };

  const handleToggleOutOfStock = () => {
    const next = !filterOutOfStock;
    setFilterOutOfStock(next);
    if (next) {
      setFilterVariantOutOfStock(false);
      if (statusTab === "ATIVOS") {
        setStatusTab("TODOS");
      }
    }
  };

  const handleToggleVariantOutOfStock = () => {
    const next = !filterVariantOutOfStock;
    setFilterVariantOutOfStock(next);
    if (next) {
      setFilterOutOfStock(false);
    }
  };

  const handleToggleProductStatus = (p: Product) => {
    const isPaused = isProductPaused(p);

    if (isPaused) {
      const totalStock = getProductTotalStock(p);
      if (totalStock <= 0) {
        setStatusFeedback({
          type: "warning",
          msg: "Reabasteça o estoque para ativar o anúncio.",
        });
        setTimeout(() => setStatusFeedback(null), 3500);
        return;
      }

      const updated: Product = {
        ...p,
        status: "active",
      };
      onUpdateProduct(updated);

      if (isSupabaseConfigured) {
        try {
          if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.id)) {
            supabase.from("products").update({ status: "active" }).eq("id", p.id).then();
          } else {
            supabase.from("products").update({ status: "active" }).ilike("title", p.title.trim()).then();
          }
        } catch {}
      }

      setStatusFeedback({
        type: "success",
        msg: "Anúncio ativado com sucesso!",
      });
      setTimeout(() => setStatusFeedback(null), 3000);
    } else {
      const updated: Product = {
        ...p,
        status: "paused",
      };
      onUpdateProduct(updated);

      if (isSupabaseConfigured) {
        try {
          if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.id)) {
            supabase.from("products").update({ status: "paused" }).eq("id", p.id).then();
          } else {
            supabase.from("products").update({ status: "paused" }).ilike("title", p.title.trim()).then();
          }
        } catch {}
      }

      setStatusFeedback({
        type: "success",
        msg: "Anúncio desativado com sucesso!",
      });
      setTimeout(() => setStatusFeedback(null), 3000);
    }
  };

  // Filter products based on Status Tab, Sub-filters, Delivery and Search
  let filteredProducts = myOwnProducts.filter((p) => {
    // Delivery Filter
    if (deliveryFilter !== "TODOS" && p.deliveryType !== deliveryFilter) {
      return false;
    }

    // Status Tab Filter
    if (statusTab === "ATIVOS") {
      if (!isProductActive(p)) return false;
    } else if (statusTab === "DESATIVADOS") {
      if (!isProductPaused(p)) return false;
    } else if (statusTab === "PENDENTES") {
      if (p.status !== "pending_review" && p.status !== "pending_approval") return false;
    } else if (statusTab === "REJEITADOS") {
      if (p.status !== "rejected") return false;
    } else if (statusTab === "ARQUIVADOS") {
      return false;
    }

    // Sub-filter: Sem Estoque (apenas anúncios cujo estoque total zerou)
    if (filterOutOfStock && !isProductOutOfStock(p)) {
      return false;
    }

    // Sub-filter: Variante s/ Estoque (anúncios que possuem ao menos uma opção zerada)
    if (filterVariantOutOfStock && !hasVariantOutOfStock(p)) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (sortByMostSold) {
    filteredProducts = [...filteredProducts].sort(
      (a, b) => (b.salesCount || 0) - (a.salesCount || 0)
    );
  }

  // =========================================================================
  // VIEW DEDICADA: EDITAR ANÚNCIO (ESTILO PÁGINA COMPLETA - IDÊNTICA À REFERÊNCIA)
  // =========================================================================
  if (editingProduct) {
    return (
      <div className="min-h-screen bg-zinc-50 pb-20 pt-6 font-sans">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top Bar Navigation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <button
              type="button"
              onClick={handleCloseEdit}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-bold text-zinc-700 hover:text-[#0066FF] hover:border-[#0066FF] transition-all shadow-2xs group cursor-pointer w-fit"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span>Voltar aos meus produtos</span>
            </button>

            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono font-black px-2.5 py-1 rounded-lg bg-blue-50 text-[#0066FF] border border-blue-200">
                {getProductAdCode(editingProduct)}
              </span>
              {editingProduct.status === "rejected" ? (
                <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Reprovado</span>
                </span>
              ) : editingProduct.status === "pending_review" || editingProduct.status === "pending_approval" ? (
                <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Em Análise</span>
                </span>
              ) : isProductPaused(editingProduct) ? (
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
          {editingProduct.status === "rejected" && (
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
                  {editingProduct.rejectionReason || "O anúncio precisa de correções para se adequar às diretrizes da plataforma."}
                </div>
                <p className="mt-2 text-rose-800 leading-relaxed font-semibold">
                  💡 Ajuste as informações nos campos abaixo e clique em <strong>Salvar Alterações</strong> para reenviar seu anúncio automaticamente para a fila de análise da moderação.
                </p>
              </div>
            </div>
          )}

          {/* Banner de Aviso: Anúncio em Análise */}
          {(editingProduct.status === "pending_review" || editingProduct.status === "pending_approval") && (
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

          {/* Form Principal */}
          <form onSubmit={handleSaveProduct}>
            {saveSuccessMsg && (
              <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-xs animate-fadeIn">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  {editingProduct.status === "rejected"
                    ? "Anúncio atualizado e reenviado para análise da moderação!"
                    : "Anúncio atualizado com sucesso no catálogo!"}
                </span>
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
                      Descrição *
                    </label>
                    <span className="text-[11px] font-bold text-zinc-400">
                      {editDescription.length} / 5000
                    </span>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-2xs focus-within:border-[#0066FF] focus-within:ring-2 focus-within:ring-[#0066FF]/20 transition-all">
                    <textarea
                      ref={textareaRef}
                      rows={7}
                      maxLength={5000}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Descreva detalhes, garantias, benefícios e como o comprador irá receber o produto..."
                      className="w-full text-xs sm:text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none resize-y leading-relaxed bg-transparent"
                    />
                  </div>
                  <span className="text-[11px] text-zinc-400 mt-1.5 block">
                    Seja detalhado sobre o que está vendendo (máximo 5000 caracteres)
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

                {/* 4. Preço (R$) e Estoque (Lado a lado, exatamente como na referência) */}
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

                  {/* Thumbnail de Capa Atual com Badge CAPA */}
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
                        <Trash2 className="w-4 h-4" />
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
                      onClick={handleCloseEdit}
                      className="w-full py-2.5 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 font-bold text-xs transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16">
      {/* Top Header / Breadcrumb */}
      <div className="bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <button
                onClick={onBack}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-[#0066FF] transition-colors mb-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar para a Loja</span>
              </button>
              <h1 className="text-xl sm:text-2xl font-black text-zinc-950 flex items-center gap-2.5">
                <Package className="w-6 h-6 text-[#0066FF]" />
                <span>Meus Produtos & Anúncios</span>
              </h1>
              <p className="text-xs sm:text-sm text-zinc-500 mt-1">
                Gerencie todos os seus produtos publicados, ajuste preços, estoque e descrições com sincronização em tempo real.
              </p>
            </div>

            <button
              onClick={onOpenCreateListing}
              className="px-5 py-2.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm shadow-blue-500/20 active:scale-95 transition-all self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>+ Novo Anúncio</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">
        {/* ========================================================
            TOP STATUS CARDS: Pendentes & Rejeitados (Matching uploaded screenshot)
            ======================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-zinc-200/90 shadow-2xs hover:border-zinc-300 transition-all">
            <span className="text-xs font-bold text-zinc-500 block mb-1">
              Pendentes
            </span>
            <div className="text-3xl font-black text-zinc-950 mb-1">
              {pendingCount}
            </div>
            <span className="text-xs text-zinc-400 font-medium">
              Aguardando aprovação
            </span>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-zinc-200/90 shadow-2xs hover:border-zinc-300 transition-all">
            <span className="text-xs font-bold text-zinc-500 block mb-1">
              Rejeitados
            </span>
            <div className="text-3xl font-black text-rose-600 mb-1">
              {rejectedCount}
            </div>
            <span className="text-xs text-zinc-400 font-medium">
              Não aprovados
            </span>
          </div>
        </div>

        {/* ========================================================
            STATUS TABS & SUB-FILTERS CARD (Matching uploaded screenshot)
            ======================================================== */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-zinc-200/90 shadow-2xs space-y-4">
          {/* Row 1: Status Tabs Grid (Todos, Ativos, Pendentes, Rejeitados, Desativados, Arquivados) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {[
              { id: "TODOS", label: "Todos", count: totalCount },
              { id: "ATIVOS", label: "Ativos", count: activeCount },
              { id: "PENDENTES", label: "Pendentes", count: pendingCount },
              { id: "REJEITADOS", label: "Rejeitados", count: rejectedCount },
              { id: "DESATIVADOS", label: "Pausados", count: disabledCount },
              { id: "ARQUIVADOS", label: "Arquivados", count: archivedCount },
            ].map((tab) => {
              const isActive = statusTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSelectStatusTab(tab.id as StatusTab)}
                  className={`py-3 px-2 rounded-xl text-center transition-all flex flex-col items-center justify-center cursor-pointer ${
                    isActive
                      ? "bg-[#0066FF] text-white shadow-md shadow-blue-500/25 font-bold"
                      : "bg-zinc-100 hover:bg-zinc-200/80 text-zinc-700 font-medium"
                  }`}
                >
                  <span className="text-xs font-bold">{tab.label}</span>
                  <span
                    className={`text-[11px] font-semibold mt-0.5 ${
                      isActive ? "text-blue-100" : "text-zinc-500"
                    }`}
                  >
                    ({tab.count})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Row 2: Sub-filters (Mais Vendidos, Sem Estoque, Variante s/ Estoque) + Search & Entrega */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-zinc-100">
            {/* Quick Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setSortByMostSold((prev) => !prev)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap border cursor-pointer ${
                  sortByMostSold
                    ? "bg-[#0066FF] text-white border-[#0066FF] shadow-xs"
                    : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-200"
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Mais Vendidos</span>
              </button>

              <button
                type="button"
                onClick={handleToggleOutOfStock}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap border cursor-pointer ${
                  filterOutOfStock
                    ? "bg-[#0066FF] text-white border-[#0066FF] shadow-xs"
                    : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-200"
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Sem Estoque</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                    filterOutOfStock
                      ? "bg-white/20 text-white"
                      : "bg-black/10 text-zinc-800"
                  }`}
                >
                  {outOfStockCount}
                </span>
              </button>

              <button
                type="button"
                onClick={handleToggleVariantOutOfStock}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap border cursor-pointer ${
                  filterVariantOutOfStock
                    ? "bg-[#0066FF] text-white border-[#0066FF] shadow-xs"
                    : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-200"
                }`}
              >
                <Info className="w-3.5 h-3.5" />
                <span>Variante s/ Estoque</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                    filterVariantOutOfStock
                      ? "bg-white/20 text-white"
                      : variantOutOfStockCount > 0
                      ? "bg-amber-100 text-amber-800"
                      : "bg-black/10 text-zinc-800"
                  }`}
                >
                  {variantOutOfStockCount}
                </span>
              </button>
            </div>

            {/* Search and Delivery Filter */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar produto..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#0066FF] focus:bg-white transition-all"
                />
              </div>

              {/* Delivery Pills */}
              <div className="flex items-center gap-1 bg-zinc-100 p-0.5 rounded-xl border border-zinc-200 text-xs">
                {(["TODOS", "AUTOMATIC", "MANUAL"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setDeliveryFilter(type)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${
                      deliveryFilter === type
                        ? "bg-white text-[#0066FF] shadow-2xs"
                        : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    {type === "TODOS" && "Todas"}
                    {type === "AUTOMATIC" && "⚡ Auto"}
                    {type === "MANUAL" && "🕒 Manual"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Product Cards List */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-3xl border border-zinc-200 p-12 text-center shadow-xs">
            <Package className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
            <h3 className="font-bold text-zinc-900 text-base mb-1">
              {totalCount === 0 ? "Você ainda não possui anúncios cadastrados" : "Nenhum produto encontrado"}
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto mb-4">
              {totalCount === 0
                ? "Comece a vender na plataforma publicando seu primeiro produto agora mesmo!"
                : "Não encontramos anúncios correspondentes aos filtros selecionados."}
            </p>
            {totalCount > 0 && (statusTab !== "TODOS" || filterOutOfStock || filterVariantOutOfStock || searchQuery.trim() || deliveryFilter !== "TODOS") && (
              <button
                type="button"
                onClick={() => {
                  setStatusTab("TODOS");
                  setFilterOutOfStock(false);
                  setFilterVariantOutOfStock(false);
                  setSearchQuery("");
                  setDeliveryFilter("TODOS");
                }}
                className="mb-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#0066FF] text-xs font-bold border border-blue-200 transition-colors cursor-pointer"
              >
                Limpar filtros aplicados
              </button>
            )}
            <div>
              <button
                onClick={onOpenCreateListing}
                className="px-5 py-2.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
              >
                + Criar Novo Anúncio
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map((p) => {
              return (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl border border-zinc-200/90 hover:border-zinc-300 p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Left: Thumbnail & Main info */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-zinc-100 border border-zinc-200 flex-shrink-0">
                      <img
                        src={p.image}
                        alt={p.title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[11px] font-mono font-black text-[#0066FF] bg-blue-50/90 px-2 py-0.5 rounded border border-blue-200">
                          {getProductAdCode(p)}
                        </span>
                        {p.deliveryType === "AUTOMATIC" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0066FF] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            <Zap className="w-3 h-3 fill-[#0066FF]" />
                            <span>Entrega Automática</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                            <Clock className="w-3 h-3 text-sky-700" />
                            <span>Entrega Manual</span>
                          </span>
                        )}

                        {p.status === "pending_review" || p.status === "pending_approval" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                            <span>Em Análise</span>
                          </span>
                        ) : p.status === "rejected" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            <span>Reprovado</span>
                          </span>
                        ) : isProductPaused(p) ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <PauseCircle className="w-3 h-3 text-amber-600" />
                            <span>Pausado (Sem estoque)</span>
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Ativo
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-zinc-950 text-sm sm:text-base leading-snug line-clamp-1">
                        {p.title}
                      </h3>

                      <p className="text-xs sm:text-[13px] text-zinc-500 font-medium mt-0.5">
                        {formatProductCategory(p)}
                      </p>

                      {p.status === "rejected" && p.rejectionReason && (
                        <div className="mt-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-950">
                          <div className="flex items-center gap-1.5 font-bold text-rose-800 mb-1">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>Motivo:</span>
                          </div>
                          <p className="text-rose-900 leading-relaxed font-medium">
                            "{p.rejectionReason}"
                          </p>
                        </div>
                      )}

                      {(p.status === "pending_review" || p.status === "pending_approval") && (
                        <div className="mt-2 p-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-medium flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Anúncio aguardando aprovação do administrador para ser publicado no catálogo.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Middle: Stock & Pricing */}
                  <div className="flex items-center justify-between md:justify-end gap-6 sm:gap-8 pt-3 md:pt-0 border-t md:border-t-0 border-zinc-100 flex-shrink-0">
                    <div>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                        Estoque
                      </span>
                      <span className="text-sm sm:text-base font-black text-zinc-900">
                        {getProductTotalStock(p)}{" "}
                        <span className="text-xs font-normal text-zinc-400">un.</span>
                      </span>
                      {hasVariants(p) && (
                        <span className="text-[10px] font-semibold text-blue-600 block">
                          {p.variants?.length} opções
                        </span>
                      )}
                      {hasVariantOutOfStock(p) && getProductTotalStock(p) > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-0.5">
                          ⚠️ Opção esgotada
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                        Preço
                      </span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-base sm:text-lg font-black text-zinc-950">
                          R$ {p.price.toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                      {/* Botão Ativar / Desativar apenas para anúncios já aprovados */}
                      {p.status !== "pending_review" &&
                      p.status !== "pending_approval" &&
                      p.status !== "rejected" ? (
                        isProductPaused(p) ? (
                          <button
                            type="button"
                            onClick={() => handleToggleProductStatus(p)}
                            className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white font-bold text-xs flex items-center gap-1.5 border border-emerald-200 hover:border-transparent transition-all shadow-2xs cursor-pointer group"
                            title={
                              isProductOutOfStock(p)
                                ? "Estoque zerado. Clique para mais detalhes."
                                : "Ativar anúncio"
                            }
                          >
                            <Play className="w-3.5 h-3.5 fill-current text-emerald-600 group-hover:text-white transition-colors" />
                            <span>Ativar</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleProductStatus(p)}
                            className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-500 text-amber-700 hover:text-white font-bold text-xs flex items-center gap-1.5 border border-amber-200 hover:border-transparent transition-all shadow-2xs cursor-pointer group"
                            title="Desativar anúncio temporariamente"
                          >
                            <PauseCircle className="w-3.5 h-3.5 text-amber-600 group-hover:text-white transition-colors" />
                            <span>Desativar</span>
                          </button>
                        )
                      ) : null}

                      <button
                        onClick={() => handleStartEdit(p)}
                        className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer ${
                          p.status === "rejected"
                            ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/25"
                            : "bg-blue-50 hover:bg-[#0066FF] text-[#0066FF] hover:text-white border border-blue-200 hover:border-transparent"
                        }`}
                        title="Editar anúncio"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{p.status === "rejected" ? "Corrigir Anúncio" : "Editar"}</span>
                      </button>

                      <button
                        onClick={() => onSelectProduct(p)}
                        className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors cursor-pointer"
                        title="Ver página do produto"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setProductToDelete(p)}
                        className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-colors cursor-pointer"
                        title="Excluir produto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Feedback Toast ao Ativar/Desativar */}
      {statusFeedback && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md animate-fadeIn">
          <div
            className={`py-3 px-4 rounded-xl border shadow-lg flex items-center gap-2.5 ${
              statusFeedback.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                : "bg-amber-50 border-amber-200 text-amber-950"
            }`}
          >
            {statusFeedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <div className="flex-1 text-xs font-bold">
              {statusFeedback.msg}
            </div>
            <button
              onClick={() => setStatusFeedback(null)}
              className="text-zinc-400 hover:text-zinc-700 cursor-pointer p-0.5 ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          DELETE CONFIRMATION MODAL (White, Black & Blue Theme - No Native Dialog)
          ======================================================== */}
      {productToDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setProductToDelete(null)}
        >
          <div
            className="bg-white rounded-3xl border border-zinc-200 shadow-2xl max-w-sm w-full p-6 text-center space-y-4 animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100 shadow-inner">
              <Trash2 className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-black text-zinc-950 mb-1">
                Excluir Anúncio?
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed mb-2">
                Tem certeza que deseja excluir este anúncio do catálogo?
              </p>
              <div className="text-xs font-bold text-zinc-900 bg-zinc-50 p-3 rounded-xl border border-zinc-200 break-words leading-snug">
                <span className="font-mono text-[#0066FF] font-black mr-1.5">{getProductAdCode(productToDelete)}</span>
                &ldquo;{productToDelete.title}&rdquo;
              </div>
              <p className="text-[11px] text-zinc-400 mt-2">
                Esta ação é irreversível e o produto será removido da loja e do banco de dados.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="w-full py-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-700 font-bold text-xs transition-colors"
              >
                Não, Cancelar
              </button>

              <button
                type="button"
                onClick={() => {
                  onDeleteProduct(productToDelete.id, productToDelete);
                  setProductToDelete(null);
                }}
                className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-500/20 active:scale-95 transition-all"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
