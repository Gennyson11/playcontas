"use client";

import React from "react";
import { ArrowRight } from "lucide-react";

export interface PopularCategoryItem {
  id: string;
  name: string;
  query: string;
  image: string;
}

interface PopularCategoriesSectionProps {
  selectedCategory?: string;
  onSelectCategory: (categoryName: string) => void;
  onOpenAllCategories: () => void;
}

export const POPULAR_CATEGORIES: PopularCategoryItem[] = [
  {
    id: "gpt",
    name: "ChatGPT",
    query: "ChatGPT",
    image: "/categorias/gpt.webp",
  },
  {
    id: "claude",
    name: "Claude",
    query: "Claude",
    image: "/categorias/claude.webp",
  },
  {
    id: "cursor",
    name: "Cursor",
    query: "Cursor",
    image: "/categorias/cursor.webp",
  },
  {
    id: "gemini",
    name: "Gemini",
    query: "Gemini",
    image: "/categorias/gemini.webp",
  },
  {
    id: "steam",
    name: "Steam",
    query: "Steam",
    image: "/categorias/steam.webp",
  },
  {
    id: "gtavi",
    name: "GTA VI",
    query: "GTA",
    image: "/categorias/gtavi.webp",
  },
  {
    id: "minecraft",
    name: "Minecraft",
    query: "Minecraft",
    image: "/categorias/minecraft.webp",
  },
  {
    id: "roblox",
    name: "Roblox",
    query: "Roblox",
    image: "/categorias/roblox.webp",
  },
];

export function PopularCategoriesSection({
  selectedCategory,
  onSelectCategory,
  onOpenAllCategories,
}: PopularCategoriesSectionProps) {
  const handleCategoryClick = (categoryQuery: string) => {
    onSelectCategory(categoryQuery);
    const el = document.getElementById("em-destaque");
    el?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6 select-none">
      {/* SECTION HEADER */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2.5">
          <span className="w-3 h-7 rounded-full bg-[#0066FF] shadow-xs" />
          <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
            Categorias Populares
          </h2>
        </div>

        {/* "Ver todas as categorias →" Button */}
        <button
          onClick={onOpenAllCategories}
          className="flex items-center gap-2 px-5 py-2 rounded-full border border-zinc-200 hover:border-[#0066FF] bg-white text-zinc-800 hover:text-[#0066FF] font-bold text-xs uppercase tracking-wider transition-all shadow-xs group"
        >
          <span>Ver todas as categorias</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* 8-COLUMN CARDS GRID - Exact 4:5 ratio (384x480) with labels underneath */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4">
        {POPULAR_CATEGORIES.map((cat) => {
          const isSelected =
            selectedCategory?.toLowerCase() === cat.name.toLowerCase() ||
            selectedCategory?.toLowerCase() === cat.query.toLowerCase();

          return (
            <div
              key={cat.id}
              onClick={() => handleCategoryClick(cat.query)}
              className="flex flex-col items-center group cursor-pointer text-center"
            >
              {/* Card Tile with exact 4:5 aspect ratio (384x480) */}
              <div
                className={`relative w-full aspect-[4/5] rounded-2xl overflow-hidden shadow-xs group-hover:shadow-xl group-hover:shadow-blue-500/20 border-2 transition-all duration-300 group-hover:-translate-y-1.5 bg-zinc-900 ${
                  isSelected
                    ? "border-[#0066FF] shadow-lg shadow-blue-500/20 ring-2 ring-[#0066FF]/20"
                    : "border-zinc-200/90 group-hover:border-[#0066FF]"
                }`}
              >
                <img
                  src={cat.image}
                  alt={cat.name}
                  width={384}
                  height={480}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              </div>

              {/* Text Label Below the Card */}
              <span
                className={`block text-xs sm:text-[13px] font-bold tracking-tight leading-snug line-clamp-2 transition-colors mt-2 sm:mt-2.5 max-w-[120px] mx-auto ${
                  isSelected
                    ? "text-[#0066FF]"
                    : "text-zinc-900 group-hover:text-[#0066FF]"
                }`}
              >
                {cat.name}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
