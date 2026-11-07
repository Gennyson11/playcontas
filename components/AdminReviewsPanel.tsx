"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Product, UserProfile } from "@/types";
import { getStoredProducts, approveProduct, rejectProduct, mergeWithSupabaseProducts } from "@/lib/productStore";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { variationFieldsFromRow } from "@/lib/productVault";
import { getProductAdCode } from "@/lib/adCode";
import { getProductUrl } from "@/lib/slug";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Eye,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  User,
  Zap,
  Tag,
  Calendar,
  Layers,
  Sparkles,
  ExternalLink,
  MessageSquare,
  HelpCircle,
  X,
  FileText,
  DollarSign,
  Package,
  RefreshCw,
  Loader2,
} from "lucide-react";

interface AdminReviewsPanelProps {
  currentUser: UserProfile;
  initialProducts?: Product[];
  onSelectProduct?: (product: Product) => void;
  onUpdateProducts?: (products: Product[]) => void;
}

export function AdminReviewsPanel({
  currentUser,
  initialProducts,
  onSelectProduct,
  onUpdateProducts,
}: AdminReviewsPanelProps) {
  const [products, setProducts] = useState<Product[]>(() => {
    if (initialProducts && initialProducts.length > 0) return initialProducts;
    return getStoredProducts();
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "pending" | "approved" | "rejected" | "all"
  >("pending");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals state
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [rejectingProduct, setRejectingProduct] = useState<Product | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [feedbackToast, setFeedbackToast] = useState<{
    type: "success" | "error" | "info";
    title: string;
    msg: string;
  } | null>(null);

  const refreshFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setProducts(getStoredProducts());
      return;
    }
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase
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
          autoDeliveryContent: d.delivery_content ? [d.delivery_content] : undefined,
          warrantyDays: d.warranty_days || d.warrantyDays || 30,
          status: d.status || ((d.stock ?? 10) <= 0 ? "paused" : "active"),
          rejectionReason: d.rejection_reason || undefined,
          reviewedAt: d.reviewed_at || undefined,
          createdAt: d.created_at || new Date().toISOString(),
          ...variationFieldsFromRow(d),
          seller: {
            id: d.seller_id || "seller-1",
            name: d.seller_name || "Vendedor",
            avatar:
              d.seller_avatar ||
              `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
                d.seller_name || "PlayContas"
              )}`,
            rating: 5.0,
            salesCount: d.sales_count || 0,
            isVerified: true,
            responseTime: "5 min",
            memberSince: "2026",
            level: "Elite",
          },
        }));

        const finalMerged = mergeWithSupabaseProducts(mappedList);
        setProducts(finalMerged);
        if (onUpdateProducts) onUpdateProducts(finalMerged);
      } else {
        setProducts(getStoredProducts());
      }
    } catch (err) {
      console.error("Erro ao sincronizar do Supabase no Admin:", err);
      setProducts(getStoredProducts());
    } finally {
      setIsRefreshing(false);
    }
  }, [onUpdateProducts]);

  useEffect(() => {
    refreshFromSupabase();
    const handleUpdate = () => refreshFromSupabase();
    window.addEventListener("central_products_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("central_products_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [refreshFromSupabase]);

  useEffect(() => {
    if (initialProducts && initialProducts.length > 0) {
      setProducts(initialProducts);
    }
  }, [initialProducts]);

  // Show Toast Helper
  const showToast = (type: "success" | "error" | "info", title: string, msg: string) => {
    setFeedbackToast({ type, title, msg });
    setTimeout(() => {
      setFeedbackToast(null);
    }, 4500);
  };

  // Counts
  const pendingProducts = useMemo(
    () =>
      products.filter(
        (p) => p.status === "pending_review" || p.status === "pending_approval"
      ),
    [products]
  );

  const approvedProducts = useMemo(
    () => products.filter((p) => p.status === "active"),
    [products]
  );

  const rejectedProducts = useMemo(
    () => products.filter((p) => p.status === "rejected"),
    [products]
  );

  // Filtered List
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      // Status Filter
      if (statusFilter === "pending") {
        if (p.status !== "pending_review" && p.status !== "pending_approval")
          return false;
      } else if (statusFilter === "approved") {
        if (p.status !== "active") return false;
      } else if (statusFilter === "rejected") {
        if (p.status !== "rejected") return false;
      }

      // Search Query
      if (q) {
        const titleMatch = (p.title || "").toLowerCase().includes(q);
        const sellerMatch = (p.seller?.name || "").toLowerCase().includes(q);
        const catMatch = (p.category || "").toLowerCase().includes(q);
        const codeMatch = getProductAdCode(p).toLowerCase().includes(q);
        const reasonMatch = (p.rejectionReason || "").toLowerCase().includes(q);
        if (!titleMatch && !sellerMatch && !catMatch && !codeMatch && !reasonMatch) {
          return false;
        }
      }

      return true;
    });
  }, [products, statusFilter, search]);

  // Actions
  const handleApprove = (product: Product) => {
    const updated = approveProduct(product.id, product);
    if (updated) {
      const nextList = products.map((p) => (p.id === product.id ? updated : p));
      setProducts(nextList);
      if (onUpdateProducts) onUpdateProducts(nextList);
    }
    if (previewProduct?.id === product.id) {
      setPreviewProduct(null);
    }
    showToast(
      "success",
      "Anúncio Aprovado!",
      `O anúncio "${product.title}" foi publicado com sucesso no catálogo e o vendedor foi notificado.`
    );
  };

  const handleOpenRejectModal = (product: Product) => {
    setRejectingProduct(product);
    setRejectionReason(product.rejectionReason || "");
  };

  const handleConfirmReject = () => {
    if (!rejectingProduct) return;
    if (!rejectionReason.trim()) {
      alert("Por favor, digite o motivo da reprovação para que o vendedor possa corrigir o anúncio.");
      return;
    }

    const updated = rejectProduct(rejectingProduct.id, rejectionReason.trim(), rejectingProduct);
    if (updated) {
      const nextList = products.map((p) => (p.id === rejectingProduct.id ? updated : p));
      setProducts(nextList);
      if (onUpdateProducts) onUpdateProducts(nextList);
    }

    if (previewProduct?.id === rejectingProduct.id) {
      setPreviewProduct(null);
    }

    const prodTitle = rejectingProduct.title;
    setRejectingProduct(null);
    setRejectionReason("");

    showToast(
      "error",
      "Anúncio Reprovado",
      `O anúncio "${prodTitle}" foi reprovado e o vendedor recebeu o motivo detalhado para ajustes.`
    );
  };

  const quickReasons = [
    "Imagem de capa com baixa qualidade, corte inadequado ou sem nitidez.",
    "Título confuso, com caracteres excessivos ou informações imprecisas.",
    "Preço informado fora do padrão de mercado ou incoerente com o produto.",
    "Descrição incompleta: especifique claramente o que o comprador receberá e os termos de acesso.",
    "Categoria selecionada incorreta. Por favor, ajuste para a categoria correspondente.",
    "Credenciais ou linhas de entrega automática inválidas ou em formato incorreto.",
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Header & Metrics Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setStatusFilter("pending")}
          className={`p-6 rounded-3xl border transition-all cursor-pointer shadow-xs ${
            statusFilter === "pending"
              ? "bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20"
              : "bg-white border-zinc-200 hover:border-zinc-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Aguardando Revisão
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-600 mt-2">
            {pendingProducts.length}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">
            Anúncios precisando de análise
          </span>
        </div>

        <div
          onClick={() => setStatusFilter("approved")}
          className={`p-6 rounded-3xl border transition-all cursor-pointer shadow-xs ${
            statusFilter === "approved"
              ? "bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/20"
              : "bg-white border-zinc-200 hover:border-zinc-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Aprovados no Catálogo
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-600 mt-2">
            {approvedProducts.length}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">
            Disponíveis para venda aos clientes
          </span>
        </div>

        <div
          onClick={() => setStatusFilter("rejected")}
          className={`p-6 rounded-3xl border transition-all cursor-pointer shadow-xs ${
            statusFilter === "rejected"
              ? "bg-rose-500/10 border-rose-500 ring-2 ring-rose-500/20"
              : "bg-white border-zinc-200 hover:border-zinc-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Reprovados (Ajustes)
            </span>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-rose-600 mt-2">
            {rejectedProducts.length}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">
            Aguardando correções dos vendedores
          </span>
        </div>

        <div
          onClick={() => setStatusFilter("all")}
          className={`p-6 rounded-3xl border transition-all cursor-pointer shadow-xs ${
            statusFilter === "all"
              ? "bg-blue-500/10 border-[#0066FF] ring-2 ring-blue-500/20"
              : "bg-white border-zinc-200 hover:border-zinc-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Total de Anúncios
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0066FF] flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-zinc-950 mt-2">
            {products.length}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">
            Todos os anúncios cadastrados
          </span>
        </div>
      </div>

      {/* 2. Filter Tabs & Search Bar */}
      <div className="bg-white rounded-3xl p-5 border border-zinc-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Status Segmented Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-zinc-100 rounded-2xl w-full sm:w-auto overflow-x-auto">
          {[
            {
              id: "pending",
              label: "Pendentes",
              count: pendingProducts.length,
              color: "text-amber-600",
            },
            {
              id: "approved",
              label: "Aprovados",
              count: approvedProducts.length,
              color: "text-emerald-600",
            },
            {
              id: "rejected",
              label: "Reprovados",
              count: rejectedProducts.length,
              color: "text-rose-600",
            },
            { id: "all", label: "Todos", count: products.length },
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                className={`py-2 px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-white text-zinc-950 shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                    isActive ? "bg-zinc-100 text-zinc-900" : "text-zinc-400"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Botão Atualizar Nuvem */}
          <button
            type="button"
            onClick={() => refreshFromSupabase()}
            disabled={isRefreshing}
            className="px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer shrink-0 disabled:opacity-60"
            title="Atualizar lista diretamente do banco Supabase"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#0066FF] ${isRefreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{isRefreshing ? "Buscando..." : "Atualizar"}</span>
          </button>

          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por anúncio, vendedor..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white text-xs font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#0066FF] transition-all"
            />
          </div>
        </div>
      </div>

      {/* 3. Products List / Table */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-xs overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-zinc-900">
              Nenhum anúncio encontrado
            </h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
              {statusFilter === "pending"
                ? "Excelente! Não há nenhum anúncio pendente de aprovação no momento."
                : "Nenhum anúncio corresponde aos filtros aplicados."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase font-black text-[11px] tracking-wider">
                  <th className="py-4 px-5">Anúncio & Código</th>
                  <th className="py-4 px-5">Vendedor</th>
                  <th className="py-4 px-5">Preço & Tipo</th>
                  <th className="py-4 px-5">Status</th>
                  <th className="py-4 px-5 text-right">Ações de Moderação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredProducts.map((p) => {
                  const isPending =
                    p.status === "pending_review" ||
                    p.status === "pending_approval";
                  const isRejected = p.status === "rejected";
                  const isApproved = p.status === "active";

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-zinc-50/80 transition-colors"
                    >
                      {/* Anúncio & Código */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3.5 max-w-md">
                          <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-zinc-100 border border-zinc-200 shrink-0">
                            <img
                              src={p.image}
                              alt={p.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="font-mono text-[10px] font-black text-[#0066FF] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                {getProductAdCode(p)}
                              </span>
                              <span className="text-[10px] font-bold text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded truncate max-w-[140px]">
                                {p.category}
                              </span>
                            </div>
                            <h4 className="font-bold text-zinc-950 text-xs sm:text-sm line-clamp-1">
                              {p.title}
                            </h4>
                            <span className="text-[11px] text-zinc-400 block mt-0.5">
                              Cadastrado em: {p.createdAt || "Recente"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Vendedor */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={
                              p.seller?.avatar ||
                              `https://api.dicebear.com/7.x/bottts/svg?seed=${p.seller?.name || "Vendedor"}`
                            }
                            alt={p.seller?.name}
                            className="w-8 h-8 rounded-full border border-zinc-200 object-cover shrink-0"
                          />
                          <div>
                            <span className="font-bold text-xs text-zinc-900 block">
                              {p.seller?.name || "Vendedor"}
                            </span>
                            <span className="text-[10px] text-zinc-400 block">
                              ID: {p.seller?.id?.slice(0, 10) || "me-seller"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Preço & Tipo */}
                      <td className="py-4 px-5">
                        <div className="font-black text-sm text-zinc-950">
                          R$ {p.price.toFixed(2).replace(".", ",")}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] font-bold mt-0.5">
                          {p.deliveryType === "AUTOMATIC" ? (
                            <span className="text-[#0066FF] flex items-center gap-0.5">
                              <Zap className="w-3 h-3 fill-current" />
                              <span>Automática</span>
                            </span>
                          ) : (
                            <span className="text-zinc-500 flex items-center gap-0.5">
                              <Clock className="w-3 h-3" />
                              <span>Manual</span>
                            </span>
                          )}
                          {p.hasVariations && (
                            <span className="text-blue-600 bg-blue-50 px-1 rounded text-[10px]">
                              {p.variants?.length} planos
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-5">
                        {isPending && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-black border border-amber-200">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            <span>Aguardando Análise</span>
                          </span>
                        )}

                        {isApproved && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black border border-emerald-200">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>Aprovado</span>
                          </span>
                        )}

                        {isRejected && (
                          <div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-black border border-rose-200">
                              <span className="w-2 h-2 rounded-full bg-rose-500" />
                              <span>Reprovado</span>
                            </span>
                            {p.rejectionReason && (
                              <p className="text-[11px] text-rose-700 font-medium mt-1 max-w-xs line-clamp-2" title={p.rejectionReason}>
                                Motivo: {p.rejectionReason}
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Pré-visualizar Detalhes */}
                          <button
                            type="button"
                            onClick={() => setPreviewProduct(p)}
                            className="px-3 py-1.5 rounded-xl border border-zinc-200 hover:border-zinc-300 text-zinc-700 bg-white hover:bg-zinc-50 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                            title="Ver detalhes completos do anúncio"
                          >
                            <Eye className="w-3.5 h-3.5 text-zinc-500" />
                            <span>Ver</span>
                          </button>

                          {/* Botão Aprovar */}
                          <button
                            type="button"
                            onClick={() => handleApprove(p)}
                            disabled={isApproved}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                              isApproved
                                ? "bg-emerald-50 text-emerald-400 opacity-60 cursor-default"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 active:scale-95"
                            }`}
                            title="Aprovar anúncio para o catálogo público"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{isApproved ? "Aprovado" : "Aprovar"}</span>
                          </button>

                          {/* Botão Reprovar */}
                          <button
                            type="button"
                            onClick={() => handleOpenRejectModal(p)}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                              isRejected
                                ? "bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200"
                                : "bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-transparent active:scale-95"
                            }`}
                            title="Reprovar anúncio e informar motivo ao vendedor"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>{isRejected ? "Alterar Motivo" : "Reprovar"}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================================================================
          MODAL: PRÉ-VISUALIZAÇÃO COMPLETA DO ANÚNCIO
         ========================================================================= */}
      {previewProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fadeIn select-none"
          onClick={() => setPreviewProduct(null)}
        >
          <div
            className="relative w-full max-w-2xl bg-white text-zinc-900 rounded-3xl shadow-2xl overflow-hidden my-6 max-h-[90vh] flex flex-col border border-zinc-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-zinc-50">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black text-[#0066FF] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {getProductAdCode(previewProduct)}
                </span>
                <h3 className="font-black text-zinc-950 text-sm sm:text-base">
                  Revisão de Anúncio
                </h3>
              </div>
              <button
                onClick={() => setPreviewProduct(null)}
                className="p-1.5 rounded-xl bg-white border border-zinc-200 text-zinc-600 hover:text-black transition-colors shadow-xs"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Cover Image & Basic Specs */}
              <div className="flex flex-col sm:flex-row gap-5 items-start">
                <div className="relative w-full sm:w-48 aspect-video sm:aspect-square rounded-2xl overflow-hidden bg-black shrink-0 border border-zinc-200">
                  <img
                    src={previewProduct.image}
                    alt={previewProduct.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-[#0066FF] bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                      {previewProduct.category}
                    </span>
                    <span className="text-[11px] font-bold text-zinc-600 bg-zinc-100 px-2.5 py-0.5 rounded">
                      Garantia: {previewProduct.warrantyDays || 30} dias
                    </span>
                  </div>
                  <h2 className="text-lg font-black text-zinc-950 leading-snug">
                    {previewProduct.title}
                  </h2>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-zinc-950">
                      R$ {previewProduct.price.toFixed(2).replace(".", ",")}
                    </span>
                    {previewProduct.originalPrice && (
                      <span className="text-xs text-zinc-400 line-through">
                        R$ {previewProduct.originalPrice.toFixed(2).replace(".", ",")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-600">
                    <User className="w-3.5 h-3.5 text-[#0066FF]" />
                    <span>Vendedor: <strong>{previewProduct.seller?.name}</strong></span>
                  </div>
                </div>
              </div>

              {/* Status Alert if rejected */}
              {previewProduct.status === "rejected" && previewProduct.rejectionReason && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900">
                  <span className="font-bold block mb-0.5 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Motivo:</span>
                  </span>
                  <p className="text-rose-800 leading-relaxed">
                    {previewProduct.rejectionReason}
                  </p>
                </div>
              )}

              {/* Variations if applicable */}
              {previewProduct.hasVariations && previewProduct.variants && previewProduct.variants.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    Planos / Variações Cadastradas ({previewProduct.variants.length})
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {previewProduct.variants.map((v) => (
                      <div
                        key={v.id}
                        className="p-3 rounded-xl border border-zinc-200 bg-zinc-50 flex items-center justify-between text-xs"
                      >
                        <span className="font-bold text-zinc-900">{v.name}</span>
                        <div className="text-right">
                          <span className="font-black text-zinc-950 block">
                            R$ {v.price.toFixed(2).replace(".", ",")}
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            Estoque: {v.stock} un.
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                  Descrição Completa do Anúncio
                </label>
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs sm:text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                  {previewProduct.description || "Nenhuma descrição informada."}
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 bg-zinc-50">
              <button
                type="button"
                onClick={() => setPreviewProduct(null)}
                className="px-5 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 bg-white hover:bg-zinc-100 transition-colors"
              >
                Fechar
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = previewProduct;
                    setPreviewProduct(null);
                    handleOpenRejectModal(target);
                  }}
                  className="px-5 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white font-bold text-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reprovar</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleApprove(previewProduct)}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all shadow-md shadow-emerald-600/20 active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Aprovar Anúncio</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: REPROVAR ANÚNCIO (INFORMAR MOTIVO AO VENDEDOR)
         ========================================================================= */}
      {rejectingProduct && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn select-none"
          onClick={() => setRejectingProduct(null)}
        >
          <div
            className="relative w-full max-w-lg bg-white text-zinc-900 rounded-3xl shadow-2xl overflow-hidden my-6 border border-zinc-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-rose-100 bg-rose-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-xs">
                  <XCircle className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-black text-zinc-950 text-sm sm:text-base">
                    Motivo da Rejeição do Anúncio
                  </h3>
                  <p className="text-[11px] text-zinc-600">
                    Escreva o motivo para o vendedor corrigir e reenviar
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectingProduct(null)}
                className="p-1.5 rounded-xl bg-white border border-zinc-200 text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Product mini card */}
              <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center gap-3">
                <img
                  src={rejectingProduct.image}
                  alt={rejectingProduct.title}
                  className="w-12 h-12 rounded-xl object-cover border border-zinc-200 shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] font-black text-[#0066FF] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                      {getProductAdCode(rejectingProduct)}
                    </span>
                    <span className="text-[11px] text-zinc-500 truncate">
                      Vendedor: <strong className="text-zinc-800">{rejectingProduct.seller?.name}</strong>
                    </span>
                  </div>
                  <h4 className="font-bold text-zinc-950 text-xs truncate mt-1">
                    {rejectingProduct.title}
                  </h4>
                </div>
              </div>

              {/* Quick Reasons Chips */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-2">
                  Sugestões Rápidas de Motivo (Clique para preencher):
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "📷 Foto de baixa qualidade", text: "Imagem de capa com baixa qualidade, corte inadequado ou sem nitidez. Por favor, envie uma foto nítida e atrativa." },
                    { label: "📝 Título incorreto", text: "Título fora do padrão: corrija o nome do produto, plano e tempo de duração com clareza." },
                    { label: "📄 Descrição incompleta", text: "Descrição incompleta: especifique detalhadamente o que o comprador receberá, regras de uso e duração do acesso." },
                    { label: "💰 Preço incoerente", text: "Preço informado fora do padrão de mercado ou incoerente com as variações oferecidas." },
                    { label: "🏷️ Categoria errada", text: "Categoria selecionada incorreta. Por favor, ajuste para a categoria correspondente ao produto." },
                    { label: "⚡ Entrega inválida", text: "Credenciais ou dados de entrega automática inválidos ou em formato incorreto no cofre." },
                  ].map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setRejectionReason(item.text)}
                      className="px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-zinc-200 text-xs font-semibold text-zinc-700 transition-colors text-left cursor-pointer"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rejection Reason Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-zinc-900 uppercase tracking-wider">
                    Escreva o Motivo da Rejeição *
                  </label>
                  <span className="text-[11px] font-mono text-zinc-400">
                    {rejectionReason.length} caracteres
                  </span>
                </div>
                <textarea
                  rows={4}
                  autoFocus
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explique exatamente o que o vendedor deve arrumar no anúncio..."
                  className="w-full p-3.5 rounded-2xl border-2 border-rose-200 focus:border-rose-500 bg-white text-xs sm:text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-4 focus:ring-rose-500/10 transition-all resize-none leading-relaxed"
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">
                  💡 Este texto será mostrado com destaque para o vendedor na aba <strong>Meus Produtos</strong> para que ele possa corrigir e reenviar o anúncio para sua aprovação.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 bg-zinc-50">
              <button
                type="button"
                onClick={() => setRejectingProduct(null)}
                className="px-5 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 bg-white hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={!rejectionReason.trim()}
                className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black text-xs transition-all shadow-md shadow-rose-600/25 active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                <XCircle className="w-4 h-4" />
                <span>Confirmar Reprovação do Anúncio</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Feedback Toast */}
      {feedbackToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md animate-scaleUp">
          <div
            className={`p-4 rounded-2xl border shadow-xl flex items-start gap-3 ${
              feedbackToast.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                : "bg-rose-50 border-rose-200 text-rose-950"
            }`}
          >
            {feedbackToast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <h5 className="font-bold text-xs sm:text-sm">{feedbackToast.title}</h5>
              <p className="text-xs opacity-90 mt-0.5 leading-relaxed">
                {feedbackToast.msg}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
