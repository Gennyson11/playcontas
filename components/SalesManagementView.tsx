"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { UserProfile } from "@/types";
import {
  ArrowLeft,
  Search,
  MessageSquare,
  MoreVertical,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  Package,
  TrendingUp,
  DollarSign,
  ShieldAlert,
  X,
  Eye,
  Filter,
} from "lucide-react";
import {
  SaleRecord,
  fetchSellerSales,
  formatCurrencyBRL,
  getStoredSales,
} from "@/lib/saleStore";
import { fetchReceivedQuestions } from "@/lib/questionStore";
import { getStoredProducts } from "@/lib/productStore";
import { getProductUrl } from "@/lib/slug";

interface SalesManagementViewProps {
  currentUser: UserProfile;
  onBack?: () => void;
  onNavigateToQuestions?: () => void;
}

export function SalesManagementView({
  currentUser,
  onBack,
  onNavigateToQuestions,
}: SalesManagementViewProps) {
  const router = useRouter();

  // Lista de vendas
  const [sales, setSales] = useState<SaleRecord[]>(() =>
    getStoredSales(currentUser?.id)
  );
  const [isLoading, setIsLoading] = useState(false);

  // Perguntas pendentes para a faixa do topo (alerta dinâmico)
  const [unansweredQuestionsCount, setUnansweredQuestionsCount] = useState(0);

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Dropdowns de filtro
  const [periodDropdownOpen, setPeriodDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  // Menu de opções aberto para uma venda específica
  const [activeMenuSaleId, setActiveMenuSaleId] = useState<string | null>(null);

  // Modal de detalhes da venda
  const [detailSale, setDetailSale] = useState<SaleRecord | null>(null);

  // Feedback de cópia do código
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Carrega vendas e perguntas pendentes
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setIsLoading(true);
      try {
        const list = await fetchSellerSales(currentUser);
        if (isMounted) {
          setSales(list);
        }
      } catch (e) {
        console.warn("Erro ao carregar vendas:", e);
      } finally {
        if (isMounted) setIsLoading(false);
      }

      try {
        const questions = await fetchReceivedQuestions(currentUser);
        const unanswered = questions.filter((q) => !q.answer).length;
        if (isMounted) {
          setUnansweredQuestionsCount(unanswered);
        }
      } catch {}
    };

    loadData();

    const handleUpdate = () => {
      loadData();
    };

    window.addEventListener("central_sales_updated", handleUpdate);
    window.addEventListener("central_questions_changed", handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener("central_sales_updated", handleUpdate);
      window.removeEventListener("central_questions_changed", handleUpdate);
    };
  }, [currentUser?.id, currentUser?.name]);

  // Fechar menus ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-menu-container]")) {
        setActiveMenuSaleId(null);
      }
      if (!target.closest("[data-dropdown-container]")) {
        setPeriodDropdownOpen(false);
        setStatusDropdownOpen(false);
      }
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  // Copiar código do pedido
  const handleCopyCode = (code: string) => {
    try {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2200);
    } catch {}
  };

  // Abrir chat da venda
  const handleOpenChat = (sale: SaleRecord) => {
    const targetChat = sale.chatId || sale.orderCode.replace("#", "") || sale.id;
    router.push(`/chat/${encodeURIComponent(targetChat)}`);
  };

  // Navegar para o anúncio
  const handleViewProduct = (sale: SaleRecord) => {
    if (sale.productId) {
      const prods = getStoredProducts();
      const found = prods.find((p) => p.id === sale.productId);
      if (found) {
        router.push(getProductUrl(found));
        return;
      }
    }
    router.push("/");
  };

  // Vendas filtradas
  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      // 1. Busca textual
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = sale.productTitle.toLowerCase().includes(q);
        const matchesVariant = (sale.variantName || "").toLowerCase().includes(q);
        const matchesBuyer = sale.buyerName.toLowerCase().includes(q);
        const matchesCode = sale.orderCode.toLowerCase().includes(q);
        if (!matchesTitle && !matchesVariant && !matchesBuyer && !matchesCode) {
          return false;
        }
      }

      // 2. Filtro de Status
      if (statusFilter !== "all") {
        if (sale.status !== statusFilter) return false;
      }

      // 3. Filtro de Período
      if (periodFilter !== "all") {
        const saleDate = new Date(sale.createdAt);
        const now = new Date();
        const diffMs = now.getTime() - saleDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (periodFilter === "today") {
          const isToday =
            saleDate.getDate() === now.getDate() &&
            saleDate.getMonth() === now.getMonth() &&
            saleDate.getFullYear() === now.getFullYear();
          if (!isToday) return false;
        } else if (periodFilter === "7days") {
          if (diffDays > 7) return false;
        } else if (periodFilter === "30days") {
          if (diffDays > 30) return false;
        } else if (periodFilter === "month") {
          const isThisMonth =
            saleDate.getMonth() === now.getMonth() &&
            saleDate.getFullYear() === now.getFullYear();
          if (!isThisMonth) return false;
        }
      }

      return true;
    });
  }, [sales, searchQuery, periodFilter, statusFilter]);

  // Métricas de faturamento
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let deliveredCount = 0;
    let pendingCount = 0;

    sales.forEach((s) => {
      totalRevenue += s.total || s.price * s.quantity;
      if (s.status === "delivered") deliveredCount++;
      else if (s.status === "pending") pendingCount++;
    });

    return { totalRevenue, deliveredCount, pendingCount };
  }, [sales]);

  // Labels dos filtros
  const periodLabels: Record<string, string> = {
    all: "Período",
    today: "Hoje",
    "7days": "Últimos 7 dias",
    "30days": "Últimos 30 dias",
    month: "Este mês",
  };

  const statusLabels: Record<string, string> = {
    all: "Status",
    delivered: "Entregue",
    pending: "Pendente",
    dispute: "Em mediação",
    cancelled: "Cancelado",
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-14 font-sans">
      {/* Toast Feedback de Cópia */}
      {copiedCode && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-950 text-white px-5 py-3 rounded-2xl shadow-2xl border border-zinc-800 text-xs sm:text-sm font-semibold flex items-center gap-2.5 animate-slideUp">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Código {copiedCode} copiado para a área de transferência!</span>
        </div>
      )}

      {/* HEADER PRINCIPAL NO CONCEITO PADRONIZADO DO SITE */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="w-9 h-9 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-600 hover:text-black flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Voltar para Minha Conta"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h2 className="text-base sm:text-lg font-black text-zinc-950 tracking-tight flex items-center gap-2">
                <span>Painel de Vendas</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#0066FF] border border-blue-100">
                  {sales.length} {sales.length === 1 ? "venda" : "vendas"}
                </span>
              </h2>
              <p className="text-xs text-zinc-500 font-medium mt-0.5">
                Acompanhe pedidos recebidos, entregas e converse diretamente com seus compradores.
              </p>
            </div>
          </div>
        </div>

        {/* 3 Métricas no topo padronizadas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-6 pt-6 border-t border-zinc-100">
          <div className="bg-zinc-50/80 border border-zinc-200/80 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                Total Faturado
              </span>
              <span className="text-xl sm:text-2xl font-black text-zinc-950">
                R$ {formatCurrencyBRL(stats.totalRevenue)}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0066FF] flex items-center justify-center border border-blue-100 shadow-2xs">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-zinc-50/80 border border-zinc-200/80 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                Pedidos Entregues
              </span>
              <span className="text-xl sm:text-2xl font-black text-emerald-600">
                {stats.deliveredCount}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shadow-2xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-zinc-50/80 border border-zinc-200/80 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
                Aguardando Entrega
              </span>
              <span className="text-xl sm:text-2xl font-black text-amber-600">
                {stats.pendingCount}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shadow-2xs">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          FAIXA DE ALERTA NO TOPO: PERGUNTAS SEM RESPOSTA (CONFORME IMAGEM)
         ========================================================================= */}
      {unansweredQuestionsCount > 0 && (
        <button
          type="button"
          onClick={() => {
            if (onNavigateToQuestions) onNavigateToQuestions();
            else router.push("/minha-conta?tab=perguntas");
          }}
          className="w-full bg-white hover:bg-zinc-50/90 border border-zinc-200 hover:border-zinc-300 rounded-2xl p-4 sm:px-5 flex items-center justify-between shadow-xs transition-all cursor-pointer group text-left"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0066FF] shadow-xs group-hover:scale-110 transition-transform shrink-0" />
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-zinc-900 group-hover:text-[#0066FF] transition-colors">
              PERGUNTAS SEM RESPOSTA
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm sm:text-base font-black text-zinc-900 group-hover:text-[#0066FF] transition-colors">
              {unansweredQuestionsCount}
            </span>
            <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-[#0066FF] transition-transform group-hover:translate-x-0.5" />
          </div>
        </button>
      )}

      {/* =========================================================================
          CONTAINER PRINCIPAL DAS VENDAS: FILTROS + TABELA (ESTILO DA IMAGEM)
         ========================================================================= */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-xs overflow-hidden">
        {/* BARRA DE BUSCA E FILTROS (CONFORME IMAGEM DE REFERÊNCIA) */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Campo de Busca */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por produto ou cliente..."
              className="w-full pl-10 pr-9 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs sm:text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtros em Dropdown */}
          <div className="flex items-center gap-2" data-dropdown-container>
            {/* Dropdown Período */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setPeriodDropdownOpen((prev) => !prev);
                  setStatusDropdownOpen(false);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  periodFilter !== "all"
                    ? "bg-[#0066FF] text-white border-[#0066FF] shadow-xs"
                    : "bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-700"
                }`}
              >
                <span>{periodLabels[periodFilter]}</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              </button>

              {periodDropdownOpen && (
                <div className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-44 bg-white rounded-2xl shadow-xl border border-zinc-200 py-1.5 z-40 animate-fadeIn">
                  {[
                    { id: "all", label: "Todos os períodos" },
                    { id: "today", label: "Hoje" },
                    { id: "7days", label: "Últimos 7 dias" },
                    { id: "30days", label: "Últimos 30 dias" },
                    { id: "month", label: "Este mês" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setPeriodFilter(opt.id);
                        setPeriodDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-xs font-semibold flex items-center justify-between hover:bg-zinc-50 transition-colors cursor-pointer ${
                        periodFilter === opt.id
                          ? "text-[#0066FF] font-bold bg-blue-50/50"
                          : "text-zinc-700"
                      }`}
                    >
                      <span>{opt.label}</span>
                      {periodFilter === opt.id && <Check className="w-3.5 h-3.5 text-[#0066FF]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dropdown Status */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setStatusDropdownOpen((prev) => !prev);
                  setPeriodDropdownOpen(false);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  statusFilter !== "all"
                    ? "bg-[#0066FF] text-white border-[#0066FF] shadow-xs"
                    : "bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-700"
                }`}
              >
                <span>{statusLabels[statusFilter]}</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              </button>

              {statusDropdownOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-white rounded-2xl shadow-xl border border-zinc-200 py-1.5 z-40 animate-fadeIn">
                  {[
                    { id: "all", label: "Todos os status" },
                    { id: "delivered", label: "Entregue" },
                    { id: "pending", label: "Pendente" },
                    { id: "dispute", label: "Em mediação" },
                    { id: "cancelled", label: "Cancelado" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setStatusFilter(opt.id);
                        setStatusDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-xs font-semibold flex items-center justify-between hover:bg-zinc-50 transition-colors cursor-pointer ${
                        statusFilter === opt.id
                          ? "text-[#0066FF] font-bold bg-blue-50/50"
                          : "text-zinc-700"
                      }`}
                    >
                      <span>{opt.label}</span>
                      {statusFilter === opt.id && <Check className="w-3.5 h-3.5 text-[#0066FF]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* =========================================================================
            TABELA DE VENDAS (COLUNAS CONFORME IMAGEM: PRODUTO, DATA, VALOR, STATUS, AÇÕES)
           ========================================================================= */}
        {filteredSales.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-400 mb-3">
              <Package className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-zinc-800">
              {sales.length === 0 ? "Nenhuma venda realizada ainda" : "Nenhuma venda encontrada"}
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mt-1">
              {sales.length === 0
                ? "Quando os clientes comprarem seus anúncios, seus pedidos recebidos aparecerão aqui com acesso direto ao chat e status de entrega."
                : "Não encontramos nenhuma venda com os filtros selecionados ou termo pesquisado."}
            </p>
            {(searchQuery || periodFilter !== "all" || statusFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setPeriodFilter("all");
                  setStatusFilter("all");
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-xs font-bold text-zinc-700 transition-colors cursor-pointer"
              >
                Limpar Filtros
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/70 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-zinc-400">
                  <th className="py-3 px-4 sm:px-6">PRODUTO</th>
                  <th className="py-3 px-4 whitespace-nowrap">DATA</th>
                  <th className="py-3 px-4 whitespace-nowrap">VALOR</th>
                  <th className="py-3 px-4 whitespace-nowrap">STATUS</th>
                  <th className="py-3 px-4 sm:px-6 text-right whitespace-nowrap">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredSales.map((sale) => {
                  const isMenuOpen = activeMenuSaleId === sale.id;

                  return (
                    <tr
                      key={sale.id}
                      className="hover:bg-zinc-50/70 transition-colors group"
                    >
                      {/* 1. PRODUTO */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-3 sm:gap-3.5">
                          {/* Miniatura do Produto */}
                          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-zinc-100 border border-zinc-200/80 shrink-0 shadow-2xs">
                            <img
                              src={sale.productImage || "/categorias/gpt.webp"}
                              alt={sale.productTitle}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = "/categorias/gpt.webp";
                              }}
                            />
                          </div>

                          {/* Título, Variação, Código e Comprador */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs sm:text-sm font-black text-zinc-950 truncate max-w-[220px] sm:max-w-[320px]">
                                {sale.productTitle}
                              </span>

                              {sale.variantName && (
                                <span className="text-xs sm:text-sm font-semibold text-zinc-700 flex items-center gap-1">
                                  <span className="text-zinc-400">&gt;</span>
                                  <span className="truncate max-w-[160px] sm:max-w-[200px]">
                                    {sale.variantName}
                                  </span>
                                </span>
                              )}
                            </div>

                            {/* Subtítulo: #CÓDIGO | Nome do Comprador */}
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-500 font-medium">
                              <button
                                type="button"
                                onClick={() => handleCopyCode(sale.orderCode)}
                                className="font-mono font-bold text-zinc-700 hover:text-[#0066FF] flex items-center gap-1 cursor-pointer transition-colors"
                                title="Clique para copiar o código"
                              >
                                <span>{sale.orderCode}</span>
                                <Copy className="w-3 h-3 opacity-60 hover:opacity-100" />
                              </button>

                              {sale.buyerName && (
                                <>
                                  <span className="text-zinc-300">|</span>
                                  <span className="truncate text-zinc-600 font-medium max-w-[140px] sm:max-w-[200px]">
                                    {sale.buyerName}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. DATA */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="text-xs font-bold text-zinc-600">
                          {sale.formattedDate}
                        </span>
                      </td>

                      {/* 3. VALOR */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="text-xs sm:text-sm font-black text-zinc-950">
                          {sale.quantity}x R$ {formatCurrencyBRL(sale.price)}
                        </span>
                      </td>

                      {/* 4. STATUS */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {sale.status === "delivered" ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                            Entregue
                          </span>
                        ) : sale.status === "pending" ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
                            Pendente
                          </span>
                        ) : sale.status === "dispute" ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/80">
                            Em mediação
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-600 border border-zinc-200">
                            Cancelado
                          </span>
                        )}
                      </td>

                      {/* 5. AÇÕES: Botão Chat + Três Pontinhos */}
                      <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                        <div
                          className="inline-flex items-center gap-1.5 justify-end relative"
                          data-menu-container
                        >
                          {/* Botão Chat */}
                          <button
                            type="button"
                            onClick={() => handleOpenChat(sale)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-[#0066FF] text-zinc-700 hover:text-white text-xs font-bold transition-all cursor-pointer shadow-2xs"
                            title="Conversar com o comprador"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Chat</span>
                          </button>

                          {/* Botão ⋮ (Três Pontos) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuSaleId(isMenuOpen ? null : sale.id);
                            }}
                            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                              isMenuOpen
                                ? "bg-zinc-200 text-zinc-950"
                                : "text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100"
                            }`}
                            title="Mais opções"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {/* Menu Dropdown de Opções */}
                          {isMenuOpen && (
                            <div className="absolute right-0 top-10 w-52 bg-white rounded-2xl shadow-xl border border-zinc-200 py-1.5 z-40 animate-fadeIn text-left">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuSaleId(null);
                                  setDetailSale(sale);
                                }}
                                className="w-full text-left px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:text-zinc-950 hover:bg-zinc-50 flex items-center gap-2 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-zinc-400" />
                                <span>Ver detalhes do pedido</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuSaleId(null);
                                  handleCopyCode(sale.orderCode);
                                }}
                                className="w-full text-left px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:text-zinc-950 hover:bg-zinc-50 flex items-center gap-2 cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                                <span>Copiar código ({sale.orderCode})</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuSaleId(null);
                                  handleViewProduct(sale);
                                }}
                                className="w-full text-left px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:text-zinc-950 hover:bg-zinc-50 flex items-center gap-2 cursor-pointer"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                                <span>Ver anúncio na loja</span>
                              </button>

                              <div className="my-1 border-t border-zinc-100" />

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuSaleId(null);
                                  handleOpenChat(sale);
                                }}
                                className="w-full text-left px-3.5 py-2 text-xs font-bold text-[#0066FF] hover:bg-blue-50/60 flex items-center gap-2 cursor-pointer"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-[#0066FF]" />
                                <span>Abrir chat com comprador</span>
                              </button>
                            </div>
                          )}
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
          MODAL DE DETALHES DO PEDIDO
         ========================================================================= */}
      {detailSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-zinc-200 relative animate-scaleUp">
            {/* Header do Modal */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0066FF] flex items-center justify-center font-bold">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-zinc-950 tracking-tight">
                    Pedido {detailSale.orderCode}
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-medium">
                    Realizado em {detailSale.formattedDate}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDetailSale(null)}
                className="w-8 h-8 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-500 hover:text-zinc-950 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo do Pedido */}
            <div className="space-y-4 py-4">
              {/* Card do Produto */}
              <div className="flex items-center gap-3.5 p-3.5 bg-zinc-50 rounded-2xl border border-zinc-200/80">
                <img
                  src={detailSale.productImage || "/categorias/gpt.webp"}
                  alt={detailSale.productTitle}
                  className="w-14 h-14 rounded-xl object-cover border border-zinc-200 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-black text-zinc-950 truncate">
                    {detailSale.productTitle}
                  </h4>
                  {detailSale.variantName && (
                    <p className="text-xs font-semibold text-zinc-600 mt-0.5 truncate">
                      {detailSale.variantName}
                    </p>
                  )}
                  <p className="text-xs font-bold text-[#0066FF] mt-1">
                    {detailSale.quantity}x R$ {formatCurrencyBRL(detailSale.price)} = R${" "}
                    {formatCurrencyBRL(detailSale.total)}
                  </p>
                </div>
              </div>

              {/* Informações detalhadas */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-zinc-50/70 rounded-xl border border-zinc-100">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">
                    Comprador
                  </span>
                  <span className="font-bold text-zinc-800 truncate block">
                    {detailSale.buyerName}
                  </span>
                </div>

                <div className="p-3 bg-zinc-50/70 rounded-xl border border-zinc-100">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">
                    Status
                  </span>
                  <span
                    className={`font-black ${
                      detailSale.status === "delivered"
                        ? "text-emerald-600"
                        : detailSale.status === "pending"
                        ? "text-amber-600"
                        : "text-zinc-800"
                    }`}
                  >
                    {detailSale.statusLabel}
                  </span>
                </div>

                <div className="p-3 bg-zinc-50/70 rounded-xl border border-zinc-100">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">
                    Tipo de Entrega
                  </span>
                  <span className="font-bold text-zinc-800">
                    {detailSale.deliveryType === "AUTOMATIC" ? "⚡ Automática" : "📦 Manual"}
                  </span>
                </div>

                <div className="p-3 bg-zinc-50/70 rounded-xl border border-zinc-100">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">
                    Código do Pedido
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-zinc-800">
                      {detailSale.orderCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(detailSale.orderCode)}
                      className="text-[#0066FF] hover:underline cursor-pointer"
                      title="Copiar código"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Rodapé do Modal com Ações */}
            <div className="pt-4 border-t border-zinc-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDetailSale(null)}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-xs font-bold text-zinc-700 transition-colors cursor-pointer"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => {
                  setDetailSale(null);
                  handleOpenChat(detailSale);
                }}
                className="px-4 py-2.5 rounded-xl bg-[#0066FF] hover:bg-[#0052cc] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Abrir Chat com o Comprador</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
