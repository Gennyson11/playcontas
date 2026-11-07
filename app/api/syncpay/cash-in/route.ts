import { NextRequest, NextResponse } from "next/server";
import { createSyncPayPixCashIn, SyncPaySplitRule } from "@/lib/syncpay";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount, buyer, description, sellerSyncPayId, items, platformFee } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Valor da cobrança inválido." },
        { status: 400 }
      );
    }

    if (!buyer || !buyer.name || !buyer.email) {
      return NextResponse.json(
        { success: false, error: "Dados do comprador (nome e e-mail) são obrigatórios." },
        { status: 400 }
      );
    }

    // Taxa padrão da plataforma PlayContas é de 13%
    const feePercentage = typeof platformFee === "number" ? platformFee : 13;
    const sellerPercentage = Math.max(0, 100 - feePercentage);

    // Se o vendedor possuir conta SyncPay cadastrada para split automático
    const splitRules: SyncPaySplitRule[] = [];
    if (sellerSyncPayId && typeof sellerSyncPayId === "string" && sellerSyncPayId.trim()) {
      splitRules.push({
        user_id: sellerSyncPayId.trim(),
        percentage: Number(sellerPercentage.toFixed(2)),
      });
    }

    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const defaultWebhook = `${protocol}://${host}/api/webhooks/syncpay`;

    const result = await createSyncPayPixCashIn({
      amount: Number(amount),
      description: description || `Pedido PlayContas (${items?.length || 1} itens)`,
      client: {
        name: buyer.name,
        email: buyer.email,
        document: buyer.document || "00000000000",
        phone: buyer.phone || "11999999999",
      },
      split: splitRules.length > 0 ? splitRules : undefined,
      webhook_url: defaultWebhook,
      metadata: {
        buyerId: buyer.id,
        itemsCount: items?.length || 1,
        sellerSyncPayId: sellerSyncPayId || null,
        feePercentage,
      },
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Erro ao gerar Pix na SyncPay" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      pix_code: result.pix_code,
      qr_code_url: result.qr_code_url,
      identifier: result.identifier,
      simulated: result.simulated || false,
      message: result.message,
      split: splitRules,
    });
  } catch (error: any) {
    console.error("[API syncpay/cash-in Exception]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
