"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { UserProfile } from "@/types";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  OrderDispute,
  getStoredDisputes,
  resolveDispute,
  ensureDisputeFromChat,
  subscribeToDisputes,
} from "@/lib/disputeStore";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Search,
  MessageSquare,
  CheckCircle2,
  ExternalLink,
  Clock,
  Lock,
  Unlock,
  RefreshCw,
  DollarSign,
  User,
  ShoppingBag,
} from "lucide-react";

interface AdminDisputesPanelProps {
  currentUser: UserProfile;
  onOpenChat: (orderCode: string) => void;
}

export function AdminDisputesPanel({
  currentUser,
  onOpenChat,
}: AdminDisputesPanelProps) {
  const [disputes, setDisputes] = useState<OrderDispute[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "resolved">("all");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [confirmModal, setConfirmModal] = useState<{
    dispute: OrderDispute;
    decision: "release_seller" | "refund_buyer";
  } | null>(null);
  const [profileEmails, setProfileEmails] = useState<Record<string, string>>({
    "881a8911-8eaa-43ca-9e0b-be6a68b51f48": "kilr@gmail.com",
    kilr: "kilr@gmail.com",
    Kilr: "kilr@gmail.com",
    "bb25d258-3152-422b-aa04-7bd34e8a5927": "gennysonmarinhodemacedo@gmail.com",
    "usr-gennyson": "gennysonmarinhodemacedo@gmail.com",
    gennyson: "gennysonmarinhodemacedo@gmail.com",
    "Gennyson Marinho": "gennysonmarinhodemacedo@gmail.com",
    "fcaba04d-92ec-45b3-a626-013318cc0f8c": "jovitoolsbr@gmail.com",
    buscaninja: "jovitoolsbr@gmail.com",
    BuscaNinja: "jovitoolsbr@gmail.com",
  });

  const isUserAdmin =
    currentUser?.role === "admin" ||
    currentUser?.name?.toLowerCase().includes("gennyson") ||
    currentUser?.email?.toLowerCase().includes("gennyson");

  const [refreshing, setRefreshing] = useState(false);
  const [justRefreshed, setJustRefreshed] = useState(false);

  const roleLabel = isUserAdmin
    ? "Admin"
    : (currentUser as any)?.role === "moderator"
    ? "Moderador"
    : "Admin";

  const loadData = useCallback(async () => {
    setRefreshing(true);
    setJustRefreshed(false);

    try {
      // 1. Atualiza do armazenamento local
      setDisputes(getStoredDisputes());

      // 2. Sincroniza e-mails dos usuários cadastrados no Supabase
      if (isSupabaseConfigured) {
        try {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, email, full_name");
          if (profilesData && profilesData.length > 0) {
            setProfileEmails((prev) => {
              const next = { ...prev };
              profilesData.forEach((p: any) => {
                if (p?.email) {
                  if (p.id) next[p.id] = p.email;
                  if (p.full_name) {
                    next[p.full_name] = p.email;
                    next[p.full_name.toLowerCase()] = p.email;
                  }
                }
              });
              return next;
            });
          }
        } catch {}

        // 3. Busca no banco se há conversas com mediação reportada
        try {
          const { data: disputedChats } = await supabase
            .from("order_chats")
            .select("*")
            .or("last_message.ilike.%MEDIAÇÃO%,last_message.ilike.%BLOQUEADO%,last_message.ilike.%PROBLEMA%")
            .limit(50);

          if (disputedChats && disputedChats.length > 0) {
            disputedChats.forEach((rc: any) => {
              const oc = {
                id: rc.id,
                number: Number(rc.number) || 0,
                code: rc.code || String(rc.number || 0).padStart(5, "0"),
                productId: rc.product_id || "",
                productTitle: rc.product_title || "Produto",
                productImage: rc.product_image || "",
                price: Number(rc.price) || 0,
                quantity: Number(rc.quantity) || 1,
                buyerId: rc.buyer_id || null,
                buyerName: rc.buyer_name || "Comprador",
                sellerId: rc.seller_id || null,
                sellerName: rc.seller_name || "Vendedor",
                deliveryType: rc.delivery_type === "MANUAL" ? ("MANUAL" as const) : ("AUTOMATIC" as const),
                status: rc.status === "delivered" ? ("delivered" as const) : ("pending" as const),
                lastMessage: rc.last_message || "",
                lastMessageAt: rc.last_message_at || rc.created_at,
                createdAt: rc.created_at,
              };
              ensureDisputeFromChat(oc, rc.last_message);
            });
          }
        } catch {}
      }

      // Pequena pausa para animação do botão de atualizar
      await new Promise((r) => setTimeout(r, 450));

      setDisputes(getStoredDisputes());
      setJustRefreshed(true);
      setTimeout(() => setJustRefreshed(false), 2000);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsub = subscribeToDisputes(() => {
      loadData();
    });
    return unsub;
  }, [loadData]);

  const resolveSellerEmail = (d: OrderDispute) => {
    if (d.sellerEmail) return d.sellerEmail;
    if (d.sellerId && profileEmails[d.sellerId]) return profileEmails[d.sellerId];
    if (d.sellerName && profileEmails[d.sellerName]) return profileEmails[d.sellerName];
    if (d.sellerName && profileEmails[d.sellerName.toLowerCase()]) return profileEmails[d.sellerName.toLowerCase()];
    return null;
  };

  const resolveBuyerEmail = (d: OrderDispute) => {
    if (d.buyerEmail) return d.buyerEmail;
    if (d.buyerId && profileEmails[d.buyerId]) return profileEmails[d.buyerId];
    if (d.buyerName && profileEmails[d.buyerName]) return profileEmails[d.buyerName];
    if (d.buyerName && profileEmails[d.buyerName.toLowerCase()]) return profileEmails[d.buyerName.toLowerCase()];
    return null;
  };

  const filteredDisputes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return disputes.filter((d) => {
      const matchSearch =
        !q ||
        d.orderCode.toLowerCase().includes(q) ||
        d.productTitle.toLowerCase().includes(q) ||
        d.buyerName.toLowerCase().includes(q) ||
        d.sellerName.toLowerCase().includes(q) ||
        d.reason.toLowerCase().includes(q);

      const matchStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "open"
          ? d.status === "open"
          : d.status !== "open";

      return matchSearch && matchStatus;
    });
  }, [disputes, search, statusFilter]);

  const openCount = useMemo(
    () => disputes.filter((d) => d.status === "open").length,
    [disputes]
  );

  const handleConfirmDecision = async () => {
    if (!confirmModal) return;
    const { dispute, decision } = confirmModal;
    setResolvingId(dispute.id);
    const res = await resolveDispute(dispute.id, decision, currentUser, actionNotes);
    setResolvingId(null);
    setConfirmModal(null);
    setActionNotes("");
    if (res.ok) {
      loadData();
    } else {
      alert(res.error || "Não foi possível finalizar a mediação.");
    }
  };

  const brl = (n: number) =>
    (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  return (
    <div className="space-y-6 animate-fadeIn pb-12 select-none font-sans">
      {/* Top Banner de Informação do Sistema de Mediação */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-rose-50 via-white to-amber-50/60 border border-rose-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-600/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-zinc-950 tracking-tight">
                Painel de Mediação & Disputas
              </h2>
              {openCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white animate-pulse">
                  {openCount} {openCount === 1 ? "problema pendente" : "problemas pendentes"}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-zinc-600 mt-0.5 leading-relaxed font-medium">
              Quando um cliente reporta problema, o saldo da venda fica bloqueado preventivamente.
              Você pode acessar o chat como Administrador para intermediar e decidir o destino do saldo.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => loadData()}
          disabled={refreshing}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer self-start md:self-auto shrink-0 shadow-2xs hover:shadow-xs active:scale-95 ${
            justRefreshed
              ? "bg-emerald-50 border-emerald-300 text-emerald-700"
              : "bg-white border-zinc-200 hover:border-zinc-300 text-zinc-700"
          }`}
          title="Recarregar mediações e dados atualizados"
        >
          {justRefreshed ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 animate-fadeIn" />
              <span>Atualizado!</span>
            </>
          ) : (
            <>
              <RefreshCw
                className={`w-3.5 h-3.5 transition-transform ${
                  refreshing ? "animate-spin text-[#0066FF]" : "text-zinc-600"
                }`}
              />
              <span>{refreshing ? "Atualizando..." : "Atualizar"}</span>
            </>
          )}
        </button>
      </div>

      {/* Barra de Filtros & Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por pedido, comprador, vendedor ou produto..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#0066FF] transition-all shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-xl w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "all"
                ? "bg-white text-zinc-950 shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Todos ({disputes.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("open")}
            className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              statusFilter === "open"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            <span>Bloqueados / Pendentes</span>
            {openCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center">
                {openCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("resolved")}
            className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "resolved"
                ? "bg-white text-zinc-950 shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Resolvidos
          </button>
        </div>
      </div>

      {/* Lista de Disputas */}
      {filteredDisputes.length === 0 ? (
        <div className="bg-white rounded-3xl border border-zinc-200 p-12 text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-zinc-50 border border-zinc-200 text-zinc-400 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-7 h-7 text-emerald-500" />
          </div>
          <h3 className="font-bold text-sm text-zinc-900">
            Nenhuma disputa encontrada
          </h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            {search
              ? "Nenhum problema reportado corresponde à sua busca."
              : "Não há problemas reportados no momento. Todas as vendas estão operando normalmente."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredDisputes.map((dispute) => {
            const isOpen = dispute.status === "open";
            return (
              <div
                key={dispute.id}
                className={`bg-white rounded-3xl border transition-all p-5 sm:p-6 shadow-xs ${
                  isOpen
                    ? "border-rose-200 hover:border-rose-300"
                    : "border-zinc-200 opacity-90"
                }`}
              >
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-zinc-100">
                  {/* Informações da Compra */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <img
                      src={dispute.productImage}
                      alt={dispute.productTitle}
                      className="w-14 h-14 rounded-2xl object-cover border border-zinc-200 shrink-0 bg-zinc-100"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-black text-[#0066FF] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-lg">
                          Pedido #{dispute.orderCode}
                        </span>
                        {isOpen ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                            <Lock className="w-3 h-3 text-rose-600" />
                            Saldo Bloqueado (Em Análise)
                          </span>
                        ) : dispute.status === "resolved_seller" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Unlock className="w-3 h-3" />
                            Resolvido (Liberado ao Vendedor)
                          </span>
                        ) : dispute.status === "withdrawn" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-100 text-zinc-600 border border-zinc-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Problema retirado pelo {dispute.openedBy === "seller" ? "vendedor" : "comprador"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-[#0066FF] border border-blue-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Resolvido (Comprador Reembolsado)
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-sm sm:text-base text-zinc-950 mt-1 truncate">
                        {dispute.productTitle}
                      </h4>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Registrado em{" "}
                        {new Date(dispute.createdAt).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Valor da Venda em Bloqueio */}
                  <div className="text-left lg:text-right shrink-0">
                    <div className="text-xs text-zinc-500 font-semibold">
                      Valor da negociação
                    </div>
                    <div className="text-lg sm:text-xl font-black text-zinc-950">
                      {brl(dispute.price)}
                    </div>
                    {isOpen && (
                      <span className="text-[11px] font-bold text-rose-600">
                        🔒 Retido preventivamente
                      </span>
                    )}
                  </div>
                </div>

                {/* Detalhes: Comprador x Vendedor + Motivo do Relato */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-4 border-b border-zinc-100 text-xs">
                  {/* Comprador (Reclamante) */}
                  <div className="md:col-span-3 space-y-1 bg-zinc-50/70 p-3 rounded-2xl border border-zinc-100">
                    <div className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                      Comprador (Cliente)
                    </div>
                    <div className="font-bold text-zinc-900 truncate">
                      {dispute.buyerName}
                    </div>
                    {resolveBuyerEmail(dispute) ? (
                      <div className="text-zinc-500 truncate text-[11px]">
                        {resolveBuyerEmail(dispute)}
                      </div>
                    ) : dispute.buyerId ? (
                      <div className="text-zinc-500 truncate text-[11px]">
                        ID: {dispute.buyerId}
                      </div>
                    ) : null}
                  </div>

                  {/* Vendedor */}
                  <div className="md:col-span-3 space-y-1 bg-zinc-50/70 p-3 rounded-2xl border border-zinc-100">
                    <div className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                      Vendedor
                    </div>
                    <div className="font-bold text-zinc-900 truncate">
                      {dispute.sellerName}
                    </div>
                    {resolveSellerEmail(dispute) ? (
                      <div className="text-zinc-500 truncate text-[11px]">
                        {resolveSellerEmail(dispute)}
                      </div>
                    ) : (
                      <div className="text-zinc-500 truncate text-[11px]">
                        ID: {dispute.sellerId}
                      </div>
                    )}
                  </div>

                  {/* Motivo do Problema Reportado */}
                  <div className="md:col-span-6 space-y-1 bg-rose-50/40 border border-rose-100 p-3 rounded-2xl">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-rose-800 tracking-wider">
                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                      <span>Problema Relatado pelo Comprador:</span>
                    </div>
                    <p className="text-xs text-zinc-800 font-medium leading-relaxed italic">
                      "{dispute.reason}"
                    </p>
                  </div>
                </div>

                {/* Parecer se já resolvido */}
                {!isOpen && dispute.resolutionNotes && (
                  <div className="mt-3 p-3 rounded-2xl bg-emerald-50/50 border border-emerald-200 text-xs">
                    <span className="font-bold text-emerald-900">
                      Parecer da Moderação ({dispute.resolvedBy}):
                    </span>{" "}
                    <span className="text-zinc-700">{dispute.resolutionNotes}</span>
                  </div>
                )}

                {/* Barra de Ações do Administrador / Moderador */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
                  {/* Botão para entrar no Chat */}
                  <button
                    type="button"
                    onClick={() => {
                      const target =
                        dispute.orderCode && dispute.orderCode !== "00000" && dispute.orderCode !== "0"
                          ? dispute.orderCode
                          : dispute.chatId || dispute.id;
                      onOpenChat(target);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4 text-amber-400" />
                    <span>Entrar no Chat como {roleLabel}</span>
                  </button>

                  {/* Ações de Resolução de Saldo (se estiver aberto) */}
                  {isOpen && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmModal({
                            dispute,
                            decision: "release_seller",
                          })
                        }
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Liberar Saldo ao Vendedor</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setConfirmModal({
                            dispute,
                            decision: "refund_buyer",
                          })
                        }
                        className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Reembolsar Comprador</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Confirmação de Resolução */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-zinc-200 animate-scaleUp space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 ${
                  confirmModal.decision === "release_seller"
                    ? "bg-emerald-600"
                    : "bg-rose-600"
                }`}
              >
                {confirmModal.decision === "release_seller" ? (
                  <Unlock className="w-6 h-6" />
                ) : (
                  <DollarSign className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="text-base font-black text-zinc-950">
                  {confirmModal.decision === "release_seller"
                    ? "Liberar Saldo ao Vendedor"
                    : "Aprovar Reembolso ao Comprador"}
                </h3>
                <p className="text-xs text-zinc-500">
                  Pedido #{confirmModal.dispute.orderCode} • Valor:{" "}
                  {brl(confirmModal.dispute.price)}
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed font-medium">
              {confirmModal.decision === "release_seller"
                ? `Você está prestes a desmarcar o bloqueio e liberar o saldo de ${brl(
                    confirmModal.dispute.price
                  )} para o vendedor ${confirmModal.dispute.sellerName}. Uma mensagem oficial será registrada no chat.`
                : `Você está prestes a estornar ${brl(
                    confirmModal.dispute.price
                  )} de volta para o comprador ${confirmModal.dispute.buyerName}. O vendedor não receberá o valor.`}
            </p>

            <div>
              <label className="block text-[11px] font-bold text-zinc-700 uppercase mb-1">
                Parecer / Observação da Moderação (opcional):
              </label>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Ex.: Comprador confirmou que o acesso foi regularizado pelo suporte..."
                rows={3}
                className="w-full p-3 rounded-xl border border-zinc-200 text-xs text-zinc-900 focus:outline-none focus:border-[#0066FF]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmModal(null);
                  setActionNotes("");
                }}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 text-zinc-700 font-bold text-xs hover:bg-zinc-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDecision}
                disabled={!!resolvingId}
                className={`px-5 py-2.5 rounded-xl text-white font-bold text-xs cursor-pointer shadow-sm active:scale-95 transition-all ${
                  confirmModal.decision === "release_seller"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {resolvingId ? "Processando..." : "Confirmar e Aplicar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
