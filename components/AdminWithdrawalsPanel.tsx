"use client";

import React, { useState, useEffect, useMemo } from "react";
import { UserProfile } from "@/types";
import {
  getAllAdminWithdrawals,
  approveAdminWithdrawal,
  rejectAdminWithdrawal,
  AdminWithdrawal,
} from "@/lib/walletStore";
import {
  Wallet,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Copy,
  Check,
  User,
  AlertTriangle,
  ArrowUpRight,
  ShieldCheck,
  DollarSign,
  RefreshCw,
} from "lucide-react";

interface AdminWithdrawalsPanelProps {
  currentUser: UserProfile;
}

export function AdminWithdrawalsPanel({ currentUser }: AdminWithdrawalsPanelProps) {
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([]);
  const [filter, setFilter] = useState<"all" | "processing" | "completed" | "cancelled">("all");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Modal de Recusa
  const [rejectingItem, setRejectingItem] = useState<AdminWithdrawal | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const loadData = () => {
    setWithdrawals(getAllAdminWithdrawals());
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener("playcontas_withdrawals_updated", handleUpdate);
    window.addEventListener("playcontas_wallet_updated", handleUpdate);
    return () => {
      window.removeEventListener("playcontas_withdrawals_updated", handleUpdate);
      window.removeEventListener("playcontas_wallet_updated", handleUpdate);
    };
  }, []);

  const handleCopyPixKey = (id: string, key: string) => {
    try {
      navigator.clipboard.writeText(key);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {}
  };

  const handleApprove = async (withdrawal: AdminWithdrawal) => {
    if (
      !confirm(
        `Confirmar a liberação do saque PIX Flash de R$ ${withdrawal.amount.toFixed(2)} para ${withdrawal.pixHolder}?`
      )
    ) {
      return;
    }

    setIsProcessing(withdrawal.id);
    const res = await approveAdminWithdrawal(withdrawal.id);
    setIsProcessing(null);

    if (res.success) {
      setActionMessage({ text: res.message, type: "success" });
      setTimeout(() => setActionMessage(null), 4000);
      loadData();
    } else {
      setActionMessage({ text: res.message, type: "error" });
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingItem) return;
    setIsProcessing(rejectingItem.id);
    const res = await rejectAdminWithdrawal(
      rejectingItem.id,
      rejectionReason.trim() || "Chave PIX inválida ou recusada pelo administrador."
    );
    setIsProcessing(null);
    setRejectingItem(null);
    setRejectionReason("");

    if (res.success) {
      setActionMessage({ text: res.message, type: "success" });
      setTimeout(() => setActionMessage(null), 4000);
      loadData();
    } else {
      setActionMessage({ text: res.message, type: "error" });
    }
  };

  // Métricas
  const stats = useMemo(() => {
    const pending = withdrawals.filter((w) => w.status === "processing");
    const completed = withdrawals.filter((w) => w.status === "completed");
    const cancelled = withdrawals.filter((w) => w.status === "cancelled");

    const pendingTotalNet = pending.reduce((sum, w) => sum + (w.netAmount ?? (w.amount - 5)), 0);
    const completedTotal = completed.reduce((sum, w) => sum + w.amount, 0);
    const totalFeesEarned = completed.reduce((sum, w) => sum + (w.fee || 5), 0);

    return {
      pendingCount: pending.length,
      pendingTotalNet,
      completedCount: completed.length,
      completedTotal,
      cancelledCount: cancelled.length,
      totalFeesEarned,
      totalCount: withdrawals.length,
    };
  }, [withdrawals]);

  // Filtro e Busca
  const filteredList = useMemo(() => {
    return withdrawals.filter((w) => {
      if (filter !== "all" && w.status !== filter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          w.userName.toLowerCase().includes(q) ||
          w.userEmail.toLowerCase().includes(q) ||
          w.pixHolder.toLowerCase().includes(q) ||
          w.pixKey.toLowerCase().includes(q) ||
          w.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [withdrawals, filter, search]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Header do Painel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-zinc-200/90 rounded-3xl p-6 sm:p-7 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-2xs">
              <Zap className="w-5 h-5 fill-amber-500 text-amber-500" />
            </div>
            <div>
              <h2 className="text-xl font-black text-zinc-950 tracking-tight flex items-center gap-2">
                <span>Gestão de Saques & PIX Flash</span>
                {stats.pendingCount > 0 && (
                  <span className="text-xs bg-amber-500 text-white font-bold px-2 py-0.5 rounded-full animate-pulse">
                    {stats.pendingCount} para liberar
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-500">
                Aprove solicitações de saque dos vendedores, copie a chave PIX e confirme os repasses expressos.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fadeIn shadow-2xs ${
            actionMessage.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-rose-50 border border-rose-200 text-rose-800"
          }`}
        >
          {actionMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* 2. Métricas Financeiras de Saque */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pendentes */}
        <div className="bg-white border-2 border-amber-400/90 rounded-3xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Aguardando Liberação
            </span>
            <span className="text-xs font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
              {stats.pendingCount}
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-zinc-950">
              R$ {stats.pendingTotalNet.toFixed(2).replace(".", ",")}
            </span>
            <span className="text-[11px] text-zinc-400 block mt-0.5">
              Valor líquido a ser transferido via PIX
            </span>
          </div>
        </div>

        {/* Card 2: Total Pago */}
        <div className="bg-white border border-zinc-200/90 rounded-3xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Total Já Pago
            </span>
            <span className="text-xs font-bold text-zinc-400">{stats.completedCount} saques</span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-600">
              R$ {stats.completedTotal.toFixed(2).replace(".", ",")}
            </span>
            <span className="text-[11px] text-zinc-400 block mt-0.5">
              Repasses concluídos aos vendedores
            </span>
          </div>
        </div>

        {/* Card 3: Lucro com Taxas de Saque (R$ 5 cada) */}
        <div className="bg-white border border-zinc-200/90 rounded-3xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              Taxas PIX Flash Ganhas
            </span>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">
              R$ 5,00/saque
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-zinc-950">
              R$ {stats.totalFeesEarned.toFixed(2).replace(".", ",")}
            </span>
            <span className="text-[11px] text-zinc-400 block mt-0.5">
              Lucro retido pela taxa de processamento
            </span>
          </div>
        </div>

        {/* Card 4: Total de Solicitações */}
        <div className="bg-white border border-zinc-200/90 rounded-3xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5 text-blue-600" />
              Total de Solicitações
            </span>
            <span className="text-xs font-bold text-zinc-400">{stats.totalCount} no total</span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-zinc-950">{stats.totalCount}</span>
            <span className="text-[11px] text-zinc-400 block mt-0.5">
              {stats.cancelledCount > 0 ? `${stats.cancelledCount} estornado(s)` : "Histórico completo"}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Filtros e Busca */}
      <div className="bg-white border border-zinc-200/90 rounded-3xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-2xl w-full sm:w-auto overflow-x-auto">
          {[
            { id: "all", label: "Todos", count: stats.totalCount },
            { id: "processing", label: "Pendentes", count: stats.pendingCount },
            { id: "completed", label: "Concluídos", count: stats.completedCount },
            { id: "cancelled", label: "Recusados", count: stats.cancelledCount },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                filter === tab.id
                  ? "bg-white text-zinc-950 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-950"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  filter === tab.id ? "bg-zinc-100 text-zinc-800" : "bg-zinc-200/70 text-zinc-600"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por vendedor, e-mail ou chave PIX..."
            className="w-full bg-zinc-50 border border-zinc-200 focus:border-[#0066FF] rounded-xl pl-9 pr-3.5 py-2 text-xs text-zinc-900 focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* 4. Lista de Solicitações */}
      {filteredList.length === 0 ? (
        <div className="bg-white border border-zinc-200/90 rounded-3xl p-12 text-center space-y-3 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto">
            <Wallet className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-base text-zinc-900">Nenhuma solicitação de saque encontrada</h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            {search
              ? "Nenhum resultado corresponde à sua pesquisa."
              : "Assim que um vendedor solicitar um saque via PIX Flash na carteira, a solicitação aparecerá aqui para você conferir os dados e liberar o pagamento."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredList.map((item) => {
            const isPending = item.status === "processing";
            const isCompleted = item.status === "completed";
            const isCancelled = item.status === "cancelled";
            const isCopied = copiedId === item.id;
            const netVal = item.netAmount ?? Math.max(0, item.amount - 5);

            return (
              <div
                key={item.id}
                className={`bg-white border rounded-3xl p-6 shadow-xs transition-all space-y-5 ${
                  isPending
                    ? "border-amber-300 ring-2 ring-amber-400/20"
                    : isCompleted
                    ? "border-zinc-200"
                    : "border-zinc-200 bg-zinc-50/60"
                }`}
              >
                {/* Topo do Card: Vendedor e Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-[#0066FF]/10 text-[#0066FF] font-black text-sm flex items-center justify-center border border-blue-200">
                      {item.userName ? item.userName.charAt(0).toUpperCase() : "V"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-sm text-zinc-950">{item.userName}</h4>
                        <span className="text-[10px] bg-zinc-100 text-zinc-600 font-bold px-2 py-0.5 rounded-full">
                          Vendedor
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 font-mono">{item.userEmail || "Sem e-mail"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-400 font-medium">
                      {new Date(item.createdAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span
                      className={`text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5 ${
                        isPending
                          ? "bg-amber-100 text-amber-800 border border-amber-200 animate-pulse"
                          : isCompleted
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-rose-50 text-rose-700 border border-rose-200"
                      }`}
                    >
                      {isPending ? (
                        <>
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>Aguardando Liberação</span>
                        </>
                      ) : isCompleted ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Concluído / Pago</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 text-rose-600" />
                          <span>Recusado (Estornado)</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Meio: Valores Financeiros e Chave PIX */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                  {/* Valores (5 cols) */}
                  <div className="lg:col-span-5 bg-zinc-50 border border-zinc-200/90 rounded-2xl p-4 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-500">Valor Solicitado (Bruto):</span>
                      <span className="font-bold text-zinc-800">
                        R$ {item.amount.toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-500 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                        Taxa PIX Flash (Plataforma):
                      </span>
                      <span className="font-bold text-rose-600">
                        - R$ {(item.fee || 5).toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-zinc-200 flex justify-between items-center">
                      <span className="font-bold text-zinc-900 text-xs">
                        Valor Líquido a Enviar via PIX:
                      </span>
                      <span className="font-black text-base text-emerald-600 font-mono">
                        R$ {netVal.toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                  </div>

                  {/* Dados PIX (7 cols) */}
                  <div className="lg:col-span-7 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">
                        Titular: <strong>{item.pixHolder}</strong>
                      </span>
                      <span className="text-[10px] font-bold uppercase bg-blue-50 text-[#0066FF] border border-blue-200 px-2 py-0.5 rounded-md">
                        Chave {item.pixKeyType?.toUpperCase() || "PIX"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={item.pixKey}
                        className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 font-mono select-all focus:outline-none font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyPixKey(item.id, item.pixKey)}
                        className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-2xs ${
                          isCopied
                            ? "bg-emerald-600 text-white"
                            : "bg-[#0066FF] hover:bg-[#0052CC] text-white"
                        }`}
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar Chave PIX</span>
                          </>
                        )}
                      </button>
                    </div>

                    {item.rejectionReason && (
                      <p className="text-xs text-rose-600 font-medium pt-1">
                        Motivo da recusa: {item.rejectionReason}
                      </p>
                    )}
                  </div>
                </div>

                {/* Rodapé de Ações (Apenas quando pendente) */}
                {isPending && (
                  <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-3 border-t border-zinc-100">
                    <button
                      type="button"
                      disabled={isProcessing === item.id}
                      onClick={() => {
                        setRejectingItem(item);
                        setRejectionReason("");
                      }}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4 text-rose-600" />
                      <span>Recusar e Devolver Saldo</span>
                    </button>

                    <button
                      type="button"
                      disabled={isProcessing === item.id}
                      onClick={() => handleApprove(item)}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isProcessing === item.id ? (
                        <div className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Processando...</span>
                        </div>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Liberar PIX Flash (R$ {netVal.toFixed(2).replace(".", ",")})</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Recusar Saque e Devolver Saldo */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-150">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <XCircle className="w-4 h-4" />
                </div>
                <h3 className="font-black text-base text-zinc-950">Recusar Solicitação de Saque</h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-600 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed">
              O valor total de{" "}
              <strong className="text-zinc-950">
                R$ {rejectingItem.amount.toFixed(2).replace(".", ",")}
              </strong>{" "}
              será estornado imediatamente para o saldo da carteira de{" "}
              <strong>{rejectingItem.userName}</strong>.
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider block">
                Motivo da Recusa (para o vendedor)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ex: Chave PIX informada não confere com o titular cadastrado..."
                rows={3}
                className="w-full bg-zinc-50 border border-zinc-200 focus:border-rose-500 rounded-xl p-3 text-xs text-zinc-900 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 text-zinc-700 font-bold text-xs hover:bg-zinc-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isProcessing === rejectingItem.id}
                onClick={handleConfirmReject}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 cursor-pointer transition-all"
              >
                Confirmar Recusa e Devolver Saldo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
