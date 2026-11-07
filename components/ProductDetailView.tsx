"use client";

import React, { useState, useEffect } from "react";
import { Product, UserProfile, Question } from "@/types";
import { MarkdownDescription } from "@/components/MarkdownDescription";
import { getProductAdCode } from "@/lib/adCode";
import { saveStoredProduct } from "@/lib/productStore";
import {
  Review,
  fetchProductReviews,
  fetchSellerReviews,
  summarizeReviews,
  formatReviewTime,
} from "@/lib/reviewStore";
import { addNotification } from "@/lib/notificationStore";
import {
  fetchQuestions,
  insertQuestion,
  answerQuestionRemote,
  deleteQuestionRemote,
  UUID_REGEX,
} from "@/lib/questionStore";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { getProductUrl } from "@/lib/slug";
import { useSellerPresence } from "@/lib/presenceStore";
import { isProductFavorite, toggleFavorite } from "@/lib/favoriteStore";
import {
  Heart,
  Zap,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  Maximize2,
  Star,
  MessageCircle,
  MessageSquare,
  ArrowLeft,
  HelpCircle,
  X,
  ShoppingBag,
  Trash2,
  Flag,
  Reply,
  Copy,
  Check,
  Link2,
  Crown,
  XCircle,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";

function getUserInitials(name: string): string {
  if (!name) return "U";
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

function formatQuestionTime(dateStr?: string): string {
  if (!dateStr) return "há pouco";
  if (
    dateStr.startsWith("há ") ||
    dateStr.startsWith("Hoje") ||
    dateStr.startsWith("Ontem") ||
    dateStr.startsWith("Agora")
  ) {
    return dateStr;
  }
  const timestamp = Date.parse(dateStr);
  if (isNaN(timestamp)) return dateStr;

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "há poucos instantes";
  if (diffMinutes < 60) return `há ${diffMinutes} min`;
  if (diffHours < 24) return `há ${diffHours} hora${diffHours > 1 ? "s" : ""}`;
  if (diffDays === 1) return "há 1 dia";
  if (diffDays > 1) return `há ${diffDays} dias`;

  return dateStr;
}

interface ProductDetailViewProps {
  product: Product;
  allProducts?: Product[];
  currentUser?: UserProfile | null;
  onBack: () => void;
  onBuyNow: (
    product: Product,
    selectedOptionLabel: string,
    finalPrice: number,
    selectedVariantId?: string
  ) => void;
}

export function ProductDetailView({
  product,
  allProducts,
  currentUser,
  onBack,
  onBuyNow,
}: ProductDetailViewProps) {
  const [isFavorite, setIsFavorite] = useState(() =>
    isProductFavorite(product.id, currentUser?.id)
  );

  useEffect(() => {
    setIsFavorite(isProductFavorite(product.id, currentUser?.id));
    const handleFavChange = () => {
      setIsFavorite(isProductFavorite(product.id, currentUser?.id));
    };
    window.addEventListener("central_favorites_changed", handleFavChange);
    return () => {
      window.removeEventListener("central_favorites_changed", handleFavChange);
    };
  }, [product.id, currentUser?.id]);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [userQuestion, setUserQuestion] = useState("");
  const [questionsList, setQuestionsList] = useState<Question[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(`central_questions_${product.id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            return parsed.map((q: any) =>
              q.answer?.includes("Nosso sistema realiza a entrega imediatamente")
                ? { ...q, answer: undefined, answeredAt: undefined }
                : q
            );
          }
        }
      } catch {}
    }
    return (product.questions || []).map((q: any) =>
      q.answer?.includes("Nosso sistema realiza a entrega imediatamente")
        ? { ...q, answer: undefined, answeredAt: undefined }
        : q
    );
  });
  const [replyText, setReplyText] = useState<{ [questionId: string]: string }>({});
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [reportedQuestionIds, setReportedQuestionIds] = useState<Set<string>>(new Set());
  const [reportNotice, setReportNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cleanLegacy = (list: any[]): Question[] =>
      list.map((q: any) => {
        let user = q.user;
        if (user && user.toLowerCase().includes("jovizeira")) user = "BuscaNinja";
        let avatar = q.avatar;
        if (avatar && avatar.includes("Jovizeira")) avatar = avatar.replace(/Jovizeira/gi, "BuscaNinja");
        return {
          ...q,
          user,
          avatar,
          answer: q.answer?.includes("Nosso sistema realiza a entrega imediatamente") ? undefined : q.answer,
          answeredAt: q.answer?.includes("Nosso sistema realiza a entrega imediatamente") ? undefined : q.answeredAt,
        };
      });

    let base: Question[] = cleanLegacy(product.questions || []);
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(`central_questions_${product.id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) base = cleanLegacy(parsed);
        }
      } catch {}
    }
    setQuestionsList(base);

    // Carrega as perguntas reais do Supabase (visíveis para todos os visitantes)
    const loadRemote = async () => {
      const remote = await fetchQuestions(product.id);
      if (cancelled || remote === null) return;
      // Mantém perguntas antigas que só existiam neste navegador (ids locais)
      const localOnly = base.filter((q) => !UUID_REGEX.test(q.id));
      setQuestionsList([...remote, ...localOnly]);
    };
    loadRemote();

    // Atualiza em tempo real quando alguém pergunta ou o vendedor responde
    let channel: any = null;
    if (isSupabaseConfigured) {
      try {
        channel = supabase
          .channel(`questions-${product.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "product_questions",
              filter: `product_id=eq.${product.id}`,
            },
            () => loadRemote()
          )
          .subscribe();
      } catch {}
    }

    return () => {
      cancelled = true;
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [product.id]);

  // Product variants for the dropdown selector (apenas variações com estoque > 0)
  const hasVariants =
    (Boolean(product.hasVariations) ||
      product.listingType === "MULTIPLA" ||
      (Array.isArray(product.variants) && product.variants.length > 0)) &&
    Boolean(product.variants && product.variants.length > 0);

  const availableVariants = hasVariants
    ? product.variants!
        .filter((v) => Number(v.stock ?? 0) > 0)
        .map((v) => ({
          id: v.id,
          label: v.name,
          price: Number(v.price) || 0,
          stock: Number(v.stock) || 0,
        }))
    : (product.stock ?? 0) > 0
    ? [
        {
          id: "default",
          label: "Padrão",
          price: Number(product.price) || 0,
          stock: Number(product.stock) || 0,
        },
      ]
    : [];

  const variants = availableVariants;
  const currentVariant = variants[selectedVariantIndex] || variants[0] || {
    id: "default",
    label: "Padrão",
    price: Number(product.price) || 0,
    stock: Number(product.stock) || 0,
  };

  useEffect(() => {
    if (selectedVariantIndex >= variants.length && variants.length > 0) {
      setSelectedVariantIndex(0);
    }
  }, [variants.length, selectedVariantIndex]);
  const adCode = getProductAdCode(product);

  // Avaliações reais dos clientes (somente quem comprou e recebeu o pedido pode avaliar)
  const [reviews, setReviews] = useState<Review[]>([]);
  const [sellerReviews, setSellerReviews] = useState<Review[]>([]);

  useEffect(() => {
    let cancelled = false;
    setReviews([]);
    setSellerReviews([]);
    fetchProductReviews(product.id).then((list) => {
      if (!cancelled) setReviews(list);
    });
    fetchSellerReviews(product.seller.id, product.seller.name).then((list) => {
      if (!cancelled) setSellerReviews(list);
    });
    return () => {
      cancelled = true;
    };
  }, [product.id, product.seller.id, product.seller.name]);

  const reviewSummary = summarizeReviews(reviews);
  const sellerSummary = summarizeReviews(sellerReviews);
  // Sincroniza em tempo real a foto/GIF e nome do vendedor com o perfil atualizado do usuário
  const isGennysonSeller = Boolean(
    product.seller?.name?.toLowerCase().includes("gennyson") ||
    product.seller?.id === "usr-gennyson" ||
    product.seller?.id === "bb25d258-3152-422b-aa04-7bd34e8a5927"
  );

  const isOwner = Boolean(
    currentUser &&
    ((product.seller?.id && currentUser.id === product.seller.id) ||
      (product.seller?.name &&
        currentUser.name &&
        currentUser.name.trim().toLowerCase() === product.seller.name.trim().toLowerCase()) ||
      (isGennysonSeller &&
        (currentUser.email?.toLowerCase().includes("gennyson") ||
          currentUser.name?.toLowerCase().includes("gennyson") ||
          currentUser.id === "bb25d258-3152-422b-aa04-7bd34e8a5927")))
  );

  const [liveSellerAvatar, setLiveSellerAvatar] = useState<string | null>(null);
  const [liveSellerCreatedAt, setLiveSellerCreatedAt] = useState<string | null>(null);
  const [liveSellerUpdatedAt, setLiveSellerUpdatedAt] = useState<string | null>(null);
  const [liveSellerRole, setLiveSellerRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadLiveSellerProfile() {
      if (!isSupabaseConfigured) return;
      try {
        const targetId = isGennysonSeller
          ? "bb25d258-3152-422b-aa04-7bd34e8a5927"
          : product.seller.id;

        if (targetId && targetId.length > 20) {
          const { data } = await supabase
            .from("profiles")
            .select("avatar_url, created_at, role, updated_at")
            .eq("id", targetId)
            .maybeSingle();

          if (!cancelled && data) {
            if (data.avatar_url && !data.avatar_url.includes("avatar-bb25d258")) {
              setLiveSellerAvatar(data.avatar_url);
            }
            if (data.created_at) {
              setLiveSellerCreatedAt(data.created_at);
            }
            if (data.updated_at) {
              setLiveSellerUpdatedAt(data.updated_at);
            }
            if (data.role) {
              setLiveSellerRole(data.role);
            }
            return;
          }
        }

        // Se o ID for curto/antigo, busca por nome na tabela profiles
        const sName = product.seller.name;
        if (sName) {
          const { data } = await supabase
            .from("profiles")
            .select("avatar_url, created_at, role, updated_at")
            .ilike("full_name", sName)
            .maybeSingle();

          if (!cancelled && data) {
            if (data.avatar_url && !data.avatar_url.includes("avatar-bb25d258")) {
              setLiveSellerAvatar(data.avatar_url);
            }
            if (data.created_at) {
              setLiveSellerCreatedAt(data.created_at);
            }
            if (data.updated_at) {
              setLiveSellerUpdatedAt(data.updated_at);
            }
            if (data.role) {
              setLiveSellerRole(data.role);
            }
          }
        }
      } catch {}
    }
    loadLiveSellerProfile();
    return () => {
      cancelled = true;
    };
  }, [isGennysonSeller, product.seller.id, product.seller.name]);

  const realGennysonAvatar =
    "https://lazueuycrcqirdykdppm.supabase.co/storage/v1/object/public/avatars/avatar-gennysonmarinhodemacedo_gmail_com.gif";

  const sellerAvatar =
    (isOwner && currentUser?.avatar && !currentUser.avatar.includes("dicebear") && !currentUser.avatar.includes("avatar-bb25d258")
      ? currentUser.avatar
      : null) ||
    liveSellerAvatar ||
    (product.seller.avatar && !product.seller.avatar.includes("dicebear") && !product.seller.avatar.includes("avatar-bb25d258")
      ? product.seller.avatar
      : null) ||
    (isGennysonSeller ? realGennysonAvatar : null) ||
    product.seller.avatar ||
    `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(product.seller.name || "PlayContas")}`;

  const formatMemberSince = (raw?: string | null): string => {
    if (!raw) return new Date().toLocaleDateString("pt-BR");
    if (raw === "Hoje" || raw.toLowerCase().includes("hoje")) {
      return new Date().toLocaleDateString("pt-BR");
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw.trim())) {
      return raw.trim();
    }
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }
    return raw;
  };

  const formatAdCreatedAt = (raw?: string | null): string => {
    if (!raw) return "26/10/26 22:06";
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = String(d.getFullYear()).slice(-2);
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${mins}`;
  };

  const [currentUrl, setCurrentUrl] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [adReported, setAdReported] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentUrl(window.location.href);
    }
  }, []);

  const handleCopyLink = () => {
    try {
      const url = typeof window !== "undefined" ? window.location.href : currentUrl;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {}
  };

  const handleReportAd = (e: React.MouseEvent) => {
    e.preventDefault();
    if (adReported) {
      alert("Você já enviou uma denúncia sobre este anúncio. Nossa equipe de moderação está analisando.");
      return;
    }
    const reason = prompt("Descreva o motivo da denúncia para a equipe de moderação:");
    if (reason && reason.trim()) {
      setAdReported(true);
      alert("Denúncia registrada com sucesso! Um administrador irá analisar as informações.");
    }
  };

  const rawSellerDate =
    (isOwner && currentUser?.createdAt ? currentUser.createdAt : null) ||
    liveSellerCreatedAt ||
    (isGennysonSeller ? "2026-10-26T18:15:03.605184+00:00" : null) ||
    (product.seller?.memberSince && product.seller.memberSince !== "Hoje" ? product.seller.memberSince : null) ||
    product.createdAt ||
    "2026-10-26";

  const sellerMemberSince = formatMemberSince(rawSellerDate);

  const sellerDisplayName =
    (isOwner && currentUser?.name) ||
    product.seller?.name ||
    "Vendedor Central";

  const isSellerAdmin =
    liveSellerRole === "admin" ||
    isGennysonSeller ||
    (isOwner && currentUser?.role === "admin") ||
    (product.seller as any)?.role === "admin" ||
    (product.seller as any)?.isAdmin === true ||
    Boolean(product.seller?.name?.toLowerCase().includes("gennyson")) ||
    product.seller?.id === "bb25d258-3152-422b-aa04-7bd34e8a5927";

  const isQuestionUserAdmin = (userName?: string, userId?: string) => {
    if (!userName && !userId) return false;
    const nameLower = (userName || "").toLowerCase().trim();
    if (nameLower.includes("gennyson")) return true;
    if (userId === "bb25d258-3152-422b-aa04-7bd34e8a5927") return true;
    if (
      currentUser &&
      (currentUser.id === userId || currentUser.name.toLowerCase() === nameLower)
    ) {
      if (
        currentUser.role === "admin" ||
        (currentUser as any).isAdmin ||
        currentUser.name.toLowerCase().includes("gennyson") ||
        currentUser.email?.toLowerCase().includes("gennyson")
      ) {
        return true;
      }
    }
    return false;
  };

  // Presença e status online em tempo real do vendedor
  const sellerPresence = useSellerPresence({
    sellerId: isGennysonSeller ? "bb25d258-3152-422b-aa04-7bd34e8a5927" : product.seller.id,
    sellerEmail: (product.seller as any)?.email,
    sellerName: product.seller.name,
    fallbackUpdatedAt: liveSellerUpdatedAt || (product as any)?.updated_at,
    isOwner: Boolean(isOwner),
  });

  // Estatísticas calculadas em tempo real a partir dos produtos reais do vendedor
  const sellerProducts = allProducts
    ? allProducts.filter(
        (p) =>
          p.seller.name.toLowerCase() === product.seller.name.toLowerCase() ||
          p.seller.id === product.seller.id
      )
    : [product];

  const totalSellerSales = sellerProducts.reduce(
    (acc, p) => acc + (p.salesCount || 0),
    0
  );

  const totalReviewsCount = sellerSummary.total;

  const saveQuestions = (updated: Question[]) => {
    setQuestionsList(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`central_questions_${product.id}`, JSON.stringify(updated));
      } catch {}
      const modifiedProduct = { ...product, questions: updated };
      saveStoredProduct(modifiedProduct);
    }
  };

  const handlePostQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = userQuestion.trim();
    if (!text) return;

    const buyerName = currentUser?.name || "Comprador";
    const buyerAvatar =
      currentUser?.avatar && !currentUser.avatar.includes("dicebear")
        ? currentUser.avatar
        : "";

    setUserQuestion("");

    // 1) Tenta salvar no Supabase (assim o vendedor recebe em qualquer aparelho)
    const remoteQ = await insertQuestion({
      productId: product.id,
      productTitle: product.title,
      sellerId: product.seller.id,
      sellerName: product.seller.name,
      askerId: currentUser?.id,
      askerName: buyerName,
      askerAvatar: buyerAvatar,
      question: text,
    });

    // 2) Reserva local caso o Supabase não esteja disponível
    const newQ: Question = remoteQ || {
      id: `q-${Date.now()}`,
      user: buyerName,
      avatar: buyerAvatar,
      date: "há poucos instantes",
      question: text,
      userId: currentUser?.id,
    };

    saveQuestions([newQ, ...questionsList]);

    // Notifica o vendedor no sininho (somente se quem perguntou não for o próprio vendedor)
    const askerIsSeller =
      !!currentUser &&
      (currentUser.id === product.seller.id ||
        currentUser.name.toLowerCase() === product.seller.name.toLowerCase());
    if (!askerIsSeller) {
      addNotification({
        kind: "question",
        recipientId: product.seller.id,
        recipientName: product.seller.name,
        title: "Nova pergunta no seu anúncio",
        body: `${buyerName}: ${text}`,
        link: getProductUrl(product),
        productTitle: product.title,
        productImage: product.image,
      });
    }
  };

  const handleSellerReply = async (questionId: string) => {
    const text = (replyText[questionId] || "").trim();
    if (!text) return;

    const answered = questionsList.find((q) => q.id === questionId);

    const updated = questionsList.map((q) => {
      if (q.id === questionId) {
        return {
          ...q,
          answer: text,
          answeredAt: "há poucos instantes",
        };
      }
      return q;
    });

    saveQuestions(updated);
    setReplyText((prev) => ({ ...prev, [questionId]: "" }));
    setActiveReplyId(null);

    await answerQuestionRemote(questionId, text);

    // Notifica o comprador no sininho que o vendedor respondeu
    if (answered && answered.user) {
      addNotification({
        kind: "answer",
        recipientId: answered.userId,
        recipientName: answered.user,
        title: "O vendedor respondeu sua pergunta",
        body: `${sellerDisplayName}: ${text}`,
        link: getProductUrl(product),
        productTitle: product.title,
        productImage: product.image,
      });
    }
  };

  const handleDeleteQuestion = (questionId: string) => {
    const updated = questionsList.filter((q) => q.id !== questionId);
    saveQuestions(updated);
    deleteQuestionRemote(questionId);
  };

  const handleToggleReport = (questionId: string) => {
    setReportedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
        setReportNotice("Denúncia removida.");
      } else {
        next.add(questionId);
        setReportNotice("Pergunta denunciada para a moderação.");
      }
      setTimeout(() => setReportNotice(null), 3000);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-zinc-900 font-sans pb-24">
      {/* Container geral esticado e amplo (max-w-[1440px]) estilo GGMAX */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-5">
        {/* 1. Breadcrumbs Row */}
        <div className="flex items-center justify-between text-xs text-zinc-500 font-medium mb-4">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={onBack}
              className="text-zinc-700 hover:text-black flex items-center gap-1 font-bold mr-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar</span>
            </button>
            <span className="text-zinc-400">/</span>
            <a href="#" onClick={(e) => { e.preventDefault(); onBack(); }} className="hover:text-[#0066FF]">
              Início
            </a>
            <span className="text-zinc-400">&gt;</span>
            <a href="#" onClick={(e) => { e.preventDefault(); onBack(); }} className="hover:text-[#0066FF]">
              Produtos
            </a>
            <span className="text-zinc-400">&gt;</span>
            <span className="text-[#0066FF] font-semibold">{product.category || "Inteligência Artificial"}</span>
          </div>

          <a href="#" className="text-zinc-400 hover:text-rose-500 text-xs font-semibold">
            Denunciar
          </a>
        </div>

        {/* 2-Column Grid alinhado no topo: Coluna Principal Esticada (Left) + Sidebar do Vendedor (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
          {/* ========================================================
              COLUNA ESQUERDA: Hero esticado do anúncio, Características, Descrição, etc.
              ======================================================== */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-7 min-w-0">
            {/* Top Product Hero Box - Esticado horizontalmente para o título brilhar */}
            <div className="bg-white p-5 sm:p-7 rounded-3xl border border-zinc-200 shadow-xs flex flex-col md:flex-row gap-6 lg:gap-8 items-start">
              {/* Thumbnail em formato 16:9 Widescreen (não corta texto nem bordas) com botão de expandir */}
              <div
                onClick={() => setIsImageModalOpen(true)}
                className="relative w-full md:w-[320px] lg:w-[340px] aspect-video rounded-2xl overflow-hidden bg-zinc-100 shrink-0 border border-zinc-200 shadow-xs group cursor-pointer"
              >
                <img
                  src={product.image}
                  alt={product.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsImageModalOpen(true);
                  }}
                  className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/95 hover:bg-white text-zinc-700 flex items-center justify-center shadow-md transition-colors"
                  title="Ampliar Imagem"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Lado Direito do Box do Anúncio - Muito esticado horizontalmente para o título */}
              <div className="flex-1 min-w-0 w-full flex flex-col justify-between">
                <div>
                  {/* Título do Anúncio + Favoritar */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h1 className="text-xl sm:text-2xl lg:text-[26px] font-black text-zinc-950 tracking-tight leading-snug uppercase break-words">
                      {product.title}
                    </h1>

                    <button
                      type="button"
                      onClick={() => {
                        const next = toggleFavorite(product, currentUser?.id);
                        setIsFavorite(next);
                      }}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors shadow-xs shrink-0 cursor-pointer ${
                        isFavorite
                          ? "bg-rose-50 text-rose-600 hover:bg-rose-100"
                          : "bg-zinc-100 hover:bg-zinc-200 text-zinc-600"
                      }`}
                      title={isFavorite ? "Remover dos favoritos" : "Salvar nos favoritos"}
                    >
                      <Heart
                        className={`w-4 h-4 transition-colors ${
                          isFavorite ? "fill-rose-500 text-rose-500" : ""
                        }`}
                      />
                    </button>
                  </div>

                  {/* Aviso de Anúncio Reprovado */}
                  {product.status === "rejected" && (
                    <div className="mb-3.5 rounded-xl border border-rose-300 bg-rose-50 p-3.5 text-xs text-rose-950 flex flex-col gap-1.5 shadow-2xs">
                      <div className="flex items-center gap-2 font-bold text-rose-800">
                        <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Anúncio Reprovado pela Moderação</span>
                      </div>
                      <p className="text-[11px] text-rose-900 font-medium">
                        Este anúncio não está disponível para compra no catálogo público.
                      </p>
                      {product.rejectionReason && (
                        <div className="mt-1 pt-1.5 border-t border-rose-200 text-[11px] text-rose-950">
                          <span className="font-bold text-rose-900">Motivo: </span>
                          <span className="font-medium text-rose-900">{product.rejectionReason}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Aviso de Anúncio em Análise */}
                  {(product.status === "pending_review" || product.status === "pending_approval") && (
                    <div className="mb-3.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950 flex items-center gap-2 shadow-2xs">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="font-bold">
                        Anúncio em Análise pela Moderação (Aguardando aprovação)
                      </span>
                    </div>
                  )}

                  {/* Aviso de Sem Estoque */}
                  {product.status !== "paused" &&
                    product.status !== "rejected" &&
                    product.status !== "pending_review" &&
                    product.status !== "pending_approval" &&
                    product.stock !== undefined &&
                    product.stock <= 0 && (
                      <div className="mb-3.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 flex items-center gap-2 shadow-2xs">
                        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="font-bold">
                          Anúncio Pausado (Sem estoque disponível no momento)
                        </span>
                      </div>
                    )}

                  {/* Métricas em tempo real: DISPONÍVEIS | VENDIDOS */}
                  <div className="flex items-center gap-8 sm:gap-10 mb-4 text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block leading-none mb-1">
                        DISPONÍVEIS
                      </span>
                      <span className="text-base font-black text-zinc-950 leading-tight">
                        {product.stock !== undefined ? product.stock : 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block leading-none mb-1">
                        VENDIDOS
                      </span>
                      <span className="text-base font-black text-zinc-950 leading-tight">
                        {product.salesCount || 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dropdown de Variantes / Opções se houver mais de uma disponível */}
                {hasVariants && variants.length > 1 && (
                  <div className="mb-4 max-w-lg">
                    <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                      Selecione a opção desejada:
                    </label>
                    <div className="relative">
                      <select
                        value={selectedVariantIndex}
                        onChange={(e) => setSelectedVariantIndex(Number(e.target.value))}
                        className="w-full appearance-none bg-white border border-zinc-300 rounded-xl px-4 py-2.5 pr-10 text-xs sm:text-sm font-bold text-zinc-900 focus:outline-none focus:border-[#0066FF] cursor-pointer shadow-xs"
                      >
                        {variants.map((v, i) => (
                          <option key={v.id || i} value={i} className="text-zinc-900">
                            {v.label} — R$ {v.price.toFixed(2).replace(".", ",")}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                )}

                {/* Se restar apenas 1 opção com estoque disponível */}
                {hasVariants && variants.length === 1 && (
                  <div className="mb-4 max-w-lg">
                    <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                      Opção disponível:
                    </label>
                    <div className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold text-zinc-900 shadow-xs flex items-center justify-between">
                      <span>{variants[0].label}</span>
                      <span className="text-[#0066FF]">R$ {variants[0].price.toFixed(2).replace(".", ",")}</span>
                    </div>
                  </div>
                )}

                {/* Se todas as variações estiverem zeradas */}
                {hasVariants && variants.length === 0 && (
                  <div className="mb-4 max-w-lg p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm font-semibold flex items-center gap-2">
                    <span className="text-base">⚠️</span>
                    <span>Todas as opções deste anúncio estão temporariamente esgotadas.</span>
                  </div>
                )}

                {/* Preço + Botão COMPRAR + Badge de Entrega */}
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-1">
                  <div className="text-2xl sm:text-3xl font-black text-[#0066FF] tracking-tight">
                    R$ {currentVariant.price.toFixed(2).replace(".", ",")}
                  </div>

                  {product.status === "paused" ||
                  product.status === "rejected" ||
                  product.status === "pending_review" ||
                  product.status === "pending_approval" ||
                  (hasVariants ? variants.length === 0 : (product.stock !== undefined && product.stock <= 0)) ||
                  currentVariant.stock <= 0 ? (
                    <button
                      type="button"
                      disabled
                      className="px-9 py-2.5 rounded-xl bg-zinc-200 text-zinc-500 font-black text-xs sm:text-sm uppercase tracking-wider cursor-not-allowed opacity-80"
                    >
                      {product.status === "paused"
                        ? "DESATIVADO"
                        : product.status === "rejected"
                        ? "INDISPONÍVEL"
                        : product.status === "pending_review" || product.status === "pending_approval"
                        ? "EM ANÁLISE"
                        : "ESGOTADO"}
                    </button>
                  ) : isOwner ? (
                    <button
                      type="button"
                      disabled
                      title="Você é o vendedor deste anúncio e não pode comprar seu próprio produto."
                      className="px-8 py-2.5 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-500 font-black text-xs sm:text-sm uppercase tracking-wider cursor-not-allowed shadow-2xs select-none"
                    >
                      Seu anúncio
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        onBuyNow(
                          product,
                          currentVariant.label,
                          currentVariant.price,
                          currentVariant.id
                        )
                      }
                      className="px-9 py-2.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-black text-xs sm:text-sm uppercase tracking-wider transition-all shadow-md shadow-blue-500/25 active:scale-95 cursor-pointer"
                    >
                      COMPRAR
                    </button>
                  )}

                  {product.deliveryType === "AUTOMATIC" ? (
                    <div className="px-3.5 py-2 rounded-xl border border-blue-200 text-[#0066FF] bg-blue-50 text-xs sm:text-sm font-bold flex items-center gap-2">
                      <Zap className="w-4 h-4 fill-[#0066FF] text-[#0066FF]" />
                      <span>Entrega automática</span>
                    </div>
                  ) : (
                    <div className="px-3.5 py-2 rounded-xl border border-blue-200 text-[#0066FF] bg-blue-50 text-xs sm:text-sm font-bold flex items-center gap-2">
                      <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" fill="#0066FF" />
                        <polyline points="12 6.5 12 12 15.5 14" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Entrega manual</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. CARACTERÍSTICAS Section */}
            <div>
              <h2 className="text-sm font-black text-zinc-950 uppercase tracking-wider mb-2.5">
                CARACTERÍSTICAS
              </h2>
              <div className="border border-zinc-200 rounded-2xl overflow-hidden max-w-full text-xs bg-white shadow-xs divide-y divide-zinc-200">
                <div className="flex items-center">
                  <div className="bg-zinc-100 px-5 py-3 text-zinc-700 font-bold border-r border-zinc-200 min-w-[160px]">
                    Código do Anúncio
                  </div>
                  <div className="px-5 py-3 font-mono font-black text-[#0066FF] flex-1">
                    {adCode}
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="bg-zinc-100 px-5 py-3 text-zinc-700 font-bold border-r border-zinc-200 min-w-[160px]">
                    Tipo do Anúncio
                  </div>
                  <div className="px-5 py-3 text-zinc-900 font-medium flex-1">
                    {product.category || "Item"}
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="bg-zinc-100 px-5 py-3 text-zinc-700 font-bold border-r border-zinc-200 min-w-[160px]">
                    Forma de Entrega
                  </div>
                  <div className="px-5 py-3 text-zinc-900 font-medium flex-1 flex items-center gap-2">
                    {product.deliveryType === "AUTOMATIC" ? (
                      <>
                        <Zap className="w-3.5 h-3.5 text-[#0066FF] fill-[#0066FF]" />
                        <span className="text-[#0066FF] font-bold">Entrega Automática (Imediata 24/7)</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" fill="#0066FF" />
                          <polyline points="12 6.5 12 12 15.5 14" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="text-[#0066FF] font-bold">Entrega Manual (Via Chat com Vendedor)</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. DESCRIÇÃO DO ANÚNCIO Section */}
            <div>
              <h2 className="text-sm font-black text-zinc-950 uppercase tracking-wider mb-2.5">
                DESCRIÇÃO DO ANÚNCIO
              </h2>
              <div className="bg-white rounded-3xl border border-zinc-200 p-6 sm:p-7 text-xs sm:text-sm leading-relaxed space-y-5 shadow-xs">
                {/* Header bar com garantia */}
                <div className="pb-3 border-b border-zinc-100 flex items-center justify-between">
                  <span className="font-bold text-xs sm:text-sm text-zinc-800 flex items-center gap-1.5">
                    <span>🛡️</span> Garantia de {product.warrantyDays || 30} dias
                  </span>
                  <span className="text-[11px] font-bold text-[#0066FF] bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-100">
                    Vendedor Verificado
                  </span>
                </div>

                {/* Descrição do Produto */}
                <MarkdownDescription content={product.description} />

                {/* Barra inferior: Data de Criação + Compartilhar */}
                <div className="pt-2">
                  <div className="bg-zinc-100/90 border border-zinc-200/80 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-600 font-semibold select-none">
                    <span className="font-bold text-zinc-600 tracking-wide uppercase text-[11px] sm:text-xs">
                      CRIADO EM: {formatAdCreatedAt(product.createdAt)}
                    </span>

                    <div className="flex items-center gap-2">
                      <span className="text-zinc-600 font-semibold text-xs">
                        Compartilhar:
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        title={copiedLink ? "Link copiado!" : "Copiar link do anúncio"}
                        className="w-7 h-7 rounded-full bg-zinc-200/80 hover:bg-[#0066FF] text-zinc-700 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs active:scale-90"
                      >
                        {copiedLink ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Link2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {copiedLink && (
                        <span className="text-[11px] font-bold text-emerald-600 animate-fadeIn">
                          Copiado!
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Denunciar */}
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={handleReportAd}
                      className="text-amber-600 hover:text-amber-700 text-xs font-semibold hover:underline cursor-pointer transition-colors"
                    >
                      Denunciar
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. AVALIAÇÕES Section */}
            <div>
              <h2 className="text-sm font-black text-zinc-950 uppercase tracking-wider mb-2.5">
                AVALIAÇÕES
              </h2>

              <div className="bg-white rounded-3xl border border-zinc-200 shadow-xs overflow-hidden">
                {/* Resumo: total, média e distribuição */}
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1.4fr] divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 p-5 sm:p-6">
                  <div className="pb-4 sm:pb-0 sm:pr-6">
                    <div className="text-sm text-zinc-600 font-medium">Avaliações totais</div>
                    <div className="text-4xl font-black text-zinc-700 mt-1">{reviewSummary.total}</div>
                  </div>

                  <div className="py-4 sm:py-0 sm:px-6">
                    <div className="text-sm text-zinc-600 font-medium">Média</div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-4xl font-black text-zinc-700">
                        {reviewSummary.total > 0
                          ? Number.isInteger(reviewSummary.average)
                            ? reviewSummary.average
                            : reviewSummary.average.toFixed(1).replace(".", ",")
                          : "—"}
                      </span>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`w-4 h-4 ${
                              n <= Math.round(reviewSummary.average)
                                ? "fill-amber-400 text-amber-400"
                                : "fill-zinc-200 text-zinc-200"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 sm:pt-0 sm:pl-6 space-y-2.5 self-center">
                    {[
                      { label: "Positivas", count: reviewSummary.positive, bar: "bg-emerald-500", text: "text-emerald-600" },
                      { label: "Negativas", count: reviewSummary.negative, bar: "bg-rose-500", text: "text-rose-600" },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center gap-3 text-xs">
                        <span className={`w-16 font-bold ${row.text}`}>{row.label}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${row.bar}`}
                            style={{
                              width: `${
                                reviewSummary.total > 0 ? (row.count / reviewSummary.total) * 100 : 0
                              }%`,
                            }}
                          />
                        </div>
                        <span className="w-6 text-right font-bold text-zinc-600">{row.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lista de avaliações dos clientes */}
                <div className="border-t border-zinc-200 p-5 sm:p-6">
                  {reviews.length === 0 ? (
                    <p className="text-center text-xs font-medium text-zinc-400 py-2">
                      Este anúncio ainda não tem avaliações. Elas aparecem aqui depois que os clientes
                      recebem o produto e avaliam a compra.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {reviews.map((rev) => (
                        <div
                          key={rev.id}
                          className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-bold text-zinc-900 truncate">{rev.buyerName?.toLowerCase().includes("jovizeira") ? "BuscaNinja" : rev.buyerName}</span>
                              <div className="flex items-center text-amber-500 shrink-0">
                                {[...Array(rev.rating)].map((_, i) => (
                                  <Star key={i} className="w-3 h-3 fill-current" />
                                ))}
                              </div>
                            </div>
                            <span className="text-zinc-400 shrink-0">{formatReviewTime(rev.createdAt)}</span>
                          </div>
                          {rev.comment && (
                            <p className="text-zinc-700 whitespace-pre-wrap break-words">{rev.comment}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 5. PERGUNTAS E RESPOSTAS Section */}
            <div>
              <h2 className="text-sm font-black text-zinc-950 uppercase tracking-wider mb-2.5">
                PERGUNTAS E RESPOSTAS
              </h2>

              <div className="bg-white rounded-3xl border border-zinc-200 p-5 sm:p-6 space-y-5 shadow-xs">
                {/* Notice de denúncia */}
                {reportNotice && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3.5 py-2 rounded-xl flex items-center gap-2">
                    <Flag className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>{reportNotice}</span>
                  </div>
                )}

                {/* Form para perguntar (compacto estilo Mercado Livre, sem espaço ocioso) */}
                <form onSubmit={handlePostQuestion} className="space-y-2">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    <input
                      type="text"
                      value={userQuestion}
                      onChange={(e) => setUserQuestion(e.target.value)}
                      placeholder="Faça uma pergunta ao vendedor antes de comprar..."
                      className="flex-1 bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-xs sm:text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#0066FF] focus:bg-white transition-all font-medium"
                    />
                    <button
                      type="submit"
                      disabled={!userQuestion.trim()}
                      className="px-6 py-3 rounded-2xl bg-black hover:bg-zinc-800 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all active:scale-95 cursor-pointer shrink-0 whitespace-nowrap"
                    >
                      Enviar Pergunta
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-400 font-medium pl-1">
                    Sua pergunta será pública no anúncio, junto ao seu nome de usuário e avatar, e poderá aparecer nos mecanismos de busca.
                  </p>
                </form>

                {/* Questions List */}
                <div className={questionsList.length === 0 ? "hidden" : "divide-y divide-zinc-100 pt-1"}>
                  {questionsList.length === 0 ? null : (
                    questionsList.map((q) => {
                      const hasCustomAvatar =
                        q.avatar &&
                        !q.avatar.includes("dicebear.com/7.x/bottts") &&
                        !q.avatar.includes("api.dicebear.com");

                      const canDelete =
                        isOwner ||
                        currentUser?.role === "admin" ||
                        (currentUser && currentUser.name === q.user);

                      const isReported = reportedQuestionIds.has(q.id);

                      return (
                        <div
                          key={q.id}
                          className="py-4 first:pt-2 last:pb-2 space-y-1.5"
                        >
                          {/* Linha superior: Avatar, Nome, Data e Ações */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              {hasCustomAvatar ? (
                                <img
                                  src={q.avatar}
                                  alt={q.user}
                                  className="w-8 h-8 rounded-full object-cover border border-zinc-200 shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-zinc-700 text-white font-bold text-xs flex items-center justify-center shrink-0 uppercase tracking-tight">
                                  {getUserInitials(q.user)}
                                </div>
                              )}

                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-zinc-900 text-xs sm:text-sm">
                                  {q.user?.toLowerCase().includes("jovizeira") ? "BuscaNinja" : q.user}
                                </span>
                                {isQuestionUserAdmin(q.user, q.userId) && (
                                  <span
                                    title="Administrador Oficial"
                                    className="inline-flex items-center shrink-0 cursor-default"
                                  >
                                    <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400 drop-shadow-2xs" />
                                  </span>
                                )}
                                <span className="text-[11px] text-zinc-400 font-normal">
                                  {formatQuestionTime(q.date)}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggleReport(q.id)}
                                title={isReported ? "Denúncia enviada" : "Denunciar"}
                                className={`p-1 transition-colors cursor-pointer ${
                                  isReported
                                    ? "text-amber-500"
                                    : "text-zinc-400 hover:text-zinc-600"
                                }`}
                              >
                                <Flag className="w-3.5 h-3.5" />
                              </button>

                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteQuestion(q.id)}
                                  title="Excluir pergunta"
                                  className="text-rose-500 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Texto da pergunta */}
                          <p className="text-zinc-800 text-xs sm:text-sm pl-10.5 font-normal leading-relaxed">
                            {q.question}
                          </p>

                          {/* Se já foi respondida: Resposta do Vendedor (Imagem 1) */}
                          {q.answer ? (
                            <div className="ml-10.5 mt-2 space-y-1">
                              <div className="flex items-center gap-2">
                                {sellerAvatar && !sellerAvatar.includes("dicebear") ? (
                                  <img
                                    src={sellerAvatar}
                                    alt={sellerDisplayName}
                                    className="w-5 h-5 rounded-full object-cover border border-zinc-200 shrink-0"
                                  />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-[#0066FF] text-white text-[9px] font-bold flex items-center justify-center shrink-0 uppercase">
                                    {getUserInitials(sellerDisplayName)}
                                  </div>
                                )}
                                <span className="font-bold text-[#0066FF] text-xs">
                                  {sellerDisplayName}
                                </span>
                                {isSellerAdmin && (
                                  <span
                                    title="Administrador Oficial"
                                    className="inline-flex items-center shrink-0 cursor-default"
                                  >
                                    <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400 drop-shadow-2xs" />
                                  </span>
                                )}
                                <span className="text-[11px] text-zinc-400 font-normal">
                                  {formatQuestionTime(q.answeredAt)}
                                </span>
                              </div>
                              <p className="text-zinc-700 text-xs sm:text-sm pl-7 leading-relaxed">
                                {q.answer}
                              </p>
                            </div>
                          ) : isOwner ? (
                            /* Se NÃO foi respondida e o usuário é o dono/vendedor: Botão Responder (Imagem 3) */
                            <div className="ml-10.5 pt-1.5">
                              {activeReplyId === q.id ? (
                                <div className="p-3.5 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-2.5">
                                  <span className="text-[11px] font-bold text-zinc-700 block">
                                    Sua resposta ({sellerDisplayName}):
                                  </span>
                                  <textarea
                                    value={replyText[q.id] || ""}
                                    onChange={(e) =>
                                      setReplyText({ ...replyText, [q.id]: e.target.value })
                                    }
                                    placeholder="Digite sua resposta para o comprador..."
                                    rows={2}
                                    className="w-full bg-white border border-zinc-200 rounded-xl p-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#0066FF] resize-none font-normal"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setActiveReplyId(null)}
                                      className="px-3.5 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 text-xs font-semibold transition-colors cursor-pointer"
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!replyText[q.id]?.trim()}
                                      onClick={() => handleSellerReply(q.id)}
                                      className="px-4 py-1.5 rounded-lg bg-[#0066FF] hover:bg-[#0052CC] disabled:opacity-40 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                                    >
                                      Responder
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setActiveReplyId(q.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-700 hover:text-black text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                                >
                                  <Reply className="w-3.5 h-3.5 text-zinc-500" />
                                  <span>Responder</span>
                                </button>
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>


          {/* ========================================================
              COLUNA DIREITA: Sidebar alinhada no topo com o anúncio
              ======================================================== */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-5">
            {/* Card 1: Vendedor - Estilo de referência moderno com a paleta do site */}
            <div className="bg-white rounded-3xl border border-zinc-200 p-5 sm:p-6 shadow-xs">
              <h3 className="font-black text-sm text-zinc-950 text-center uppercase tracking-wider mb-4">
                Vendedor
              </h3>

              {/* Layout horizontal: Avatar com anel azul elétrico + Nome + Selo Verificado + Pílula */}
              <div className="flex items-center gap-3.5 mb-4">
                {/* Avatar circular com anel azul elétrico */}
                <div className="relative shrink-0">
                  <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-[#0066FF] ring-offset-2 bg-zinc-900 shadow-sm">
                    <img
                      src={sellerAvatar}
                      alt={sellerDisplayName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                {/* Dados do Vendedor */}
                <div className="flex-1 min-w-0">
                  {/* Linha 1: Nome + Selo Verificado + Pílula de visto */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-black text-sm text-zinc-950 hover:text-[#0066FF] transition-colors truncate">
                      {sellerDisplayName}
                    </span>

                    {/* Selo: se for Admin exibe exclusivamente a coroa dourada; se não for, exibe o selo verificado azul */}
                    {isSellerAdmin ? (
                      <span
                        title="Administrador Oficial do PlayContas"
                        className="inline-flex items-center justify-center shrink-0 cursor-default"
                      >
                        <Crown className="w-4 h-4 text-amber-500 fill-amber-400 drop-shadow-2xs" />
                      </span>
                    ) : (
                      <span title="Vendedor Verificado" className="inline-flex shrink-0">
                        <svg
                          className="w-4 h-4 text-[#0066FF] fill-current"
                          viewBox="0 0 24 24"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    )}

                    {/* Pílula de Status Online em Tempo Real */}
                    {sellerPresence.isOnline ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center gap-1.5 shrink-0 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Online agora
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200 text-[10px] font-bold flex items-center gap-1.5 shrink-0 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                        {sellerPresence.label}
                      </span>
                    )}
                  </div>

                  {/* Linha 2: ⭐ 5.0 (avaliações em tempo real) | 🛍️ +vendas totais do vendedor em tempo real */}
                  <div className="flex items-center gap-2 mt-1 text-xs text-zinc-600 font-medium flex-wrap">
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span className="font-bold text-zinc-950">
                        {sellerSummary.total > 0 ? sellerSummary.average.toFixed(1) : "—"}
                      </span>
                      <span className="text-zinc-400 text-[11px]">
                        ({totalReviewsCount})
                      </span>
                    </div>

                    <span className="text-zinc-300">|</span>

                    <div className="flex items-center gap-1 text-zinc-600 text-[11px]">
                      <ShoppingBag className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{totalSellerSales > 0 ? `+${totalSellerSales}` : "+0"} vendas</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Informações complementares limpas */}
              <div className="space-y-2 text-xs border-t border-zinc-100 pt-3 text-zinc-600">
                <div className="flex items-center justify-between">
                  <span>Membro desde:</span>
                  <span className="font-bold text-zinc-800">
                    {sellerMemberSince}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Avaliações positivas:</span>
                  <span className="font-bold text-emerald-600">
                    {sellerSummary.total > 0
                      ? `${Math.round((sellerSummary.positive / sellerSummary.total) * 100)}%`
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Tempo de resposta:</span>
                  <span className="font-bold text-zinc-800">~5 min</span>
                </div>
              </div>
            </div>

            {/* Card 2: Verificações */}
            <div className="bg-white rounded-3xl border border-zinc-200 p-6 text-center shadow-xs">
              <h3 className="font-black text-sm text-zinc-900 uppercase tracking-wider mb-4">
                Verificações
              </h3>

              <div className="space-y-3 text-xs text-left">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600 font-medium">E-mail:</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verificado
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600 font-medium">Telefone:</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verificado
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600 font-medium">Documentos:</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verificado
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Entrega garantida */}
            <div className="bg-white rounded-3xl border border-zinc-200 p-6 text-center shadow-xs">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#0066FF] flex items-center justify-center mx-auto mb-3 border border-blue-100">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h4 className="font-black text-sm text-zinc-900 mb-1">
                Entrega garantida
              </h4>
              <p className="text-xs text-zinc-500 flex items-center justify-center gap-1">
                <span>Ou o seu dinheiro de volta</span>
                <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Chat Bubble at bottom right */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          className="w-12 h-12 rounded-full bg-[#0066FF] hover:bg-[#0052CC] text-white flex items-center justify-center shadow-xl shadow-blue-500/30 transition-transform active:scale-95"
          title="Fale Conosco"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      </div>

      {/* 16:9 Image Modal Lightbox */}
      {isImageModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 animate-fadeIn"
          onClick={() => setIsImageModalOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl bg-zinc-950 rounded-3xl overflow-hidden shadow-2xl border border-zinc-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full aspect-video bg-black flex items-center justify-center">
              <img
                src={product.image}
                alt={product.title}
                className="w-full h-full object-contain"
              />
            </div>
            <button
              onClick={() => setIsImageModalOpen(false)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center transition-colors shadow-lg border border-white/10"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
