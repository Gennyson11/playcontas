"use client";

import React, { useState } from "react";
import { ALL_CATEGORIES } from "@/lib/categories";
import {
  Gamepad2,
  Search,
  X,
  ChevronRight,
  Flame,
} from "lucide-react";

interface CategoriesSectionProps {
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
}

export function CategoriesSection({
  selectedCategory,
  onSelectCategory,
}: CategoriesSectionProps) {
  const [allModalOpen, setAllModalOpen] = useState(false);
  const [searchModal, setSearchModal] = useState("");

  const topFeatured = [
    { name: "Fortnite", count: "480 anúncios" },
    { name: "Valorant", count: "392 anúncios" },
    { name: "Roblox", count: "1.240 anúncios" },
    { name: "Steam", count: "890 anúncios" },
    { name: "GTA V", count: "315 anúncios" },
    { name: "Minecraft", count: "620 anúncios" },
    { name: "League of Legends", count: "440 anúncios" },
    { name: "Inteligência Artificial", count: "342 anúncios" },
    { name: "Licenças de Software", count: "184 anúncios" },
    { name: "Discord", count: "160 anúncios" },
    { name: "Redes Sociais", count: "312 anúncios" },
    { name: "Free Fire (FF)", count: "510 anúncios" },
  ];

  const modalFiltered = ALL_CATEGORIES.filter((c) =>
    c.name.toLowerCase().includes(searchModal.toLowerCase())
  );

  return (
    <section className="px-8 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Explore Categories</span>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#131D2A] text-[#0084FF] border border-[#1A283B] font-mono font-bold">
              {ALL_CATEGORIES.length} CATEGORIAS
            </span>
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {selectedCategory !== "TODOS" && (
            <button
              onClick={() => onSelectCategory("TODOS")}
              className="text-xs font-bold text-[#0084FF] hover:underline"
            >
              Ver Todas
            </button>
          )}

          <button
            onClick={() => setAllModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-[#101722] hover:bg-[#16202E] border border-[#17212F] text-xs font-bold text-zinc-300 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <span>Ver todas</span>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        </div>
      </div>

      {/* Grid of Top Categories */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {topFeatured.map((cat) => {
          const isSelected = selectedCategory === cat.name;

          return (
            <button
              key={cat.name}
              onClick={() => {
                onSelectCategory(isSelected ? "TODOS" : cat.name);
                const el = document.getElementById("games-discount");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`p-3.5 rounded-2xl text-left transition-all duration-200 cursor-pointer ${
                isSelected
                  ? "bg-[#182639] border border-[#0084FF] shadow-lg shadow-[#0084FF]/20"
                  : "bg-[#101722] border border-[#17212F] hover:border-[#1F2E42] hover:bg-[#131C28]"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                    isSelected
                      ? "bg-[#0084FF] text-white"
                      : "bg-[#17212F] text-zinc-400"
                  }`}
                >
                  <Gamepad2 className="w-3.5 h-3.5" />
                </div>
                <ChevronRight
                  className={`w-3.5 h-3.5 text-zinc-600 ${
                    isSelected ? "text-[#0084FF]" : ""
                  }`}
                />
              </div>
              <h3 className="font-bold text-xs text-white truncate">
                {cat.name}
              </h3>
              <span className="text-[10px] text-zinc-400 block mt-0.5">
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Modal with ALL 100+ Categories */}
      {allModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-4xl bg-[#0D141F] border border-[#1A2637] rounded-3xl shadow-2xl overflow-hidden my-6 max-h-[88vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#17212F] bg-[#0A0E15]">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-[#0084FF]" />
                <h3 className="font-black text-white text-base">
                  Todas as Categorias ({ALL_CATEGORIES.length})
                </h3>
              </div>
              <button
                onClick={() => setAllModalOpen(false)}
                className="p-1.5 rounded-xl bg-[#131C28] text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-[#17212F] bg-[#0E1520]">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchModal}
                  onChange={(e) => setSearchModal(e.target.value)}
                  placeholder="Pesquisar categoria (ex: Fortnite, Roblox, GTA V, Valorant, Cursos...)"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#121A26] border border-[#1A2637] text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#0084FF]"
                />
              </div>
            </div>

            {/* Categories List */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 bg-[#0D141F]">
              {modalFiltered.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    onSelectCategory(cat.name);
                    setAllModalOpen(false);
                    const el = document.getElementById("games-discount");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="p-3 rounded-xl bg-[#101722] hover:bg-[#16202E] border border-[#17212F] hover:border-[#0084FF] text-left transition-all cursor-pointer group"
                >
                  <span className="font-bold text-xs text-zinc-200 group-hover:text-[#0084FF] block truncate">
                    {cat.name}
                  </span>
                  <span className="text-[10px] text-zinc-500 block mt-0.5">
                    {cat.group}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
