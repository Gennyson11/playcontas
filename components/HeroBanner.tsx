"use client";

import React from "react";
import {
  Zap,
  ShieldCheck,
  Users,
  ArrowRight,
} from "lucide-react";

interface HeroBannerProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectCategory: (cat: string) => void;
  onOpenCreateListing: () => void;
}

export function HeroBanner({
  searchQuery,
  onSearchChange,
  onSelectCategory,
  onOpenCreateListing,
}: HeroBannerProps) {
  return (
    <div className="relative bg-[#141412] text-white overflow-hidden">
      {/* Subtle radial ambient warmth on top-right */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#FFE500]/5 blur-[140px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 lg:pt-16 lg:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Column: Headline, Pill, Buttons, Stats */}
          <div className="lg:col-span-7">
            {/* Outline yellow pill badge */}
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-[#FFE500]/40 bg-[#1c1b16] text-[#FFE500] text-xs font-black uppercase tracking-wider mb-5">
              <Zap className="w-3.5 h-3.5 fill-[#FFE500]" />
              <span>POBRE TAMBÉM TEM GOSTO CARO</span>
            </div>

            {/* Main Headline with Yellow Highlight Box */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.08] mb-4">
              Quanto mais<br />
              gente compra,<br />
              <span className="bg-[#FFE500] text-black px-2.5 py-0.5 rounded-sm inline-block font-black mt-1">
                mais barato fica
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-zinc-300 text-sm sm:text-base font-normal max-w-xl leading-relaxed mb-8">
              Marketplace de contas digitais, licenças de ferramentas de IA e softwares.
              Ativação imediata via Pix com garantia e suporte.
            </p>

            {/* Buttons */}
            <div className="flex flex-wrap items-center gap-3.5 mb-10">
              <button
                onClick={() => {
                  const el = document.getElementById("produtos");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="px-6 py-3 rounded-lg bg-[#0066FF] hover:bg-[#0052cc] text-white font-bold text-sm flex items-center gap-2 transition-all shadow-md active:scale-95"
              >
                <span>Ver mais vendidos</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  const el = document.getElementById("como-funciona");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="px-6 py-3 rounded-lg border border-zinc-700 hover:border-zinc-500 hover:bg-white/5 text-white font-semibold text-sm transition-colors"
              >
                Como funciona
              </button>
            </div>

            {/* 3 Stats Row under buttons */}
            <div className="grid grid-cols-3 gap-6 pt-5 max-w-md border-t border-zinc-800/80">
              <div>
                <div className="text-[#FFE500] text-lg sm:text-xl font-black leading-tight">
                  Na hora
                </div>
                <div className="text-zinc-400 text-xs mt-0.5 font-medium leading-tight">
                  entrega automática após o Pix
                </div>
              </div>
              <div>
                <div className="text-[#FFE500] text-lg sm:text-xl font-black leading-tight">
                  Pix
                </div>
                <div className="text-zinc-400 text-xs mt-0.5 font-medium leading-tight">
                  pagamento instantâneo e seguro
                </div>
              </div>
              <div>
                <div className="text-[#FFE500] text-lg sm:text-xl font-black leading-tight">
                  100%
                </div>
                <div className="text-zinc-400 text-xs mt-0.5 font-medium leading-tight">
                  devolvido se a entrega falhar
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: 3 Feature Cards */}
          <div className="lg:col-span-5 flex flex-col gap-3.5">
            {/* Card 1 */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#1c1b18] border border-zinc-800/90 flex items-start gap-4 shadow-lg hover:border-zinc-700 transition-all">
              <div className="w-10 h-10 rounded-xl bg-[#2a2718] border border-[#FFE500]/30 flex items-center justify-center text-[#FFE500] shrink-0 mt-0.5">
                <Zap className="w-5 h-5 fill-[#FFE500]" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-1">
                  Chega antes de você terminar de ler isto
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Número, código, chave ou licença aparecem no seu painel sem esperar atendente de plantão.
                </p>
              </div>
            </div>

            {/* Card 2 */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#1c1b18] border border-zinc-800/90 flex items-start gap-4 shadow-lg hover:border-zinc-700 transition-all">
              <div className="w-10 h-10 rounded-xl bg-[#2a2718] border border-[#FFE500]/30 flex items-center justify-center text-[#FFE500] shrink-0 mt-0.5">
                <ShieldCheck className="w-5 h-5 text-[#FFE500]" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-1">
                  Não chegou? Dinheiro de volta sozinho
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Passou do prazo e o código não veio, o valor volta 100% para a sua carteira sem você pedir.
                </p>
              </div>
            </div>

            {/* Card 3 */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#1c1b18] border border-zinc-800/90 flex items-start gap-4 shadow-lg hover:border-zinc-700 transition-all">
              <div className="w-10 h-10 rounded-xl bg-[#2a2718] border border-[#FFE500]/30 flex items-center justify-center text-[#FFE500] shrink-0 mt-0.5">
                <Users className="w-5 h-5 text-[#FFE500]" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-1">
                  Pagando preço cheio ainda? Que fofo
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Na compra coletiva o preço cai conforme o grupo cresce — e o menor valor vale para todos.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hazard yellow/black diagonal stripes tape at the bottom */}
      <div
        className="h-3 w-full"
        style={{
          background:
            "repeating-linear-gradient(45deg, #FFE500, #FFE500 12px, #000 12px, #000 24px)",
        }}
      />
    </div>
  );
}
