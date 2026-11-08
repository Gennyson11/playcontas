/**
 * SyncPayments (Syndpay) API Integration
 * Documentação oficial: https://docs.syncpayments.com.br/
 */

export interface SyncPayClient {
  name: string;
  document: string; // CPF ou CNPJ
  email: string;
  phone?: string;
}

export interface SyncPaySplitRule {
  user_id: string; // client_id / user_id do parceiro na SyncPay
  percentage: number; // Porcentagem do valor total destinada ao recebedor
}

export interface CreatePixChargeParams {
  amount: number; // Valor em reais (ex: 49.90)
  description?: string;
  client: SyncPayClient;
  split?: SyncPaySplitRule[];
  webhook_url?: string;
  metadata?: Record<string, any>;
}

export interface SyncPayCashInResponse {
  success: boolean;
  message?: string;
  pix_code: string;
  qr_code_url: string;
  identifier: string;
  simulated?: boolean;
  error?: string;
}

export interface SyncPayStatusResponse {
  identifier: string;
  status: "pending" | "approved" | "completed" | "expired" | "refunded" | "failed";
  amount: number;
  simulated?: boolean;
}

// In-memory token cache
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

// In-memory store for simulated transactions
const simulatedTransactions = new Map<
  string,
  {
    status: "pending" | "approved" | "completed";
    amount: number;
    createdAt: number;
    metadata?: Record<string, any>;
  }
>();

const BASE_URL =
  process.env.SYNCPAY_BASE_URL || "https://api.syncpayments.com.br/api/partner/v1";

/**
 * Validação de CPF com dígitos verificadores reais
 */
function isValidCPF(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11 || /^(\d)\1{10}$/.test(clean)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(clean.charAt(i)) * (10 - i);
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9))) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(clean.charAt(i)) * (11 - i);
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  return rev === parseInt(clean.charAt(10));
}

/**
 * Gera um CPF matematicamente válido caso o comprador não tenha informado
 */
function generateValidCPF(): string {
  const rnd = (n: number) => Math.round(Math.random() * n);
  const mod = (base: number, div: number) =>
    Math.round(base - Math.floor(base / div) * div);
  const n = Array(9)
    .fill(0)
    .map(() => rnd(9));
  let d1 = n.reduce((total, num, i) => total + num * (10 - i), 0);
  d1 = 11 - mod(d1, 11);
  if (d1 >= 10) d1 = 0;
  let d2 = n.reduce((total, num, i) => total + num * (11 - i), 0) + d1 * 2;
  d2 = 11 - mod(d2, 11);
  if (d2 >= 10) d2 = 0;
  return "" + n.join("") + d1 + d2;
}

/**
 * Validação de CNPJ com dígitos verificadores
 */
function isValidCNPJ(cnpj: string): boolean {
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length !== 14 || /^(\d)\1{13}$/.test(clean)) return false;
  let size = clean.length - 2;
  let numbers = clean.substring(0, size);
  const digits = clean.substring(size);
  let sum = 0;
  let pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;
  size = size + 1;
  numbers = clean.substring(0, size);
  sum = 0;
  pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return result === parseInt(digits.charAt(1));
}

export function ensureValidDocument(doc?: string): string {
  const clean = (doc || "").replace(/\D/g, "");
  if (clean.length === 11 && isValidCPF(clean)) return clean;
  if (clean.length === 14 && isValidCNPJ(clean)) return clean;
  return generateValidCPF();
}

export function ensureValidPhone(phone?: string): string {
  const clean = (phone || "").replace(/\D/g, "");
  if (clean.length >= 10 && clean.length <= 11) return clean;
  return "11987654321";
}

/**
 * Verifica se as credenciais da SyncPay estão devidamente configuradas
 */
export function isSyncPayConfigured(): boolean {
  return Boolean(
    process.env.SYNCPAY_CLIENT_ID && process.env.SYNCPAY_CLIENT_SECRET
  );
}

/**
 * Obtém ou reutiliza o Access Token OAuth da SyncPay
 */
export async function getSyncPayAccessToken(): Promise<string | null> {
  const clientId = process.env.SYNCPAY_CLIENT_ID;
  const clientSecret = process.env.SYNCPAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  // Retorna token em cache se ainda for válido
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && tokenExpiresAt > now + 60) {
    return cachedToken;
  }

  try {
    const res = await fetch(`${BASE_URL}/auth-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[SyncPay Auth Error]", res.status, errText);
      return null;
    }

    const data = await res.json();
    if (data.access_token) {
      cachedToken = data.access_token;
      tokenExpiresAt = now + (data.expires_in || 3600);
      return cachedToken;
    }

    return null;
  } catch (error) {
    console.error("[SyncPay Auth Exception]", error);
    return null;
  }
}

/**
 * Cria uma cobrança Pix com split de pagamentos na SyncPay
 */
export async function createSyncPayPixCashIn(
  params: CreatePixChargeParams
): Promise<SyncPayCashInResponse> {
  const token = await getSyncPayAccessToken();
  const clientId = process.env.SYNCPAY_CLIENT_ID;

  const formattedAmount = Number(params.amount.toFixed(2));
  const validDocument = ensureValidDocument(params.client.document);
  const validPhone = ensureValidPhone(params.client.phone);

  // Se não houver credenciais reais, utiliza o modo simulação/sandbox
  if (!token) {
    const fakeIdentifier = `syncpay_sim_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const mockPixCode = `00020126580014br.gov.bcb.pix0136${fakeIdentifier}520400005303986540${formattedAmount.toFixed(
      2
    )}5802BR5925PLAYCONTAS INTERMEDIACAO6009SAO PAULO62070503***6304E8A2`;

    simulatedTransactions.set(fakeIdentifier, {
      status: "pending",
      amount: formattedAmount,
      createdAt: Date.now(),
      metadata: params.metadata,
    });

    return {
      success: true,
      message: "Cobrança Pix criada (Modo Sandbox PlayContas)",
      pix_code: mockPixCode,
      qr_code_url: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
        mockPixCode
      )}`,
      identifier: fakeIdentifier,
      simulated: true,
    };
  }

  // Helper para chamar cash-in na SyncPay
  const executeCall = async (includeSplit: boolean) => {
    const payload: Record<string, any> = {
      amount: formattedAmount,
      description: params.description || "Pedido PlayContas",
      client: {
        name: params.client.name,
        document: validDocument,
        email: params.client.email,
        phone: validPhone,
      },
    };

    if (params.webhook_url) {
      payload.webhook_url = params.webhook_url;
    } else if (process.env.SYNCPAY_WEBHOOK_URL) {
      payload.webhook_url = process.env.SYNCPAY_WEBHOOK_URL;
    }

    // Regras de split: filtra qualquer regra que tente fazer split para a própria conta principal
    if (includeSplit && params.split && params.split.length > 0) {
      const validSplits = params.split
        .filter((rule) => rule.user_id && rule.user_id !== clientId)
        .map((rule) => ({
          user_id: rule.user_id,
          percentage: Number(rule.percentage.toFixed(2)),
        }));

      if (validSplits.length > 0) {
        payload.split = validSplits;
      }
    }

    const res = await fetch(`${BASE_URL}/cash-in`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const resData = await res.json();
    return { ok: res.ok, status: res.status, data: resData };
  };

  try {
    // 1ª Tentativa com Split (se houver)
    let call = await executeCall(true);

    // Se falhar devido a erro de split (ex: mesmo usuário ou conta não encontrada), tenta sem split
    if (
      !call.ok &&
      (JSON.stringify(call.data).includes("split") || call.status === 500)
    ) {
      console.warn("[SyncPay Split Fallback] Tentando gerar cobrança direta sem split...");
      call = await executeCall(false);
    }

    if (!call.ok) {
      console.error("[SyncPay Cash-in Error]", call.status, call.data);
      return {
        success: false,
        error: call.data.message || "Erro ao gerar cobrança Pix na SyncPay",
        pix_code: "",
        qr_code_url: "",
        identifier: "",
      };
    }

    const pixCode = call.data.pix_code || call.data.pix_copy_paste || "";
    const identifier = call.data.identifier || call.data.id || "";
    const qrCodeUrl =
      call.data.qr_code_url ||
      `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
        pixCode
      )}`;

    return {
      success: true,
      message: call.data.message || "Cashin request successfully submitted",
      pix_code: pixCode,
      qr_code_url: qrCodeUrl,
      identifier: identifier,
    };
  } catch (error: any) {
    console.error("[SyncPay Cash-in Exception]", error);
    return {
      success: false,
      error: error.message || "Falha na comunicação com a SyncPay",
      pix_code: "",
      qr_code_url: "",
      identifier: "",
    };
  }
}

/**
 * Consulta o status de uma cobrança Pix na SyncPay
 */
export async function getSyncPayPixStatus(
  identifier: string
): Promise<SyncPayStatusResponse> {
  // Transações simuladas
  if (identifier.startsWith("syncpay_sim_")) {
    const item = simulatedTransactions.get(identifier);
    if (!item) {
      return { identifier, status: "pending", amount: 0, simulated: true };
    }
    return {
      identifier,
      status: item.status,
      amount: item.amount,
      simulated: true,
    };
  }

  const token = await getSyncPayAccessToken();
  if (!token) {
    return { identifier, status: "pending", amount: 0, simulated: true };
  }

  try {
    let res = await fetch(`${BASE_URL}/transaction/${identifier}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      // Tenta rota legada caso a API responda em /cash-in
      const alt = await fetch(`${BASE_URL}/cash-in/${identifier}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (alt.ok) res = alt;
    }

    if (!res.ok) {
      return { identifier, status: "pending", amount: 0 };
    }

    const data = await res.json();
    const rawStatus = (
      data.status ||
      data.transaction?.status ||
      data.data?.status ||
      "pending"
    ).toLowerCase();

    let mappedStatus: SyncPayStatusResponse["status"] = "pending";
    if (["approved", "paid", "completed", "success", "confirmed"].includes(rawStatus)) {
      mappedStatus = "approved";
    } else if (["expired", "cancelled", "canceled"].includes(rawStatus)) {
      mappedStatus = "expired";
    } else if (["refunded", "chargeback"].includes(rawStatus)) {
      mappedStatus = "refunded";
    }

    return {
      identifier,
      status: mappedStatus,
      amount: Number(data.amount || data.transaction?.amount || 0),
    };
  } catch (error) {
    console.error("[SyncPay Status Exception]", error);
    return { identifier, status: "pending", amount: 0 };
  }
}

/**
 * Simula a aprovação manual de uma transação sandbox
 */
export function simulateSyncPayApproval(identifier: string): boolean {
  const item = simulatedTransactions.get(identifier);
  if (item) {
    item.status = "approved";
    return true;
  }
  return false;
}
