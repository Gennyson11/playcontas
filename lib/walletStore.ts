import { UserProfile } from "@/types";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { getStoredUserSync, saveStoredUser } from "./authStore";

export type WalletTxType = "sale" | "deposit" | "withdrawal" | "purchase";
export type WalletTxStatus = "completed" | "pending" | "processing" | "cancelled";

export interface WalletTransaction {
  id: string;
  userId: string;
  type: WalletTxType;
  amount: number;
  fee?: number;
  netAmount?: number;
  description: string;
  status: WalletTxStatus;
  pixKeyType?: "cpf" | "cnpj" | "email" | "phone" | "random";
  pixKey?: string;
  pixHolder?: string;
  createdAt: string;
}

export interface AdminWithdrawal {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  fee: number;
  netAmount: number;
  pixKeyType: "cpf" | "cnpj" | "email" | "phone" | "random";
  pixKey: string;
  pixHolder: string;
  status: "processing" | "completed" | "cancelled";
  createdAt: string;
  processedAt?: string;
  rejectionReason?: string;
}

const WALLET_TX_PREFIX = "playcontas_wallet_tx_";
const ALL_WITHDRAWALS_KEY = "playcontas_all_withdrawals";
export const WITHDRAWAL_MIN_AMOUNT = 20.0;
export const WITHDRAWAL_FEE = 5.0; // Taxa de saque fixa de R$ 5,00 (PIX Flash)

/** Retorna todas as solicitações de saque globais para o Painel Admin */
export function getAllAdminWithdrawals(): AdminWithdrawal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ALL_WITHDRAWALS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
    }
  } catch {}
  return [];
}

/** Salva lista global de saques */
export function saveAdminWithdrawals(list: AdminWithdrawal[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ALL_WITHDRAWALS_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event("playcontas_withdrawals_updated"));
  } catch {}
}

/** Registra uma nova solicitação de saque na fila global do admin */
export function saveAdminWithdrawal(withdrawal: AdminWithdrawal): void {
  const current = getAllAdminWithdrawals();
  const filtered = current.filter((w) => w.id !== withdrawal.id);
  saveAdminWithdrawals([withdrawal, ...filtered]);
}

/** Aprova um saque no painel Admin e marca como concluído */
export async function approveAdminWithdrawal(
  withdrawalId: string
): Promise<{ success: boolean; message: string }> {
  const list = getAllAdminWithdrawals();
  const index = list.findIndex((w) => w.id === withdrawalId);
  if (index === -1) {
    return { success: false, message: "Solicitação de saque não encontrada." };
  }

  const withdrawal = list[index];
  withdrawal.status = "completed";
  withdrawal.processedAt = new Date().toISOString();
  list[index] = withdrawal;
  saveAdminWithdrawals(list);

  // Atualiza também na lista individual do usuário
  const userTxs = getWalletTransactions(withdrawal.userId);
  const txIdx = userTxs.findIndex((t) => t.id === withdrawal.id);
  if (txIdx !== -1) {
    userTxs[txIdx].status = "completed";
    saveWalletTransactions(withdrawal.userId, userTxs);
  }

  window.dispatchEvent(new Event("playcontas_wallet_updated"));
  return {
    success: true,
    message: `Saque de R$ ${withdrawal.amount.toFixed(2).replace(".", ",")} aprovado e marcado como concluído!`,
  };
}

/** Rejeita um saque no painel Admin e devolve o saldo ao vendedor */
export async function rejectAdminWithdrawal(
  withdrawalId: string,
  reason?: string
): Promise<{ success: boolean; message: string }> {
  const list = getAllAdminWithdrawals();
  const index = list.findIndex((w) => w.id === withdrawalId);
  if (index === -1) {
    return { success: false, message: "Solicitação de saque não encontrada." };
  }

  const withdrawal = list[index];
  withdrawal.status = "cancelled";
  withdrawal.rejectionReason = reason || "Chave PIX inválida ou recusada.";
  withdrawal.processedAt = new Date().toISOString();
  list[index] = withdrawal;
  saveAdminWithdrawals(list);

  // Devolve o saldo para o usuário
  const storedUser = getStoredUserSync();
  if (storedUser && storedUser.id === withdrawal.userId) {
    const refundedBalance = (Number(storedUser.balance) || 0) + withdrawal.amount;
    saveStoredUser({ ...storedUser, balance: refundedBalance });
  }

  // Devolve no Supabase caso configurado
  if (isSupabaseConfigured && withdrawal.userEmail) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("balance")
        .ilike("email", withdrawal.userEmail)
        .maybeSingle();

      const newBal = (Number(profile?.balance) || 0) + withdrawal.amount;
      await supabase
        .from("profiles")
        .update({ balance: newBal })
        .ilike("email", withdrawal.userEmail);

      await supabase.from("balance_transactions").insert({
        user_id: withdrawal.userId,
        amount: withdrawal.amount,
        kind: "credit",
        note: `Estorno de saque recusado (${reason || "Dados PIX incorretos"})`,
        balance_after: newBal,
      });
    } catch {}
  }

  // Atualiza na lista de transações do usuário
  const userTxs = getWalletTransactions(withdrawal.userId);
  const txIdx = userTxs.findIndex((t) => t.id === withdrawal.id);
  if (txIdx !== -1) {
    userTxs[txIdx].status = "cancelled";
    userTxs[txIdx].description = `${userTxs[txIdx].description} (Recusado: ${reason || "Estornado"})`;
    saveWalletTransactions(withdrawal.userId, userTxs);
  }

  window.dispatchEvent(new Event("central_auth_changed"));
  window.dispatchEvent(new Event("playcontas_wallet_updated"));

  return {
    success: true,
    message: `Saque recusado. O valor de R$ ${withdrawal.amount.toFixed(2).replace(".", ",")} foi estornado para o saldo do vendedor.`,
  };
}

/** Retorna a lista de transações da carteira do usuário (localStorage + sincronização) */
export function getWalletTransactions(userId: string): WalletTransaction[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = localStorage.getItem(`${WALLET_TX_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
    }
  } catch {}
  return [];
}

/** Salva transações da carteira no LocalStorage e dispara evento */
export function saveWalletTransactions(userId: string, txs: WalletTransaction[]): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(`${WALLET_TX_PREFIX}${userId}`, JSON.stringify(txs));
    window.dispatchEvent(new Event("playcontas_wallet_updated"));
  } catch {}
}

/** Retorna métricas da carteira: saldo disponível, em custódia/garantia e total já sacado */
export function getWalletStats(
  userId: string,
  currentBalance: number = 0
): {
  available: number;
  pendingCustody: number;
  totalWithdrawn: number;
} {
  const txs = getWalletTransactions(userId);
  let totalWithdrawn = 0;
  let pendingCustody = 0;

  txs.forEach((tx) => {
    if (tx.type === "withdrawal" && (tx.status === "completed" || tx.status === "processing")) {
      totalWithdrawn += tx.amount;
    }
    if (tx.type === "sale" && tx.status === "pending") {
      pendingCustody += tx.amount;
    }
  });

  return {
    available: Math.max(0, currentBalance),
    pendingCustody,
    totalWithdrawn,
  };
}

/** Solicita um saque via PIX para o vendedor */
export async function requestWithdrawal(
  user: UserProfile,
  amount: number,
  pixKeyType: "cpf" | "cnpj" | "email" | "phone" | "random",
  pixKey: string,
  pixHolder: string
): Promise<{ success: boolean; message: string; newBalance?: number }> {
  if (!user || !user.id) {
    return { success: false, message: "Você precisa estar logado para solicitar um saque." };
  }

  const isSeller =
    user.role === "seller" ||
    user.role === "admin" ||
    user.verificationStatus === "approved" ||
    (user as any)?.is_verified === true;

  if (!isSeller) {
    return {
      success: false,
      message: "A solicitação de saque via PIX é exclusiva para vendedores verificados. Para se tornar um vendedor, acesse Verificação de Identidade.",
    };
  }

  const currentBalance = Number(user.balance) || 0;

  if (amount < WITHDRAWAL_MIN_AMOUNT) {
    return {
      success: false,
      message: `O valor mínimo para solicitação de saque é de R$ ${WITHDRAWAL_MIN_AMOUNT.toFixed(2).replace(".", ",")}.`,
    };
  }

  if (amount > currentBalance) {
    return {
      success: false,
      message: `Saldo insuficiente. Seu saldo disponível é de R$ ${currentBalance.toFixed(2).replace(".", ",")}.`,
    };
  }

  if (!pixKey.trim()) {
    return { success: false, message: "Por favor, informe a sua chave PIX para recebimento." };
  }

  if (!pixHolder.trim()) {
    return { success: false, message: "Por favor, confirme o nome do titular da chave PIX." };
  }

  const newBalance = Math.max(0, currentBalance - amount);
  const netAmount = Math.max(0, amount - WITHDRAWAL_FEE);

  // 1. Cria a transação de saque com taxa de R$ 5,00 e envio PIX Flash
  const tx: WalletTransaction = {
    id: `saque-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId: user.id,
    type: "withdrawal",
    amount,
    fee: WITHDRAWAL_FEE,
    netAmount,
    description: `Saque PIX Flash (${pixKeyType.toUpperCase()}: ${pixKey})`,
    status: "processing",
    pixKeyType,
    pixKey: pixKey.trim(),
    pixHolder: pixHolder.trim(),
    createdAt: new Date().toISOString(),
  };

  const existingTxs = getWalletTransactions(user.id);
  saveWalletTransactions(user.id, [tx, ...existingTxs]);

  // Registra na fila global de saques para aprovação do Administrador no Painel
  const adminWithdrawal: AdminWithdrawal = {
    id: tx.id,
    userId: user.id,
    userName: user.name || "Vendedor",
    userEmail: user.email || "",
    amount,
    fee: WITHDRAWAL_FEE,
    netAmount,
    pixKeyType,
    pixKey: pixKey.trim(),
    pixHolder: pixHolder.trim(),
    status: "processing",
    createdAt: tx.createdAt,
  };
  saveAdminWithdrawal(adminWithdrawal);

  // 2. Atualiza o saldo local do usuário
  const updatedUser: UserProfile = { ...user, balance: newBalance };
  saveStoredUser(updatedUser);

  // 3. Atualiza no Supabase caso configurado
  if (isSupabaseConfigured && user.email) {
    try {
      await supabase
        .from("profiles")
        .update({ balance: newBalance })
        .ilike("email", user.email);
    } catch (err) {
      console.warn("Aviso ao atualizar saldo no Supabase:", err);
    }

    try {
      await supabase.from("balance_transactions").insert({
        user_id: user.id,
        amount: -amount,
        kind: "debit",
        note: `Saque PIX Flash para ${pixHolder} (${pixKeyType}: ${pixKey}) - Líquido R$ ${netAmount.toFixed(2)} (Taxa R$ 5,00)`,
        balance_after: newBalance,
      });
    } catch {}
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("central_auth_changed"));
    window.dispatchEvent(new Event("playcontas_wallet_updated"));
  }

  return {
    success: true,
    message: `Saque PIX Flash de R$ ${amount.toFixed(2).replace(".", ",")} solicitado com sucesso! Você receberá R$ ${netAmount.toFixed(2).replace(".", ",")} (taxa de R$ 5,00).`,
    newBalance,
  };
}

/** Registra crédito de depósito concluído na carteira */
export async function addWalletDeposit(
  user: UserProfile,
  amount: number,
  identifier: string
): Promise<{ success: boolean; newBalance: number }> {
  if (!user || !user.id || amount <= 0) return { success: false, newBalance: 0 };

  const currentBalance = Number(user.balance) || 0;
  const newBalance = currentBalance + amount;

  const tx: WalletTransaction = {
    id: `dep-${Date.now()}-${identifier.slice(0, 8)}`,
    userId: user.id,
    type: "deposit",
    amount,
    description: `Depósito via PIX (Recarga de Carteira)`,
    status: "completed",
    createdAt: new Date().toISOString(),
  };

  const existingTxs = getWalletTransactions(user.id);
  saveWalletTransactions(user.id, [tx, ...existingTxs]);

  const updatedUser: UserProfile = { ...user, balance: newBalance };
  saveStoredUser(updatedUser);

  if (isSupabaseConfigured && user.email) {
    try {
      await supabase
        .from("profiles")
        .update({ balance: newBalance })
        .ilike("email", user.email);
    } catch {}

    try {
      await supabase.from("balance_transactions").insert({
        user_id: user.id,
        amount,
        kind: "credit",
        note: `Recarga de carteira via PIX (${identifier})`,
        balance_after: newBalance,
      });
    } catch {}
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("central_auth_changed"));
    window.dispatchEvent(new Event("playcontas_wallet_updated"));
  }

  return { success: true, newBalance };
}
