"use client";

import React from "react";
import { UserCheck, ShieldCheck, Headphones } from "lucide-react";

interface AboutMarketSectionProps {
  onLearnMore?: () => void;
}

export function AboutMarketSection({ onLearnMore }: AboutMarketSectionProps) {
  return (
    <section
      id="sobre-central"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 pt-6"
    >
      {/* Cabeçalho no padrão visual do site */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-[#0066FF] text-xs font-bold uppercase tracking-wider mb-3.5 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-[#0066FF]" />
          <span>Segurança & Confiança</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-black text-zinc-950 tracking-tight">
          O que é o <span className="text-[#0066FF]">PlayContas</span>?
        </h2>
        <p className="mt-3 text-sm sm:text-base text-zinc-600 font-medium leading-relaxed max-w-2xl mx-auto">
          Marketplace brasileiro de contas, serviços, itens e ferramentas, com verificação,
          custódia e suporte de verdade.
        </p>
      </div>

      {/* Grade com os 3 Cards no padrão do site (Card branco com borda suave e detalhes em azul) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
        {/* Card 1: Vendedores com histórico real */}
        <div className="bg-white rounded-3xl border border-zinc-200 p-6 sm:p-7 shadow-xs hover:border-[#0066FF] hover:shadow-lg hover:shadow-blue-500/5 transition-all group flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-[#0066FF] flex items-center justify-center mb-5 group-hover:scale-105 group-hover:bg-[#0066FF] group-hover:text-white transition-all shadow-2xs">
              <UserCheck className="w-6 h-6" />
            </div>
            <h3 className="text-base sm:text-lg font-black text-zinc-950 tracking-tight mb-2">
              Vendedores com histórico real
            </h3>
            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed font-medium">
              Avaliações, tempo de casa e histórico de vendas visíveis antes de fechar negócio.
            </p>
          </div>
        </div>

        {/* Card 2: Pagamento protegido até a entrega */}
        <div className="bg-white rounded-3xl border border-zinc-200 p-6 sm:p-7 shadow-xs hover:border-[#0066FF] hover:shadow-lg hover:shadow-blue-500/5 transition-all group flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-[#0066FF] flex items-center justify-center mb-5 group-hover:scale-105 group-hover:bg-[#0066FF] group-hover:text-white transition-all shadow-2xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-base sm:text-lg font-black text-zinc-950 tracking-tight mb-2">
              Seu pagamento protegido até a entrega
            </h3>
            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed font-medium">
              O valor fica retido até você confirmar o recebimento. Deu errado, o dinheiro volta.
            </p>
          </div>
        </div>

        {/* Card 3: Suporte que resolve */}
        <div className="bg-white rounded-3xl border border-zinc-200 p-6 sm:p-7 shadow-xs hover:border-[#0066FF] hover:shadow-lg hover:shadow-blue-500/5 transition-all group flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-[#0066FF] flex items-center justify-center mb-5 group-hover:scale-105 group-hover:bg-[#0066FF] group-hover:text-white transition-all shadow-2xs">
              <Headphones className="w-6 h-6" />
            </div>
            <h3 className="text-base sm:text-lg font-black text-zinc-950 tracking-tight mb-2">
              Suporte que resolve, não enrola
            </h3>
            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed font-medium">
              Mediação humana, prazos claros e disputas resolvidas com justiça.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
