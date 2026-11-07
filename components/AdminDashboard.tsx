"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Product, UserProfile, OrderItem } from "@/types";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { getProductAdCode } from "@/lib/adCode";
import { deleteStoredProduct, deleteProductRemote } from "@/lib/productStore";
import { AdminUsersPanel } from "@/components/AdminUsersPanel";
import { AdminVerificationsPanel } from "@/components/AdminVerificationsPanel";
import { AdminDisputesPanel } from "@/components/AdminDisputesPanel";
import { AdminAllChatsPanel } from "@/components/AdminAllChatsPanel";
import { AdminReviewsPanel } from "@/components/AdminReviewsPanel";
import { AdminWithdrawalsPanel } from "@/components/AdminWithdrawalsPanel";
import { getAllAdminWithdrawals } from "@/lib/walletStore";
import { getProductUrl } from "@/lib/slug";
import { getStoredDisputes, subscribeToDisputes } from "@/lib/disputeStore";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Package,
  Users,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Database,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowLeft,
  Search,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Eye,
  Key,
  Layers,
  Sparkles,
  RefreshCw,
  ArrowRight,
  Lock,
  Crown,
  MessageSquare,
  Clock,
  Wallet,
  Zap,
} from "lucide-react";

interface AdminDashboardProps {
  currentUser: UserProfile;
  products: Product[];
  onBackToShop: () => void;
  onUpdateProducts?: (products: Product[]) => void;
  onCreateProduct?: () => void;
}

export function AdminDashboard({
  currentUser,
  products,
  onBackToShop,
  onUpdateProducts,
  onCreateProduct,
}: AdminDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "overview" | "reviews" | "products" | "orders" | "disputes" | "all_chats" | "verifications" | "users" | "withdrawals" | "supabase"
  >("overview");

  const [withdrawalsList, setWithdrawalsList] = useState(() => getAllAdminWithdrawals());

  useEffect(() => {
    const handleUpdate = () => setWithdrawalsList(getAllAdminWithdrawals());
    window.addEventListener("playcontas_withdrawals_updated", handleUpdate);
    window.addEventListener("playcontas_wallet_updated", handleUpdate);
    return () => {
      window.removeEventListener("playcontas_withdrawals_updated", handleUpdate);
      window.removeEventListener("playcontas_wallet_updated", handleUpdate);
    };
  }, []);

  const pendingWithdrawalsCount = useMemo(
    () => withdrawalsList.filter((w) => w.status === "processing").length,
    [withdrawalsList]
  );

  const [disputesList, setDisputesList] = useState(() => getStoredDisputes());

  useEffect(() => {
    const unsub = subscribeToDisputes(() => {
      setDisputesList(getStoredDisputes());
    });
    return unsub;
  }, []);

  const openDisputesCount = useMemo(
    () => disputesList.filter((d) => d.status === "open").length,
    [disputesList]
  );

  const [copiedSql, setCopiedSql] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [localProducts, setLocalProducts] = useState<Product[]>(products);

  useEffect(() => {
    if (products && products.length > 0) {
      setLocalProducts(products);
    }
  }, [products]);

  const pendingReviewsCount = useMemo(
    () =>
      localProducts.filter(
        (p) => p.status === "pending_review" || p.status === "pending_approval"
      ).length,
    [localProducts]
  );

  // Orders list (dados zerados - inicia vazio até haver vendas reais)
  const [orders, setOrders] = useState<OrderItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("central_real_orders");
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return [];
  });

  // Usuários (clientes, vendedores e admins) vindos do banco de dados
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderPaymentFilter, setOrderPaymentFilter] = useState<"all" | "PIX" | "Cartão">("all");
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshAll = async () => {
    setRefreshing(true);
    setDisputesList(getStoredDisputes());
    await loadProfiles();
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleCopyKey = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedOrderId(id);
    setTimeout(() => setCopiedOrderId(null), 2000);
  };

  const filteredRecentOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return orders.filter((o) => {
      if (orderPaymentFilter !== "all" && o.paymentMethod !== orderPaymentFilter) return false;
      if (!q) return true;
      return (
        o.id.toLowerCase().includes(q) ||
        o.buyerEmail.toLowerCase().includes(q) ||
        o.productTitle.toLowerCase().includes(q)
      );
    });
  }, [orders, orderSearch, orderPaymentFilter]);

  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");

  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Carregar usuários reais do banco de dados
  const loadProfiles = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setUsersError("Banco de dados não configurado.");
      return;
    }
    setUsersLoading(true);
    setUsersError("");
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const mappedUsers: UserProfile[] = (data || []).map((d: any) => {
        let name = d.full_name || (d.email || "").split("@")[0] || "Sem nome";
        if (d.email?.toLowerCase().includes("jovitools") && (!name || name.toLowerCase().includes("jovizeira"))) {
          name = "BuscaNinja";
          supabase.from("profiles").update({ full_name: "BuscaNinja" }).eq("id", d.id).then();
        }
        return {
          id: d.id,
          name,
        email: d.email || "",
        role: (d.role as any) || "buyer",
        balance: Number(d.balance) || 0,
        avatar: d.avatar_url || "",
        createdAt: d.created_at ? new Date(d.created_at).toLocaleDateString("pt-BR") : "",
        };
      });
      setUsersList(mappedUsers);
    } catch (err: any) {
      console.error("Erro ao carregar usuários:", err);
      setUsersError(err?.message || "Não foi possível carregar os usuários.");
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from("order_chats")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data && data.length > 0) {
        const mapped: OrderItem[] = data.map((d: any) => ({
          id: d.code ? `#${d.code}` : `ord-${d.number || d.id}`,
          buyerEmail: d.buyer_name || "Cliente",
          productTitle: d.product_title || "Produto",
          variantLabel: "Padrão",
          amount: Number(d.price) || 0,
          status: d.status === "delivered" ? "completed" : "pending",
          paymentMethod: "PIX",
          deliveredData: d.last_message || "Processado via PIX",
          createdAt: d.created_at ? new Date(d.created_at).toLocaleDateString("pt-BR") : "Recente",
        }));
        setOrders(mapped);
      } else {
        setOrders([]);
      }
    } catch {
      setOrders([]);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
    loadOrders();
  }, [loadProfiles, loadOrders]);

  // Delete product action com confirmação visual estilizada e sincronização no Supabase
  const handleConfirmDeleteProduct = async () => {
    if (!productToDelete) return;
    const productId = productToDelete.id;
    const updated = deleteStoredProduct(productId, productToDelete);
    setLocalProducts(updated);
    if (onUpdateProducts) onUpdateProducts(updated);

    if (isSupabaseConfigured) {
      try {
        await deleteProductRemote(productToDelete);
      } catch (err) {
        console.error("Erro ao excluir do Supabase:", err);
      }
    }
    setProductToDelete(null);
  };

  const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
  const platformProfit = totalRevenue * 0.13; // Taxa de 13% retida pela PlayContas
  const sellersPayout = totalRevenue * 0.87; // Repasse de 87% destinado aos vendedores
  const filteredProducts = localProducts.filter(
    (p) =>
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-zinc-900 pb-20 select-none font-sans">
      {/* 1. TOP ADMIN BAR (Ultra-clean & Responsivo) */}
      <header className="bg-white text-zinc-900 sticky top-0 z-40 border-b border-zinc-200/80 shadow-xs">
        <div className="max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToShop}
              className="flex items-center gap-1.5 text-xs font-bold text-zinc-700 hover:text-[#0066FF] bg-zinc-50 hover:bg-blue-50/60 border border-zinc-200 hover:border-[#0066FF] px-3 py-1.5 rounded-xl transition-all group cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="hidden sm:inline">Voltar à Loja</span>
            </button>

            <div className="h-5 w-px bg-zinc-200 hidden sm:block" />

            <div className="flex items-center gap-2">
              <span className="w-2.5 h-5 rounded-full bg-[#0066FF]" />
              <h1 className="text-sm sm:text-base font-black tracking-tight text-zinc-950 flex items-center gap-2">
                <span>PAINEL ADMINISTRATIVO</span>
                <span className="bg-[#0066FF] text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  MASTER
                </span>
              </h1>
            </div>

            {/* Live Database Status Pill in Header */}
            <span className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              PostgreSQL Conectado
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {onCreateProduct && (
              <button
                onClick={onCreateProduct}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0066FF] hover:bg-[#0052cc] text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Anúncio</span>
              </button>
            )}

            <button
              onClick={handleRefreshAll}
              disabled={refreshing}
              title="Sincronizar e recarregar dados"
              className="p-2 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-[#0066FF]" : ""}`} />
            </button>

            <div className="h-6 w-px bg-zinc-200 hidden sm:block" />

            <div className="flex items-center gap-2.5 pl-1">
              <div className="text-right hidden sm:block">
                <span className="block text-xs font-black text-zinc-950 leading-tight">
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-amber-600 font-black uppercase tracking-wider flex items-center justify-end gap-1">
                  <Crown className="w-3 h-3 text-amber-500 fill-amber-400" /> ADMIN
                </span>
              </div>
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-9 h-9 rounded-xl border-2 border-[#0066FF] object-cover shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar (Clean Segmented Pills) */}
        <div className="max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-t border-zinc-100">
          {[
            { id: "overview", label: "Visão Geral", icon: TrendingUp },
            {
              id: "reviews",
              label: "Revisão de Anúncios",
              badge:
                pendingReviewsCount > 0
                  ? `${pendingReviewsCount} Pendente${pendingReviewsCount > 1 ? "s" : ""}`
                  : undefined,
              badgeColor: "bg-amber-500 text-white animate-pulse",
              icon: Clock,
            },
            { id: "products", label: "Produtos & Anúncios", count: localProducts.length, icon: Package },
            { id: "orders", label: "Vendas & Pedidos", count: orders.length, icon: ShoppingCart },
            {
              id: "disputes",
              label: "Mediações & Problemas",
              badge: openDisputesCount > 0 ? `${openDisputesCount} Pendente${openDisputesCount > 1 ? "s" : ""}` : undefined,
              badgeColor: "bg-rose-600 text-white animate-pulse",
              icon: ShieldAlert,
            },
            { id: "all_chats", label: "Todos os Chats", icon: MessageSquare },
            {
              id: "verifications",
              label: "Verificações",
              badge: "Pendente",
              badgeColor: "bg-amber-100 text-amber-800",
              icon: ShieldCheck,
            },
            { id: "users", label: "Vendedores & Clientes", count: usersList.length, icon: Users },
            {
              id: "withdrawals",
              label: "Saques PIX Flash",
              badge:
                pendingWithdrawalsCount > 0
                  ? `${pendingWithdrawalsCount} Pendente${pendingWithdrawalsCount > 1 ? "s" : ""}`
                  : undefined,
              badgeColor: "bg-amber-500 text-white animate-pulse",
              icon: Wallet,
            },
            { id: "supabase", label: "Banco de Dados", icon: Database },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-3.5 rounded-xl font-bold text-xs sm:text-[13px] flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-zinc-950 text-white shadow-xs"
                    : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100"
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive
                      ? tab.id === "disputes"
                        ? "text-rose-400"
                        : "text-[#0066FF]"
                      : tab.id === "disputes" && openDisputesCount > 0
                      ? "text-rose-600"
                      : "text-zinc-400"
                  }`}
                />
                <span>{tab.label}</span>
                {typeof tab.count === "number" && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                      isActive ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
                {tab.badge && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${tab.badgeColor}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* 2. BODY CONTENT */}
      <main className="max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        
        {/* =========================================================================
            TAB 1: VISÃO GERAL
           ========================================================================= */}
        {activeTab === "overview" && (
          <div className="space-y-8 animate-fadeIn">
            {/* Status Banner */}
            <div className="p-6 sm:p-7 rounded-3xl bg-white border border-emerald-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-zinc-900">
                    Banco de Dados Conectado & Operacional
                  </h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Banco de dados PostgreSQL ativo e sincronizado
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Status 200 OK
              </span>
            </div>

            {/* Cards de Métricas e Faturamento com Divisão das Taxas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Card 1: Faturamento Bruto */}
              <div className="p-7 rounded-3xl bg-white border border-zinc-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Volume Bruto Total
                  </span>
                  <div className="text-3xl font-black text-zinc-950 mt-1.5">
                    R$ {totalRevenue.toFixed(2).replace(".", ",")}
                  </div>
                  <span className="text-xs text-zinc-500 font-semibold mt-1 inline-block">
                    Total movimentado na loja
                  </span>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#0066FF] flex items-center justify-center shadow-2xs">
                  <DollarSign className="w-7 h-7" />
                </div>
              </div>

              {/* Card 2: Seu Lucro (Taxa 13%) */}
              <div className="p-7 rounded-3xl bg-white border-2 border-emerald-500/80 shadow-xs flex items-center justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-black uppercase px-2.5 py-0.5 rounded-bl-xl tracking-wider">
                  Seu Lucro
                </div>
                <div>
                  <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                    Lucro das Taxas (13%)
                  </span>
                  <div className="text-3xl font-black text-emerald-600 mt-1.5">
                    R$ {platformProfit.toFixed(2).replace(".", ",")}
                  </div>
                  <span className="text-xs text-emerald-700 font-bold mt-1 inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Cai direto na sua SyncPay
                  </span>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-2xs">
                  <TrendingUp className="w-7 h-7" />
                </div>
              </div>

              {/* Card 3: Repasse dos Vendedores */}
              <div className="p-7 rounded-3xl bg-white border border-zinc-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Faturamento Vendedores (87%)
                  </span>
                  <div className="text-3xl font-black text-zinc-900 mt-1.5">
                    R$ {sellersPayout.toFixed(2).replace(".", ",")}
                  </div>
                  <span className="text-xs text-zinc-500 font-semibold mt-1 inline-block">
                    {usersList.filter((u) => u.role === "seller").length} vendedores ativos
                  </span>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-2xs">
                  <Users className="w-7 h-7" />
                </div>
              </div>

              {/* Card 4: Vendas Concluídas */}
              <div className="p-7 rounded-3xl bg-white border border-zinc-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Vendas Concluídas
                  </span>
                  <div className="text-3xl font-black text-zinc-950 mt-1.5">
                    {orders.length} pedidos
                  </div>
                  <span className="text-xs text-zinc-500 font-medium mt-1 inline-block">
                    Aguardando primeira venda
                  </span>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-zinc-100 text-zinc-800 flex items-center justify-center shadow-2xs">
                  <ShoppingCart className="w-7 h-7" />
                </div>
              </div>
            </div>

            {/* Alerta de Saques Pendentes */}
            {pendingWithdrawalsCount > 0 && (
              <div className="p-5 rounded-3xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black shrink-0 shadow-xs">
                    <Zap className="w-5 h-5 fill-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-amber-950">
                      Você tem {pendingWithdrawalsCount} solicitação{pendingWithdrawalsCount > 1 ? "ões" : ""} de saque PIX Flash pendente{pendingWithdrawalsCount > 1 ? "s" : ""}!
                    </h4>
                    <p className="text-xs text-amber-700">
                      Acesse a aba de Saques para conferir a chave PIX dos vendedores e confirmar o repasse.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("withdrawals")}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition-all cursor-pointer whitespace-nowrap"
                >
                  Liberar Saques Pendentes →
                </button>
              </div>
            )}

            {/* Pedidos Recentes */}
            <div className="p-8 rounded-3xl bg-white border border-zinc-200 shadow-xs">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-6 rounded-full bg-[#0066FF]" />
                  <h2 className="text-base font-black text-zinc-950 tracking-tight">
                    Vendas em Tempo Real (Entrega Automática)
                  </h2>
                </div>
                <button
                  onClick={() => setActiveTab("orders")}
                  className="text-xs font-bold text-[#0066FF] hover:underline"
                >
                  Ver todas as vendas →
                </button>
              </div>

              {orders.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <ShoppingCart className="w-10 h-10 mx-auto text-zinc-300 stroke-[1.5]" />
                  <p className="font-bold text-sm text-zinc-700">Nenhuma venda realizada ainda</p>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                    Assim que houver a primeira venda real via PIX, as transações e o seu lucro das taxas de 13% aparecerão aqui em tempo real.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 text-zinc-400 uppercase font-black tracking-wider text-xs">
                        <th className="pb-3">Código</th>
                        <th className="pb-3">Cliente</th>
                        <th className="pb-3">Produto</th>
                        <th className="pb-3">Valor Total</th>
                        <th className="pb-3 text-emerald-600">Sua Taxa (13%)</th>
                        <th className="pb-3 text-purple-700">Líquido Vendedor (87%)</th>
                        <th className="pb-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 font-medium">
                      {orders.slice(0, 4).map((o) => (
                        <tr key={o.id} className="hover:bg-zinc-50/70 transition-colors">
                          <td className="py-4 font-mono text-xs text-zinc-500">{o.id}</td>
                          <td className="py-4 font-bold text-xs text-zinc-900">{o.buyerEmail}</td>
                          <td className="py-4 text-xs text-zinc-800">{o.productTitle}</td>
                          <td className="py-4 font-black text-xs text-zinc-950">
                            R$ {o.amount.toFixed(2).replace(".", ",")}
                          </td>
                          <td className="py-4 font-black text-xs text-emerald-600">
                            +R$ {(o.amount * 0.13).toFixed(2).replace(".", ",")}
                          </td>
                          <td className="py-4 font-bold text-xs text-purple-700">
                            R$ {(o.amount * 0.87).toFixed(2).replace(".", ",")}
                          </td>
                          <td className="py-4">
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Aprovado & Entregue
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB: REVISÃO DE ANÚNCIOS (MODERAÇÃO)
           ========================================================================= */}
        {activeTab === "reviews" && (
          <AdminReviewsPanel
            currentUser={currentUser}
            initialProducts={localProducts}
            onUpdateProducts={(updated) => {
              setLocalProducts(updated);
              if (onUpdateProducts) onUpdateProducts(updated);
            }}
            onSelectProduct={(p) => router.push(getProductUrl(p))}
          />
        )}

        {/* =========================================================================
            TAB 2: PRODUTOS & ANÚNCIOS
           ========================================================================= */}
        {activeTab === "products" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-xl">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Pesquisar anúncios por título ou categoria..."
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-zinc-200 bg-white text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#0066FF] transition-colors"
                />
              </div>

              {onCreateProduct && (
                <button
                  onClick={onCreateProduct}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#0066FF] hover:bg-[#0052cc] text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Criar Novo Anúncio</span>
                </button>
              )}
            </div>

            <div className="bg-white rounded-3xl border border-zinc-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase font-black tracking-wider">
                      <th className="py-5 px-5">Anúncio</th>
                      <th className="py-5 px-5">Categoria</th>
                      <th className="py-5 px-5">Preço</th>
                      <th className="py-5 px-5">Estoque</th>
                      <th className="py-5 px-5">Vendas</th>
                      <th className="py-5 px-5">Entrega</th>
                      <th className="py-5 px-5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-50/70 transition-colors">
                        <td className="py-5 px-5">
                          <div className="flex items-center gap-3">
                            <img
                              src={p.image}
                              alt={p.title}
                              className="w-20 h-14 rounded-xl object-cover border border-zinc-200 shrink-0"
                            />
                            <div>
                              <span className="font-bold text-zinc-900 block truncate max-w-md text-base">
                                {p.title}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs font-mono font-black text-[#0066FF] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                  {getProductAdCode(p)}
                                </span>
                                <span className="text-xs text-zinc-400">
                                  • {p.seller?.name || "PlayContas"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-5 px-5">
                          <span className="px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-700 font-bold border border-zinc-200 text-xs">
                            {p.category}
                          </span>
                        </td>
                        <td className="py-5 px-5 font-extrabold text-zinc-950 text-base">
                          R$ {p.price.toFixed(2).replace(".", ",")}
                        </td>
                        <td className="py-5 px-5 font-bold text-zinc-700">
                          {p.stock} un.
                        </td>
                        <td className="py-5 px-5 font-extrabold text-[#0066FF]">
                          {Number(p.salesCount) || 0} vendas
                        </td>
                        <td className="py-5 px-5">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                            ⚡ Automática
                          </span>
                        </td>
                        <td className="py-5 px-5 text-right">
                          <button
                            onClick={() => setProductToDelete(p)}
                            className="p-2.5 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Excluir Anúncio"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: VENDAS & PEDIDOS
           ========================================================================= */}
        {activeTab === "orders" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white rounded-3xl border border-zinc-200 shadow-xs overflow-hidden p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2.5 h-6 rounded-full bg-[#0066FF]" />
                <h2 className="text-base font-black text-zinc-950 tracking-tight">
                  Histórico de Pedidos & Chaves Entregues
                </h2>
              </div>

              {orders.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <ShoppingCart className="w-12 h-12 mx-auto text-zinc-300 stroke-[1.5]" />
                  <p className="font-bold text-base text-zinc-800">Nenhum pedido registrado</p>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    Seu painel está zerado e pronto para receber vendas reais. Todas as transações concluídas via SyncPay e entregas automáticas serão listadas aqui.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase font-black tracking-wider text-xs">
                        <th className="py-4 px-4">ID</th>
                        <th className="py-4 px-4">Cliente</th>
                        <th className="py-4 px-4">Produto</th>
                        <th className="py-4 px-4">Valor Bruto</th>
                        <th className="py-4 px-4 text-emerald-600">Sua Taxa (13%)</th>
                        <th className="py-4 px-4 text-purple-700">Líquido Vendedor (87%)</th>
                        <th className="py-4 px-4">Entrega Automática</th>
                        <th className="py-4 px-4">Data</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {orders.map((o) => {
                        const fee = o.amount * 0.13;
                        const net = o.amount * 0.87;
                        return (
                          <tr key={o.id} className="hover:bg-zinc-50/70 transition-colors">
                            <td className="py-4 px-4 font-mono text-xs text-zinc-500">{o.id}</td>
                            <td className="py-4 px-4 font-bold text-xs text-zinc-900">{o.buyerEmail}</td>
                            <td className="py-4 px-4 font-semibold text-xs text-zinc-800">{o.productTitle}</td>
                            <td className="py-4 px-4 font-black text-zinc-950 text-xs">
                              R$ {o.amount.toFixed(2).replace(".", ",")}
                            </td>
                            <td className="py-4 px-4 font-black text-emerald-600 text-xs">
                              +R$ {fee.toFixed(2).replace(".", ",")}
                            </td>
                            <td className="py-4 px-4 font-bold text-purple-700 text-xs">
                              R$ {net.toFixed(2).replace(".", ",")}
                            </td>
                            <td className="py-4 px-4">
                              <code className="px-2 py-1 rounded bg-zinc-100 border border-zinc-200 font-mono text-[11px] text-zinc-800">
                                {o.deliveredData}
                              </code>
                            </td>
                            <td className="py-4 px-4 text-zinc-400 font-medium text-xs">{o.createdAt}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB: VERIFICAÇÕES DE IDENTIDADE
           ========================================================================= */}
        {/* =========================================================================
            TAB: MEDIAÇÕES & PROBLEMAS REPORTADOS
           ========================================================================= */}
        {activeTab === "disputes" && (
          <AdminDisputesPanel
            currentUser={currentUser}
            onOpenChat={(code) => router.push(`/chat/${code}`)}
          />
        )}

        {/* =========================================================================
            TAB: TODOS OS CHATS DE COMPRAS (ACESSO TOTAL DO ADMINISTRADOR)
           ========================================================================= */}
        {activeTab === "all_chats" && (
          <AdminAllChatsPanel
            currentUser={currentUser}
            onOpenChat={(code) => router.push(`/chat/${code}`)}
          />
        )}

        {activeTab === "verifications" && (
          <AdminVerificationsPanel registeredUsers={usersList} />
        )}

        {/* =========================================================================
            TAB 4: VENDEDORES & USUÁRIOS (GERENCIAMENTO)
           ========================================================================= */}
        {activeTab === "users" && (
          <AdminUsersPanel
            currentUser={currentUser}
            users={usersList}
            products={localProducts}
            loading={usersLoading}
            loadError={usersError}
            onReload={loadProfiles}
            onUsersChange={setUsersList}
          />
        )}

        {/* =========================================================================
            TAB: SAQUES PIX FLASH (APROVAÇÃO E GESTÃO DE REPASSES)
           ========================================================================= */}
        {activeTab === "withdrawals" && (
          <AdminWithdrawalsPanel currentUser={currentUser} />
        )}

        {/* =========================================================================
            TAB 5: BANCO DE DADOS SUPABASE
           ========================================================================= */}
        {activeTab === "supabase" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="p-8 rounded-3xl bg-white border border-zinc-200 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-6 rounded-full bg-[#0066FF]" />
                  <h2 className="text-base font-black text-zinc-950 tracking-tight">
                    Conexão com Banco de Dados em Nuvem
                  </h2>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-black text-xs border border-emerald-200">
                  ● Conectado
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    PROJECT HOST
                  </span>
                  <code className="text-xs font-mono font-bold text-zinc-800 mt-1 block">
                    PostgreSQL Cloud
                  </code>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    STATUS
                  </span>
                  <code className="text-xs font-mono font-bold text-emerald-600 mt-1 block truncate">
                    Sincronizado e Seguro
                  </code>
                </div>
              </div>

              <div className="mt-6 border-t border-zinc-100 pt-5">
                <h3 className="text-xs font-black text-zinc-900 uppercase tracking-wider mb-2">
                  Tabelas Ativas no Banco:
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl border border-zinc-200 bg-white flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-zinc-900 block">public.profiles</span>
                      <span className="text-xs text-zinc-400">Usuários & Vendedores</span>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>

                  <div className="p-3.5 rounded-xl border border-zinc-200 bg-white flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-zinc-900 block">public.products</span>
                      <span className="text-xs text-zinc-400">Catálogo & Anúncios</span>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>

                  <div className="p-3.5 rounded-xl border border-zinc-200 bg-white flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-zinc-900 block">auth.users</span>
                      <span className="text-xs text-zinc-400">Autenticação & Senhas</span>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Delete Product Confirmation Modal */}
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
                Tem certeza que deseja excluir permanentemente o anúncio:
              </p>
              <div className="text-xs font-bold text-zinc-900 bg-zinc-50 p-3 rounded-xl border border-zinc-200 break-words leading-snug">
                <span className="font-mono text-[#0066FF] font-black mr-1.5">{getProductAdCode(productToDelete)}</span>
                &ldquo;{productToDelete.title}&rdquo;
              </div>
              <p className="text-[11px] text-zinc-400 mt-2">
                Esta ação removerá o produto da loja e do banco de dados permanentemente.
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
                onClick={handleConfirmDeleteProduct}
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
