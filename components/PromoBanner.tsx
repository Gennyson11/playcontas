"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Gift, Sparkles, Megaphone, Percent } from "lucide-react";

export function PromoBanner() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: "Get $50 for your friend!",
      description: "Invite a friend who spends $50 or more in the first 30 days and get $50 free",
      tag: "INVITE & EARN",
      gradient: "from-[#170E2E] via-[#1A1238] to-[#121B2D]",
    },
    {
      title: "Roblox Robux & Blox Fruits em Promoção!",
      description: "Contas verificadas, frutas míticas e entrega automática 24 horas por dia",
      tag: "DESTAQUE DA SEMANA",
      gradient: "from-[#1C122C] via-[#151D33] to-[#0F2327]",
    },
    {
      title: "Contas de IA com 18 Meses de Garantia",
      description: "Gemini Advanced Pro, Lovable e ChatGPT Plus com ativação imediata via Pix",
      tag: "OFERTA ESPECIAL",
      gradient: "from-[#2A1810] via-[#1F1735] to-[#121B2D]",
    },
  ];

  const handleNext = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const handlePrev = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const slide = slides[currentSlide];

  return (
    <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4 select-none">
      <div
        className={`relative w-full rounded-3xl bg-gradient-to-r ${slide.gradient} border border-purple-500/20 p-6 sm:p-8 flex items-center justify-between overflow-hidden shadow-2xl transition-all duration-500 min-h-[140px] sm:min-h-[160px]`}
      >
        {/* Left Arrow Button */}
        <button
          onClick={handlePrev}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-zinc-400 hover:text-white flex items-center justify-center transition-colors border border-white/10"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="relative z-10 pl-6 sm:pl-8 max-w-xl">
          <div className="inline-block px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] font-black uppercase tracking-wider mb-2">
            {slide.tag}
          </div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight leading-tight mb-1 font-sans">
            {slide.title}
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300 font-medium leading-relaxed">
            {slide.description}
          </p>
        </div>

        {/* Right 3D Visual Floating Icons */}
        <div className="hidden sm:flex items-center gap-4 relative z-10 pr-6">
          {/* Megaphone Orb */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-xl shadow-cyan-500/20 rotate-[-12deg] animate-pulse">
            <Megaphone className="w-8 h-8 fill-white" />
          </div>

          {/* Discount % Sphere */}
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white shadow-xl shadow-purple-500/30 rotate-[8deg]">
            <Percent className="w-7 h-7 stroke-[3]" />
          </div>

          {/* Floating Coin / Orb */}
          <div className="w-8 h-8 rounded-full bg-amber-400 shadow-lg shadow-amber-400/40 animate-bounce" />
        </div>

        {/* Right Arrow Button */}
        <button
          onClick={handleNext}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-zinc-400 hover:text-white flex items-center justify-center transition-colors border border-white/10"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Dots Indicator */}
      <div className="flex items-center justify-center gap-2 mt-3">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentSlide(idx)}
            className={`h-1.5 rounded-full transition-all ${
              currentSlide === idx ? "w-6 bg-white" : "w-1.5 bg-zinc-700"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
