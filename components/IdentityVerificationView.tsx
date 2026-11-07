"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserProfile, VerificationData } from "@/types";
import {
  ArrowLeft,
  Check,
  Shield,
  ShieldCheck,
  UploadCloud,
  FileText,
  Calendar,
  Mail,
  BarChart2,
  Lock,
  Camera,
  CheckCircle2,
  AlertCircle,
  Clock,
  Phone,
  User,
  MapPin,
  CreditCard,
  Trash2,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import {
  getStoredVerification,
  saveStoredVerification,
} from "@/lib/verificationStore";
import { getStoredUserSync, saveStoredUser } from "@/lib/authStore";

interface IdentityVerificationViewProps {
  currentUser: UserProfile | null;
  onBack?: () => void;
}

export function IdentityVerificationView({
  currentUser,
  onBack,
}: IdentityVerificationViewProps) {
  const router = useRouter();

  const [verification, setVerification] = useState<VerificationData>(() =>
    getStoredVerification(currentUser?.id)
  );

  // Se já estiver aprovado, recusado ou em análise, começa na tela de status (step 5).
  // Se não estiver, começa no step 1 (Contato).
  const [currentStep, setCurrentStep] = useState<number>(() => {
    if (
      verification.status === "approved" ||
      verification.status === "pending" ||
      verification.status === "rejected"
    ) {
      return 5;
    }
    return 1;
  });

  // Sincroniza dados e status mais recentes da API central (cross-browser)
  useEffect(() => {
    const fetchLatest = async () => {
      try {
        const query = new URLSearchParams();
        if (currentUser?.id) query.set("userId", currentUser.id);
        if (currentUser?.email) query.set("email", currentUser.email);
        if (!query.toString()) return;

        const res = await fetch(`/api/verifications?${query.toString()}`);
        if (res.ok) {
          const json = await res.json();
          if (json.submission) {
            const sub = json.submission;
            setVerification((prev) => {
              const updated = {
                ...prev,
                ...sub,
                status: sub.status || prev.status,
                approvedAt: sub.approvedAt || prev.approvedAt,
                rejectionReason: sub.rejectionReason || prev.rejectionReason,
              };
              if (typeof window !== "undefined") {
                try {
                  const uid = sub.userId || currentUser?.id;
                  if (uid) {
                    localStorage.setItem(`central_verification_data_${uid}`, JSON.stringify(updated));
                  }
                  localStorage.setItem("central_verification_data", JSON.stringify(updated));
                } catch {}
              }
              return updated;
            });

            if (sub.status === "approved" || sub.status === "rejected" || sub.status === "pending") {
              setCurrentStep(5);
            }
            if (sub.docFrontFile) setDocFrontFile(sub.docFrontFile);
            if (sub.docFrontName) setDocFrontName(sub.docFrontName);
            if (sub.docBackFile) setDocBackFile(sub.docBackFile);
            if (sub.docBackName) setDocBackName(sub.docBackName);
            if (sub.docSelfieFile) setDocSelfieFile(sub.docSelfieFile);
            if (sub.docSelfieName) setDocSelfieName(sub.docSelfieName);
            if (sub.addressProofFile) setAddressProofFile(sub.addressProofFile);
            if (sub.addressProofName) setAddressProofName(sub.addressProofName);

            // Sincroniza no authStore o usuário local
            const cur = getStoredUserSync();
            if (cur && sub.status && cur.verificationStatus !== sub.status) {
              const updatedUser = {
                ...cur,
                verificationStatus: sub.status,
                isVerified: sub.status === "approved",
                role: sub.status === "approved" ? "seller" : (cur.role === "admin" ? "admin" : "buyer"),
              };
              saveStoredUser(updatedUser as any);
            }
          }
        }
      } catch {}
    };

    fetchLatest();
    const interval = setInterval(fetchLatest, 3000);
    window.addEventListener("central_verifications_changed", fetchLatest);
    window.addEventListener("central_auth_changed", fetchLatest);
    window.addEventListener("storage", fetchLatest);
    return () => {
      clearInterval(interval);
      window.removeEventListener("central_verifications_changed", fetchLatest);
      window.removeEventListener("central_auth_changed", fetchLatest);
      window.removeEventListener("storage", fetchLatest);
    };
  }, [currentUser?.id, currentUser?.email]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgressText, setSubmitProgressText] = useState("");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // Form State - Etapa 1: Contato
  const [email, setEmail] = useState(verification.email || currentUser?.email || "");
  const [phone, setPhone] = useState(verification.phone || currentUser?.phone || "");
  const [pixKey, setPixKey] = useState(
    verification.pixKey || verification.email || currentUser?.email || ""
  );
  const [pixType, setPixType] = useState<"cpf" | "email" | "phone" | "random">(
    verification.pixType || "cpf"
  );

  // Form State - Etapa 2: Seus Dados
  const [fullName, setFullName] = useState(
    verification.fullName || currentUser?.name || ""
  );
  const [cpf, setCpf] = useState(verification.cpf || "");
  const [birthDate, setBirthDate] = useState(verification.birthDate || "");
  const [motherName, setMotherName] = useState(
    verification.motherName || ""
  );
  const [nationality, setNationality] = useState(
    verification.nationality || "Brasileira"
  );

  // Form State - Etapa 3: Endereço
  const [cep, setCep] = useState(verification.cep || "");
  const [street, setStreet] = useState(verification.street || "");
  const [number, setNumber] = useState(verification.number || "");
  const [complement, setComplement] = useState(verification.complement || "");
  const [neighborhood, setNeighborhood] = useState(
    verification.neighborhood || ""
  );
  const [city, setCity] = useState(verification.city || "");
  const [state, setState] = useState(verification.state || "SP");
  const [addressProofName, setAddressProofName] = useState(
    verification.addressProofName || ""
  );
  const [addressProofFile, setAddressProofFile] = useState(
    verification.addressProofFile || ""
  );
  const [isSearchingCep, setIsSearchingCep] = useState(false);

  // Form State - Etapa 4: Identidade
  const [documentType, setDocumentType] = useState<"RG" | "CNH" | "Passaporte">(
    verification.documentType || "RG"
  );
  const [documentNumber, setDocumentNumber] = useState(
    verification.documentNumber || ""
  );
  const [issuingAgency, setIssuingAgency] = useState(
    verification.issuingAgency || ""
  );
  const [docFrontName, setDocFrontName] = useState(
    verification.docFrontName || ""
  );
  const [docFrontFile, setDocFrontFile] = useState(
    verification.docFrontFile || ""
  );
  const [docBackName, setDocBackName] = useState(
    verification.docBackName || ""
  );
  const [docBackFile, setDocBackFile] = useState(
    verification.docBackFile || ""
  );
  const [docSelfieName, setDocSelfieName] = useState(
    verification.docSelfieName || ""
  );
  const [docSelfieFile, setDocSelfieFile] = useState(
    verification.docSelfieFile || ""
  );

  // Processador de imagens para Data URL otimizada e nítida
  const processFileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => resolve("");
        reader.readAsDataURL(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (!result) return resolve("");

        const img = new Image();
        img.onload = () => {
          const MAX_DIM = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_DIM) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }

          try {
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const compressed = canvas.toDataURL("image/jpeg", 0.85);
              resolve(compressed);
              return;
            }
          } catch {}
          resolve(result);
        };
        img.onerror = () => resolve(result);
        img.src = result;
      };
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });
  };

  // Upload real de arquivos com leitura de imagem
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setName: (name: string) => void,
    setFile: (dataUrl: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setName(file.name);
      const dataUrl = await processFileToDataUrl(file);
      setFile(dataUrl);
    }
  };

  // Mascaradores auxiliares
  const formatPhone = (val: string) => {
    const raw = val.replace(/\D/g, "").slice(0, 11);
    if (raw.length <= 2) return raw;
    if (raw.length <= 7) return `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7, 11)}`;
  };

  const formatCpf = (val: string) => {
    const raw = val.replace(/\D/g, "").slice(0, 11);
    if (raw.length <= 3) return raw;
    if (raw.length <= 6) return `${raw.slice(0, 3)}.${raw.slice(3)}`;
    if (raw.length <= 9) return `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6)}`;
    return `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6, 9)}-${raw.slice(9, 11)}`;
  };

  const formatBirth = (val: string) => {
    const raw = val.replace(/\D/g, "").slice(0, 8);
    if (raw.length <= 2) return raw;
    if (raw.length <= 4) return `${raw.slice(0, 2)}/${raw.slice(2)}`;
    return `${raw.slice(0, 2)}/${raw.slice(2, 4)}/${raw.slice(4, 8)}`;
  };

  const formatCep = (val: string) => {
    const raw = val.replace(/\D/g, "").slice(0, 8);
    if (raw.length <= 5) return raw;
    return `${raw.slice(0, 5)}-${raw.slice(5, 8)}`;
  };

  // Busca automática via CEP
  const handleCepChange = async (val: string) => {
    const formatted = formatCep(val);
    setCep(formatted);
    const clean = val.replace(/\D/g, "");
    if (clean.length === 8) {
      setIsSearchingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
        const data = await res.json();
        if (!data.erro) {
          if (data.logradouro) setStreet(data.logradouro);
          if (data.bairro) setNeighborhood(data.bairro);
          if (data.localidade) setCity(data.localidade);
          if (data.uf) setState(data.uf);
        }
      } catch {}
      setIsSearchingCep(false);
    }
  };

  // Validação e avanço de etapas (TUDO RIGOROSAMENTE OBRIGATÓRIO)
  const handleNextStep = () => {
    setFeedbackError(null);

    // ETAPA 1: CONTATO
    if (currentStep === 1) {
      if (!email.trim() || !email.includes("@")) {
        setFeedbackError("Por favor, preencha um e-mail válido para notificações e contato.");
        return;
      }
      const rawPhone = phone.replace(/\D/g, "");
      if (!phone.trim() || rawPhone.length < 10) {
        setFeedbackError("Por favor, preencha seu celular / WhatsApp com DDD (mínimo 10 dígitos).");
        return;
      }
      if (!pixKey.trim()) {
        setFeedbackError("Por favor, informe sua chave PIX para recebimento das vendas.");
        return;
      }
      setCurrentStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // ETAPA 2: DADOS PESSOAIS
    if (currentStep === 2) {
      if (!fullName.trim() || fullName.trim().split(" ").length < 2) {
        setFeedbackError("Por favor, preencha seu nome completo (nome e sobrenome).");
        return;
      }
      const rawCpf = cpf.replace(/\D/g, "");
      if (!cpf.trim() || rawCpf.length !== 11) {
        setFeedbackError("Por favor, preencha um CPF válido com 11 dígitos.");
        return;
      }
      const rawBirth = birthDate.replace(/\D/g, "");
      if (!birthDate.trim() || rawBirth.length < 8) {
        setFeedbackError("Por favor, informe sua data de nascimento completa (DD/MM/AAAA).");
        return;
      }
      if (!motherName.trim()) {
        setFeedbackError("Por favor, informe o nome completo da sua mãe.");
        return;
      }
      if (!nationality.trim()) {
        setFeedbackError("Por favor, informe a sua nacionalidade.");
        return;
      }
      setCurrentStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // ETAPA 3: ENDEREÇO & COMPROVANTE
    if (currentStep === 3) {
      const rawCep = cep.replace(/\D/g, "");
      if (!cep.trim() || rawCep.length < 8) {
        setFeedbackError("Por favor, informe um CEP válido com 8 dígitos.");
        return;
      }
      if (!street.trim()) {
        setFeedbackError("Por favor, preencha o logradouro / endereço residencial.");
        return;
      }
      if (!number.trim()) {
        setFeedbackError("Por favor, informe o número da residência (ou 'S/N' se não houver).");
        return;
      }
      if (!neighborhood.trim()) {
        setFeedbackError("Por favor, informe o bairro residencial.");
        return;
      }
      if (!city.trim()) {
        setFeedbackError("Por favor, informe a cidade.");
        return;
      }
      if (!state.trim() || state.trim().length !== 2) {
        setFeedbackError("Por favor, informe o estado / UF com 2 letras (ex: SP, RJ, RN).");
        return;
      }
      if (!addressProofName) {
        setFeedbackError("Por favor, anexe o comprovante de residência (conta de água, luz, gás ou internet).");
        return;
      }
      setCurrentStep(4);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
  };

  // Envio final da verificação para análise do Admin
  const handleSubmitVerification = async () => {
    setFeedbackError(null);
    if (!documentNumber.trim()) {
      setFeedbackError("Por favor, informe o número do documento de identidade.");
      return;
    }
    if (!issuingAgency.trim()) {
      setFeedbackError("Por favor, informe o órgão emissor e estado (ex: SSP/SP, DETRAN, etc).");
      return;
    }
    if (!docFrontName) {
      setFeedbackError("Por favor, anexe a foto nítida da frente do seu documento.");
      return;
    }
    if (!docBackName) {
      setFeedbackError("Por favor, anexe a foto nítida do verso do seu documento.");
      return;
    }
    if (!docSelfieName) {
      setFeedbackError("Por favor, anexe a selfie segurando o documento próximo ao rosto.");
      return;
    }

    setIsSubmitting(true);
    setSubmitProgressText("Criptografando dados e documentos...");
    await new Promise((r) => setTimeout(r, 600));

    setSubmitProgressText("Enviando solicitação para análise da moderação...");
    await new Promise((r) => setTimeout(r, 700));

    const now = new Date();
    const formattedDate = `${now.toLocaleDateString("pt-BR")}, ${now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;

    const newVerifData: VerificationData = {
      email,
      phone,
      pixKey,
      pixType,
      fullName,
      cpf,
      birthDate,
      motherName,
      nationality,
      cep,
      street,
      number,
      complement,
      neighborhood,
      city,
      state,
      addressProofFile,
      addressProofName,
      documentType,
      documentNumber,
      issuingAgency,
      docFrontFile,
      docFrontName,
      docBackFile,
      docBackName,
      docSelfieFile,
      docSelfieName,
      status: "pending",
      submittedAt: formattedDate,
    };

    setVerification(newVerifData);
    await saveStoredVerification(currentUser?.id || "default", newVerifData);

    setIsSubmitting(false);
    setCurrentStep(5);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const stepsMeta = [
    { num: 1, label: "Contato" },
    { num: 2, label: "Seus dados" },
    { num: 3, label: "Endereço" },
    { num: 4, label: "Identidade" },
  ];

  return (
    <div className="space-y-6">
      {/* ========================================================
          CARD PRINCIPAL: Design do site (Branco, clean, azul elétrico)
          ======================================================== */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200 shadow-xs relative">
        {/* CABEÇALHO DO CARD COM BOTÃO VOLTAR SE APLICÁVEL */}
        <div className="flex items-center justify-between pb-6 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            {currentStep > 1 && currentStep < 5 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep - 1)}
                className="w-9 h-9 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-600 hover:text-black flex items-center justify-center transition-colors cursor-pointer"
                title="Voltar etapa"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="w-9 h-9 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-600 hover:text-black flex items-center justify-center transition-colors cursor-pointer"
                title="Voltar para Minha Conta"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : null}
            <div>
              <h2 className="text-base sm:text-lg font-black text-zinc-950 tracking-tight">
                Verificação de identidade
              </h2>
              <p className="text-xs text-zinc-500 font-medium mt-0.5">
                Valide seus dados e envie seus documentos para se tornar um vendedor verificado no PlayContas.
              </p>
            </div>
          </div>

          {currentUser?.isVerified || verification.status === "approved" ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Verificado</span>
            </span>
          ) : verification.status === "rejected" ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Recusada</span>
            </span>
          ) : verification.status === "pending" ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Em Análise</span>
            </span>
          ) : null}
        </div>

        {/* ========================================================
            STEPPER HORIZONTAL (Design Central das Ias)
            ======================================================== */}
        <div className="py-6 border-b border-zinc-100">
          <div className="max-w-md mx-auto flex items-center justify-between relative px-2">
            {stepsMeta.map((s, idx) => {
              const isCompleted = currentStep > s.num || currentStep === 5;
              const isCurrent = currentStep === s.num && currentStep !== 5;

              return (
                <React.Fragment key={s.num}>
                  {/* Círculo do Passo */}
                  <div
                    className="flex flex-col items-center relative z-10 cursor-pointer"
                    onClick={() => {
                      if (currentStep === 5 || s.num < currentStep) {
                        setCurrentStep(s.num);
                      }
                    }}
                  >
                    <div
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-all duration-300 ${
                        isCompleted
                          ? "bg-[#0066FF] text-white shadow-sm shadow-blue-500/20"
                          : isCurrent
                          ? "bg-[#0066FF] text-white ring-4 ring-blue-500/20 shadow-md shadow-blue-500/30 scale-105"
                          : "bg-zinc-100 text-zinc-400 border border-zinc-200"
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.8]" />
                      ) : (
                        s.num
                      )}
                    </div>
                    <span
                      className={`text-[11px] sm:text-xs font-bold mt-2 transition-colors whitespace-nowrap ${
                        isCompleted || isCurrent ? "text-zinc-900" : "text-zinc-400"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>

                  {/* Linha conectora */}
                  {idx < stepsMeta.length - 1 && (
                    <div className="flex-1 h-[2px] mx-2 -mt-5 bg-zinc-200 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          currentStep > s.num || currentStep === 5
                            ? "bg-[#0066FF]"
                            : "bg-transparent"
                        }`}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* FEEDBACK DE ERRO SE HOUVER */}
        {feedbackError && (
          <div className="my-5 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center gap-3 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="font-semibold">{feedbackError}</span>
          </div>
        )}

        {/* ========================================================
            ETAPA 1: CONTATO
            ======================================================== */}
        {currentStep === 1 && (
          <div className="pt-6 max-w-lg mx-auto space-y-5">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-[#0066FF] flex items-center justify-center mx-auto mb-2.5">
                <Phone className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-zinc-950">Informações de Contato</h3>
              <p className="text-xs text-zinc-500">
                Usaremos estes canais para notificações de vendas e confirmações da sua conta.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  Email:
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seuemail@exemplo.com"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl pl-10 pr-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#0066FF] focus:bg-white transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  Celular / WhatsApp (com DDD)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl pl-10 pr-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#0066FF] focus:bg-white transition-all font-medium font-mono"
                  />
                </div>
                <span className="text-[11px] text-zinc-400 mt-1 block">
                  Usado para alertas imediatos de pedidos recebidos.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  Chave PIX para Receber Saques
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[
                    { id: "email", label: "E-mail" },
                    { id: "cpf", label: "CPF" },
                    { id: "phone", label: "Telefone" },
                    { id: "random", label: "Aleatória" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPixType(opt.id as any)}
                      className={`py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        pixType === opt.id
                          ? "bg-[#0066FF] border-[#0066FF] text-white shadow-2xs"
                          : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <CreditCard className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={pixKey}
                    onChange={(e) => setPixKey(e.target.value)}
                    placeholder="Informe sua chave PIX para repasse"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl pl-10 pr-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#0066FF] focus:bg-white transition-all font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3">
              <button
                type="button"
                onClick={handleNextStep}
                className="w-full py-3.5 rounded-2xl bg-black hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                Continuar para Seus Dados
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            ETAPA 2: SEUS DADOS PESSOAIS
            ======================================================== */}
        {currentStep === 2 && (
          <div className="pt-6 max-w-lg mx-auto space-y-5">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-[#0066FF] flex items-center justify-center mx-auto mb-2.5">
                <User className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-zinc-950">Dados Pessoais</h3>
              <p className="text-xs text-zinc-500">
                Preencha exatamente como está impresso em seu documento oficial com foto.
              </p>
            </div>

            <div className="space-y-3.5 pt-1">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  Nome Completo
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nome completo do titular"
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#0066FF] focus:bg-white transition-all font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                    CPF
                  </label>
                  <input
                    type="text"
                    value={cpf}
                    onChange={(e) => setCpf(formatCpf(e.target.value))}
                    placeholder="000.000.000-00"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#0066FF] focus:bg-white transition-all font-mono font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                    Data de Nascimento
                  </label>
                  <input
                    type="text"
                    value={birthDate}
                    onChange={(e) => setBirthDate(formatBirth(e.target.value))}
                    placeholder="DD/MM/AAAA"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#0066FF] focus:bg-white transition-all font-mono font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  Nome Completo da Mãe
                </label>
                <input
                  type="text"
                  value={motherName}
                  onChange={(e) => setMotherName(e.target.value)}
                  placeholder="Nome completo da sua mãe"
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#0066FF] focus:bg-white transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  Nacionalidade
                </label>
                <input
                  type="text"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#0066FF] focus:bg-white transition-all font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="w-full py-3.5 rounded-2xl border border-zinc-200 hover:bg-zinc-100 text-zinc-700 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleNextStep}
                className="w-full py-3.5 rounded-2xl bg-black hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            ETAPA 3: ENDEREÇO & COMPROVANTE
            ======================================================== */}
        {currentStep === 3 && (
          <div className="pt-6 max-w-lg mx-auto space-y-5">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-[#0066FF] flex items-center justify-center mx-auto mb-2.5">
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-zinc-950">Endereço Residencial</h3>
              <p className="text-xs text-zinc-500">
                Informe onde você reside e anexe um comprovante de endereço emitido há menos de 90 dias.
              </p>
            </div>

            <div className="space-y-3.5 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                    CEP {isSearchingCep && <span className="text-[#0066FF] font-normal">(buscando...)</span>}
                  </label>
                  <input
                    type="text"
                    value={cep}
                    onChange={(e) => handleCepChange(e.target.value)}
                    placeholder="00000-000"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#0066FF] focus:bg-white transition-all font-mono font-medium"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                    Rua / Logradouro
                  </label>
                  <input
                    type="text"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="Ex: Av. Paulista"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#0066FF] focus:bg-white transition-all font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                    Número
                  </label>
                  <input
                    type="text"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="Ex: 100"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#0066FF] focus:bg-white transition-all font-medium"
                  />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                    Complemento (opcional)
                  </label>
                  <input
                    type="text"
                    value={complement}
                    onChange={(e) => setComplement(e.target.value)}
                    placeholder="Apto, Bloco, etc."
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#0066FF] focus:bg-white transition-all font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                    Bairro
                  </label>
                  <input
                    type="text"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#0066FF] focus:bg-white transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                    Cidade
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#0066FF] focus:bg-white transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                    Estado (UF)
                  </label>
                  <input
                    type="text"
                    value={state}
                    maxLength={2}
                    onChange={(e) => setState(e.target.value.toUpperCase())}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#0066FF] focus:bg-white transition-all uppercase font-mono font-medium"
                  />
                </div>
              </div>

              {/* Upload Comprovante de Residência */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  Comprovante de Residência (Máx. 90 dias)
                </label>
                <label className="border-2 border-dashed border-zinc-200 hover:border-[#0066FF] bg-zinc-50 hover:bg-blue-50/20 rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all group">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => handleFileUpload(e, setAddressProofName, setAddressProofFile)}
                    className="hidden"
                  />
                  {addressProofFile && addressProofFile.startsWith("data:image") ? (
                    <div className="flex flex-col items-center gap-2">
                      <img
                        src={addressProofFile}
                        alt="Comprovante"
                        className="w-24 h-24 object-cover rounded-xl border border-zinc-300 shadow-xs"
                      />
                      <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="truncate max-w-[220px]">{addressProofName}</span>
                      </div>
                      <span className="text-[11px] text-[#0066FF] font-bold">Clique para alterar foto</span>
                    </div>
                  ) : addressProofName ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <FileText className="w-8 h-8 text-[#0066FF]" />
                      <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="truncate max-w-[220px]">{addressProofName}</span>
                      </div>
                      <span className="text-[11px] text-[#0066FF] font-bold">Clique para alterar anexo</span>
                    </div>
                  ) : (
                    <>
                      <UploadCloud className="w-7 h-7 text-zinc-400 group-hover:text-[#0066FF] mb-1.5 transition-colors" />
                      <span className="text-xs font-bold text-zinc-800">
                        Clique ou arraste seu comprovante
                      </span>
                      <span className="text-[11px] text-zinc-400 mt-0.5">
                        PDF, PNG ou JPG (Conta de luz, água ou internet)
                      </span>
                    </>
                  )}
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="w-full py-3.5 rounded-2xl border border-zinc-200 hover:bg-zinc-100 text-zinc-700 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleNextStep}
                className="w-full py-3.5 rounded-2xl bg-black hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            ETAPA 4: IDENTIDADE & DOCUMENTOS
            ======================================================== */}
        {currentStep === 4 && (
          <div className="pt-6 max-w-lg mx-auto space-y-5">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-[#0066FF] flex items-center justify-center mx-auto mb-2.5">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-zinc-950">Documentos de Identidade</h3>
              <p className="text-xs text-zinc-500">
                Envie fotos nítidas do seu documento e uma selfie segurando-o para validação biométrica.
              </p>
            </div>

            <div className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  Tipo de Documento
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["RG", "CNH", "Passaporte"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setDocumentType(t)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        documentType === t
                          ? "bg-[#0066FF] border-[#0066FF] text-white shadow-xs"
                          : "bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                    Número do Documento
                  </label>
                  <input
                    type="text"
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    placeholder="Ex: 003.123.456"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#0066FF] focus:bg-white transition-all font-mono font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                    Órgão Emissor / UF
                  </label>
                  <input
                    type="text"
                    value={issuingAgency}
                    onChange={(e) => setIssuingAgency(e.target.value)}
                    placeholder="Ex: SSP/SP"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#0066FF] focus:bg-white transition-all font-medium"
                  />
                </div>
              </div>

              {/* 3 Uploads */}
              <div className="space-y-3 pt-1">
                {/* 1. Frente */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    1. Foto da Frente do Documento
                  </label>
                  <label className="border border-dashed border-zinc-300 hover:border-[#0066FF] bg-zinc-50 hover:bg-blue-50/20 rounded-xl p-3 flex items-center justify-between cursor-pointer transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, setDocFrontName, setDocFrontFile)}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2.5">
                      {docFrontFile && docFrontFile.startsWith("data:image") ? (
                        <img
                          src={docFrontFile}
                          alt="Frente"
                          className="w-12 h-12 object-cover rounded-lg border border-zinc-300 shrink-0 shadow-xs"
                        />
                      ) : (
                        <FileText className="w-5 h-5 text-[#0066FF] shrink-0" />
                      )}
                      <div>
                        <span className="text-xs text-zinc-800 font-bold truncate max-w-[220px] block">
                          {docFrontName || "Selecionar foto da frente"}
                        </span>
                        {docFrontFile && (
                          <span className="text-[10px] text-emerald-600 font-semibold block">
                            Foto anexada com sucesso
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-[#0066FF] shrink-0">
                      {docFrontName ? "Trocar" : "Enviar"}
                    </span>
                  </label>
                </div>

                {/* 2. Verso */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    2. Foto do Verso do Documento
                  </label>
                  <label className="border border-dashed border-zinc-300 hover:border-[#0066FF] bg-zinc-50 hover:bg-blue-50/20 rounded-xl p-3 flex items-center justify-between cursor-pointer transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, setDocBackName, setDocBackFile)}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2.5">
                      {docBackFile && docBackFile.startsWith("data:image") ? (
                        <img
                          src={docBackFile}
                          alt="Verso"
                          className="w-12 h-12 object-cover rounded-lg border border-zinc-300 shrink-0 shadow-xs"
                        />
                      ) : (
                        <FileText className="w-5 h-5 text-[#0066FF] shrink-0" />
                      )}
                      <div>
                        <span className="text-xs text-zinc-800 font-bold truncate max-w-[220px] block">
                          {docBackName || "Selecionar foto do verso"}
                        </span>
                        {docBackFile && (
                          <span className="text-[10px] text-emerald-600 font-semibold block">
                            Foto anexada com sucesso
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-[#0066FF] shrink-0">
                      {docBackName ? "Trocar" : "Enviar"}
                    </span>
                  </label>
                </div>

                {/* 3. Selfie segurando documento */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    3. Selfie Segurando o Documento
                  </label>
                  <label className="border border-dashed border-zinc-300 hover:border-[#0066FF] bg-zinc-50 hover:bg-blue-50/20 rounded-xl p-3 flex items-center justify-between cursor-pointer transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, setDocSelfieName, setDocSelfieFile)}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2.5">
                      {docSelfieFile && docSelfieFile.startsWith("data:image") ? (
                        <img
                          src={docSelfieFile}
                          alt="Selfie"
                          className="w-12 h-12 object-cover rounded-lg border border-zinc-300 shrink-0 shadow-xs"
                        />
                      ) : (
                        <Camera className="w-5 h-5 text-[#0066FF] shrink-0" />
                      )}
                      <div>
                        <span className="text-xs text-zinc-800 font-bold truncate max-w-[220px] block">
                          {docSelfieName || "Tirar ou enviar selfie"}
                        </span>
                        {docSelfieFile && (
                          <span className="text-[10px] text-emerald-600 font-semibold block">
                            Selfie anexada com sucesso
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-[#0066FF] shrink-0">
                      {docSelfieName ? "Trocar" : "Enviar"}
                    </span>
                  </label>
                  <span className="text-[10px] text-zinc-400 mt-1 block">
                    Segure o documento próximo ao queixo sem tapar o rosto ou dados.
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setCurrentStep(3)}
                className="w-full py-3.5 rounded-2xl border border-zinc-200 hover:bg-zinc-100 text-zinc-700 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmitVerification}
                className="w-full py-3.5 rounded-2xl bg-[#0066FF] hover:bg-[#0052CC] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-blue-500/25 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{submitProgressText}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Enviar para Análise</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            ETAPA 5: STATUS DA VERIFICAÇÃO (APROVADA / EM ANÁLISE / REJEITADA)
            ======================================================== */}
        {currentStep === 5 && (
          <div className="pt-6 max-w-lg mx-auto text-center space-y-6 animate-fadeIn">
            {verification.status === "approved" ? (
              <>
                <div>
                  <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
                    <Check className="w-8 h-8 stroke-[3]" />
                  </div>

                  <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
                    Conta aprovada
                  </h2>

                  <p className="text-xs sm:text-sm text-zinc-500 max-w-md mx-auto mt-1.5 leading-relaxed font-medium">
                    Sua verificação foi concluída com sucesso. Sua conta está liberada para continuar usando todos os recursos de vendedor.
                  </p>

                  <div className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Aprovada</span>
                  </div>
                </div>

                {/* Card de Resumo Interno */}
                <div className="bg-zinc-50 border border-zinc-200 rounded-2xl overflow-hidden divide-y divide-zinc-200 text-left text-xs sm:text-sm">
                  <div className="flex items-center justify-between p-3.5 sm:p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0066FF] flex items-center justify-center">
                        <BarChart2 className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-zinc-900">Status</span>
                    </div>
                    <span className="font-bold text-emerald-600">Aprovada</span>
                  </div>

                  <div className="flex items-center justify-between p-3.5 sm:p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0066FF] flex items-center justify-center">
                        <FileText className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-zinc-900">Documento</span>
                    </div>
                    <span className="font-bold text-zinc-700">
                      {verification.documentType || "RG"} {verification.documentNumber ? `nº ${verification.documentNumber}` : ""}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3.5 sm:p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0066FF] flex items-center justify-center">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-zinc-900">Aprovado em</span>
                    </div>
                    <span className="font-bold text-zinc-700 font-mono">
                      {verification.approvedAt || "20/10/2026, 13:49"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3.5 sm:p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0066FF] flex items-center justify-center">
                        <Mail className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-zinc-900">Resultado</span>
                    </div>
                    <span className="font-bold text-zinc-700">Conta liberada para vendas</span>
                  </div>
                </div>
              </>
            ) : verification.status === "rejected" ? (
              <>
                <div>
                  <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
                    <AlertCircle className="w-8 h-8 stroke-[2.5]" />
                  </div>

                  <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
                    Verificação Recusada
                  </h2>

                  <p className="text-xs sm:text-sm text-zinc-500 max-w-md mx-auto mt-1.5 leading-relaxed font-medium">
                    {verification.rejectionReason || "Os dados ou documentos enviados não puderam ser validados. Por favor, revise as informações e envie novamente."}
                  </p>

                  <div className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>Recusada</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="w-full py-3.5 rounded-2xl bg-[#0066FF] hover:bg-blue-600 text-white font-bold text-xs sm:text-sm tracking-wide shadow-md shadow-blue-500/20 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    Corrigir Dados e Reenviar Documentos
                  </button>
                </div>
              </>
            ) : (
              /* STATUS PENDING - EM ANÁLISE */
              <>
                <div>
                  <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 text-amber-500 flex items-center justify-center mx-auto mb-3 shadow-xs">
                    <Clock className="w-8 h-8 stroke-[2.5]" />
                  </div>

                  <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
                    Solicitação enviada para análise!
                  </h2>

                  <p className="text-xs sm:text-sm text-zinc-500 max-w-md mx-auto mt-1.5 leading-relaxed font-medium">
                    Recebemos todos os seus dados e documentos com sucesso. Nossa equipe de moderação está analisando sua solicitação para liberação da conta de vendedor.
                  </p>

                  <div className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span>Aguardando Análise da Moderação</span>
                  </div>
                </div>

                {/* Card de Resumo Interno */}
                <div className="bg-zinc-50 border border-zinc-200 rounded-2xl overflow-hidden divide-y divide-zinc-200 text-left text-xs sm:text-sm">
                  <div className="flex items-center justify-between p-3.5 sm:p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                        <BarChart2 className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-zinc-900">Status</span>
                    </div>
                    <span className="font-bold text-amber-600">Em Análise</span>
                  </div>

                  <div className="flex items-center justify-between p-3.5 sm:p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0066FF] flex items-center justify-center">
                        <FileText className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-zinc-900">Documento Enviado</span>
                    </div>
                    <span className="font-bold text-zinc-700 font-mono">
                      {verification.documentType || "RG"} {verification.documentNumber ? `nº ${verification.documentNumber}` : ""}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3.5 sm:p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0066FF] flex items-center justify-center">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-zinc-900">Data de Envio</span>
                    </div>
                    <span className="font-bold text-zinc-700 font-mono">
                      {verification.submittedAt || "Hoje"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3.5 sm:p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-zinc-900">Previsão</span>
                    </div>
                    <span className="font-bold text-emerald-700">Até 24 horas úteis</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Footer de Segurança com Cadeado */}
        <div className="mt-8 pt-4 border-t border-zinc-100 flex items-center justify-center gap-2 text-[11px] text-zinc-400 text-center font-medium">
          <Lock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span>Seus documentos são usados apenas para a verificação da sua conta.</span>
        </div>
      </div>
    </div>
  );
}
