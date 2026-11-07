"use client";

import React, { useState } from "react";
import { Heart, Play, ArrowRight, Sparkles } from "lucide-react";
import { Product } from "@/types";

interface CoverflowItem {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  badgeText: string;
  image: string;
  accentColor: string;
  price: string;
}

interface CoverflowHeroProps {
  onSelectGame?: (title: string) => void;
  onExploreProduct?: () => void;
}

export function CoverflowHero({
  onSelectGame,
  onExploreProduct,
}: CoverflowHeroProps) {
  const items: CoverflowItem[] = [
    {
      id: "elden-ring",
      title: "ELDEN RING",
      subtitle: "Rise, Tarnished, and be guided by grace to brandish the power of the Elden Ring.",
      tag: "ACTION RPG",
      badgeText: "PRE-ORDER",
      image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1000&q=80",
      accentColor: "#f59e0b",
      price: "R$ 149,00",
    },
    {
      id: "cyberpunk",
      title: "CYBERPUNK 2077",
      subtitle: "Night City will change you. An open-world, action-adventure story set in Night City.",
      tag: "OPEN WORLD",
      badgeText: "COMPRAR AGORA",
      image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1000&q=80",
      accentColor: "#FFE500",
      price: "R$ 69,90",
    },
    {
      id: "lol",
      title: "LEAGUE OF LEGENDS",
      subtitle: "Become a legend. Choose a champion, learn his skills, beat opponents in 5v5 team battles.",
      tag: "RIOT GAMES",
      badgeText: "PRE-ORDER",
      image: "https://images.unsplash.com/photo-1542751110-97427bbecf20?auto=format&fit=crop&w=1000&q=80",
      accentColor: "#10b981",
      price: "R$ 29,90",
    },
    {
      id: "fortnite",
      title: "FORTNITE • CHAPTER 5",
      subtitle: "Drop into the island and battle to be the last one standing with exclusive skins and V-Bucks.",
      tag: "BATTLE ROYALE",
      badgeText: "VER SKINS",
      image: "https://images.unsplash.com/photo-1589241062272-c0a000072dfa?auto=format&fit=crop&w=1000&q=80",
      accentColor: "#0084FF",
      price: "R$ 49,90",
    },
    {
      id: "gemini-pro",
      title: "GEMINI PRO & IA TOOLS",
      subtitle: "Acesso total aos modelos avançados de IA com chaves privadas e ativação imediata.",
      tag: "INTELIGÊNCIA ARTIFICIAL",
      badgeText: "ATIVAR AGORA",
      image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1000&q=80",
      accentColor: "#8b5cf6",
      price: "R$ 67,00",
    },
  ];

  const [activeIndex, setActiveIndex] = useState(2); // Starts at center (League of Legends)
  const [favoriteActive, setFavoriteActive] = useState(true);

  const getPositionOffset = (index: number) => {
    let diff = index - activeIndex;
    if (diff < -2) diff += items.length;
    if (diff > 2) diff -= items.length;
    return diff;
  };

  return (
    <div className="relative w-full py-8 overflow-hidden select-none">
      <div className="relative h-[340px] flex items-center justify-center max-w-6xl mx-auto perspective-[1200px]">
        {items.map((item, index) => {
          const offset = getPositionOffset(index);
          const isCenter = offset === 0;

          // Compute transform styles based on slot offset (-2, -1, 0, 1, 2)
          let transformStyle = "";
          let zIndex = 10;
          let opacity = 0;
          let scale = 1;

          if (offset === 0) {
            transformStyle = "translateX(0px) scale(1) rotateY(0deg)";
            zIndex = 30;
            opacity = 1;
            scale = 1;
          } else if (offset === -1) {
            transformStyle = "translateX(-240px) scale(0.85) rotateY(18deg)";
            zIndex = 20;
            opacity = 0.85;
            scale = 0.85;
          } else if (offset === 1) {
            transformStyle = "translateX(240px) scale(0.85) rotateY(-18deg)";
            zIndex = 20;
            opacity = 0.85;
            scale = 0.85;
          } else if (offset === -2) {
            transformStyle = "translateX(-420px) scale(0.72) rotateY(28deg)";
            zIndex = 10;
            opacity = 0.45;
            scale = 0.72;
          } else if (offset === 2) {
            transformStyle = "translateX(420px) scale(0.72) rotateY(-28deg)";
            zIndex = 10;
            opacity = 0.45;
            scale = 0.72;
          } else {
            transformStyle = "translateX(0px) scale(0.5)";
            zIndex = 1;
            opacity = 0;
          }

          return (
            <div
              key={item.id}
              onClick={() => setActiveIndex(index)}
              style={{
                transform: transformStyle,
                zIndex: zIndex,
                opacity: opacity,
                transition: "all 500ms cubic-bezier(0.16, 1, 0.3, 1)",
              }}
              className={`absolute top-0 w-[480px] h-[330px] rounded-3xl overflow-hidden cursor-pointer shadow-2xl origin-center border border-white/10 ${
                isCenter ? "shadow-[#0084FF]/20" : ""
              }`}
            >
              {/* Background Cover Image */}
              <img
                src={item.image}
                alt={item.title}
                className="w-full h-full object-cover brightness-[0.85]"
              />

              {/* Gradient Vignette Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A0E15] via-[#0A0E15]/30 to-black/30" />

              {/* Top Bar inside Center Card */}
              {isCenter && (
                <div className="absolute top-4 right-4 z-20">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFavoriteActive(!favoriteActive);
                    }}
                    className="w-9 h-9 rounded-2xl bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-rose-500 hover:scale-110 transition-transform shadow-lg"
                  >
                    <Heart
                      className={`w-4 h-4 ${favoriteActive ? "fill-rose-500" : ""}`}
                    />
                  </button>
                </div>
              )}

              {/* Bottom Content for Active Center Card */}
              {isCenter ? (
                <div className="absolute bottom-6 left-6 right-6 z-20">
                  <div className="inline-block px-2.5 py-0.5 rounded-md bg-[#0084FF] text-white text-[10px] font-black uppercase tracking-wider mb-2">
                    {item.tag}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight mb-1 font-mono leading-none">
                    {item.title}
                  </h2>
                  <p className="text-xs text-zinc-300 font-medium max-w-sm line-clamp-2 leading-relaxed mb-4">
                    {item.subtitle}
                  </p>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onExploreProduct) onExploreProduct();
                      }}
                      className="px-6 py-2.5 rounded-full bg-white text-black font-black text-xs uppercase tracking-wider hover:bg-zinc-200 transition-all active:scale-95 shadow-lg"
                    >
                      {item.badgeText}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const el = document.getElementById("games-discount");
                        el?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white flex items-center justify-center hover:bg-white/30 transition-colors"
                      title="Ver mais"
                    >
                      <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Muted Title for Side Cards */
                <div className="absolute bottom-4 left-4 right-4 z-20">
                  <h3 className="text-base font-black text-white/90 truncate font-mono uppercase">
                    {item.title}
                  </h3>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dots Indicator */}
      <div className="flex items-center justify-center gap-2 mt-4">
        {items.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setActiveIndex(idx)}
            className={`h-1.5 rounded-full transition-all ${
              activeIndex === idx
                ? "w-7 bg-[#0084FF]"
                : "w-2 bg-zinc-700 hover:bg-zinc-500"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
