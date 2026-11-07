"use client";

import React from "react";
import { Search, SlidersHorizontal, Gamepad2, Flame, Heart } from "lucide-react";

interface SeedCategoryBarProps {
  selectedTag: string;
  onSelectTag: (tag: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sortBy: "popularity" | "price" | "rate" | "alphabet";
  onSortChange: (sort: "popularity" | "price" | "rate" | "alphabet") => void;
  activeCategoryName: string;
  totalGamesCount?: string;
}

export function SeedCategoryBar({
  selectedTag,
  onSelectTag,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  activeCategoryName = "Roblox",
  totalGamesCount = "7,021 Games",
}: SeedCategoryBarProps) {
  const filterPills = [
    { label: "All games", tag: "ALL" },
    { label: "Roblox", tag: "Roblox", icon: "cube" },
    { label: "Fortnite", tag: "Fortnite" },
    { label: "Minecraft", tag: "Minecraft" },
    { label: "# Popularity", tag: "POPULAR" },
    { label: "# For woman", tag: "WOMAN" },
    { label: "# Active players", tag: "ACTIVE" },
    { label: "# High rate", tag: "HIGH_RATE" },
    { label: "# Creators Love", tag: "CREATORS_LOVE" },
    { label: "# Hot", tag: "HOT" },
    { label: "# RPG", tag: "RPG" },
    { label: "# FFA", tag: "FFA" },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2 select-none">
      {/* 1. Header with Category Title & Game Count */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          {/* Red square icon like the Roblox logo */}
          <div className="w-6 h-6 rounded-lg bg-[#EF4444] flex items-center justify-center text-white shadow-md shadow-red-500/20 rotate-[-8deg]">
            <div className="w-2.5 h-2.5 bg-[#0E1117] rounded-xs" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-sans">
            {activeCategoryName}
          </h1>
        </div>
        <span className="text-xs sm:text-sm font-bold text-zinc-400">
          {totalGamesCount}
        </span>
      </div>

      {/* 2. Horizontal Scrollable Filter Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 scrollbar-none mb-6">
        {filterPills.map((pill) => {
          const isSelected = selectedTag === pill.tag;

          return (
            <button
              key={pill.tag}
              onClick={() => onSelectTag(pill.tag)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                isSelected
                  ? "bg-[#10B981]/15 text-[#10B981] border border-[#10B981] shadow-sm shadow-emerald-500/10"
                  : "bg-[#161B26] text-zinc-400 hover:text-white border border-[#222B3A] hover:bg-[#1C2333]"
              }`}
            >
              {pill.tag === "Roblox" && (
                <span className="w-2 h-2 rounded-xs bg-[#EF4444]" />
              )}
              {pill.tag === "HOT" && <Flame className="w-3 h-3 text-red-500" />}
              {pill.tag === "CREATORS_LOVE" && (
                <Heart className="w-3 h-3 fill-emerald-500 text-emerald-500" />
              )}
              <span>{pill.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Search and Sort Sub-bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
        {/* Left: "All Games" label + Search pill */}
        <div className="flex items-center gap-4 flex-1 max-w-md">
          <span className="text-lg font-black text-white whitespace-nowrap">
            All Games
          </span>
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search game by ID or Name..."
              className="w-full pl-9 pr-4 py-2 rounded-full bg-[#161B26] border border-[#222B3A] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#10B981] transition-all"
            />
          </div>
        </div>

        {/* Right: Sort By options + Filter Button */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-500 font-semibold mr-1">Sort by:</span>
          <div className="flex items-center gap-1.5 bg-[#161B26] p-1 rounded-full border border-[#222B3A]">
            {(
              [
                { label: "Popularity", id: "popularity" },
                { label: "Price", id: "price" },
                { label: "Rate", id: "rate" },
                { label: "Alphabet", id: "alphabet" },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                onClick={() => onSortChange(s.id)}
                className={`px-3 py-1 rounded-full font-bold transition-all ${
                  sortBy === s.id
                    ? "bg-[#232B3B] text-white shadow-xs"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Filter button */}
          <button className="px-4 py-1.5 rounded-full bg-[#161B26] border border-[#222B3A] text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors font-bold flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filter</span>
          </button>
        </div>
      </div>
    </div>
  );
}
