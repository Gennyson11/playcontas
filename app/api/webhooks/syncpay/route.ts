import { NextRequest, NextResponse } from "next/server";
import { simulateSyncPayApproval } from "@/lib/syncpay";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Extrai o identifier e o status da notificação
    const identifier =
      body.transaction?.identifier ||
      body.identifier ||
      body.data?.identifier ||
      body.id;

    const rawStatus = (
      body.transaction?.status ||
      body.status ||
      body.event ||
      ""
    ).toLowerCase();

    const isApproved =
      rawStatus.includes("approved") ||
      rawStatus.includes("paid") ||
      rawStatus.includes("completed") ||
      rawStatus.includes("success");

    if (identifier && isApproved) {
      simulateSyncPayApproval(identifier);
    }

    return NextResponse.json({
      received: true,
      identifier,
      status: isApproved ? "approved" : "pending",
    });
  } catch (error: any) {
    console.error("[Webhook SyncPay Exception]", error);
    // Sempre retorna 200 para evitar retentativas desnecessárias em erro de parsing
    return NextResponse.json({ received: true, error: error.message }, { status: 200 });
  }
}
