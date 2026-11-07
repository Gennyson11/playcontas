"use client";

import React, { useState, useEffect } from "react";
import { VerificationSubmission, UserProfile } from "@/types";
import {
  getAllVerificationRequests,
  approveVerification,
  rejectVerification,
} from "@/lib/verificationStore";
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Check,
  X,
  FileText,
  User,
  Phone,
  Mail,
  CreditCard,
  MapPin,
  Calendar,
  Camera,
  ExternalLink,
  AlertTriangle,
  Download,
  ZoomIn,
  Sparkles,
} from "lucide-react";

interface AdminVerificationsPanelProps {
  registeredUsers?: UserProfile[];
}

export function AdminVerificationsPanel({ registeredUsers = [] }: AdminVerificationsPanelProps) {
  const [submissions, setSubmissions] = useState<VerificationSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">(
    "all"
  );

  // Modal de Detalhes
  const [selectedSubmission, setSelectedSubmission] = useState<VerificationSubmission | null>(null);

  // Modal de Rejeição
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Modal de Zoom de Imagem
  const [zoomedImage, setZoomedImage] = useState<{ title: string; url: string } | null>(null);

  // Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadSubmissions = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const data = await getAllVerificationRequests(registeredUsers);
      setSubmissions(data);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions(true);
    const handleUpdate = () => loadSubmissions(false);
    window.addEventListener("central_verifications_changed", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    // Polling a cada 3.5 segundos para sincronização em tempo real entre navegadores diferentes
    const interval = setInterval(() => {
      loadSubmissions(false);
    }, 3500);

    return () => {
      window.removeEventListener("central_verifications_changed", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
      clearInterval(interval);
    };
  }, [registeredUsers]);

  const handleApprove = async (sub: VerificationSubmission) => {
    const updated = await approveVerification(sub.id);
    setSubmissions(updated);
    if (selectedSubmission?.id === sub.id) {
      setSelectedSubmission({ ...sub, status: "approved", approvedAt: "Agora" });
    }
    showToast(`Conta de ${sub.fullName || sub.userName} aprovada como Vendedor!`);
  };

  const handleConfirmReject = async () => {
    if (!rejectingId) return;
    const reason = rejectionReason.trim() || "Documentação ilegível ou divergente.";
    const updated = await rejectVerification(rejectingId, reason);
    setSubmissions(updated);
    if (selectedSubmission?.id === rejectingId) {
      setSelectedSubmission(null);
    }
    setRejectingId(null);
    setRejectionReason("");
    showToast("Solicitação de verificação rejeitada.");
  };

  // Contadores
  const totalCount = submissions.length;
  const pendingCount = submissions.filter((s) => s.status === "pending").length;
  const approvedCount = submissions.filter((s) => s.status === "approved").length;
  const rejectedCount = submissions.filter((s) => s.status === "rejected").length;

  // Filtragem
  const filtered = submissions.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (searchTerm.trim() !== "") {
      const q = searchTerm.toLowerCase();
      return (
        s.userName.toLowerCase().includes(q) ||
        s.fullName?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.cpf?.toLowerCase().includes(q) ||
        s.documentNumber?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* TOAST DE FEEDBACK */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-950 text-white border border-zinc-800 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-fadeIn text-xs sm:text-sm font-bold">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER DA ABA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-zinc-950">
              Verificações de Identidade
            </h2>
            {pendingCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-black animate-pulse">
                {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Analise documentos, dados pessoais e selfies enviadas pelos usuários para liberar permissão de vendas.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadSubmissions(true)}
          className="px-4 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-700 font-bold text-xs transition-colors self-start cursor-pointer"
        >
          Atualizar Lista
        </button>
      </div>

      {/* CARDS DE RESUMO (MÉTRICAS) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div
          onClick={() => setStatusFilter("all")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === "all"
              ? "bg-blue-50/50 border-[#0066FF] shadow-xs"
              : "bg-white border-zinc-200 hover:border-zinc-300"
          }`}
        >
          <div className="text-xs font-bold text-zinc-500">Total Enviadas</div>
          <div className="text-2xl font-black text-zinc-950 mt-1">{totalCount}</div>
        </div>

        <div
          onClick={() => setStatusFilter("pending")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === "pending"
              ? "bg-amber-50 border-amber-500 shadow-xs"
              : "bg-white border-zinc-200 hover:border-zinc-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700">Aguardando Análise</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700 mt-1">{pendingCount}</div>
        </div>

        <div
          onClick={() => setStatusFilter("approved")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === "approved"
              ? "bg-emerald-50 border-emerald-500 shadow-xs"
              : "bg-white border-zinc-200 hover:border-zinc-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700">Aprovados</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1">{approvedCount}</div>
        </div>

        <div
          onClick={() => setStatusFilter("rejected")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === "rejected"
              ? "bg-rose-50 border-rose-500 shadow-xs"
              : "bg-white border-zinc-200 hover:border-zinc-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700">Rejeitados</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-700 mt-1">{rejectedCount}</div>
        </div>
      </div>

      {/* BUSCA E FILTROS */}
      <div className="bg-white rounded-3xl p-5 border border-zinc-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, nome, e-mail ou CPF..."
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#0066FF] transition-all font-medium"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "all", label: "Todos" },
            { id: "pending", label: "Pendentes" },
            { id: "approved", label: "Aprovados" },
            { id: "rejected", label: "Rejeitados" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === tab.id
                  ? "bg-black text-white shadow-2xs"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TABELA DE SOLICITAÇÕES */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-3 border-[#0066FF] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <span className="text-xs text-zinc-500 font-medium">Carregando verificações...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center px-4">
            <ShieldCheck className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-zinc-800">Nenhuma verificação encontrada</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Não há clientes correspondentes aos filtros selecionados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50/80 border-b border-zinc-200 text-[11px] font-black uppercase text-zinc-500 tracking-wider">
                <tr>
                  <th className="py-3.5 px-5">Cliente</th>
                  <th className="py-3.5 px-4">Documento</th>
                  <th className="py-3.5 px-4">Endereço</th>
                  <th className="py-3.5 px-4">Enviado em</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((sub) => {
                  return (
                    <tr key={sub.id} className="hover:bg-zinc-50/50 transition-colors">
                      {/* Cliente */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              sub.userAvatar ||
                              `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
                                sub.userName
                              )}`
                            }
                            alt={sub.userName}
                            className="w-10 h-10 rounded-full object-cover border border-zinc-200 shrink-0 bg-zinc-100"
                          />
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-zinc-950 text-xs sm:text-sm">
                                {sub.fullName || sub.userName}
                              </span>
                              <span className="text-[9px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                                Conta no site
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-400 font-mono">
                              {sub.email}
                            </div>
                            <div className="text-[10px] text-zinc-500 mt-0.5">
                              CPF: {sub.cpf || "Não informado"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Documento */}
                      <td className="py-4 px-4">
                        <div className="text-xs font-bold text-zinc-800">
                          {sub.documentType} · {sub.documentNumber}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {sub.issuingAgency || "SSP"}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-blue-600 font-semibold">
                          <FileText className="w-3 h-3" />
                          <span>3 arquivos anexados</span>
                        </div>
                      </td>

                      {/* Endereço */}
                      <td className="py-4 px-4">
                        <div className="text-xs font-medium text-zinc-800 truncate max-w-[180px]">
                          {sub.city} - {sub.state}
                        </div>
                        <div className="text-[11px] text-zinc-400 truncate max-w-[180px]">
                          {sub.street}, {sub.number}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          CEP: {sub.cep}
                        </div>
                      </td>

                      {/* Data */}
                      <td className="py-4 px-4 text-xs text-zinc-600 font-mono">
                        {sub.submittedAt || "Recente"}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        {sub.status === "approved" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Aprovada</span>
                          </span>
                        ) : sub.status === "rejected" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            <span>Rejeitada</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            <span>Pendente</span>
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedSubmission(sub)}
                            className="p-2 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-700 font-bold text-xs transition-colors cursor-pointer"
                            title="Ver Detalhes e Documentos"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {sub.status !== "approved" && (
                            <button
                              type="button"
                              onClick={() => handleApprove(sub)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs active:scale-95 flex items-center gap-1"
                              title="Aprovar Vendedor"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Aprovar</span>
                            </button>
                          )}

                          {sub.status !== "rejected" && (
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingId(sub.id);
                                setRejectionReason("");
                              }}
                              className="p-2 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 transition-colors cursor-pointer"
                              title="Rejeitar Solicitação"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================================================================
          MODAL DE DETALHES COMPLETOS E ANÁLISE DE DOCUMENTOS
          ========================================================================= */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-zinc-200 animate-fadeIn">
            {/* Cabeçalho do Modal */}
            <div className="sticky top-0 bg-white border-b border-zinc-100 p-5 sm:p-6 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <img
                  src={
                    selectedSubmission.userAvatar ||
                    `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
                      selectedSubmission.userName
                    )}`
                  }
                  alt={selectedSubmission.userName}
                  className="w-12 h-12 rounded-full border border-zinc-200 object-cover bg-zinc-100"
                />
                <div>
                  <h3 className="text-base font-black text-zinc-950">
                    {selectedSubmission.fullName || selectedSubmission.userName}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span>{selectedSubmission.email}</span>
                    <span>•</span>
                    <span className="font-mono">{selectedSubmission.phone}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-5 sm:p-6 space-y-6">
              {/* STATUS ATUAL */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 border border-zinc-200">
                <div>
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
                    Status da Verificação
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    {selectedSubmission.status === "approved" ? (
                      <span className="text-sm font-black text-emerald-600 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Aprovada como Vendedor</span>
                      </span>
                    ) : selectedSubmission.status === "rejected" ? (
                      <span className="text-sm font-black text-rose-600 flex items-center gap-1.5">
                        <XCircle className="w-4 h-4" />
                        <span>Rejeitada</span>
                      </span>
                    ) : (
                      <span className="text-sm font-black text-amber-600 flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        <span>Aguardando sua Aprovação</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right text-xs text-zinc-500">
                  <span>Enviado em: </span>
                  <span className="font-mono font-bold text-zinc-800">
                    {selectedSubmission.submittedAt || "Recente"}
                  </span>
                </div>
              </div>

              {/* SEÇÃO 1: DADOS PESSOAIS */}
              <div>
                <h4 className="text-xs font-black text-zinc-950 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-[#0066FF]" />
                  <span>Dados Pessoais do Titular</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-zinc-50 p-4 rounded-2xl border border-zinc-200 text-xs">
                  <div>
                    <span className="text-zinc-400 block font-medium">Nome Completo:</span>
                    <span className="font-bold text-zinc-900 mt-0.5 block">
                      {selectedSubmission.fullName || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block font-medium">CPF:</span>
                    <span className="font-bold text-zinc-900 mt-0.5 block font-mono">
                      {selectedSubmission.cpf || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block font-medium">Nascimento:</span>
                    <span className="font-bold text-zinc-900 mt-0.5 block font-mono">
                      {selectedSubmission.birthDate || "—"}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-zinc-400 block font-medium">Nome da Mãe:</span>
                    <span className="font-bold text-zinc-900 mt-0.5 block">
                      {selectedSubmission.motherName || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block font-medium">Nacionalidade:</span>
                    <span className="font-bold text-zinc-900 mt-0.5 block">
                      {selectedSubmission.nationality || "Brasileira"}
                    </span>
                  </div>
                </div>
              </div>

              {/* SEÇÃO 2: CONTATO & CHAVE PIX */}
              <div>
                <h4 className="text-xs font-black text-zinc-950 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#0066FF]" />
                  <span>Contato e Recebimento de Saques</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-50 p-4 rounded-2xl border border-zinc-200 text-xs">
                  <div>
                    <span className="text-zinc-400 block font-medium">WhatsApp / Telefone:</span>
                    <span className="font-bold text-zinc-900 mt-0.5 block font-mono">
                      {selectedSubmission.phone || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block font-medium">
                      Chave PIX ({selectedSubmission.pixType?.toUpperCase() || "PIX"}):
                    </span>
                    <span className="font-bold text-zinc-900 mt-0.5 block font-mono text-[#0066FF]">
                      {selectedSubmission.pixKey || selectedSubmission.email}
                    </span>
                  </div>
                </div>
              </div>

              {/* SEÇÃO 3: ENDEREÇO & COMPROVANTE */}
              <div>
                <h4 className="text-xs font-black text-zinc-950 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#0066FF]" />
                  <span>Endereço Residencial e Comprovante</span>
                </h4>
                <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200 space-y-3 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div>
                      <span className="text-zinc-400 block font-medium">Logradouro:</span>
                      <span className="font-bold text-zinc-900 mt-0.5 block">
                        {selectedSubmission.street}, {selectedSubmission.number}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block font-medium">Bairro:</span>
                      <span className="font-bold text-zinc-900 mt-0.5 block">
                        {selectedSubmission.neighborhood}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block font-medium">Cidade/UF:</span>
                      <span className="font-bold text-zinc-900 mt-0.5 block">
                        {selectedSubmission.city} - {selectedSubmission.state}
                      </span>
                    </div>
                  </div>

                  {/* Comprovante */}
                  <div className="pt-2 border-t border-zinc-200/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#0066FF]" />
                      <span className="font-bold text-zinc-800">
                        {selectedSubmission.addressProofName || "comprovante_residencia.pdf"}
                      </span>
                    </div>
                    {selectedSubmission.addressProofFile ? (
                      <button
                        type="button"
                        onClick={() =>
                          setZoomedImage({
                            title: `Comprovante de Residência (${selectedSubmission.addressProofName || "Anexo"})`,
                            url: selectedSubmission.addressProofFile!,
                          })
                        }
                        className="text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-lg border border-blue-200 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                        <span>Ver Comprovante</span>
                      </button>
                    ) : (
                      <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        Anexo Registrado
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* SEÇÃO 4: DOCUMENTOS DE IDENTIDADE & FOTOS */}
              <div>
                <h4 className="text-xs font-black text-zinc-950 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#0066FF]" />
                  <span>Documentos Enviados ({selectedSubmission.documentType})</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Frente */}
                  <div className="border border-zinc-200 rounded-2xl p-3 bg-zinc-50 text-center space-y-2">
                    <div className="text-[11px] font-bold text-zinc-700">1. Frente do Documento</div>
                    {selectedSubmission.docFrontFile ? (
                      <div
                        onClick={() =>
                          setZoomedImage({
                            title: `Frente do Documento (${selectedSubmission.documentType})`,
                            url: selectedSubmission.docFrontFile!,
                          })
                        }
                        className="w-full h-32 bg-white rounded-xl border border-zinc-200 flex flex-col items-center justify-center cursor-pointer hover:border-[#0066FF] transition-all group relative overflow-hidden shadow-2xs"
                      >
                        <img
                          src={selectedSubmission.docFrontFile}
                          alt="Frente"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                          <ZoomIn className="w-4 h-4 mr-1" /> Ampliar Foto
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-32 bg-white rounded-xl border border-dashed border-zinc-300 flex flex-col items-center justify-center p-3 text-zinc-400">
                        <FileText className="w-8 h-8 text-zinc-300 mb-1" />
                        <span className="text-[10px] text-zinc-600 font-bold truncate max-w-[130px]">
                          {selectedSubmission.docFrontName || "rg_frente.jpg"}
                        </span>
                        <span className="text-[9px] text-amber-600 font-semibold mt-1">
                          (Sem imagem anexada)
                        </span>
                      </div>
                    )}
                    <div className="text-[10px] text-zinc-500 font-mono truncate px-1">
                      {selectedSubmission.docFrontName || "doc_frente.jpg"}
                    </div>
                  </div>

                  {/* Verso */}
                  <div className="border border-zinc-200 rounded-2xl p-3 bg-zinc-50 text-center space-y-2">
                    <div className="text-[11px] font-bold text-zinc-700">2. Verso do Documento</div>
                    {selectedSubmission.docBackFile ? (
                      <div
                        onClick={() =>
                          setZoomedImage({
                            title: `Verso do Documento (${selectedSubmission.documentType})`,
                            url: selectedSubmission.docBackFile!,
                          })
                        }
                        className="w-full h-32 bg-white rounded-xl border border-zinc-200 flex flex-col items-center justify-center cursor-pointer hover:border-[#0066FF] transition-all group relative overflow-hidden shadow-2xs"
                      >
                        <img
                          src={selectedSubmission.docBackFile}
                          alt="Verso"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                          <ZoomIn className="w-4 h-4 mr-1" /> Ampliar Foto
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-32 bg-white rounded-xl border border-dashed border-zinc-300 flex flex-col items-center justify-center p-3 text-zinc-400">
                        <FileText className="w-8 h-8 text-zinc-300 mb-1" />
                        <span className="text-[10px] text-zinc-600 font-bold truncate max-w-[130px]">
                          {selectedSubmission.docBackName || "rg_verso.jpg"}
                        </span>
                        <span className="text-[9px] text-amber-600 font-semibold mt-1">
                          (Sem imagem anexada)
                        </span>
                      </div>
                    )}
                    <div className="text-[10px] text-zinc-500 font-mono truncate px-1">
                      {selectedSubmission.docBackName || "doc_verso.jpg"}
                    </div>
                  </div>

                  {/* Selfie */}
                  <div className="border border-zinc-200 rounded-2xl p-3 bg-zinc-50 text-center space-y-2">
                    <div className="text-[11px] font-bold text-zinc-700">3. Selfie com Documento</div>
                    {selectedSubmission.docSelfieFile ? (
                      <div
                        onClick={() =>
                          setZoomedImage({
                            title: "Selfie Segurando Documento",
                            url: selectedSubmission.docSelfieFile!,
                          })
                        }
                        className="w-full h-32 bg-white rounded-xl border border-zinc-200 flex flex-col items-center justify-center cursor-pointer hover:border-[#0066FF] transition-all group relative overflow-hidden shadow-2xs"
                      >
                        <img
                          src={selectedSubmission.docSelfieFile}
                          alt="Selfie"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                          <ZoomIn className="w-4 h-4 mr-1" /> Ampliar Selfie
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-32 bg-white rounded-xl border border-dashed border-zinc-300 flex flex-col items-center justify-center p-3 text-zinc-400">
                        <Camera className="w-8 h-8 text-zinc-300 mb-1" />
                        <span className="text-[10px] text-zinc-600 font-bold truncate max-w-[130px]">
                          {selectedSubmission.docSelfieName || "selfie.jpg"}
                        </span>
                        <span className="text-[9px] text-amber-600 font-semibold mt-1">
                          (Sem imagem anexada)
                        </span>
                      </div>
                    )}
                    <div className="text-[10px] text-zinc-500 font-mono truncate px-1">
                      {selectedSubmission.docSelfieName || "selfie.jpg"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Ações no Rodapé do Modal */}
            <div className="sticky bottom-0 bg-white border-t border-zinc-100 p-4 sm:p-5 flex items-center justify-end gap-3 z-10">
              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Fechar
              </button>

              {selectedSubmission.status !== "rejected" && (
                <button
                  type="button"
                  onClick={() => {
                    setRejectingId(selectedSubmission.id);
                    setRejectionReason("");
                  }}
                  className="px-4 py-2.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  Rejeitar
                </button>
              )}

              {selectedSubmission.status !== "approved" && (
                <button
                  type="button"
                  onClick={() => handleApprove(selectedSubmission)}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Aprovar Vendedor Agora</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL DE CONFIRMAÇÃO DE REJEIÇÃO
          ========================================================================= */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 animate-fadeIn space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-black text-zinc-950">Rejeitar Verificação?</h3>
              <p className="text-xs text-zinc-500 mt-1">
                Informe o motivo para o cliente corrigir seus dados ou reenviar documentos.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                Motivo da Rejeição
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ex: Foto do documento ilegível / Selfie não mostra o rosto com clareza / Comprovante com mais de 90 dias..."
                rows={3}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-rose-500 transition-all resize-none font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setRejectingId(null)}
                className="w-full py-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 active:scale-95 transition-all cursor-pointer"
              >
                Confirmar Rejeição
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL DE ZOOM DE IMAGEM
          ========================================================================= */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setZoomedImage(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full p-4 sm:p-5 overflow-hidden shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-3">
              <span className="font-black text-xs sm:text-sm text-zinc-900 tracking-tight">
                {zoomedImage.title}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={zoomedImage.url}
                  download={zoomedImage.title.replace(/\s+/g, "_") + ".jpg"}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-700 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar</span>
                </a>
                <button
                  type="button"
                  onClick={() => setZoomedImage(null)}
                  className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden bg-zinc-950/5 flex items-center justify-center max-h-[75vh] p-2">
              <img
                src={zoomedImage.url}
                alt={zoomedImage.title}
                className="max-h-[70vh] w-auto max-w-full rounded-xl object-contain shadow-xs"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
