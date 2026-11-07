import { NextRequest, NextResponse } from "next/server";
import { getSyncPayPixStatus } from "@/lib/syncpay";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const identifier = searchParams.get("identifier");

    if (!identifier || typeof identifier !== "string" || identifier.length > 120) {
      return NextResponse.json(
        { success: false, error: "Identificador de cobrança inválido." },
        { status: 400 }
      );
    }

    const statusRes = await getSyncPayPixStatus(identifier);

    return NextResponse.json({
      success: true,
      identifier: statusRes.identifier,
      status: statusRes.status,
      amount: statusRes.amount,
      simulated: statusRes.simulated || false,
    });
  } catch (error: any) {
    console.error("[API syncpay/check-status Exception]", error);
    return NextResponse.json(
      { success: false, error: "Erro ao consultar status da transação." },
      { status: 500 }
    );
  }
}
