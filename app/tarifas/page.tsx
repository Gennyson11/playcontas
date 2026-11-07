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
  Percent,
  Clock,
  ShieldCheck,
  Zap,
  ArrowRight,
  Wallet,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
} from "lucide-react";

export default function TarifasPage() {
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
        onOpenAdmin={() => router.push("/admin")}
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
              <Percent className="w-3.5 h-3.5 text-[#0066FF]" />
              Transparência & Regras Claras
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-zinc-950 tracking-tight mb-3">
              Tarifas e Prazos
            </h1>
            <p className="text-base sm:text-lg text-zinc-600 font-medium max-w-2xl mx-auto leading-relaxed">
              Sem mensalidades ou taxas ocultas: você só paga quando vender com sucesso.
            </p>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 space-y-12">
          {/* CARD DE TAXA POR VENDA (13%) */}
          <section className="bg-white rounded-3xl border border-zinc-200/90 p-6 sm:p-8 md:p-10 shadow-xs relative overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Taxa Única por Transação Concluída
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
                  13% por venda
                </h2>
                <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">
                  Não cobramos nada para criar conta, publicar anúncios ou manter seus produtos ativos.
                  A taxa de <strong>13%</strong> é descontada exclusivamente sobre o valor dos pedidos
                  entregues e finalizados.
                </p>

                <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-600 font-medium">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Zero mensalidade</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Entrega automática gratuita</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Chat e moderação inclusos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Custódia de pagamento Pix</span>
                  </div>
                </div>
              </div>

              {/* Destaque Visual */}
              <div className="lg:col-span-5 bg-gradient-to-br from-[#0066FF] to-[#0047b3] text-white rounded-2xl p-6 sm:p-7 shadow-lg text-center space-y-3">
                <span className="text-xs uppercase font-extrabold tracking-widest text-blue-200">
                  Comissão da Plataforma
                </span>
                <div className="text-5xl sm:text-6xl font-black tracking-tight">
                  13%
                </div>
                <p className="text-xs text-blue-100 leading-relaxed">
                  Você recebe <strong>87% do valor líquido</strong> direto na sua carteira,
                  pronto para saque via Pix.
                </p>
                <div className="pt-2">
                  <Link
                    href="/anunciar"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-100 text-[#0066FF] font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    <span>Começar a Vender</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* SEÇÃO DE PRAZOS E REGRAS */}
          <section className="space-y-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
                Prazos e Regras da Plataforma
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 mt-1">
                Conheça os tempos de pagamento, garantias e condições para saque.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              {/* 1. Tempo do PIX */}
              <div className="bg-white rounded-3xl border border-zinc-200/90 p-6 shadow-xs hover:border-blue-300 transition-all space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500">
                    <Clock className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-zinc-950">Tempo de Pagamento do PIX</h3>
                    <span className="text-xs text-amber-600 font-semibold">10 minutos de validade</span>
                  </div>
                </div>
                <p className="text-sm text-zinc-600 leading-relaxed">
                  O PIX vale por <strong>10 minutos</strong>; pedidos não pagos nesse prazo são
                  cancelados automaticamente pelo sistema para que o estoque do produto seja liberado.
                </p>
              </div>

              {/* 2. Prazo de Garantia */}
              <div className="bg-white rounded-3xl border border-zinc-200/90 p-6 shadow-xs hover:border-blue-300 transition-all space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0066FF]">
                    <ShieldCheck className="w-5 h-5 text-[#0066FF]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-zinc-950">Garantia do Anúncio</h3>
                    <span className="text-xs text-[#0066FF] font-semibold">7, 15 ou até 90 dias</span>
                  </div>
                </div>
                <p className="text-sm text-zinc-600 leading-relaxed">
                  Cada anúncio tem uma garantia de <strong>7, 15 ou até 90 dias</strong>, escolhida
                  pelo vendedor (conta de criador original: <strong>7 dias fixos</strong>). Ela começa
                  a contar a partir da entrega do produto.
                </p>
              </div>

              {/* 3. Retenção e Liberação Automática */}
              <div className="bg-white rounded-3xl border border-zinc-200/90 p-6 shadow-xs hover:border-blue-300 transition-all space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
                    <Zap className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-zinc-950">Liberação Automática do Saldo</h3>
                    <span className="text-xs text-purple-600 font-semibold">Sem burocracia</span>
                  </div>
                </div>
                <p className="text-sm text-zinc-600 leading-relaxed">
                  Durante a garantia o valor fica retido e o comprador pode abrir mediação. No fim do
                  prazo, o valor é <strong>liberado automaticamente na carteira do vendedor</strong>,
                  pronto para saque. <strong>O comprador não precisa confirmar nada.</strong>
                </p>
              </div>

              {/* 4. Saque via PIX Flash */}
              <div className="bg-white rounded-3xl border border-zinc-200/90 p-6 shadow-xs hover:border-blue-300 transition-all space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                    <Zap className="w-5 h-5 text-amber-600 fill-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-zinc-950 flex items-center gap-2">
                      <span>Saque via PIX Flash</span>
                      <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 font-bold px-2 py-0.5 rounded-full">
                        Taxa R$ 5,00
                      </span>
                    </h3>
                    <span className="text-xs text-amber-600 font-semibold">Envio expresso e imediato</span>
                  </div>
                </div>
                <p className="text-sm text-zinc-600 leading-relaxed">
                  <strong>Taxa fixa de R$ 5,00 por saque (PIX Flash).</strong> Saque mínimo de R$ 20,00. 
                  Você solicita o saque diretamente no menu da sua carteira e o valor líquido é transferido de forma imediata para a sua chave PIX cadastrada.
                </p>
              </div>
            </div>
          </section>

          {/* DÚVIDAS E SUPORTE */}
          <section className="bg-white rounded-3xl border border-zinc-200/90 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xs">
            <div className="space-y-1.5 text-center sm:text-left">
              <h3 className="text-lg font-bold text-zinc-950">Ficou com alguma dúvida?</h3>
              <p className="text-xs sm:text-sm text-zinc-500">
                Confira o guia detalhado de como funciona ou entre em contato com nossa equipe.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
              <Link
                href="/como-funciona"
                className="px-5 py-2.5 rounded-xl border border-zinc-300 hover:border-zinc-400 bg-white text-zinc-700 font-bold text-xs transition-all active:scale-95 cursor-pointer"
              >
                Como Funciona
              </Link>
              <Link
                href="/anunciar"
                className="px-5 py-2.5 rounded-xl bg-[#0066FF] hover:bg-[#0052cc] text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all active:scale-95 cursor-pointer"
              >
                Criar Anúncio
              </Link>
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
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setAuthModalOpen(false);
        }}
      />
    </div>
  );
}
