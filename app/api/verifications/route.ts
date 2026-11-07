import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

const DATA_DIR = path.join(process.cwd(), "data");
const VERIFICATIONS_FILE = path.join(DATA_DIR, "verifications.json");

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(VERIFICATIONS_FILE)) {
    fs.writeFileSync(VERIFICATIONS_FILE, "[]", "utf-8");
  }
}

function readVerifications(): any[] {
  try {
    ensureFile();
    const raw = fs.readFileSync(VERIFICATIONS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeVerifications(data: any[]) {
  try {
    ensureFile();
    fs.writeFileSync(VERIFICATIONS_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Erro ao salvar verifications.json:", err);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const email = searchParams.get("email");

  const list = readVerifications();

  if (userId || email) {
    const found = list.find(
      (v) =>
        (userId && (v.userId === userId || v.id === userId)) ||
        (email && v.email?.toLowerCase().trim() === email.toLowerCase().trim())
    );
    return NextResponse.json({ submission: found || null, submissions: list });
  }

  return NextResponse.json({ submissions: list });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const list = readVerifications();
    const email = body.email ? body.email.toLowerCase().trim() : "";
    const userId = body.userId;

    const idx = list.findIndex(
      (v) =>
        (v.id && v.id === body.id) ||
        (userId && v.userId === userId) ||
        (email && v.email?.toLowerCase().trim() === email)
    );

    const now = new Date();
    const formattedDate = `${now.toLocaleDateString("pt-BR")}, ${now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;

    const newSub = {
      ...body,
      id: idx >= 0 ? list[idx].id : body.id || `verif-${Date.now()}`,
      userId: userId || (idx >= 0 ? list[idx].userId : `user-${Date.now()}`),
      userName: body.userName || body.fullName || "Usuário",
      status: body.status || "pending",
      submittedAt: (idx >= 0 && list[idx].submittedAt) || formattedDate,
    };

    if (idx >= 0) {
      list[idx] = newSub;
    } else {
      list.unshift(newSub);
    }

    writeVerifications(list);

    // Se Supabase estiver configurado, sincroniza dados do perfil
    if (isSupabaseConfigured && (userId || email)) {
      try {
        const updateData: any = {
          phone: body.phone || undefined,
        };
        if (body.status === "approved") {
          updateData.is_verified = true;
          updateData.role = "seller";
        }
        if (userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
          await supabase.from("profiles").update(updateData).eq("id", userId);
        } else if (email) {
          await supabase.from("profiles").update(updateData).ilike("email", email);
        }
      } catch (err) {
        console.warn("Aviso ao sincronizar perfil no Supabase:", err);
      }
    }

    return NextResponse.json({ success: true, submission: newSub, submissions: list });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, action, reason, notes } = await request.json();
    if (!id || !action) {
      return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
    }

    const list = readVerifications();
    const idx = list.findIndex((v) => v.id === id);

    if (idx < 0) {
      return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 });
    }

    const now = new Date();
    const formattedDate = `${now.toLocaleDateString("pt-BR")}, ${now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;

    if (action === "approve") {
      list[idx].status = "approved";
      list[idx].approvedAt = formattedDate;
      if (notes) list[idx].notes = notes;

      // Sincroniza com Supabase
      if (isSupabaseConfigured) {
        try {
          const email = list[idx].email;
          const userId = list[idx].userId;
          const updateData = { is_verified: true, role: "seller" };
          if (userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
            await supabase.from("profiles").update(updateData).eq("id", userId);
          } else if (email) {
            await supabase.from("profiles").update(updateData).ilike("email", email);
          }
        } catch (err) {
          console.warn("Aviso ao aprovar no Supabase:", err);
        }
      }
    } else if (action === "reject") {
      list[idx].status = "rejected";
      list[idx].rejectionReason = reason || "Documentação ilegível ou dados divergentes.";
      if (notes) list[idx].notes = notes;

      // Sincroniza com Supabase
      if (isSupabaseConfigured) {
        try {
          const email = list[idx].email;
          const userId = list[idx].userId;
          const updateData = { is_verified: false };
          if (userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
            await supabase.from("profiles").update(updateData).eq("id", userId);
          } else if (email) {
            await supabase.from("profiles").update(updateData).ilike("email", email);
          }
        } catch (err) {
          console.warn("Aviso ao rejeitar no Supabase:", err);
        }
      }
    }

    writeVerifications(list);
    return NextResponse.json({ success: true, submission: list[idx], submissions: list });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
