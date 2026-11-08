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

const isUUID = (str?: string) =>
  Boolean(
    str &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str)
  );

function mapDbVerification(item: any) {
  return {
    id: item.id,
    userId: item.user_id,
    userName: item.user_name || item.full_name || item.email?.split("@")[0] || "Usuário",
    userAvatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
      item.full_name || item.user_name || "User"
    )}`,
    email: item.email,
    phone: item.phone || "",
    pixKey: item.pix_key || item.email,
    pixType: item.pix_type || "email",
    fullName: item.full_name || item.user_name || "Solicitante",
    cpf: item.cpf || "",
    birthDate: item.birth_date || "",
    motherName: item.mother_name || "",
    nationality: item.nationality || "Brasileira",
    cep: item.cep || "",
    street: item.street || "",
    number: item.number || "",
    complement: item.complement || "",
    neighborhood: item.neighborhood || "",
    city: item.city || "",
    state: item.state || "",
    documentType: item.document_type || "RG",
    documentNumber: item.document_number || "",
    issuingAgency: item.issuing_agency || "",
    addressProofName: item.address_proof_url ? "comprovante.jpg" : undefined,
    addressProofFile: item.address_proof_url,
    docFrontName: item.doc_front_url ? "doc_frente.jpg" : undefined,
    docFrontFile: item.doc_front_url,
    docBackName: item.doc_back_url ? "doc_verso.jpg" : undefined,
    docBackFile: item.doc_back_url,
    docSelfieName: item.doc_selfie_url ? "doc_selfie.jpg" : undefined,
    docSelfieFile: item.doc_selfie_url,
    status: item.status || "pending",
    rejectionReason: item.rejection_reason || undefined,
    submittedAt: item.submitted_at
      ? new Date(item.submitted_at).toLocaleString("pt-BR")
      : "Recente",
    approvedAt: item.reviewed_at && item.status === "approved"
      ? new Date(item.reviewed_at).toLocaleString("pt-BR")
      : undefined,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const email = searchParams.get("email");

  // 1. Tenta buscar no banco Supabase (fonte definitiva)
  if (isSupabaseConfigured) {
    try {
      const { data: dbList, error } = await supabase
        .from("seller_verifications")
        .select("*")
        .order("submitted_at", { ascending: false });

      if (!error && Array.isArray(dbList) && dbList.length > 0) {
        const mappedList = dbList.map(mapDbVerification);
        if (userId || email) {
          const found = mappedList.find(
            (v: any) =>
              (userId && (v.userId === userId || v.id === userId)) ||
              (email && v.email?.toLowerCase().trim() === email.toLowerCase().trim())
          );
          return NextResponse.json({ submission: found || null, submissions: mappedList });
        }
        return NextResponse.json({ submissions: mappedList });
      }
    } catch (err) {
      console.warn("Aviso ao buscar seller_verifications na API GET:", err);
    }
  }

  // 2. Fallback para arquivo local
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

    const email = body.email ? body.email.toLowerCase().trim() : "";
    const userId = body.userId;

    const now = new Date();
    const formattedDate = `${now.toLocaleDateString("pt-BR")}, ${now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;

    // 1. Salva no Supabase (seller_verifications)
    if (isSupabaseConfigured && email) {
      try {
        const isIdUuid = isUUID(userId);
        await supabase.from("seller_verifications").upsert(
          {
            user_id: isIdUuid ? userId : null,
            user_name: body.userName || body.fullName || email.split("@")[0],
            email: email,
            phone: body.phone,
            pix_key: body.pixKey,
            pix_type: body.pixType,
            full_name: body.fullName,
            cpf: body.cpf,
            birth_date: body.birthDate,
            mother_name: body.motherName,
            nationality: body.nationality,
            cep: body.cep,
            street: body.street,
            number: body.number,
            complement: body.complement,
            neighborhood: body.neighborhood,
            city: body.city,
            state: body.state,
            document_type: body.documentType,
            document_number: body.documentNumber,
            issuing_agency: body.issuingAgency,
            doc_front_url: body.docFrontFile,
            doc_back_url: body.docBackFile,
            doc_selfie_url: body.docSelfieFile,
            address_proof_url: body.addressProofFile,
            status: body.status || "pending",
          },
          { onConflict: "email" }
        );

        // Atualiza telefone no perfil
        if (body.phone) {
          if (isIdUuid) {
            await supabase.from("profiles").update({ phone: body.phone }).eq("id", userId);
          } else {
            await supabase.from("profiles").update({ phone: body.phone }).ilike("email", email);
          }
        }
      } catch (err) {
        console.warn("Aviso ao salvar seller_verifications no Supabase POST:", err);
      }
    }

    // 2. Atualiza arquivo local como cache
    const list = readVerifications();
    const idx = list.findIndex(
      (v) =>
        (v.id && v.id === body.id) ||
        (userId && v.userId === userId) ||
        (email && v.email?.toLowerCase().trim() === email)
    );

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

    const now = new Date();
    const formattedDate = `${now.toLocaleDateString("pt-BR")}, ${now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;

    let targetEmail: string | undefined;
    let targetUserId: string | undefined;

    if (idx >= 0) {
      targetEmail = list[idx].email;
      targetUserId = list[idx].userId;

      if (action === "approve") {
        list[idx].status = "approved";
        list[idx].approvedAt = formattedDate;
        if (notes) list[idx].notes = notes;
      } else if (action === "reject") {
        list[idx].status = "rejected";
        list[idx].rejectionReason = reason || "Documentação ilegível ou dados divergentes.";
        if (notes) list[idx].notes = notes;
      }
      writeVerifications(list);
    }

    // Sincroniza diretamente com Supabase (seller_verifications e profiles)
    if (isSupabaseConfigured) {
      try {
        const isAdm = Boolean(targetEmail && targetEmail.toLowerCase().includes("gennyson"));
        const newRole = isAdm ? "admin" : "seller";

        const updateVerifData: any = {
          status: action === "approve" ? "approved" : "rejected",
          rejection_reason: action === "reject" ? (reason || "Documentação ilegível ou divergente.") : null,
          reviewed_at: new Date().toISOString(),
        };

        if (isUUID(id)) {
          await supabase.from("seller_verifications").update(updateVerifData).eq("id", id);
        } else if (targetEmail) {
          await supabase.from("seller_verifications").update(updateVerifData).ilike("email", targetEmail);
        }

        if (action === "approve") {
          if (targetUserId && isUUID(targetUserId)) {
            await supabase.from("profiles").update({ is_verified: true, role: newRole }).eq("id", targetUserId);
          } else if (targetEmail) {
            await supabase.from("profiles").update({ is_verified: true, role: newRole }).ilike("email", targetEmail);
          }
        }
      } catch (err) {
        console.warn("Aviso ao atualizar status no Supabase PATCH:", err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
