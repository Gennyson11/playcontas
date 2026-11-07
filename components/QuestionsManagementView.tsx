"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { UserProfile } from "@/types";
import {
  MessageSquare,
  HelpCircle,
  Search,
  CheckCircle2,
  Clock,
  Send,
  Trash2,
  Flag,
  ExternalLink,
  ArrowLeft,
  X,
  AlertCircle,
  User,
  Package,
  Sparkles,
  Store,
  Check,
  CornerDownRight,
  ShieldAlert,
  Crown,
} from "lucide-react";
import {
  ManagedQuestion,
  fetchReceivedQuestions,
  fetchMyAskedQuestions,
  submitQuestionReply,
  deleteManagedQuestion,
  reportQuestionLocally,
  unreportQuestionLocally,
} from "@/lib/questionStore";
import { getProductUrl } from "@/lib/slug";
import { getStoredProducts } from "@/lib/productStore";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

interface QuestionsManagementViewProps {
  currentUser: UserProfile;
  onBack?: () => void;
}

export function QuestionsManagementView({
  currentUser,
  onBack,
}: QuestionsManagementViewProps) {
  const router = useRouter();

  // Abas principais: "recebidas" | "feitas"
  const [mainTab, setMainTab] = useState<"recebidas" | "feitas">("recebidas");

  // Sub-filtro: "todas" | "nao_respondidas" | "respondidas"
  const [subFilter, setSubFilter] = useState<"todas" | "nao_respondidas" | "respondidas">("todas");

  // Busca textual
  const [searchQuery, setSearchQuery] = useState("");

  // Perguntas carregadas
  const [receivedQuestions, setReceivedQuestions] = useState<ManagedQuestion[]>([]);
  const [askedQuestions, setAskedQuestions] = useState<ManagedQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Estados de resposta inline
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<{ [qId: string]: string }>({});
  const [submittingReplyId, setSubmittingReplyId] = useState<string | null>(null);

  // Modal de exclusão
  const [deletingQuestion, setDeletingQuestion] = useState<ManagedQuestion | null>(null);

  // Toast temporário de feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const isUserAdmin = (userName?: string, userId?: string) => {
    if (!userName && !userId) return false;
    const n = (userName || "").toLowerCase().trim();
    if (n.includes("gennyson") || n.includes("admin")) return true;
    if (userId === "bb25d258-3152-422b-aa04-7bd34e8a5927") return true;
    if (currentUser) {
      if (currentUser.id === userId || currentUser.name.toLowerCase() === n) {
        if (
          currentUser.role === "admin" ||
          (currentUser as any).isAdmin ||
          currentUser.name.toLowerCase().includes("gennyson") ||
          currentUser.email?.toLowerCase().includes("gennyson")
        ) {
          return true;
        }
      }
    }
    return false;
  };

  // Carrega e sincroniza perguntas
  const loadAllQuestions = async () => {
    try {
      const [received, asked] = await Promise.all([
        fetchReceivedQuestions(currentUser),
        fetchMyAskedQuestions(currentUser),
      ]);
      setReceivedQuestions(received);
      setAskedQuestions(asked);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllQuestions();

    const handleUpdate = () => {
      loadAllQuestions();
    };

    window.addEventListener("central_questions_changed", handleUpdate);

    // Canal em tempo real do Supabase para atualizar na hora que alguém perguntar ou responder
    let channel: any = null;
    if (isSupabaseConfigured) {
      try {
        channel = supabase
          .channel("realtime-questions-panel")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "product_questions" },
            () => {
              loadAllQuestions();
            }
          )
          .subscribe();
      } catch {}
    }

    return () => {
      window.removeEventListener("central_questions_changed", handleUpdate);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [currentUser?.id, currentUser?.name]);

  // Lista atual conforme aba principal
  const currentList = mainTab === "recebidas" ? receivedQuestions : askedQuestions;

  // Contagens para os badges
  const receivedUnansweredCount = useMemo(() => {
    return receivedQuestions.filter((q) => !q.answer).length;
  }, [receivedQuestions]);

  const receivedAnsweredCount = useMemo(() => {
    return receivedQuestions.filter((q) => !!q.answer).length;
  }, [receivedQuestions]);

  const askedUnansweredCount = useMemo(() => {
    return askedQuestions.filter((q) => !q.answer).length;
  }, [askedQuestions]);

  const askedAnsweredCount = useMemo(() => {
    return askedQuestions.filter((q) => !!q.answer).length;
  }, [askedQuestions]);

  // Filtra itens com base no sub-filtro e busca
  const filteredQuestions = useMemo(() => {
    return currentList.filter((q) => {
      // 1. Filtro de resposta
      if (subFilter === "nao_respondidas" && q.answer) return false;
      if (subFilter === "respondidas" && !q.answer) return false;

      // 2. Busca
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const inQuestion = (q.question || "").toLowerCase().includes(query);
        const inAnswer = (q.answer || "").toLowerCase().includes(query);
        const inTitle = (q.productTitle || "").toLowerCase().includes(query);
        const inUser =
          (q.askerName || "").toLowerCase().includes(query) ||
          (q.sellerName || "").toLowerCase().includes(query);

        if (!inQuestion && !inAnswer && !inTitle && !inUser) return false;
      }

      return true;
    });
  }, [currentList, subFilter, searchQuery]);

  // Enviar resposta
  const handleSendReply = async (question: ManagedQuestion) => {
    const text = (replyText[question.id] || "").trim();
    if (!text) return;

    setSubmittingReplyId(question.id);
    try {
      const ok = await submitQuestionReply(question, text);
      if (ok) {
        showToast("Resposta enviada com sucesso para o comprador!");
        setActiveReplyId(null);
        setReplyText((prev) => ({ ...prev, [question.id]: "" }));
        loadAllQuestions();
      } else {
        showToast("Erro ao enviar resposta. Tente novamente.");
      }
    } catch {
      showToast("Erro ao enviar resposta.");
    } finally {
      setSubmittingReplyId(null);
    }
  };

  // Confirmar exclusão
  const handleConfirmDelete = async () => {
    if (!deletingQuestion) return;
    try {
      await deleteManagedQuestion(deletingQuestion);
      showToast("Pergunta excluída com sucesso.");
      setDeletingQuestion(null);
      loadAllQuestions();
    } catch {
      showToast("Erro ao excluir pergunta.");
    }
  };

  // Alternar denúncia
  const handleToggleReport = (question: ManagedQuestion) => {
    if (question.isReported) {
      unreportQuestionLocally(question.id);
      showToast("Denúncia removida.");
    } else {
      reportQuestionLocally(question.id);
      showToast("Pergunta denunciada à moderação.");
    }
    loadAllQuestions();
  };

  // Navegar para o anúncio
  const handleOpenProduct = (productId: string) => {
    const prods = getStoredProducts();
    const prod = prods.find((p) => p.id === productId);
    if (prod) {
      router.push(getProductUrl(prod));
    } else {
      router.push(`/anuncio/${productId}`);
    }
  };

  // Formata data amigável
  const formatTime = (iso?: string) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-950 text-white px-5 py-3 rounded-2xl shadow-2xl border border-zinc-800 text-xs sm:text-sm font-semibold flex items-center gap-2.5 animate-slideUp">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER PRINCIPAL NO CONCEITO PADRONIZADO (Exatamente idêntico à Identidade) */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="w-9 h-9 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-600 hover:text-black flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Voltar para Minha Conta"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h2 className="text-base sm:text-lg font-black text-zinc-950 tracking-tight">
                Central de Perguntas
              </h2>
              <p className="text-xs text-zinc-500 font-medium mt-0.5">
                Gerencie dúvidas nos seus anúncios e acompanhe o que você perguntou a outros vendedores.
              </p>
            </div>
          </div>
        </div>

        {/* 3 Métricas no topo padronizadas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-6 pt-6 border-t border-zinc-100">
          <div className="bg-zinc-50/80 border border-zinc-200/80 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                Perguntas Recebidas
              </span>
              <span className="text-xl sm:text-2xl font-black text-zinc-950">
                {receivedQuestions.length}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0066FF] flex items-center justify-center border border-blue-100 shadow-2xs">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-zinc-50/80 border border-zinc-200/80 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
                Aguardando Resposta
              </span>
              <span className="text-xl sm:text-2xl font-black text-amber-600">
                {receivedUnansweredCount}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shadow-2xs">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-zinc-50/80 border border-zinc-200/80 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                Feitas por Mim
              </span>
              <span className="text-xl sm:text-2xl font-black text-zinc-950">
                {askedQuestions.length}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shadow-2xs">
              <HelpCircle className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* CONTAINER PRINCIPAL DAS PERGUNTAS (Estilo Exato da Imagem) */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-zinc-200 shadow-xs space-y-5">
        {/* 1. DUAS ABAS PRINCIPAIS: "Recebidas" e "Feitas por mim" */}
        <div className="flex border-b border-zinc-200 gap-2 sm:gap-4 overflow-x-auto">
          <button
            onClick={() => {
              setMainTab("recebidas");
              setSubFilter("todas");
            }}
            className={`pb-3.5 px-3 sm:px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              mainTab === "recebidas"
                ? "border-[#0066FF] text-[#0066FF]"
                : "border-transparent text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Recebidas</span>
            {receivedUnansweredCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                {receivedUnansweredCount} sem resposta
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setMainTab("feitas");
              setSubFilter("todas");
            }}
            className={`pb-3.5 px-3 sm:px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              mainTab === "feitas"
                ? "border-[#0066FF] text-[#0066FF]"
                : "border-transparent text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Feitas por mim</span>
            {askedQuestions.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-700">
                {askedQuestions.length}
              </span>
            )}
          </button>
        </div>

        {/* 2. CAMPO DE BUSCA (Exato da Imagem) */}
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por pergunta, resposta, anúncio ou usuário..."
            className="w-full pl-11 pr-10 py-3 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs sm:text-sm text-zinc-900 placeholder-zinc-400 focus:bg-white focus:outline-none focus:border-[#0066FF] transition-all font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 3. PÍLULAS DE SUB-FILTRO (Todas, Não respondidas, Respondidas) */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={() => setSubFilter("todas")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              subFilter === "todas"
                ? "bg-[#0066FF] text-white shadow-xs"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80 hover:text-zinc-900"
            }`}
          >
            <span>Todas</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                subFilter === "todas" ? "bg-white/20 text-white" : "bg-zinc-200 text-zinc-700"
              }`}
            >
              {currentList.length}
            </span>
          </button>

          <button
            onClick={() => setSubFilter("nao_respondidas")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              subFilter === "nao_respondidas"
                ? "bg-amber-500 text-white shadow-xs"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80 hover:text-zinc-900"
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>Não respondidas</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                subFilter === "nao_respondidas"
                  ? "bg-white/20 text-white"
                  : "bg-zinc-200 text-zinc-700"
              }`}
            >
              {mainTab === "recebidas" ? receivedUnansweredCount : askedUnansweredCount}
            </span>
          </button>

          <button
            onClick={() => setSubFilter("respondidas")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              subFilter === "respondidas"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80 hover:text-zinc-900"
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>Respondidas</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                subFilter === "respondidas"
                  ? "bg-white/20 text-white"
                  : "bg-zinc-200 text-zinc-700"
              }`}
            >
              {mainTab === "recebidas" ? receivedAnsweredCount : askedAnsweredCount}
            </span>
          </button>
        </div>

        {/* 4. LISTA DE CARDS DE PERGUNTAS */}
        <div className="space-y-4 pt-2">
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-[#0066FF] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-semibold text-zinc-500">
                Carregando perguntas da plataforma...
              </p>
            </div>
          ) : filteredQuestions.length === 0 ? (
            /* Estado Vazio */
            <div className="py-16 text-center border-2 border-dashed border-zinc-200 rounded-3xl p-8 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto">
                <MessageSquare className="w-7 h-7" />
              </div>
              <h3 className="text-base font-black text-zinc-900">
                {searchQuery
                  ? "Nenhuma pergunta encontrada para sua busca"
                  : mainTab === "recebidas"
                  ? subFilter === "nao_respondidas"
                    ? "Parabéns! Nenhuma pergunta pendente de resposta"
                    : "Você ainda não recebeu perguntas nos seus anúncios"
                  : "Você ainda não fez nenhuma pergunta em anúncios"}
              </h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto font-medium">
                {searchQuery
                  ? "Tente buscar por outras palavras-chave ou limpe o campo de busca."
                  : mainTab === "recebidas"
                  ? "Quando compradores tiverem dúvidas sobre seus produtos, elas aparecerão aqui em tempo real."
                  : "Acesse qualquer anúncio do PlayContas e envie suas dúvidas antes de comprar."}
              </p>
            </div>
          ) : (
            filteredQuestions.map((q) => {
              const isReplying = activeReplyId === q.id;
              const hasAnswer = Boolean(q.answer);

              return (
                <div
                  key={q.id}
                  className="rounded-2xl border border-zinc-200/90 bg-white hover:border-zinc-300 transition-all p-4 sm:p-5 shadow-2xs space-y-3.5 group"
                >
                  {/* Linha Superior: Miniatura + Título do Produto + Status + Ações */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Miniatura do Anúncio */}
                      {q.productImage ? (
                        <img
                          src={q.productImage}
                          alt={q.productTitle}
                          className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover bg-zinc-900 border border-zinc-200 shrink-0 shadow-2xs"
                        />
                      ) : (
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-400 shrink-0">
                          <Package className="w-5 h-5" />
                        </div>
                      )}

                      <div className="min-w-0">
                        {/* Título do Anúncio (Clicável) */}
                        <button
                          onClick={() => handleOpenProduct(q.productId)}
                          className="text-xs sm:text-sm font-black text-zinc-900 hover:text-[#0066FF] text-left transition-colors truncate block max-w-xl cursor-pointer"
                          title={q.productTitle}
                        >
                          {q.productTitle}
                        </button>

                        {/* Status Badge + Pergunta de quem */}
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {hasAnswer ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>Respondida</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-2.5 h-2.5" />
                              <span>Aguardando resposta</span>
                            </span>
                          )}

                          <span className="text-zinc-300">•</span>

                          {/* Info do Autor da Pergunta */}
                          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                            {q.askerAvatar ? (
                              <img
                                src={q.askerAvatar}
                                alt={q.askerName}
                                className="w-4 h-4 rounded-full object-cover border border-zinc-200"
                              />
                            ) : (
                              <User className="w-3.5 h-3.5 text-zinc-400" />
                            )}
                            <span className="font-semibold text-zinc-700">
                              {q.askerName}
                            </span>
                            {isUserAdmin(q.askerName, q.askerId) && (
                              <span
                                title="Administrador Oficial"
                                className="inline-flex items-center shrink-0 cursor-default"
                              >
                                <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400 drop-shadow-2xs" />
                              </span>
                            )}
                            <span className="text-zinc-400 text-[11px]">
                              - {formatTime(q.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Ações: Denunciar e Excluir */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleReport(q)}
                        className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                          q.isReported
                            ? "text-rose-600 bg-rose-50"
                            : "text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
                        }`}
                        title={q.isReported ? "Pergunta denunciada" : "Denunciar pergunta"}
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingQuestion(q)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Excluir pergunta"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Balão da Pergunta */}
                  <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm text-zinc-900 font-medium leading-relaxed">
                    {q.question}
                  </div>

                  {/* Balão da Resposta (se já houver) */}
                  {hasAnswer && (
                    <div className="ml-4 sm:ml-6 bg-blue-50/60 border border-blue-200/80 rounded-2xl p-3.5 sm:p-4 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#0066FF] text-white">
                            Vendedor
                          </span>
                          <span className="text-xs font-bold text-zinc-900">
                            {q.sellerName}
                          </span>
                          {isUserAdmin(q.sellerName, q.sellerId) && (
                            <span
                              title="Administrador Oficial"
                              className="inline-flex items-center shrink-0 cursor-default"
                            >
                              <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400 drop-shadow-2xs" />
                            </span>
                          )}
                        </div>
                        {q.answeredAt && (
                          <span className="text-[11px] text-zinc-400 font-medium">
                            {formatTime(q.answeredAt)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-zinc-800 leading-relaxed font-normal">
                        {q.answer}
                      </p>
                    </div>
                  )}

                  {/* Botão Responder (Apenas em Recebidas e Não Respondidas) */}
                  {mainTab === "recebidas" && !hasAnswer && !isReplying && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveReplyId(q.id)}
                        className="px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200/80 text-[#0066FF] font-bold text-xs inline-flex items-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-95"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Responder</span>
                      </button>
                    </div>
                  )}

                  {/* Caixa de Resposta Inline */}
                  {isReplying && (
                    <div className="mt-3 pt-3 border-t border-zinc-100 space-y-2.5 animate-fadeIn">
                      <div className="flex items-center gap-2 text-xs font-bold text-zinc-800">
                        <CornerDownRight className="w-3.5 h-3.5 text-[#0066FF]" />
                        <span>Sua resposta para {q.askerName}:</span>
                      </div>

                      <textarea
                        rows={3}
                        value={replyText[q.id] || ""}
                        onChange={(e) =>
                          setReplyText((prev) => ({
                            ...prev,
                            [q.id]: e.target.value,
                          }))
                        }
                        placeholder="Digite sua resposta com clareza e cordialidade..."
                        className="w-full p-3 rounded-xl border border-zinc-200 focus:border-[#0066FF] focus:outline-none text-xs sm:text-sm text-zinc-900 placeholder-zinc-400 font-medium resize-none"
                      />

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-zinc-400">
                          {(replyText[q.id] || "").length}/500 caracteres
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveReplyId(null);
                              setReplyText((prev) => ({ ...prev, [q.id]: "" }));
                            }}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
                          >
                            Cancelar
                          </button>

                          <button
                            type="button"
                            disabled={
                              submittingReplyId === q.id ||
                              !(replyText[q.id] || "").trim()
                            }
                            onClick={() => handleSendReply(q)}
                            className="px-4 py-2 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs inline-flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer active:scale-95"
                          >
                            {submittingReplyId === q.id ? (
                              <>
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Enviando...</span>
                              </>
                            ) : (
                              <>
                                <Send className="w-3.5 h-3.5" />
                                <span>Enviar Resposta</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {deletingQuestion && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-zinc-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-black text-zinc-950">
                Excluir esta pergunta?
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500 font-medium mt-1 leading-relaxed">
                Esta ação removerá permanentemente a pergunta do anúncio. Essa ação não poderá ser desfeita.
              </p>
            </div>

            <div className="p-3 bg-zinc-50 rounded-xl text-xs text-zinc-700 font-medium italic border border-zinc-200/60">
              "{deletingQuestion.question}"
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingQuestion(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
