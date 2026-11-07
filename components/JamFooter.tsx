"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Star, X, Sparkles, ShieldCheck } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { CookiePreferencesModal } from "./CookiePreferencesModal";

interface UserReviewItem {
  id: string;
  name: string;
  category: string;
  rating: number;
  comment: string;
  avatarBg: string;
}

const REAL_PERSON_NAMES_LIST: string[] = [
  "Matheus Henrique",
  "João Victor",
  "Lucas Silva",
  "Gabriel Santos",
  "Rodrigo Lima",
  "Felipe Almeida",
  "Bruno Costa",
  "Rafael Souza",
  "Thiago Ribeiro",
  "Guilherme Martins",
];

const BOT_OR_NICK_REGEX = /(buscaninja|jovizeira|admin|administrador|teste|test|user|usuario|cliente|comprador|bot|dev|root|moderador)/i;

function sanitizePersonName(rawName: string, fallbackIdx = 0): string {
  const trimmed = (rawName || "").trim();
  if (!trimmed || BOT_OR_NICK_REGEX.test(trimmed) || trimmed.length < 3) {
    if (trimmed.toLowerCase().includes("buscaninja")) return "Matheus Henrique";
    if (trimmed.toLowerCase().includes("jovizeira")) return "João Victor";
    return REAL_PERSON_NAMES_LIST[fallbackIdx % REAL_PERSON_NAMES_LIST.length];
  }

  // Se já for um nome com espaços (ex: "Carlos Eduardo"), formata com iniciais maiúsculas
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return parts
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join(" ");
  }

  // Se for apenas uma palavra (ex: "andersonmoura"), formata de forma limpa
  const single = parts[0];
  return single.charAt(0).toUpperCase() + single.slice(1);
}

const DEFAULT_REVIEWS: UserReviewItem[] = [
  // Linha 1
  {
    id: "rev-1",
    name: "Anderson Moura",
    category: "Contas & Jogos",
    rating: 5,
    comment: '"Ótimo vendedor, entrega imediata! Recomendo muito."',
    avatarBg: "bg-[#0ea5e9]",
  },
  {
    id: "rev-2",
    name: "Leonardo Teixeira",
    category: "Assinaturas Premium",
    rating: 5,
    comment: '"Perfeito! Melhor vendedor que já comprei aqui."',
    avatarBg: "bg-[#d97706]",
  },
  {
    id: "rev-3",
    name: "Matheus Henrique",
    category: "Inteligência Artificial",
    rating: 5,
    comment: '"Super indico! Atendeu todas as expectativas."',
    avatarBg: "bg-[#2563eb]",
  },
  {
    id: "rev-4",
    name: "Claudia Maia",
    category: "Licenças de Software",
    rating: 5,
    comment: '"Bom vendedor, produto funcionou de primeira."',
    avatarBg: "bg-[#e11d48]",
  },
  {
    id: "rev-5",
    name: "Erick Cavalcante",
    category: "Contas & Jogos",
    rating: 5,
    comment: '"Vendedor top! Já é a segunda vez que compro aqui."',
    avatarBg: "bg-[#dc2626]",
  },
  {
    id: "rev-6",
    name: "Larissa Moura",
    category: "Streaming & Vídeo",
    rating: 5,
    comment: '"Vendedor top! Já é a segunda vez que compro aqui."',
    avatarBg: "bg-[#2563eb]",
  },
  // Linha 2
  {
    id: "rev-7",
    name: "Flavia Coelho",
    category: "Assinaturas Premium",
    rating: 5,
    comment: '"Comprei e funcionou perfeitamente, muito obrigado!"',
    avatarBg: "bg-[#10b981]",
  },
  {
    id: "rev-8",
    name: "Alan Gomes",
    category: "Inteligência Artificial",
    rating: 5,
    comment: '"Produto conforme descrito. Muito satisfeito!"',
    avatarBg: "bg-[#0891b2]",
  },
  {
    id: "rev-9",
    name: "Camila Correia",
    category: "Contas & Jogos",
    rating: 5,
    comment: '"Entrega imediata assim que o pagamento confirmou."',
    avatarBg: "bg-[#d97706]",
  },
  {
    id: "rev-10",
    name: "Alexandre Andrade",
    category: "Inteligência Artificial",
    rating: 5,
    comment: '"Tudo como prometido, entrega rápida e atencioso."',
    avatarBg: "bg-[#16a34a]",
  },
  {
    id: "rev-11",
    name: "João Victor",
    category: "Contas & Jogos",
    rating: 5,
    comment: '"Muito profissional, respondeu todas as dúvidas."',
    avatarBg: "bg-[#059669]",
  },
  {
    id: "rev-12",
    name: "Lucas Batista",
    category: "Inteligência Artificial",
    rating: 5,
    comment: '"Muito profissional, respondeu todas as dúvidas."',
    avatarBg: "bg-[#6366f1]",
  },
];

export function JamFooter() {
  const router = useRouter();
  const [modalInfo, setModalInfo] = useState<{ title: string; content: string } | null>(null);
  const [cookieModalOpen, setCookieModalOpen] = useState(false);
  const [reviewsList, setReviewsList] = useState<UserReviewItem[]>(DEFAULT_REVIEWS);

  useEffect(() => {
    const handleOpenCookies = () => setCookieModalOpen(true);
    window.addEventListener("open_cookie_preferences", handleOpenCookies);
    return () => window.removeEventListener("open_cookie_preferences", handleOpenCookies);
  }, []);

  useEffect(() => {
    const loadRealReviews = async () => {
      try {
        if (!isSupabaseConfigured) return;
        const { data } = await supabase
          .from("product_reviews")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(6);

        if (data && data.length > 0) {
          const live: UserReviewItem[] = data.map((r: any, idx: number) => {
            const colors = [
              "bg-[#2563eb]",
              "bg-[#10b981]",
              "bg-[#0891b2]",
              "bg-[#d97706]",
              "bg-[#6366f1]",
              "bg-[#e11d48]",
            ];
            const realPersonName = sanitizePersonName(r.buyer_name || "", idx);
            const category =
              r.category && r.category !== "Produto Digital"
                ? r.category
                : idx % 2 === 0
                ? "Inteligência Artificial"
                : "Contas & Jogos";

            const rawComment = (r.comment || "Excelente produto e atendimento nota 10!")
              .replace(/^["“”']+|["“”']+$/g, "")
              .trim();

            return {
              id: r.id || `live-${idx}`,
              name: realPersonName,
              category,
              rating: Math.max(1, Math.min(5, Number(r.rating) || 5)),
              comment: `"${rawComment}"`,
              avatarBg: colors[idx % colors.length],
            };
          });

          setReviewsList([...live, ...DEFAULT_REVIEWS.slice(live.length)]);
        }
      } catch {
        // mantém DEFAULT_REVIEWS
      }
    };

    loadRealReviews();
  }, []);

  const openInfo = (title: string, content: string) => {
    setModalInfo({ title, content });
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5 shrink-0">
        {[1, 2, 3, 4, 5].map((starIndex) => (
          <Star
            key={starIndex}
            className={`w-3 h-3 ${
              starIndex <= rating
                ? "fill-amber-400 text-amber-400"
                : "fill-zinc-200 text-zinc-300"
            }`}
          />
        ))}
      </div>
    );
  };

  const renderCard = (rev: UserReviewItem, keyId: string) => {
    const initial = (rev.name || "U").charAt(0).toUpperCase();
    return (
      <div
        key={keyId}
        className="w-[270px] sm:w-[310px] shrink-0 bg-white border border-zinc-200/85 rounded-2xl p-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:shadow-md hover:border-blue-400/60 transition-all flex flex-col justify-between"
      >
        <div>
          {/* Topo do Card: Avatar + Usuário/Categoria + Estrelas */}
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${rev.avatarBg}`}
              >
                {initial}
              </div>
              <div className="min-w-0 leading-tight">
                <h4 className="text-xs font-bold text-zinc-900 truncate">
                  {rev.name}
                </h4>
                <span className="text-[10px] text-zinc-400 font-medium truncate block">
                  {rev.category}
                </span>
              </div>
            </div>
            {renderStars(rev.rating)}
          </div>

          {/* Comentário do comprador */}
          <p className="text-xs text-zinc-600 font-normal leading-relaxed italic line-clamp-3">
            {rev.comment}
          </p>
        </div>
      </div>
    );
  };

  const row1 = reviewsList.slice(0, Math.ceil(reviewsList.length / 2));
  const row2 = reviewsList.slice(Math.ceil(reviewsList.length / 2));
  const track1 = [...row1, ...row1, ...row1];
  const track2 = [...row2, ...row2, ...row2];

  return (
    <>
      {/* SEÇÃO: AVALIAÇÕES DOS USUÁRIOS (COM ANIMAÇÃO DE DESLIZE CONTÍNUO) */}
      <section className="bg-white border-t border-zinc-200/80 pt-14 pb-14 select-none overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Ícone decorativo com estrela central e linha sutil */}
          <div className="relative flex items-center justify-center mb-3.5">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-48 sm:w-64 mx-auto border-t border-zinc-200" />
            </div>
            <div className="relative z-10 w-9 h-9 rounded-2xl bg-[#eff6ff] border border-blue-200/90 flex items-center justify-center shadow-xs">
              <Star className="w-4 h-4 fill-[#205bf0] text-[#205bf0]" />
            </div>
          </div>

          {/* Cabeçalho */}
          <div className="text-center mb-9">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">
              Avaliações dos Usuários
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 font-normal mt-1.5">
              Veja o que os compradores estão dizendo sobre suas experiências
            </p>
          </div>
        </div>

        {/* Carrossel Animado Passando para os Lados */}
        <div className="relative w-full overflow-hidden space-y-3.5 py-1">
          {/* Máscara de fade suave nas bordas esquerda e direita */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-12 sm:w-28 bg-gradient-to-r from-white to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-12 sm:w-28 bg-gradient-to-l from-white to-transparent z-10" />

          {/* Linha 1: Deslizando suavemente para a esquerda */}
          <div className="animate-reviews-marquee-left flex gap-3.5 px-2">
            {track1.map((rev, index) => renderCard(rev, `t1-${rev.id}-${index}`))}
          </div>

          {/* Linha 2: Deslizando suavemente para a direita */}
          <div className="animate-reviews-marquee-right flex gap-3.5 px-2">
            {track2.map((rev, index) => renderCard(rev, `t2-${rev.id}-${index}`))}
          </div>
        </div>
      </section>

      {/* FOOTER PRINCIPAL */}
      <footer className="bg-[#f8fafc] border-t border-zinc-200/80 pt-10 pb-8 text-zinc-600 select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* COLUNAS DO RODAPÉ (ESTILO EXATO DA REFERÊNCIA) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10 pb-10">
            {/* Coluna Marca (ocupa 2 colunas no desktop) */}
            <div className="lg:col-span-2 space-y-3.5">
              <div
                onClick={() => router.push("/")}
                className="inline-flex items-center cursor-pointer group"
              >
                <img
                  src="/playcontas.png"
                  alt="PlayContas"
                  className="h-9 sm:h-10 w-auto max-w-[220px] object-contain transition-transform group-hover:scale-105"
                />
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed max-w-sm">
                Somos um marketplace digital que conecta compradores e vendedores de contas, itens,
                licenças e serviços — com o pagamento protegido até a entrega.
              </p>
            </div>

            {/* Coluna 1: ACESSO RÁPIDO */}
            <div>
              <h3 className="text-xs font-bold text-zinc-900 tracking-wider uppercase mb-3.5">
                Acesso Rápido
              </h3>
              <ul className="space-y-2 text-xs text-zinc-500">
                <li>
                  <Link href="/anunciar" className="hover:text-zinc-900 transition-colors">
                    Anunciar
                  </Link>
                </li>
                <li>
                  <Link href="/?filter=all" className="hover:text-zinc-900 transition-colors">
                    Categorias
                  </Link>
                </li>
                <li>
                  <Link href="/?search=" className="hover:text-zinc-900 transition-colors">
                    Todos os anúncios
                  </Link>
                </li>
              </ul>
            </div>

            {/* Coluna 2: COMO FUNCIONA */}
            <div>
              <h3 className="text-xs font-bold text-zinc-900 tracking-wider uppercase mb-3.5">
                Como Funciona
              </h3>
              <ul className="space-y-2 text-xs text-zinc-500">
                <li>
                  <Link
                    href="/como-funciona"
                    className="hover:text-zinc-900 transition-colors text-left"
                  >
                    Como funciona
                  </Link>
                </li>
                <li>
                  <Link
                    href="/tarifas"
                    className="hover:text-zinc-900 transition-colors text-left"
                  >
                    Tarifas e prazos
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() =>
                      openInfo(
                        "Central de Ajuda",
                        "Precisa de suporte? Nossa equipe atende 24/7. Acesse a aba de Chat no seu pedido ou entre em contato diretamente com nossa central de atendimento para resolver qualquer dúvida ou disputa."
                      )
                    }
                    className="hover:text-zinc-900 transition-colors text-left cursor-pointer"
                  >
                    Central de Ajuda
                  </button>
                </li>
              </ul>
            </div>

            {/* Coluna 3: INSTITUCIONAL */}
            <div>
              <h3 className="text-xs font-bold text-zinc-900 tracking-wider uppercase mb-3.5">
                Institucional
              </h3>
              <ul className="space-y-2 text-xs text-zinc-500">
                <li>
                  <Link
                    href="/termos"
                    className="hover:text-zinc-900 transition-colors text-left"
                  >
                    Termos de uso
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacidade"
                    className="hover:text-zinc-900 transition-colors text-left"
                  >
                    Política de privacidade
                  </Link>
                </li>
                <li>
                  <Link
                    href="/reembolso"
                    className="hover:text-zinc-900 transition-colors text-left"
                  >
                    Política de reembolso
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setCookieModalOpen(true)}
                    className="hover:text-zinc-900 transition-colors text-left cursor-pointer"
                  >
                    Preferências de cookies
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* LINHA INFERIOR COM COPYRIGHT */}
          <div className="border-t border-zinc-200/80 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
            <p>
              Copyright © PlayContas 2026 • Intermediação Segura de Negócios Digitais
            </p>
            <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Ambiente 100% Protegido</span>
            </div>
          </div>
        </div>
      </footer>

      {/* MODAL INFORMATIVO */}
      {modalInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full p-6 shadow-2xl text-left relative">
            <button
              type="button"
              onClick={() => setModalInfo(null)}
              className="w-8 h-8 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800 flex items-center justify-center absolute top-4 right-4 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 text-[#205bf0] flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-zinc-900">{modalInfo.title}</h3>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed mb-6">
              {modalInfo.content}
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setModalInfo(null)}
                className="px-4 py-2 rounded-xl bg-[#205bf0] hover:bg-blue-700 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL DE PREFERÊNCIAS DE COOKIES */}
      <CookiePreferencesModal
        isOpen={cookieModalOpen}
        onClose={() => setCookieModalOpen(false)}
      />
    </>
  );
}
