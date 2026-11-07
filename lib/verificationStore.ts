import { VerificationData, VerificationSubmission, UserProfile } from "@/types";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { saveStoredUser, getStoredUserSync, isUserAdmin } from "./authStore";

const VERIFICATION_STORAGE_KEY = "central_user_verification";
const ALL_VERIFICATIONS_KEY = "central_all_verifications";

const INITIAL_SUBMISSIONS: VerificationSubmission[] = [
  {
    id: "verif-jovizeira",
    userId: "user-jovi-001",
    userName: "BuscaNinja",
    userAvatar: "https://api.dicebear.com/7.x/bottts/svg?seed=BuscaNinja",
    email: "jovitoolsbr@gmail.com",
    phone: "(11) 98765-4321",
    pixKey: "jovitoolsbr@gmail.com",
    pixType: "email",
    fullName: "Joviano Silveira dos Santos",
    cpf: "345.678.910-12",
    birthDate: "22/08/1995",
    motherName: "Clarice Silveira dos Santos",
    nationality: "Brasileira",
    cep: "01310-100",
    street: "Avenida Paulista",
    number: "1578",
    complement: "Sala 804",
    neighborhood: "Bela Vista",
    city: "São Paulo",
    state: "SP",
    addressProofName: "comprovante_enel_setembro.pdf",
    documentType: "RG",
    documentNumber: "45.890.123-X",
    issuingAgency: "SSP/SP",
    docFrontName: "rg_frente_jovi.jpg",
    docBackName: "rg_verso_jovi.jpg",
    docSelfieName: "selfie_joviano.jpg",
    status: "pending",
    submittedAt: "28/10/2026, 14:15",
  },
  {
    id: "verif-gennyson",
    userId: "user-gennyson-admin",
    userName: "Gennyson Marinho",
    userAvatar:
      "https://lazueuycrcqirdykdppm.supabase.co/storage/v1/object/public/avatars/avatar-gennysonmarinhodemacedo_gmail_com.gif",
    email: "gennysonmarinhodemacedo@gmail.com",
    phone: "(84) 99607-6378",
    pixKey: "gennysonmarinhodemacedo@gmail.com",
    pixType: "email",
    fullName: "Gennyson Marinho de Macedo",
    cpf: "123.456.789-00",
    birthDate: "15/04/1998",
    motherName: "Maria de Lourdes Marinho",
    nationality: "Brasileira",
    cep: "59000-000",
    street: "Avenida Principal",
    number: "100",
    complement: "Apto 402",
    neighborhood: "Centro",
    city: "Natal",
    state: "RN",
    addressProofName: "comprovante_residencia.pdf",
    documentType: "RG",
    documentNumber: "003.123.456",
    issuingAgency: "ITEP/RN",
    docFrontName: "rg_frente.jpg",
    docBackName: "rg_verso.jpg",
    docSelfieName: "selfie_documento.jpg",
    status: "approved",
    submittedAt: "20/10/2026, 13:40",
    approvedAt: "20/10/2026, 13:49",
  },
];

export function getStoredVerification(userId?: string): VerificationData {
  if (typeof window === "undefined") {
    return getDefaultVerification(userId);
  }

  const currentUser = getStoredUserSync();
  const targetEmail = currentUser?.email?.toLowerCase().trim();

  try {
    if (userId) {
      const raw = localStorage.getItem(`${VERIFICATION_STORAGE_KEY}_${userId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.phone || parsed.cpf || (parsed.status && parsed.status !== "none"))) {
          return parsed;
        }
      }
    }

    if (currentUser?.id && currentUser.id !== userId) {
      const rawUser = localStorage.getItem(`${VERIFICATION_STORAGE_KEY}_${currentUser.id}`);
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (parsed && (parsed.phone || parsed.cpf || (parsed.status && parsed.status !== "none"))) {
          return parsed;
        }
      }
    }

    const defaultRaw = localStorage.getItem(VERIFICATION_STORAGE_KEY);
    if (defaultRaw) {
      const parsed = JSON.parse(defaultRaw);
      if (
        parsed &&
        ((userId && (parsed.userId === userId || parsed.id === userId)) ||
          (targetEmail && parsed.email?.toLowerCase().trim() === targetEmail))
      ) {
        return parsed;
      }
    }
  } catch {}

  // Busca na lista de todas as submissões
  try {
    const all = getStoredAllVerificationsSync();
    const found = all.find(
      (s) =>
        (userId && (s.userId === userId || s.id === userId)) ||
        (currentUser?.id && (s.userId === currentUser.id || s.id === currentUser.id)) ||
        (targetEmail && s.email?.toLowerCase().trim() === targetEmail)
    );
    if (found) {
      return found;
    }
  } catch {}

  return getDefaultVerification(userId);
}

export function getDefaultVerification(userId?: string): VerificationData {
  const currentUser = getStoredUserSync();
  const isGennyson =
    currentUser?.email?.toLowerCase().includes("gennyson") ||
    currentUser?.name?.toLowerCase().includes("gennyson");

  if (isGennyson || (currentUser?.role === "admin" && !currentUser?.email)) {
    return {
      email: currentUser?.email || "gennysonmarinhodemacedo@gmail.com",
      phone: "(84) 99607-6378",
      pixKey: "gennysonmarinhodemacedo@gmail.com",
      pixType: "email",
      fullName: currentUser?.name || "Gennyson Marinho de Macedo",
      cpf: "123.456.789-00",
      birthDate: "15/04/1998",
      motherName: "Maria de Lourdes Marinho",
      nationality: "Brasileira",
      cep: "59000-000",
      street: "Avenida Principal",
      number: "100",
      complement: "Apto 402",
      neighborhood: "Centro",
      city: "Natal",
      state: "RN",
      addressProofName: "comprovante_residencia.pdf",
      documentType: "RG",
      documentNumber: "003.123.456",
      issuingAgency: "ITEP/RN",
      docFrontName: "rg_frente.jpg",
      docBackName: "rg_verso.jpg",
      docSelfieName: "selfie_documento.jpg",
      status: "approved",
      approvedAt: "20/10/2026, 13:49",
    };
  }

  return {
    email: currentUser?.email || "",
    phone: currentUser?.phone || "",
    pixKey: "",
    pixType: "cpf",
    fullName: currentUser?.name || "",
    cpf: currentUser?.cpf || "",
    birthDate: "",
    motherName: "",
    nationality: "Brasileira",
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "SP",
    documentType: "RG",
    documentNumber: "",
    issuingAgency: "SSP",
    status: currentUser?.verificationStatus || "none",
  };
}

const isUUID = (str?: string) =>
  Boolean(
    str &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str)
  );

export async function saveStoredVerification(
  userId: string,
  data: VerificationData
): Promise<void> {
  let newSubmission: VerificationSubmission | null = null;

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(
        `${VERIFICATION_STORAGE_KEY}_${userId}`,
        JSON.stringify(data)
      );
      localStorage.setItem(VERIFICATION_STORAGE_KEY, JSON.stringify(data));

      // Atualiza também na lista global de verificações para o painel Admin
      const submissions = getStoredAllVerificationsSync();
      const idx = submissions.findIndex((s) => s.userId === userId || s.email === data.email);
      const user = getStoredUserSync();

      newSubmission = {
        ...data,
        id: idx >= 0 ? submissions[idx].id : `verif-${Date.now()}`,
        userId: userId || `user-${Date.now()}`,
        userName: data.fullName || user?.name || "Usuário",
        userAvatar:
          user?.avatar ||
          `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
            data.fullName || "User"
          )}`,
        submittedAt:
          idx >= 0 && submissions[idx].submittedAt
            ? submissions[idx].submittedAt
            : `${new Date().toLocaleDateString("pt-BR")}, ${new Date().toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}`,
      };

      if (idx >= 0) {
        submissions[idx] = newSubmission;
      } else {
        submissions.unshift(newSubmission);
      }

      localStorage.setItem(ALL_VERIFICATIONS_KEY, JSON.stringify(submissions));

      // Sincroniza com a API central do servidor para funcionar entre navegadores e janelas diferentes
      try {
        await fetch("/api/verifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newSubmission),
        });
      } catch {}
    } catch (err) {
      console.warn("Aviso ao salvar verificação local:", err);
    }
  }

  // Atualiza perfil no authStore conforme o status da verificação
  const user = getStoredUserSync();
  if (user) {
    if (data.status === "approved") {
      const updated: UserProfile = {
        ...user,
        isVerified: true,
        verificationStatus: "approved",
        role: isUserAdmin(user) ? "admin" : "seller",
        phone: data.phone || user.phone,
        cpf: data.cpf || user.cpf,
      };
      saveStoredUser(updated);
    } else if (data.status === "pending") {
      const updated: UserProfile = {
        ...user,
        isVerified: false,
        verificationStatus: "pending",
        phone: data.phone || user.phone,
        cpf: data.cpf || user.cpf,
      };
      saveStoredUser(updated);
    }
  }

  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent("central_verifications_changed"));
      window.dispatchEvent(new CustomEvent("central_auth_changed"));
    } catch {}
  }

  // Sincroniza com Supabase se configurado
  if (isSupabaseConfigured) {
    try {
      const isIdUuid = isUUID(userId);
      const updateData: any = {
        is_verified: data.status === "approved",
        phone: data.phone || undefined,
      };
      if (data.status === "approved") {
        updateData.role = "seller";
      }

      if (isIdUuid) {
        await supabase.from("profiles").update(updateData).eq("id", userId);
      } else if (data.email) {
        await supabase.from("profiles").update(updateData).ilike("email", data.email);
      }

      // Se newSubmission existe, tenta persistir na tabela de verificações
      if (newSubmission) {
        await supabase.from("verifications").upsert({
          id: newSubmission.id,
          user_id: isIdUuid ? userId : null,
          user_name: newSubmission.userName,
          user_avatar: newSubmission.userAvatar,
          email: newSubmission.email,
          phone: newSubmission.phone,
          pix_key: newSubmission.pixKey,
          pix_type: newSubmission.pixType,
          full_name: newSubmission.fullName,
          cpf: newSubmission.cpf,
          birth_date: newSubmission.birthDate,
          mother_name: newSubmission.motherName,
          nationality: newSubmission.nationality,
          cep: newSubmission.cep,
          street: newSubmission.street,
          number: newSubmission.number,
          complement: newSubmission.complement,
          neighborhood: newSubmission.neighborhood,
          city: newSubmission.city,
          state: newSubmission.state,
          address_proof_name: newSubmission.addressProofName,
          document_type: newSubmission.documentType,
          document_number: newSubmission.documentNumber,
          issuing_agency: newSubmission.issuingAgency,
          doc_front_name: newSubmission.docFrontName,
          doc_back_name: newSubmission.docBackName,
          doc_selfie_name: newSubmission.docSelfieName,
          status: newSubmission.status,
        });
      }
    } catch (err) {
      console.warn("Aviso ao salvar verificação no Supabase:", err);
    }
  }
}

export function getStoredAllVerificationsSync(): VerificationSubmission[] {
  if (typeof window === "undefined") return INITIAL_SUBMISSIONS;
  try {
    const raw = localStorage.getItem(ALL_VERIFICATIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Remove Carlos Eduardo ou quaisquer registros fictícios
        const cleaned = parsed.filter(
          (s) =>
            s.email?.toLowerCase().trim() !== "carloseduardo.tech@outlook.com" &&
            s.id !== "verif-carlos" &&
            !s.userName?.toLowerCase().includes("carlos eduardo") &&
            !s.fullName?.toLowerCase().includes("carlos eduardo")
        );
        if (cleaned.length !== parsed.length) {
          localStorage.setItem(ALL_VERIFICATIONS_KEY, JSON.stringify(cleaned));
        }
        return cleaned.length > 0 ? cleaned : INITIAL_SUBMISSIONS;
      }
    }
    // Inicializa com as submissões padrão
    localStorage.setItem(ALL_VERIFICATIONS_KEY, JSON.stringify(INITIAL_SUBMISSIONS));
    return INITIAL_SUBMISSIONS;
  } catch {
    return INITIAL_SUBMISSIONS;
  }
}

export async function getAllVerificationRequests(
  knownUsers?: UserProfile[]
): Promise<VerificationSubmission[]> {
  let serverList: VerificationSubmission[] = [];
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/verifications");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.submissions)) {
          serverList = data.submissions;
        }
      }
    } catch (err) {
      console.warn("Aviso ao buscar /api/verifications:", err);
    }
  }

  const localList = getStoredAllVerificationsSync();

  // Mapeia por id ou email para combinar sem duplicatas (prioridade para o servidor)
  const map = new Map<string, VerificationSubmission>();

  // 1. Base local
  for (const item of localList) {
    const key = (item.id || item.email || item.userId || "").toLowerCase().trim();
    if (key) map.set(key, item);
  }

  // 2. Base do servidor (centralizada e compartilhada entre navegadores)
  for (const item of serverList) {
    const key = (item.id || item.email || item.userId || "").toLowerCase().trim();
    if (key) {
      const existing = map.get(key);
      map.set(key, existing ? { ...existing, ...item } : item);
    }
  }

  const combined = Array.from(map.values());

  // Enriquecer com dados de perfis do Supabase se configurado
  if (isSupabaseConfigured) {
    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url, phone, is_verified, role, created_at");

      if (profiles && Array.isArray(profiles)) {
        profiles.forEach((p: any) => {
          const pEmail = p.email ? p.email.toLowerCase().trim() : "";
          const existing = combined.find(
            (s) =>
              (p.id && s.userId === p.id) ||
              (pEmail && s.email?.toLowerCase().trim() === pEmail)
          );
          if (existing) {
            if (!existing.userAvatar && p.avatar_url) existing.userAvatar = p.avatar_url;
            if (!existing.phone && p.phone) existing.phone = p.phone;
            if (!existing.fullName && p.full_name) existing.fullName = p.full_name;
            if (p.is_verified) {
              existing.status = "approved";
              existing.approvedAt = existing.approvedAt || "Aprovado";
            }
          }
        });
      }
    } catch (err) {
      console.warn("Aviso ao sincronizar perfis do Supabase:", err);
    }
  }

  // Remove contas fictícias/demo como Carlos Eduardo
  const filteredList = combined.filter((s) => {
    if (
      s.email?.toLowerCase().trim() === "carloseduardo.tech@outlook.com" ||
      s.id === "verif-carlos" ||
      s.userName?.toLowerCase().includes("carlos eduardo") ||
      s.fullName?.toLowerCase().includes("carlos eduardo")
    ) {
      return false;
    }
    return true;
  });

  // Atualiza localStorage para manter sincronizado localmente
  if (typeof window !== "undefined" && filteredList.length > 0) {
    try {
      localStorage.setItem(ALL_VERIFICATIONS_KEY, JSON.stringify(filteredList));
    } catch {}
  }

  return filteredList;
}

export async function approveVerification(
  submissionId: string,
  notes?: string
): Promise<VerificationSubmission[]> {
  const list = getStoredAllVerificationsSync();
  const idx = list.findIndex((s) => s.id === submissionId);
  const now = new Date();
  const formattedDate = `${now.toLocaleDateString("pt-BR")}, ${now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;

  let targetUserId: string | undefined;
  let targetEmail: string | undefined;

  if (idx >= 0) {
    const item = list[idx];
    targetUserId = item.userId;
    targetEmail = item.email;
    const updated: VerificationSubmission = {
      ...item,
      status: "approved",
      approvedAt: formattedDate,
      notes: notes || item.notes,
    };
    list[idx] = updated;

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(ALL_VERIFICATIONS_KEY, JSON.stringify(list));
        localStorage.setItem(`${VERIFICATION_STORAGE_KEY}_${item.userId}`, JSON.stringify(updated));
      } catch {}
    }

    // Atualiza authStore se for o usuário atual
    const currentUser = getStoredUserSync();
    if (
      currentUser &&
      (currentUser.id === item.userId ||
        currentUser.email.toLowerCase() === item.email.toLowerCase())
    ) {
      const updatedUser: UserProfile = {
        ...currentUser,
        isVerified: true,
        verificationStatus: "approved",
        role: isUserAdmin(currentUser) ? "admin" : "seller",
        phone: item.phone || currentUser.phone,
        cpf: item.cpf || currentUser.cpf,
      };
      saveStoredUser(updatedUser);
    }
  }

  // Sincroniza via PATCH na API central do servidor
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent("central_verifications_changed"));
      window.dispatchEvent(new CustomEvent("central_auth_changed"));
    } catch {}

    try {
      const res = await fetch("/api/verifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: submissionId, action: "approve", notes }),
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.submissions)) {
          return json.submissions;
        }
      }
    } catch (err) {
      console.warn("Aviso ao aprovar via /api/verifications:", err);
    }
  }

  // Atualiza no Supabase diretamente como fallback se configurado
  if (isSupabaseConfigured) {
    try {
      const isAdmTarget =
        Boolean(targetEmail && targetEmail.toLowerCase().includes("gennyson")) ||
        Boolean(idx >= 0 && list[idx]?.email && list[idx].email.toLowerCase().includes("gennyson"));
      const roleToSet = isAdmTarget ? "admin" : "seller";
      if (targetUserId && isUUID(targetUserId)) {
        await supabase
          .from("profiles")
          .update({ is_verified: true, role: roleToSet })
          .eq("id", targetUserId);
      } else if (targetEmail) {
        await supabase
          .from("profiles")
          .update({ is_verified: true, role: roleToSet })
          .ilike("email", targetEmail);
      }
    } catch (err) {
      console.warn("Aviso ao aprovar perfil no Supabase:", err);
    }
  }

  return list;
}

export async function rejectVerification(
  submissionId: string,
  reason: string
): Promise<VerificationSubmission[]> {
  const list = getStoredAllVerificationsSync();
  const idx = list.findIndex((s) => s.id === submissionId);

  let targetUserId: string | undefined;
  let targetEmail: string | undefined;

  if (idx >= 0) {
    const item = list[idx];
    targetUserId = item.userId;
    targetEmail = item.email;
    const updated: VerificationSubmission = {
      ...item,
      status: "rejected",
      rejectionReason: reason,
    };
    list[idx] = updated;

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(ALL_VERIFICATIONS_KEY, JSON.stringify(list));
        localStorage.setItem(`${VERIFICATION_STORAGE_KEY}_${item.userId}`, JSON.stringify(updated));
      } catch {}
    }

    // Atualiza authStore se for o usuário atual
    const currentUser = getStoredUserSync();
    if (
      currentUser &&
      (currentUser.id === item.userId ||
        currentUser.email.toLowerCase() === item.email.toLowerCase())
    ) {
      const updatedUser: UserProfile = {
        ...currentUser,
        isVerified: false,
        verificationStatus: "rejected",
        role: isUserAdmin(currentUser) ? "admin" : "buyer",
      };
      saveStoredUser(updatedUser);
    }
  }

  // Sincroniza via PATCH na API central do servidor
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent("central_verifications_changed"));
      window.dispatchEvent(new CustomEvent("central_auth_changed"));
    } catch {}

    try {
      const res = await fetch("/api/verifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: submissionId, action: "reject", reason }),
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.submissions)) {
          return json.submissions;
        }
      }
    } catch (err) {
      console.warn("Aviso ao rejeitar via /api/verifications:", err);
    }
  }

  // Atualiza no Supabase diretamente como fallback se configurado
  if (isSupabaseConfigured) {
    try {
      const isAdmTarget =
        Boolean(targetEmail && targetEmail.toLowerCase().includes("gennyson")) ||
        Boolean(idx >= 0 && list[idx]?.email && list[idx].email.toLowerCase().includes("gennyson"));
      const roleToSet = isAdmTarget ? "admin" : "buyer";
      if (targetUserId && isUUID(targetUserId)) {
        await supabase
          .from("profiles")
          .update({ is_verified: false, role: roleToSet })
          .eq("id", targetUserId);
      } else if (targetEmail) {
        await supabase
          .from("profiles")
          .update({ is_verified: false, role: roleToSet })
          .ilike("email", targetEmail);
      }
    } catch (err) {
      console.warn("Aviso ao rejeitar perfil no Supabase:", err);
    }
  }

  return list;
}
