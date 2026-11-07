"use client";

import React, { useState, useEffect, useMemo } from "react";
import { UserProfile } from "@/types";
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ShieldCheck,
  QrCode,
  X,
  Sparkles,
  RefreshCw,
  Zap,
} from "lucide-react";
import confetti from "canvas-confetti";
import {
  getWalletTransactions,
  getWalletStats,
  requestWithdrawal,
  addWalletDeposit,
  WalletTransaction,
} from "@/lib/walletStore";

interface WalletViewProps {
  currentUser: UserProfile;
  onUpdateUser?: (updated: UserProfile) => void;
}

export function WalletView({ currentUser, onUpdateUser }: WalletViewProps) {
  const [balance, setBalance] = useState<number>(Number(currentUser?.balance) || 0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [filter, setFilter] = useState<"all" | "in" | "out">("all");

  const isSeller =
    currentUser?.role === "seller" ||
    currentUser?.role === "admin" ||
    currentUser?.verificationStatus === "approved" ||
    (currentUser as any)?.is_verified === true;

  // Modal de Saque (Exclusivo para Vendedores)
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [pixKeyType, setPixKeyType] = useState<"cpf" | "cnpj" | "email" | "phone" | "random">("cpf");
  const [pixKey, setPixKey] = useState("");
  const [pixHolder, setPixHolder] = useState(currentUser?.name || "");
  const [withdrawError, setWithdrawError] = useState("");
  const [withdrawSuccess, setWithdrawSuccess] = useState("");
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);

  // Modal de Adicionar Saldo (Depósito)
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("25");
  const [isGeneratingDeposit, setIsGeneratingDeposit] = useState(false);
  const [depositPixCode, setDepositPixCode] = useState("");
  const [depositQrCodeUrl, setDepositQrCodeUrl] = useState("");
  const [depositIdentifier, setDepositIdentifier] = useState("");
  const [depositCopied, setDepositCopied] = useState(false);
  const [depositSuccess, setDepositSuccess] = useState(false);

  // Sincroniza saldo e transações
  const refreshWallet = () => {
    if (!currentUser?.id) return;
    setBalance(Number(currentUser.balance) || 0);
    setTransactions(getWalletTransactions(currentUser.id));
  };

  useEffect(() => {
    refreshWallet();
    const handleUpdate = () => refreshWallet();
    window.addEventListener("playcontas_wallet_updated", handleUpdate);
    window.addEventListener("central_auth_changed", handleUpdate);
    return () => {
      window.removeEventListener("playcontas_wallet_updated", handleUpdate);
      window.removeEventListener("central_auth_changed", handleUpdate);
    };
  }, [currentUser?.id, currentUser?.balance]);

  const stats = useMemo(() => {
    return getWalletStats(currentUser?.id || "", balance);
  }, [currentUser?.id, balance, transactions]);

  // Filtro de transações
  const filteredTxs = useMemo(() => {
    if (filter === "in") {
      return transactions.filter((t) => t.type === "sale" || t.type === "deposit");
    }
    if (filter === "out") {
      return transactions.filter((t) => t.type === "withdrawal" || t.type === "purchase");
    }
    return transactions;
  }, [transactions, filter]);

  // Envio de Solicitação de Saque (Bloqueado para compradores)
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSeller) {
      setWithdrawError("O saque via PIX está disponível apenas para vendedores cadastrados.");
      return;
    }

    setWithdrawError("");
    setWithdrawSuccess("");

    const numAmount = parseFloat(withdrawAmount.replace(",", "."));
    if (isNaN(numAmount) || numAmount <= 0) {
      setWithdrawError("Informe um valor válido para o saque.");
      return;
    }

    setIsSubmittingWithdraw(true);
    const res = await requestWithdrawal(currentUser, numAmount, pixKeyType, pixKey, pixHolder);
    setIsSubmittingWithdraw(false);

    if (res.success) {
      setWithdrawSuccess(res.message);
      if (res.newBalance !== undefined) {
        setBalance(res.newBalance);
        if (onUpdateUser) onUpdateUser({ ...currentUser, balance: res.newBalance });
      }
      try {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
      } catch {}
      setTimeout(() => {
        setIsWithdrawOpen(false);
        setWithdrawSuccess("");
        setWithdrawAmount("");
        setPixKey("");
      }, 2500);
    } else {
      setWithdrawError(res.message);
    }
  };

  // Gerar PIX de Depósito via SyncPay
  const handleGenerateDeposit = async () => {
    const numAmount = parseFloat(depositAmount.replace(",", "."));
    if (isNaN(numAmount) || numAmount < 5) {
      alert("O valor mínimo para recarga de carteira é de R$ 5,00.");
      return;
    }

    setIsGeneratingDeposit(true);
    try {
      const res = await fetch("/api/syncpay/cash-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: numAmount,
          buyer: {
            name: currentUser?.name || "Cliente PlayContas",
            email: currentUser?.email || "contato@playcontas.com.br",
            document: (currentUser as any)?.cpf || "00000000000",
          },
          description: `Recarga de Carteira PlayContas - R$ ${numAmount.toFixed(2)}`,
        }),
      });

      const data = await res.json();
      if (data.success && data.pix_code) {
        setDepositPixCode(data.pix_code);
        setDepositQrCodeUrl(
          data.qr_code_url ||
            `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
              data.pix_code
            )}`
        );
        setDepositIdentifier(data.identifier);
      }
    } catch {
      alert("Não foi possível gerar a recarga PIX no momento.");
    } finally {
      setIsGeneratingDeposit(false);
    }
  };

  // Polling automático da aprovação do depósito
  useEffect(() => {
    if (!depositIdentifier || !isDepositOpen || depositSuccess) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/syncpay/check-status?identifier=${encodeURIComponent(depositIdentifier)}`);
        const data = await res.json();
        if (data.success && (data.status === "approved" || data.status === "paid" || data.status === "completed")) {
          clearInterval(interval);
          const numAmount = parseFloat(depositAmount.replace(",", "."));
          const depRes = await addWalletDeposit(currentUser, numAmount, depositIdentifier);
          if (depRes.success) {
            setDepositSuccess(true);
            setBalance(depRes.newBalance);
            if (onUpdateUser) onUpdateUser({ ...currentUser, balance: depRes.newBalance });
            try {
              confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            } catch {}
            setTimeout(() => {
              setIsDepositOpen(false);
              setDepositSuccess(false);
              setDepositPixCode("");
              setDepositIdentifier("");
            }, 3000);
          }
        }
      } catch {}
    }, 2500);
    return () => clearInterval(interval);
  }, [depositIdentifier, isDepositOpen, depositSuccess, depositAmount, currentUser, onUpdateUser]);

  return (
    <div className="space-y-6 animate-fadeIn select-none">
      {/* 1. Header com Título e Botões Condicionais */}
      <div className="bg-white border border-zinc-200/90 rounded-3xl p-6 sm:p-7 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0066FF] flex items-center justify-center shrink-0 shadow-2xs border border-blue-100">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight flex items-center gap-2">
              <span>{isSeller ? "Carteira & Saques" : "Minha Carteira"}</span>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Instantâneo
              </span>
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {isSeller
                ? "Gerencie seus rendimentos de vendas, saldo disponível e solicite saques via PIX."
                : "Adicione saldo para pagar suas compras com 1 clique ou utilize seu saldo em novos pedidos."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Botão de Adicionar Saldo sempre visível para todos */}
          <button
            type="button"
            onClick={() => {
              setDepositPixCode("");
              setDepositSuccess(false);
              setIsDepositOpen(true);
            }}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95 ${
              isSeller
                ? "bg-zinc-100 hover:bg-zinc-200 text-zinc-800"
                : "bg-[#0066FF] hover:bg-[#0052CC] text-white shadow-md shadow-blue-500/20"
            }`}
          >
            <Plus className={`w-4 h-4 ${isSeller ? "text-[#0066FF]" : "text-white"}`} />
            <span>Adicionar Saldo</span>
          </button>

          {/* Botão de Saque exclusivo para Vendedores */}
          {isSeller && (
            <button
              type="button"
              onClick={() => {
                setWithdrawError("");
                setWithdrawSuccess("");
                setIsWithdrawOpen(true);
              }}
              className="px-5 py-2.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>Solicitar Saque (PIX Flash)</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Três Cards de Saldo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Card 1: Saldo Disponível (Comum a todos) */}
        <div className="bg-white border-2 border-[#0066FF] rounded-3xl p-6 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              Saldo Disponível
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="mt-3">
            <div className="text-3xl sm:text-4xl font-black text-[#0066FF] tracking-tight">
              R$ {balance.toFixed(2).replace(".", ",")}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1 font-medium">
              {isSeller
                ? "Livre para saque via PIX ou para compras no catálogo"
                : "Disponível para compras instantâneas com 1 clique"}
            </p>
          </div>
        </div>

        {isSeller ? (
          <>
            {/* Card 2 (Vendedor): Saldo a Liberar */}
            <div className="bg-white border border-zinc-200/90 rounded-3xl p-6 shadow-2xs">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  Saldo em Custódia
                </span>
                <Clock className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="mt-3">
                <div className="text-3xl sm:text-4xl font-black text-zinc-800 tracking-tight">
                  R$ {stats.pendingCustody.toFixed(2).replace(".", ",")}
                </div>
                <p className="text-[11px] text-zinc-500 mt-1 font-medium">
                  Vendas recentes aguardando o fim da garantia do anúncio
                </p>
              </div>
            </div>

            {/* Card 3 (Vendedor): Total Já Sacado */}
            <div className="bg-white border border-zinc-200/90 rounded-3xl p-6 shadow-2xs">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  Total Já Sacado
                </span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="mt-3">
                <div className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tight">
                  R$ {stats.totalWithdrawn.toFixed(2).replace(".", ",")}
                </div>
                <p className="text-[11px] text-zinc-500 mt-1 font-medium">
                  Transferências enviadas com sucesso para sua conta
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Card 2 (Cliente): Compras Rápidas com Saldo */}
            <div className="bg-white border border-zinc-200/90 rounded-3xl p-6 shadow-2xs">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  Pagamento com Saldo
                </span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="mt-3">
                <div className="text-3xl sm:text-4xl font-black text-zinc-800 tracking-tight">
                  1 Clique
                </div>
                <p className="text-[11px] text-zinc-500 mt-1 font-medium">
                  Finalize suas compras no checkout sem precisar gerar novo PIX
                </p>
              </div>
            </div>

            {/* Card 3 (Cliente): Torne-se Vendedor */}
            <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 border border-blue-200/80 rounded-3xl p-6 shadow-2xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#0066FF] uppercase tracking-wider block">
                  Quer Vender no PlayContas?
                </span>
                <h4 className="font-black text-sm text-zinc-950 mt-1">
                  Ative os saques via PIX
                </h4>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Verifique sua identidade para publicar anúncios e sacar rendimentos de vendas.
                </p>
              </div>
              <a
                href="/minha-conta?tab=verificacao"
                className="mt-3 inline-block text-xs font-bold text-[#0066FF] hover:underline"
              >
                Verificar Identidade →
              </a>
            </div>
          </>
        )}
      </div>

      {/* 3. Informativo das Regras da Carteira */}
      <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-start gap-3 text-xs text-zinc-600">
        <ShieldCheck className="w-5 h-5 text-[#0066FF] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-zinc-900">
            {isSeller
              ? "Informações sobre Saques e Pagamentos aos Vendedores:"
              : "Como funciona a sua Carteira PlayContas:"}
          </p>
          {isSeller ? (
            <p className="leading-relaxed">
              • <strong>Saque Mínimo:</strong> R$ 20,00 via PIX Flash (conforme a política oficial de repasses).
              <br />
              • <strong>Taxa de Saque:</strong> R$ 5,00 por saque (PIX Flash expresso).
              <br />
              • <strong>PIX Flash Instantâneo:</strong> Transferência rápida creditada diretamente na sua chave cadastrada.
              <br />
              • <strong>Liberação Automática:</strong> O valor da venda entra direto no seu saldo após o período de garantia.
            </p>
          ) : (
            <p className="leading-relaxed">
              • <strong>Pagamento com 1 Clique:</strong> Adicione saldo via PIX e utilize na finalização de qualquer pedido no site sem espera.
              <br />
              • <strong>Segurança em Custódia:</strong> Seus pedidos são protegidos pelo sistema de escrow da PlayContas até a entrega da conta.
              <br />
              • <strong>Saques via PIX:</strong> Disponíveis exclusivamente para contas de vendedores verificados.
            </p>
          )}
        </div>
      </div>

      {/* 4. Histórico de Movimentações */}
      <div className="bg-white border border-zinc-200/90 rounded-3xl p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
          <div>
            <h2 className="text-base font-black text-zinc-950">Extrato & Movimentações</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Histórico completo de depósitos, vendas e saques.</p>
          </div>

          <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filter === "all" ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setFilter("in")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filter === "in" ? "bg-white text-emerald-700 shadow-2xs" : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Entradas
            </button>
            <button
              type="button"
              onClick={() => setFilter("out")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filter === "out" ? "bg-white text-blue-700 shadow-2xs" : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {isSeller ? "Saídas / Saques" : "Compras Realizadas"}
            </button>
          </div>
        </div>

        {filteredTxs.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Wallet className="w-10 h-10 mx-auto text-zinc-300 stroke-[1.5]" />
            <p className="font-bold text-sm text-zinc-800">Nenhuma movimentação registrada</p>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Quando você realizar recargas, vendas ou solicitar saques, as transações aparecerão listadas aqui.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {filteredTxs.map((tx) => {
              const isPositive = tx.type === "sale" || tx.type === "deposit";
              return (
                <div key={tx.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isPositive ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-[#0066FF]"
                      }`}
                    >
                      {isPositive ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-zinc-900 truncate">{tx.description}</h4>
                      <span className="text-[11px] text-zinc-400">
                        {new Date(tx.createdAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`font-black text-sm block ${
                        isPositive ? "text-emerald-600" : "text-zinc-900"
                      }`}
                    >
                      {isPositive ? "+" : "-"} R$ {tx.amount.toFixed(2).replace(".", ",")}
                    </span>
                    {tx.type === "withdrawal" && (
                      <span className="text-[10px] text-zinc-500 block font-medium">
                        Líquido: R$ {(tx.netAmount ?? Math.max(0, tx.amount - 5)).toFixed(2).replace(".", ",")} (Taxa: R$ 5,00)
                      </span>
                    )}
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.2 rounded-full inline-block mt-0.5">
                      {tx.status === "completed"
                        ? "Concluído"
                        : tx.status === "processing"
                        ? "Em Processamento (Flash)"
                        : "Pendente"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
          MODAL: SOLICITAR SAQUE VIA PIX (EXCLUSIVO PARA VENDEDORES)
         ========================================================================= */}
      {isWithdrawOpen && isSeller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl max-w-md w-full p-6 sm:p-7 space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-150">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                  <Zap className="w-4 h-4 fill-amber-500 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-black text-base text-zinc-950 flex items-center gap-1.5">
                    <span>Solicitar Saque (PIX Flash)</span>
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-medium">Transferência expressa • Taxa fixa de R$ 5,00</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWithdrawOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {withdrawSuccess ? (
              <div className="py-6 text-center space-y-3 animate-fadeIn">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="font-black text-lg text-zinc-950">Saque Solicitado!</h4>
                <p className="text-xs text-zinc-600 leading-relaxed max-w-xs mx-auto">
                  {withdrawSuccess}
                </p>
              </div>
            ) : (
              <form onSubmit={handleWithdrawSubmit} className="space-y-4">
                {/* Saldo disponível e valor */}
                <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                      Saldo Disponível
                    </span>
                    <span className="text-lg font-black text-zinc-950">
                      R$ {balance.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWithdrawAmount(balance.toFixed(2))}
                    className="text-xs font-bold text-[#0066FF] hover:underline cursor-pointer"
                  >
                    Sacar tudo
                  </button>
                </div>

                {/* Valor a sacar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider">
                      Valor do Saque (R$) *
                    </label>
                    <span className="text-[10px] font-bold text-zinc-400">Mínimo R$ 20,00</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-xs font-bold text-zinc-400">R$</span>
                    <input
                      type="text"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0,00"
                      className="w-full bg-white border border-zinc-200 focus:border-[#0066FF] rounded-xl pl-9 pr-3.5 py-2.5 text-sm font-bold text-zinc-900 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Prévia do Saque e Taxa de R$ 5,00 */}
                {(() => {
                  const numVal = parseFloat(withdrawAmount.replace(",", ".")) || 0;
                  const fee = 5.0;
                  const net = Math.max(0, numVal - fee);
                  return numVal > 0 ? (
                    <div className="p-3 bg-zinc-50 border border-zinc-200/90 rounded-xl space-y-1.5 text-xs animate-fadeIn">
                      <div className="flex justify-between text-zinc-600">
                        <span>Valor Solicitado:</span>
                        <span className="font-semibold text-zinc-800">
                          R$ {numVal.toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                      <div className="flex justify-between text-zinc-600">
                        <span className="flex items-center gap-1 font-medium text-amber-700">
                          <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                          Taxa PIX Flash:
                        </span>
                        <span className="font-semibold text-rose-600 font-mono">
                          - R$ 5,00
                        </span>
                      </div>
                      <div className="pt-1.5 border-t border-zinc-200 flex justify-between items-center">
                        <span className="font-bold text-zinc-900">Líquido a Receber no PIX:</span>
                        <span className="font-black text-sm text-emerald-600 font-mono">
                          R$ {net.toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400 text-right pt-0.5">
                        ⚡ Transferência expressa imediata para o titular da conta
                      </p>
                    </div>
                  ) : null;
                })()}

                {/* Tipo de Chave PIX */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider block">
                    Tipo de Chave PIX *
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                    {[
                      { id: "cpf", label: "CPF" },
                      { id: "cnpj", label: "CNPJ" },
                      { id: "email", label: "E-mail" },
                      { id: "phone", label: "Telefone" },
                      { id: "random", label: "Aleatória" },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setPixKeyType(t.id as any)}
                        className={`py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          pixKeyType === t.id
                            ? "bg-[#0066FF] text-white border-[#0066FF] shadow-xs"
                            : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chave PIX */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider block">
                    Chave PIX de Destino *
                  </label>
                  <input
                    type="text"
                    value={pixKey}
                    onChange={(e) => setPixKey(e.target.value)}
                    placeholder={
                      pixKeyType === "cpf"
                        ? "000.000.000-00"
                        : pixKeyType === "cnpj"
                        ? "00.000.000/0001-00"
                        : pixKeyType === "email"
                        ? "seu.email@exemplo.com"
                        : pixKeyType === "phone"
                        ? "(11) 99999-9999"
                        : "Chave aleatória EVP"
                    }
                    className="w-full bg-white border border-zinc-200 focus:border-[#0066FF] rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 focus:outline-none transition-all font-mono"
                  />
                </div>

                {/* Nome do Titular */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider block">
                    Nome Completo do Titular *
                  </label>
                  <input
                    type="text"
                    value={pixHolder}
                    onChange={(e) => setPixHolder(e.target.value)}
                    placeholder="Nome conforme documento bancário"
                    className="w-full bg-white border border-zinc-200 focus:border-[#0066FF] rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 focus:outline-none transition-all"
                  />
                </div>

                {withdrawError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{withdrawError}</span>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={
                      isSubmittingWithdraw ||
                      balance < 20 ||
                      (parseFloat(withdrawAmount.replace(",", ".")) || 0) < 20
                    }
                    className="w-full py-3.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-black text-xs uppercase tracking-wider shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmittingWithdraw ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Processando solicitação...</span>
                      </div>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 fill-white" />
                        <span>
                          {(parseFloat(withdrawAmount.replace(",", ".")) || 0) >= 20
                            ? `Confirmar PIX Flash (Receber R$ ${Math.max(
                                0,
                                (parseFloat(withdrawAmount.replace(",", ".")) || 0) - 5
                              )
                                .toFixed(2)
                                .replace(".", ",")})`
                            : "Confirmar Saque via PIX Flash"}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: ADICIONAR SALDO (DEPÓSITO VIA PIX SYNCPAY)
         ========================================================================= */}
      {isDepositOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl max-w-md w-full p-6 sm:p-7 space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-150">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="font-black text-base text-zinc-950">Adicionar Saldo à Carteira</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDepositOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {depositSuccess ? (
              <div className="py-6 text-center space-y-3 animate-fadeIn">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="font-black text-lg text-zinc-950">Recarga Aprovada!</h4>
                <p className="text-xs text-zinc-600 leading-relaxed max-w-xs mx-auto">
                  O saldo de R$ {depositAmount} foi adicionado à sua carteira com sucesso.
                </p>
              </div>
            ) : depositPixCode ? (
              /* QR Code e Copia e Cola gerado */
              <div className="space-y-4 text-center animate-fadeIn">
                <div className="p-4 bg-white border-2 border-zinc-200 rounded-2xl w-48 h-48 mx-auto flex items-center justify-center">
                  <img
                    src={depositQrCodeUrl}
                    alt="QR Code PIX Depósito"
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-500">
                  <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                  <span>Aguardando pagamento... Aprovação automática</span>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider block">
                    PIX Copia e Cola
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={depositPixCode}
                      className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-mono text-zinc-800 select-all focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(depositPixCode);
                        setDepositCopied(true);
                        setTimeout(() => setDepositCopied(false), 2000);
                      }}
                      className="px-4 py-2 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs flex items-center gap-1 transition-all shrink-0 cursor-pointer"
                    >
                      {depositCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{depositCopied ? "Copiado!" : "Copiar"}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Formulário de Escolha de Valor */
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider block">
                    Escolha um valor ou digite abaixo:
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {["10", "25", "50", "100"].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setDepositAmount(v)}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          depositAmount === v
                            ? "bg-[#0066FF] text-white border-[#0066FF] shadow-xs"
                            : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                        }`}
                      >
                        R$ {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider block">
                    Valor Personalizado (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-xs font-bold text-zinc-400">R$</span>
                    <input
                      type="text"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="Ex: 35,00"
                      className="w-full bg-white border border-zinc-200 focus:border-[#0066FF] rounded-xl pl-9 pr-3.5 py-2.5 text-sm font-bold text-zinc-900 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleGenerateDeposit}
                    disabled={isGeneratingDeposit}
                    className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isGeneratingDeposit ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Gerando PIX SyncPay...</span>
                      </div>
                    ) : (
                      <>
                        <QrCode className="w-4 h-4" />
                        <span>Gerar PIX para Recarregar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
