"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { JamHeader } from "@/components/JamHeader";
import { JamFooter } from "@/components/JamFooter";
import { CartModal } from "@/components/CartModal";
import { AuthModal } from "@/components/AuthModal";
import { UserProfile, CartItem } from "@/types";
import { getStoredUserSync, clearStoredUser } from "@/lib/authStore";
import {
  Search,
  ShieldCheck,
  Zap,
  Award,
  Store,
  Layers,
  Sparkles,
  ArrowRight,
  Clock,
} from "lucide-react";

export default function ComoFuncionaPage() {
  const router = useRouter();

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // User state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getStoredUserSync());
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialTab, setAuthInitialTab] = useState<"login" | "register">("register");

  // Cart state
  const [cartModalOpen, setCartModalOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("central_cart");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  useEffect(() => {
    const syncUser = () => setCurrentUser(getStoredUserSync());
    window.addEventListener("central_auth_changed", syncUser);
    window.addEventListener("storage", syncUser);
    return () => {
      window.removeEventListener("central_auth_changed", syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  const handleCheckoutFromModal = () => {
    setCartModalOpen(false);
    router.push("/finalizar-compra");
  };

  const steps = [
    {
      number: "1",
      title: "Escolha o anúncio",
      description:
        "Encontre contas, itens, gold, gift cards e serviços. Veja a reputação do vendedor e tire dúvidas pelas perguntas.",
      icon: Search,
      badgeColor: "bg-blue-600 text-white",
      borderColor: "border-blue-200/80 hover:border-blue-400",
    },
    {
      number: "2",
      title: "Pague com segurança",
      description:
        "Pague via PIX ou com seu saldo. O dinheiro fica retido na plataforma — o vendedor ainda não recebe.",
      icon: ShieldCheck,
      badgeColor: "bg-emerald-600 text-white",
      borderColor: "border-emerald-200/80 hover:border-emerald-400",
    },
    {
      number: "3",
      title: "Receba o produto",
      description:
        "Anúncios com entrega automática chegam na hora. Nos demais, o vendedor entrega pelo chat do pedido.",
      icon: Zap,
      badgeColor: "bg-amber-500 text-white",
      borderColor: "border-amber-200/80 hover:border-amber-400",
    },
    {
      number: "4",
      title: "Garantia e avaliação",
      description:
        "Você não precisa confirmar nada: confira o produto e avalie o vendedor. Algum problema? Abra uma mediação durante a garantia. No fim dela, o valor é liberado ao vendedor.",
      icon: Award,
      badgeColor: "bg-purple-600 text-white",
      borderColor: "border-purple-200/80 hover:border-purple-400",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      {/* Header */}
      <JamHeader
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          if (q.trim()) router.push(`/?search=${encodeURIComponent(q.trim())}`);
        }}
        cartCount={cart.reduce((acc, item) => acc + item.quantity, 0)}
        onOpenCart={() => setCartModalOpen(true)}
        onOpenCreateListing={() => router.push("/anunciar")}
        currentUser={currentUser}
        onOpenAuth={(tab?: "login" | "register") => {
          setAuthInitialTab(tab || "login");
          setAuthModalOpen(true);
        }}
        onOpenAdmin={() => router.push("/")}
        onOpenSettings={() => router.push("/minha-conta")}
        onOpenMyProducts={() => router.push("/meus-produtos")}
        onGoHome={() => router.push("/")}
        onLogout={async () => {
          await clearStoredUser();
          setCurrentUser(null);
        }}
      />

      {/* Main Content */}
      <main className="flex-1 pb-16">
        {/* Hero Banner */}
        <div className="bg-gradient-to-b from-white via-blue-50/20 to-transparent pt-10 pb-12 sm:pt-14 sm:pb-16 text-center border-b border-zinc-200/60">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-[#0066FF] border border-blue-200 mb-4 shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0066FF]" />
              Guia Completo da Plataforma
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-zinc-950 tracking-tight mb-3">
              Como funciona
            </h1>
            <p className="text-base sm:text-lg text-zinc-600 font-medium max-w-2xl mx-auto leading-relaxed">
              Compre e venda com o pagamento protegido do início ao fim.
            </p>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 space-y-14">
          {/* SEÇÃO 1: PARA COMPRADORES (4 PASSOS) */}
          <section className="space-y-6">
            <div className="text-center sm:text-left">
              <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
                Para Compradores
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 mt-1">
                Processo simplificado em 4 etapas seguras.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              {steps.map((st) => {
                const IconComponent = st.icon;
                return (
                  <div
                    key={st.number}
                    className={`bg-white rounded-3xl border ${st.borderColor} p-6 shadow-xs transition-all duration-200 flex flex-col justify-between`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs ${st.badgeColor} shadow-2xs`}
                          >
                            {st.number}
                          </span>
                          <h3 className="font-bold text-base text-zinc-900 tracking-tight">
                            {st.title}
                          </h3>
                        </div>
                        <div className="w-9 h-9 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center justify-center text-zinc-500">
                          <IconComponent className="w-4 h-4" />
                        </div>
                      </div>

                      <p className="text-sm text-zinc-600 leading-relaxed">
                        {st.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* SEÇÃO 2: PARA VENDEDORES */}
          <section className="bg-white rounded-3xl border border-zinc-200/90 p-6 sm:p-8 md:p-10 shadow-xs relative overflow-hidden">
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0066FF] shadow-2xs">
                  <Store className="w-5 h-5 text-[#0066FF]" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-zinc-950 tracking-tight">
                    Para vendedores
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-500 font-medium">
                    Tudo o que você precisa saber para faturar com segurança
                  </p>
                </div>
              </div>

              <p className="text-sm sm:text-base text-zinc-700 leading-relaxed">
                Crie sua conta, clique em{" "}
                <Link
                  href="/anunciar"
                  className="font-bold text-[#0066FF] hover:underline underline-offset-2"
                >
                  Anunciar
                </Link>{" "}
                e preencha título, descrição, imagens, preço e estoque. Você pode:
              </p>

              {/* Lista com os 3 recursos chave */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-2">
                  <div className="flex items-center gap-2 text-zinc-900 font-bold text-sm">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span>Variações Próprias</span>
                  </div>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    Criar variações com preço e estoque próprios (ex.: 100, 400 e 800 Robux);
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-2">
                  <div className="flex items-center gap-2 text-zinc-900 font-bold text-sm">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span>Entrega Automática</span>
                  </div>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    Ativar a entrega automática, cadastrando o estoque (um item por linha);
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-2">
                  <div className="flex items-center gap-2 text-zinc-900 font-bold text-sm">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span>Planos de Exposição</span>
                  </div>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    Escolher o plano de exposição (Prata, Ouro ou Diamante) — veja as{" "}
                    <Link href="/tarifas" className="font-bold text-[#0066FF] hover:underline">
                      tarifas e prazos
                    </Link>.
                  </p>
                </div>
              </div>

              {/* Destaque da Retenção e Liberação Pix */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white border border-blue-200/80 flex items-start gap-3.5">
                <Clock className="w-5 h-5 text-[#0066FF] shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed">
                  Cada anúncio tem uma garantia de <strong>7, 15 ou até 90 dias</strong>, escolhida pelo vendedor (conta de criador original: 7 dias fixos), que começa na entrega.
                  Durante esse prazo o valor fica retido pela <strong>PlayContas</strong>; no fim dele, o valor
                  da venda menos a taxa entra sozinho na sua carteira, pronto para saque via PIX.{" "}
                  <strong>O comprador não precisa confirmar nada.</strong>
                </p>
              </div>

              {/* Botão de ação */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <Link
                  href="/anunciar"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0066FF] hover:bg-[#0052cc] text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 transition-all active:scale-95 cursor-pointer"
                >
                  <span>Começar a Anunciar</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/?filter=all"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-zinc-300 hover:border-zinc-400 bg-white text-zinc-700 font-semibold text-xs sm:text-sm transition-all active:scale-95 cursor-pointer"
                >
                  <span>Ver Anúncios Ativos</span>
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <JamFooter />

      {/* Modais de Carrinho e Autenticação */}
      <CartModal
        isOpen={cartModalOpen}
        onClose={() => setCartModalOpen(false)}
        onCheckout={handleCheckoutFromModal}
      />

      <AuthModal
        isOpen={authModalOpen}
        initialTab={authInitialTab}
        onClose={() => setAuthModalOpen(false)}
        onLoginSuccess={(user: UserProfile) => {
          setCurrentUser(user);
          setAuthModalOpen(false);
        }}
      />
    </div>
  );
}
