"use client";

import React, { useState, useEffect, useMemo } from "react";
import { UserProfile, Product, Coupon } from "@/types";
import {
  ArrowLeft,
  Ticket,
  Percent,
  DollarSign,
  Calendar,
  Layers,
  ShoppingBag,
  Plus,
  Trash2,
  Copy,
  Check,
  Power,
  HelpCircle,
  Clock,
  Sparkles,
  AlertCircle,
  ChevronDown,
  Tag,
  CheckCircle2,
} from "lucide-react";
import { getStoredProducts } from "@/lib/productStore";
import {
  getSellerCoupons,
  fetchRemoteCoupons,
  createCoupon,
  toggleCouponActive,
  deleteCoupon,
} from "@/lib/couponStore";

interface CouponsManagementViewProps {
  currentUser: UserProfile;
  onBack?: () => void;
}

export function CouponsManagementView({
  currentUser,
  onBack,
}: CouponsManagementViewProps) {
  // Estado da lista de cupons
  const [coupons, setCoupons] = useState<Coupon[]>(() =>
    getSellerCoupons(currentUser?.id, currentUser?.name)
  );

  // Produtos do vendedor para o cupom de produto específico
  const [sellerProducts, setSellerProducts] = useState<Product[]>([]);

  // Estados do formulário de criação (conforme a imagem de referência)
  const [scope, setScope] = useState<"store" | "product">("store");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [code, setCode] = useState<string>("");
  const [discountValue, setDiscountValue] = useState<string>("");
  const [usageLimit, setUsageLimit] = useState<string>("");
  const [validityPreset, setValidityPreset] = useState<string>("none");
  const [customValidityDate, setCustomValidityDate] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Cupom em confirmação de exclusão
  const [deletingCoupon, setDeletingCoupon] = useState<Coupon | null>(null);

  // Feedback de cópia do código
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Carrega produtos do vendedor
  useEffect(() => {
    const all = getStoredProducts();
    const sId = currentUser?.id || "";
    const sName = (currentUser?.name || "").toLowerCase().trim();
    const isGennyson =
      sName.includes("gennyson") ||
      sId === "usr-gennyson" ||
      sId === "bb25d258-3152-422b-aa04-7bd34e8a5927";

    const filtered = all.filter((p) => {
      if (isGennyson && (p.seller?.name?.toLowerCase().includes("gennyson") || p.seller?.id === "bb25d258-3152-422b-aa04-7bd34e8a5927")) {
        return true;
      }
      if (sId && p.seller?.id === sId) return true;
      if (sName && p.seller?.name?.toLowerCase().trim() === sName) return true;
      return false;
    });

    setSellerProducts(filtered.length > 0 ? filtered : all.slice(0, 10));
    if (filtered.length > 0) {
      setSelectedProductId(filtered[0].id);
    } else if (all.length > 0) {
      setSelectedProductId(all[0].id);
    }
  }, [currentUser?.id, currentUser?.name]);

  // Recarrega cupons ao mudar ou disparar evento
  const reloadCoupons = () => {
    setCoupons(getSellerCoupons(currentUser?.id, currentUser?.name));
  };

  useEffect(() => {
    reloadCoupons();
    fetchRemoteCoupons(currentUser?.id, currentUser?.name).then((remote) => {
      if (remote) setCoupons(remote);
    });
    window.addEventListener("central_coupons_changed", reloadCoupons);
    window.addEventListener("storage", reloadCoupons);
    return () => {
      window.removeEventListener("central_coupons_changed", reloadCoupons);
      window.removeEventListener("storage", reloadCoupons);
    };
  }, [currentUser?.id, currentUser?.name]);

  // Validação em tempo real do formulário
  const cleanCode = useMemo(() => {
    return code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  }, [code]);

  const numDiscount = parseFloat(discountValue.replace(",", "."));
  const isDiscountValid = !isNaN(numDiscount) && numDiscount > 0 && (discountType === "fixed" || numDiscount <= 100);

  const missingFields = useMemo(() => {
    const list: string[] = [];
    if (!cleanCode) list.push("código");
    if (!isDiscountValid) list.push("desconto");
    if (scope === "product" && !selectedProductId) list.push("produto");
    return list;
  }, [cleanCode, isDiscountValid, scope, selectedProductId]);

  const canSubmit = missingFields.length === 0;

  // Calcula a data de expiração com base no preset
  const calculateExpiresAt = (): string | null => {
    if (validityPreset === "none") return null;
    const now = new Date();
    if (validityPreset === "24h") {
      now.setHours(now.getHours() + 24);
      return now.toISOString();
    }
    if (validityPreset === "3d") {
      now.setDate(now.getDate() + 3);
      return now.toISOString();
    }
    if (validityPreset === "7d") {
      now.setDate(now.getDate() + 7);
      return now.toISOString();
    }
    if (validityPreset === "15d") {
      now.setDate(now.getDate() + 15);
      return now.toISOString();
    }
    if (validityPreset === "30d") {
      now.setDate(now.getDate() + 30);
      return now.toISOString();
    }
    if (validityPreset === "custom" && customValidityDate) {
      const custom = new Date(customValidityDate);
      if (!isNaN(custom.getTime())) {
        custom.setHours(23, 59, 59, 999);
        return custom.toISOString();
      }
    }
    return null;
  };

  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      const targetProd = sellerProducts.find((p) => p.id === selectedProductId);

      const newCoupon = createCoupon({
        code: cleanCode,
        sellerId: currentUser?.id || "bb25d258-3152-422b-aa04-7bd34e8a5927",
        sellerName: currentUser?.name || "Gennyson Marinho",
        scope,
        productId: scope === "product" ? selectedProductId : undefined,
        productTitle: scope === "product" ? targetProd?.title : undefined,
        discountType,
        discountValue: numDiscount,
        usageLimit: usageLimit ? parseInt(usageLimit, 10) : null,
        expiresAt: calculateExpiresAt(),
      });

      // Limpa os campos após salvar
      setCode("");
      setDiscountValue("");
      setUsageLimit("");
      setValidityPreset("none");
      setCustomValidityDate("");

      setSuccessNotice(`Cupom ${newCoupon.code} criado com sucesso e pronto para uso!`);
      setTimeout(() => setSuccessNotice(null), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = (couponId: string) => {
    toggleCouponActive(couponId);
  };

  const handleDeleteClick = (coupon: Coupon) => {
    setDeletingCoupon(coupon);
  };

  const handleConfirmDelete = () => {
    if (!deletingCoupon) return;
    const target = deletingCoupon;
    // Otimista: remove imediatamente da lista local
    setCoupons((prev) => prev.filter((c) => c.id !== target.id && c.code !== target.code));
    deleteCoupon(target.id);
    setDeletingCoupon(null);
    setSuccessNotice(`Cupom "${target.code}" excluído com sucesso.`);
    setTimeout(() => setSuccessNotice(null), 3000);
  };

  const handleCopyCode = (c: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(c);
      setCopiedCode(c);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return "Sem expiração";
    try {
      const d = new Date(isoString);
      return `Expira em ${d.toLocaleDateString("pt-BR")}`;
    } catch {
      return "Sem expiração";
    }
  };

  return (
    <div className="space-y-6">
      {/* =========================================================================
          CABEÇALHO PADRÃO (IDENTIDADE / NOTIFICAÇÕES / PERGUNTAS)
         ========================================================================= */}
      <div className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-7 shadow-xs">
        <div className="flex items-center justify-between pb-6 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="w-9 h-9 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-600 hover:text-black flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Voltar para Minha Conta"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : null}
            <div>
              <h2 className="text-base sm:text-lg font-black text-zinc-950 tracking-tight flex items-center gap-2">
                <span>Cupons de desconto</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#0066FF] border border-blue-100">
                  {coupons.filter((c) => c.isActive).length} ativos
                </span>
              </h2>
              <p className="text-xs text-zinc-500 font-medium mt-0.5">
                Crie cupons personalizados e ofereça descontos exclusivos aos seus compradores.
              </p>
            </div>
          </div>
        </div>

        {/* Notificação de sucesso */}
        {successNotice && (
          <div className="mt-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* =========================================================================
            CARD: CRIAR CUPOM (CONFORME IMAGEM DE REFERÊNCIA)
           ========================================================================= */}
        <form onSubmit={handleCreateCoupon} className="mt-6 space-y-6">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-black text-zinc-950 tracking-tight">
              Criar cupom
            </h3>
            <span
              title="Configure o alcance, desconto e regras de uso do cupom promocional"
              className="text-zinc-400 hover:text-zinc-600 cursor-help"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* 1. ONDE O CUPOM VALE? */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              ONDE O CUPOM VALE?
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Opção A: Loja inteira */}
              <button
                type="button"
                onClick={() => setScope("store")}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative ${
                  scope === "store"
                    ? "border-[#0066FF] bg-blue-50/40 ring-2 ring-[#0066FF]/20"
                    : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100/70"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <span
                      className={`text-sm font-bold block ${
                        scope === "store" ? "text-[#0066FF]" : "text-zinc-900"
                      }`}
                    >
                      Loja inteira
                    </span>
                    <span className="text-xs text-zinc-500">Qualquer produto</span>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors ${
                      scope === "store"
                        ? "bg-[#0066FF] border-[#0066FF] text-white"
                        : "border-zinc-300 bg-white"
                    }`}
                  >
                    {scope === "store" && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
              </button>

              {/* Opção B: Produto específico */}
              <button
                type="button"
                onClick={() => setScope("product")}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative ${
                  scope === "product"
                    ? "border-[#0066FF] bg-blue-50/40 ring-2 ring-[#0066FF]/20"
                    : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100/70"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <span
                      className={`text-sm font-bold block ${
                        scope === "product" ? "text-[#0066FF]" : "text-zinc-900"
                      }`}
                    >
                      Produto específico
                    </span>
                    <span className="text-xs text-zinc-500">Só no escolhido</span>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors ${
                      scope === "product"
                        ? "bg-[#0066FF] border-[#0066FF] text-white"
                        : "border-zinc-300 bg-white"
                    }`}
                  >
                    {scope === "product" && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
              </button>
            </div>

            {/* Seletor de produto caso "Produto específico" esteja selecionado */}
            {scope === "product" && (
              <div className="pt-2 animate-in fade-in duration-200">
                <label className="block text-[11px] font-bold text-zinc-600 mb-1">
                  Selecione o anúncio elegível:
                </label>
                <div className="relative">
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-zinc-900 appearance-none focus:outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/10 cursor-pointer pr-10"
                  >
                    {sellerProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} — R$ {p.price.toFixed(2).replace(".", ",")}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}
          </div>

          {/* 2. TIPO DE DESCONTO */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              TIPO DE DESCONTO
            </label>

            <div className="inline-flex p-1 bg-zinc-100 rounded-2xl border border-zinc-200/80 gap-1">
              <button
                type="button"
                onClick={() => setDiscountType("percentage")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  discountType === "percentage"
                    ? "bg-[#0066FF] text-white shadow-xs"
                    : "text-zinc-600 hover:text-zinc-950"
                }`}
              >
                <Percent className="w-3.5 h-3.5" />
                <span>% percentual</span>
              </button>

              <button
                type="button"
                onClick={() => setDiscountType("fixed")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  discountType === "fixed"
                    ? "bg-[#0066FF] text-white shadow-xs"
                    : "text-zinc-600 hover:text-zinc-950"
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>R$ fixo</span>
              </button>
            </div>
          </div>

          {/* 3. INPUT: CÓDIGO */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-zinc-700">
              Código do cupom
            </label>
            <div className="relative">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Ex: PROMO10, CENTRALVIP, DESCONTO"
                maxLength={20}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-xs sm:text-sm font-mono font-bold text-zinc-900 uppercase tracking-wider placeholder-zinc-400 focus:outline-none focus:border-[#0066FF] focus:bg-white focus:ring-2 focus:ring-[#0066FF]/10 transition-all"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                {code.length}/20
              </span>
            </div>
          </div>

          {/* 4. LINHA: DESCONTO + LIMITE DE USOS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Campo de Desconto */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-zinc-700">
                {discountType === "percentage" ? "Desconto (%)" : "Desconto (R$)"}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === "percentage" ? "Ex: 10" : "Ex: 15,00"}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-xs sm:text-sm font-semibold text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#0066FF] focus:bg-white focus:ring-2 focus:ring-[#0066FF]/10 transition-all"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">
                  {discountType === "percentage" ? "%" : "R$"}
                </span>
              </div>
            </div>

            {/* Campo Limite de usos */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-zinc-700">
                Limite de usos (opcional)
              </label>
              <input
                type="number"
                min="1"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                placeholder="Ex: 50 (vazio = ilimitado)"
                className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-xs sm:text-sm font-semibold text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#0066FF] focus:bg-white focus:ring-2 focus:ring-[#0066FF]/10 transition-all"
              />
            </div>
          </div>

          {/* 5. LINHA: VALIDADE + BOTÃO CRIAR */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-8 space-y-1.5">
              <label className="block text-[11px] font-bold text-zinc-700">
                Validade (opcional)
              </label>
              <div className="relative">
                <select
                  value={validityPreset}
                  onChange={(e) => setValidityPreset(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-xs sm:text-sm font-semibold text-zinc-900 appearance-none focus:outline-none focus:border-[#0066FF] focus:bg-white focus:ring-2 focus:ring-[#0066FF]/10 cursor-pointer pr-10 transition-all"
                >
                  <option value="none">Sem validade (permanente)</option>
                  <option value="24h">Válido por 24 horas</option>
                  <option value="3d">Válido por 3 dias</option>
                  <option value="7d">Válido por 7 dias</option>
                  <option value="15d">Válido por 15 dias</option>
                  <option value="30d">Válido por 30 dias</option>
                  <option value="custom">Data personalizada...</option>
                </select>
                <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Data personalizada caso selecionada */}
              {validityPreset === "custom" && (
                <div className="pt-1.5">
                  <input
                    type="date"
                    value={customValidityDate}
                    onChange={(e) => setCustomValidityDate(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2 text-xs font-medium text-zinc-900 focus:outline-none focus:border-[#0066FF]"
                  />
                </div>
              )}
            </div>

            <div className="sm:col-span-4">
              <button
                type="submit"
                disabled={!canSubmit || isSubmitting}
                className="w-full h-11.5 sm:h-12 bg-[#0066FF] hover:bg-[#0052CC] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xs transition-all active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Criar cupom</span>
              </button>
            </div>
          </div>

          {/* Validação de texto auxiliar inferior (como na imagem: "Falta: código, desconto") */}
          <div className="pt-1">
            {missingFields.length > 0 ? (
              <p className="text-xs text-zinc-400 font-medium">
                Falta:{" "}
                <span className="text-zinc-600 font-bold">
                  {missingFields.join(", ")}
                </span>
              </p>
            ) : (
              <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>
                  Cupom <strong>{cleanCode}</strong> pronto para ser ativado.
                </span>
              </p>
            )}
          </div>
        </form>
      </div>

      {/* =========================================================================
          LISTA DE CUPONS CRIADOS
         ========================================================================= */}
      <div className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
          <div>
            <h3 className="text-sm font-black text-zinc-950 tracking-tight">
              Meus cupons
            </h3>
            <p className="text-xs text-zinc-500 font-medium mt-0.5">
              Gerencie e acompanhe a utilização dos seus cupons ativos
            </p>
          </div>
          <span className="text-xs font-bold text-zinc-500">
            Total: {coupons.length}
          </span>
        </div>

        {coupons.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mx-auto text-zinc-400">
              <Ticket className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-zinc-800">
                Nenhum cupom criado ainda
              </h4>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Utilize o formulário acima para criar cupons de desconto para os seus anúncios.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {coupons.map((c) => {
              const isExpired = c.expiresAt && new Date(c.expiresAt).getTime() < Date.now();
              const isLimitReached = c.usageLimit && (c.usageCount || 0) >= c.usageLimit;

              return (
                <div
                  key={c.id}
                  className={`relative rounded-3xl border transition-all p-5 flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
                    c.isActive && !isExpired && !isLimitReached
                      ? "border-zinc-200 bg-white hover:border-[#0066FF]/40"
                      : "border-zinc-200/70 bg-zinc-50/70 opacity-80"
                  }`}
                >
                  {/* Barra decorativa superior */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-1 ${
                      isExpired
                        ? "bg-rose-400"
                        : !c.isActive
                        ? "bg-zinc-300"
                        : "bg-gradient-to-r from-[#0066FF] to-blue-400"
                    }`}
                  />

                  {/* 1. TOPO: Badge de Desconto + Status + Ações */}
                  <div className="flex items-start justify-between gap-2 pt-1">
                    {/* Badge de Desconto em Destaque */}
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-[#0066FF] border border-blue-200 shadow-2xs">
                        <Tag className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span className="font-black text-xs sm:text-sm tracking-tight">
                          {c.discountType === "percentage"
                            ? `${c.discountValue}% OFF`
                            : `R$ ${c.discountValue.toFixed(2).replace(".", ",")} OFF`}
                        </span>
                      </div>

                      {/* Status Pill */}
                      {isExpired ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700">
                          Expirado
                        </span>
                      ) : isLimitReached ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700">
                          Esgotado
                        </span>
                      ) : c.isActive ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Ativo
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-600">
                          Pausado
                        </span>
                      )}
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggle(c.id)}
                        title={c.isActive ? "Pausar cupom" : "Ativar cupom"}
                        className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                          c.isActive
                            ? "border-zinc-200 bg-white text-zinc-600 hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteClick(c)}
                        title="Excluir cupom"
                        className="p-1.5 rounded-xl border border-zinc-200 bg-white text-zinc-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 2. CENTRO: Ticket do Código com Borda Tracejada e Botão Copiar */}
                  <div
                    onClick={() => handleCopyCode(c.code)}
                    className="my-3.5 px-4 py-3 rounded-2xl bg-zinc-50 border border-dashed border-zinc-300 hover:border-[#0066FF] hover:bg-blue-50/20 transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                        CÓDIGO DO CUPOM
                      </span>
                      <span className="font-mono font-black text-sm sm:text-base tracking-wider text-zinc-950 truncate block">
                        {c.code}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyCode(c.code);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white border border-zinc-200 group-hover:border-[#0066FF] group-hover:text-[#0066FF] text-zinc-700 text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      {copiedCode === c.code ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                          <span className="text-emerald-700">Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-zinc-400 group-hover:text-[#0066FF]" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* 3. METADADOS: Grid Visual com Ícones */}
                  <div className="grid grid-cols-2 gap-2 pb-3">
                    {/* Alcance */}
                    <div className="p-2.5 rounded-xl bg-zinc-50/80 border border-zinc-100 flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#0066FF] flex items-center justify-center shrink-0">
                        <ShoppingBag className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] text-zinc-400 font-bold block uppercase tracking-wider">
                          Alcance
                        </span>
                        <span
                          className="font-semibold text-zinc-800 text-xs truncate block"
                          title={c.scope === "store" ? "Loja inteira" : c.productTitle}
                        >
                          {c.scope === "store"
                            ? "Loja inteira"
                            : c.productTitle || "Produto específico"}
                        </span>
                      </div>
                    </div>

                    {/* Usos */}
                    <div className="p-2.5 rounded-xl bg-zinc-50/80 border border-zinc-100 flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                        <Layers className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] text-zinc-400 font-bold block uppercase tracking-wider">
                          Usos
                        </span>
                        <span className="font-semibold text-zinc-800 text-xs truncate block">
                          <strong>{c.usageCount || 0}</strong>
                          {c.usageLimit ? ` / ${c.usageLimit}` : " (ilimitado)"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 4. RODAPÉ: Validade e Data de Criação */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-zinc-100 text-xs">
                    <div className="flex items-center gap-1.5 text-zinc-500 text-[11px] font-medium">
                      <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className={isExpired ? "text-rose-600 font-semibold" : ""}>
                        {formatDate(c.expiresAt)}
                      </span>
                    </div>

                    <span className="text-[10px] font-medium text-zinc-400">
                      Criado em {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
          MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE CUPOM
         ========================================================================= */}
      {deletingCoupon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-zinc-200 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-black text-zinc-950">
                Excluir cupom &quot;{deletingCoupon.code}&quot;?
              </h3>
              <p className="text-xs text-zinc-500 font-medium mt-1 leading-relaxed">
                Tem certeza que deseja excluir este cupom de desconto? Os compradores não poderão mais aplicá-lo no checkout.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setDeletingCoupon(null)}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
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
