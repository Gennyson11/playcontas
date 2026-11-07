"use client";

import React, { useState } from "react";
import {
  Search,
  ShoppingCart,
  PlusCircle,
  HelpCircle,
  Wallet,
  ChevronDown,
  Instagram,
  MessageCircle,
  X,
  Sparkles,
  Layers,
} from "lucide-react";

interface NavbarProps {
  onOpenCreateListing: () => void;
  onOpenCart: () => void;
  cartCount: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  userBalance?: number;
  onOpenCategoriesModal: () => void;
}

export function Navbar({
  onOpenCreateListing,
  onOpenCart,
  cartCount,
  searchQuery,
  onSearchChange,
  userBalance = 158.4,
  onOpenCategoriesModal,
}: NavbarProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-zinc-200 shadow-sm">
      {/* Tier 1: Main Header Row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo with Yellow/Black Hazard Stripes */}
          <div className="flex items-center gap-3 shrink-0">
            <a href="#" className="flex items-center gap-2.5 group">
              <div
                className="w-9 h-9 rounded-lg shadow-sm border border-black/20 flex items-center justify-center font-black group-hover:scale-105 transition-transform"
                style={{
                  background:
                    "repeating-linear-gradient(45deg, #FFE500, #FFE500 6px, #000 6px, #000 12px)",
                }}
              />
              <div className="flex flex-col">
                <span className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-1 leading-none">
                  Central <span className="text-black">das Ias</span>
                </span>
              </div>
            </a>
          </div>

          {/* Search Bar - Center Pill style */}
          <div className="flex-1 max-w-2xl mx-2 sm:mx-6">
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                <Search className="w-4 h-4 text-zinc-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Buscar licença, chave, gift card, IA, conta..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-300 rounded-xl text-xs sm:text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-black"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Right: Wallet Balance + User Pill */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Wallet pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 text-xs font-bold text-zinc-800">
              <Wallet className="w-3.5 h-3.5 text-zinc-500" />
              <span>R$ {userBalance.toFixed(2).replace(".", ",")}</span>
            </div>

            {/* Cart trigger */}
            <button
              onClick={onOpenCart}
              className="relative p-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-700 transition-colors"
              title="Carrinho"
            >
              <ShoppingCart className="w-4 h-4" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 min-w-[18px] text-center text-[10px] font-black bg-[#FFE500] text-black border border-black/20 rounded-full">
                  {cartCount}
                </span>
              )}
            </button>

            {/* User Profile Pill */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-xs font-semibold text-zinc-800 transition-colors"
              >
                <div className="w-5 h-5 rounded-full bg-zinc-900 text-white flex items-center justify-center text-[10px] font-bold">
                  G
                </div>
                <span className="hidden md:inline max-w-[130px] truncate text-zinc-700">
                  gennysson2012@gmail.c...
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-zinc-200 p-3 shadow-xl z-50 animate-fadeIn">
                  <div className="px-2 py-2 border-b border-zinc-100">
                    <p className="text-xs text-zinc-500">Conectado como</p>
                    <p className="text-sm font-bold text-zinc-900 truncate">gennysson2012@gmail.com</p>
                    <div className="mt-2 p-2 rounded-lg bg-zinc-50 border border-zinc-200 flex items-center justify-between">
                      <span className="text-xs text-zinc-500">Saldo:</span>
                      <span className="text-sm font-black text-zinc-900">R$ {userBalance.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="py-2 space-y-1 text-xs font-semibold">
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        onOpenCreateListing();
                      }}
                      className="w-full text-left px-2 py-2 rounded-lg hover:bg-zinc-100 text-zinc-800 flex items-center gap-2"
                    >
                      <PlusCircle className="w-4 h-4 text-amber-500" />
                      Anunciar Produto
                    </button>
                    <a
                      href="#produtos"
                      onClick={() => setUserMenuOpen(false)}
                      className="w-full text-left px-2 py-2 rounded-lg hover:bg-zinc-100 text-zinc-800 flex items-center gap-2 block"
                    >
                      <ShoppingCart className="w-4 h-4 text-zinc-500" />
                      Minhas Compras
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tier 2: Sub-navigation row matching the print */}
      <div className="border-t border-zinc-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-10 text-xs font-semibold text-zinc-600">
            {/* Left navigation links */}
            <div className="flex items-center gap-5 sm:gap-7 overflow-x-auto scrollbar-none py-1">
              <a href="#produtos" className="hover:text-black transition-colors whitespace-nowrap">
                Comprar
              </a>
              <a href="#produtos" className="hover:text-black transition-colors whitespace-nowrap">
                Ofertas coletivas
              </a>
              <a href="#produtos" className="hover:text-black transition-colors whitespace-nowrap">
                Monte seu combo
              </a>
              <a href="#produtos" className="hover:text-black transition-colors whitespace-nowrap">
                Números SMS
              </a>
              <a href="#produtos" className="hover:text-black transition-colors whitespace-nowrap">
                Contas de e-mail
              </a>

              {/* Categorias dropdown trigger */}
              <button
                onClick={onOpenCategoriesModal}
                className="flex items-center gap-1 hover:text-black transition-colors whitespace-nowrap font-bold text-zinc-800"
              >
                <span>Categorias</span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              </button>

              <button
                onClick={onOpenCreateListing}
                className="text-[#0066FF] hover:text-[#0052CC] font-bold transition-colors whitespace-nowrap flex items-center gap-1"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Vender</span>
              </button>

              <a href="#como-funciona" className="hover:text-black transition-colors whitespace-nowrap">
                Central de confiança
              </a>
            </div>

            {/* Right social icons */}
            <div className="hidden md:flex items-center gap-3 shrink-0 pl-4 border-l border-zinc-100">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="text-pink-600 hover:text-pink-700 transition-colors"
                title="Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="https://whatsapp.com"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-600 hover:text-emerald-700 transition-colors"
                title="WhatsApp"
              >
                <MessageCircle className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
