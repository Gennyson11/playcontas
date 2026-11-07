"use client";

import React, { useState } from "react";
import {
  Sprout,
  MessageSquare,
  Bell,
  PlusCircle,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

interface SeedNavbarProps {
  onOpenCreateListing: () => void;
  onOpenCart: () => void;
  cartCount: number;
  userBalance?: number;
  activeSection: string;
  onSelectSection: (section: string) => void;
}

export function SeedNavbar({
  onOpenCreateListing,
  onOpenCart,
  cartCount,
  userBalance = 2021.56,
  activeSection,
  onSelectSection,
}: SeedNavbarProps) {
  return (
    <header className="w-full bg-[#0E1117] border-b border-[#1A1F2B] relative select-none">
      {/* Top thin purple neon bar */}
      <div className="h-[2px] w-full bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-500 shadow-sm shadow-purple-500/50" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 py-3.5 gap-4">
          {/* Left: Brand Logo */}
          <div className="flex items-center gap-2.5 cursor-pointer shrink-0" onClick={() => onSelectSection("games")}>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#10B981] to-[#059669] flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Sprout className="w-5 h-5 fill-white text-white" />
            </div>
            <div className="flex items-center gap-1.5 font-sans">
              <span className="text-lg font-black tracking-tight text-white uppercase">
                SOCIAL <span className="text-zinc-200">SEED</span>
              </span>
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-xs font-semibold text-zinc-400">
            <button
              onClick={() => onSelectSection("creators")}
              className={`hover:text-white transition-colors ${
                activeSection === "creators" ? "text-white font-bold" : ""
              }`}
            >
              Find creators
            </button>
            <button
              onClick={() => onSelectSection("quests")}
              className={`hover:text-white transition-colors ${
                activeSection === "quests" ? "text-white font-bold" : ""
              }`}
            >
              Quests
            </button>
            <button
              onClick={() => onSelectSection("games")}
              className={`hover:text-white transition-colors ${
                activeSection === "games" ? "text-emerald-400 font-bold" : ""
              }`}
            >
              Games
            </button>
            <button
              onClick={onOpenCreateListing}
              className="text-[#10B981] hover:text-[#059669] font-bold flex items-center gap-1 transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Anunciar / Vender</span>
            </button>
          </nav>

          {/* Right Action Icons & Profile */}
          <div className="flex items-center gap-3 shrink-0">
            {/* My Games Pill */}
            <button
              onClick={() => onSelectSection("my-games")}
              className="hidden sm:flex items-center px-4 py-1.5 rounded-full border border-zinc-700 bg-[#161B26] hover:bg-[#1D2433] text-xs font-bold text-white transition-colors shadow-xs"
            >
              My Games
            </button>

            {/* Chat button */}
            <button
              className="w-9 h-9 rounded-full bg-[#161B26] border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
              title="Mensagens"
            >
              <MessageSquare className="w-4 h-4" />
            </button>

            {/* Bell button */}
            <button
              className="w-9 h-9 rounded-full bg-[#161B26] border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
              title="Notificações"
            >
              <Bell className="w-4 h-4" />
            </button>

            {/* Shopping Cart Button */}
            <button
              onClick={onOpenCart}
              className="relative w-9 h-9 rounded-full bg-[#161B26] border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
              title="Carrinho"
            >
              <ShoppingBag className="w-4 h-4" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#10B981] text-white text-[9px] font-black flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Balance & Avatar */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-zinc-800">
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-zinc-400 uppercase font-medium leading-none">
                  Balance
                </span>
                <span className="text-xs font-bold text-white leading-tight font-mono mt-0.5">
                  $ {userBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-cyan-400 shadow-md">
                <img
                  src="https://images.unsplash.com/photo-1566492031773-4f4e44671857?auto=format&fit=crop&w=80&q=80"
                  alt="User Avatar"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
