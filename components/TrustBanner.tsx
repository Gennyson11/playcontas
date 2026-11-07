"use client";

import React from "react";
import {
  ShieldCheck,
  Zap,
  Lock,
  ArrowRight,
  Headphones,
  CheckCircle2,
} from "lucide-react";

interface TrustBannerProps {
  onOpenCreateListing: () => void;
}

export function TrustBanner({ onOpenCreateListing }: TrustBannerProps) {
  return (
    <section id="como-funciona" className="py-16 bg-white border-b border-zinc-200 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-bold text-[#0066FF] uppercase tracking-wider px-3 py-1 rounded-full bg-blue-50 border border-blue-200 inline-block mb-3">
            Transparência & Confiança
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">
            Como Funciona o PlayContas?
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 mt-2">
            Nossa plataforma atua como intermediadora neutra (Escrow), garantindo que compradores recebam o que pagaram e vendedores recebam por suas vendas.
          </p>
        </div>

        {/* 4 Steps Flow */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
          <div className="p-6 rounded-2xl bg-zinc-50 border border-zinc-200 relative group hover:border-[#0066FF] hover:bg-white transition-all shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-white border border-zinc-200 text-[#0066FF] flex items-center justify-center font-black text-base mb-4 group-hover:bg-[#0066FF] group-hover:text-white transition-colors shadow-xs">
              1
            </div>
            <h3 className="font-extrabold text-sm text-zinc-900 mb-1.5">Escolha seu Ativo</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Explore contas de IA (ChatGPT, Gemini, Lovable), chaves de jogos ou serviços digitais.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-50 border border-zinc-200 relative group hover:border-[#0066FF] hover:bg-white transition-all shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-white border border-zinc-200 text-[#0066FF] flex items-center justify-center font-black text-base mb-4 group-hover:bg-[#0066FF] group-hover:text-white transition-colors shadow-xs">
              2
            </div>
            <h3 className="font-extrabold text-sm text-zinc-900 mb-1.5">Pagamento Protegido</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Pague via Pix com QR Code seguro. O dinheiro fica em custódia na plataforma até você confirmar.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-50 border border-zinc-200 relative group hover:border-[#0066FF] hover:bg-white transition-all shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-white border border-zinc-200 text-[#0066FF] flex items-center justify-center font-black text-base mb-4 group-hover:bg-[#0066FF] group-hover:text-white transition-colors shadow-xs">
              3
            </div>
            <h3 className="font-extrabold text-sm text-zinc-900 mb-1.5">Receba na Hora</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Chaves e logins com entrega automática são liberados no mesmo segundo na sua tela.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-50 border border-zinc-200 relative group hover:border-[#0066FF] hover:bg-white transition-all shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-white border border-zinc-200 text-[#0066FF] flex items-center justify-center font-black text-base mb-4 group-hover:bg-[#0066FF] group-hover:text-white transition-colors shadow-xs">
              4
            </div>
            <h3 className="font-extrabold text-sm text-zinc-900 mb-1.5">Liberação Segura</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Você testa o produto, avalia o atendimento e libera o pagamento ao vendedor.
            </p>
          </div>
        </div>

        {/* Seller CTA Banner */}
        <div className="mt-12 p-8 rounded-3xl bg-[#141412] text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden">
          <div className="relative z-10 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFE500]/10 border border-[#FFE500]/30 text-[#FFE500] text-xs font-bold mb-3">
              <Zap className="w-3 h-3 fill-[#FFE500]" />
              <span>Para Fornecedores e Criadores</span>
            </div>
            <h3 className="text-2xl font-black text-white tracking-tight mb-2">
              Comece a vender no PlayContas hoje
            </h3>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              Venda suas contas, ferramentas e licenças com entrega automática via bot, saque rápido e as menores taxas do mercado brasileiro.
            </p>
          </div>
          <button
            onClick={onOpenCreateListing}
            className="relative z-10 px-6 py-3.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-sm flex items-center gap-2 shrink-0 transition-transform active:scale-95 shadow-md"
          >
            <span>Criar meu primeiro anúncio</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
