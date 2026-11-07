"use client";

import React from "react";
import {
  Search,
  SlidersHorizontal,
  Heart,
  ShoppingBag,
  ChevronDown,
} from "lucide-react";

interface TopNavbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  cartCount: number;
  onOpenCart: () => void;
  favoritesCount?: number;
  onOpenFavorites?: () => void;
  userBalance?: number;
  onOpenProfile?: () => void;
}

export function TopNavbar({
  searchQuery,
  onSearchChange,
  cartCount,
  onOpenCart,
  favoritesCount = 3,
  onOpenFavorites,
  userBalance = 158.4,
  onOpenProfile,
}: TopNavbarProps) {
  return (
    <header className="h-20 px-8 flex items-center justify-between gap-6 border-b border-[#141C27] bg-[#0A0E15]">
      {/* Search Bar */}
      <div className="flex-1 max-w-lg">
        <div className="relative flex items-center bg-[#101722] border border-[#17212F] rounded-2xl px-4 py-2.5 focus-within:border-[#0084FF] transition-all">
          <Search className="w-4 h-4 text-zinc-400 mr-3 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search for games, accounts, keys, IAs..."
            className="w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none font-medium"
          />
          <button
            type="button"
            className="p-1.5 rounded-xl bg-[#16202E] text-zinc-400 hover:text-white transition-colors ml-2 shrink-0"
            title="Filters"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Right Actions: Heart, Cart, User Profile */}
      <div className="flex items-center gap-3.5">
        {/* Heart Wishlist Button */}
        <button
          onClick={onOpenFavorites}
          className="w-11 h-11 rounded-2xl bg-[#101722] border border-[#17212F] text-zinc-300 hover:text-rose-500 hover:border-rose-500/40 flex items-center justify-center transition-all shadow-sm group"
          title="Wishlist / Favoritos"
        >
          <Heart className="w-4 h-4 group-hover:scale-110 transition-transform" />
        </button>

        {/* Shopping Cart Button */}
        <button
          onClick={onOpenCart}
          className="relative w-11 h-11 rounded-2xl bg-[#101722] border border-[#17212F] text-zinc-300 hover:text-white hover:border-[#0084FF]/50 flex items-center justify-center transition-all shadow-sm group"
          title="Carrinho de Compras"
        >
          <ShoppingBag className="w-4 h-4 group-hover:scale-110 transition-transform" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#0084FF] text-white text-[10px] font-black flex items-center justify-center border-2 border-[#0A0E15]">
              {cartCount}
            </span>
          )}
        </button>

        {/* User Profile Pill */}
        <button
          onClick={onOpenProfile}
          className="flex items-center gap-3 px-3 py-1.5 rounded-2xl bg-[#101722] border border-[#17212F] hover:border-zinc-700 transition-all text-left shadow-sm"
        >
          <div className="relative w-8 h-8 rounded-full overflow-hidden border border-purple-500/60 shadow-xs">
            <img
              src="https://images.unsplash.com/photo-1566492031773-4f4e44671857?auto=format&fit=crop&w=80&q=80"
              alt="Winotikk avatar"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white leading-tight">
              Winotikk
            </span>
            <span className="text-[10px] text-[#0084FF] font-medium leading-tight">
              R$ {userBalance.toFixed(2).replace(".", ",")}
            </span>
          </div>
        </button>
      </div>
    </header>
  );
}
