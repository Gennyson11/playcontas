"use client";

import React, { useState, useEffect } from "react";
import { Product } from "@/types";
import {
  Zap,
  Clock,
  Flame,
  ArrowRight,
  TrendingUp,
  Heart,
  Store,
  ArrowUpDown,
  Search,
} from "lucide-react";
import { isProductFavorite, toggleFavorite } from "@/lib/favoriteStore";

interface PopularProductsProps {
  products: Product[];
  selectedCategory: string;
  searchQuery: string;
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product, e: React.MouseEvent) => void;
}

export function PopularProducts({
  products,
  selectedCategory,
  searchQuery,
  onSelectProduct,
  onAddToCart,
}: PopularProductsProps) {
  const [filterAutomaticOnly, setFilterAutomaticOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"popular" | "price-asc" | "price-desc" | "sales">("popular");
  const [, setFavVersion] = useState(0);

  useEffect(() => {
    const handleFavChange = () => setFavVersion((v) => v + 1);
    window.addEventListener("central_favorites_changed", handleFavChange);
    return () => window.removeEventListener("central_favorites_changed", handleFavChange);
  }, []);

  const handleToggleFavorite = (product: Product) => {
    toggleFavorite(product);
  };

  // Filter products
  const filtered = products.filter((p) => {
    if (selectedCategory !== "TODOS" && p.category.toLowerCase() !== selectedCategory.toLowerCase()) {
      return false;
    }
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const matchTitle = p.title.toLowerCase().includes(q);
      const matchDesc = p.description.toLowerCase().includes(q);
      const matchCat = p.category.toLowerCase().includes(q);
      const matchSeller = p.seller.name.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchCat && !matchSeller) {
        return false;
      }
    }
    if (filterAutomaticOnly && p.deliveryType !== "AUTOMATIC") {
      return false;
    }
    return true;
  });

  // Sort products
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "price-asc") return a.price - b.price;
    if (sortBy === "price-desc") return b.price - a.price;
    if (sortBy === "sales") return b.salesCount - a.salesCount;
    return b.salesCount - a.salesCount;
  });

  return (
    <section id="produtos" className="py-12 bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Title & Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-[#E11D48]">
                <Flame className="w-5 h-5 fill-[#E11D48]" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">
                {selectedCategory === "TODOS" ? "Mais vendidos" : selectedCategory}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-zinc-500 mt-1">
              {searchQuery
                ? `Exibindo resultados para "${searchQuery}" (${sorted.length} encontrados)`
                : "Os produtos que a galera mais compra, com vendas reais."}
            </p>
          </div>

          {/* Filters & Sorting */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Toggle Automatic Delivery Only */}
            <button
              onClick={() => setFilterAutomaticOnly(!filterAutomaticOnly)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                filterAutomaticOnly
                  ? "bg-[#0066FF] text-white shadow-sm"
                  : "bg-white text-zinc-700 border border-zinc-200 hover:border-zinc-300"
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${filterAutomaticOnly ? "fill-white" : "text-amber-500"}`} />
              <span>Entrega Automática</span>
            </button>

            {/* Sorting Select */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none bg-white border border-zinc-200 text-zinc-700 hover:text-zinc-900 hover:border-zinc-300 rounded-xl px-3.5 py-2 pr-8 text-xs font-bold focus:outline-none focus:border-[#0066FF] cursor-pointer shadow-sm"
              >
                <option value="popular">Mais Relevantes</option>
                <option value="sales">Mais Vendidos</option>
                <option value="price-asc">Menor Preço</option>
                <option value="price-desc">Maior Preço</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Empty State */}
        {sorted.length === 0 && (
          <div className="py-16 text-center rounded-2xl bg-white border border-zinc-200 p-8 max-w-md mx-auto shadow-sm">
            <Search className="w-12 h-12 text-zinc-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-zinc-800 mb-1">Nenhum anúncio encontrado</h3>
            <p className="text-xs text-zinc-500 mb-4">
              Tente buscar por outro termo ou selecione uma categoria diferente.
            </p>
          </div>
        )}

        {/* Product Cards Grid - Exactly matching reference image */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 sm:gap-6 pt-3">
          {sorted.map((product) => {
            const origPrice = product.originalPrice || product.price * 1.5;
            const discountPct = Math.round(((origPrice - product.price) / origPrice) * 100);
            const savingsAmount = origPrice - product.price;
            const isFav = isProductFavorite(product.id);

            return (
              <div
                key={product.id}
                onClick={() => onSelectProduct(product)}
                className="relative bg-white rounded-2xl border border-zinc-200/90 shadow-sm hover:shadow-md transition-all duration-200 p-3.5 flex flex-col justify-between group cursor-pointer"
              >
                {/* Top Floating Red Badge */}
                <div className="absolute -top-3 left-4 z-20 pointer-events-none">
                  <span className="bg-[#E11D48] text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-sm uppercase tracking-wider">
                    {product.salesCount} VENDIDOS
                  </span>
                </div>

                <div>
                  {/* Thumbnail Image Container */}
                  <div className="relative w-full h-44 rounded-xl overflow-hidden bg-zinc-100 mb-3">
                    <img loading="lazy" decoding="async"
                      src={product.image}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Discount Tag Top-Left */}
                    {discountPct > 0 && (
                      <div className="absolute top-2 left-2 z-10 bg-[#E11D48] text-white text-xs font-black px-2 py-0.5 rounded-md shadow-sm">
                        -{discountPct}%
                      </div>
                    )}

                    {/* Favorite Heart Button Top-Right */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFavorite(product);
                      }}
                      className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-white/90 hover:bg-white text-zinc-400 hover:text-red-500 flex items-center justify-center shadow transition-colors cursor-pointer"
                      title={isFav ? "Remover dos favoritos" : "Favoritar"}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${
                          isFav ? "fill-[#E11D48] text-[#E11D48]" : "text-zinc-400"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Uppercase Category */}
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                    {product.category}
                  </div>

                  {/* Title */}
                  <h3 className="font-bold text-zinc-900 text-sm leading-snug line-clamp-2 min-h-[38px] group-hover:text-[#0066FF] transition-colors mb-2">
                    {product.title}
                  </h3>

                  {/* Delivery Status */}
                  {product.deliveryType === "AUTOMATIC" ? (
                    <div className="flex items-center gap-1.5 text-xs text-sky-600 font-medium mb-3">
                      <Zap className="w-3.5 h-3.5 text-sky-500 fill-sky-500" />
                      <span>Entrega automática</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-sky-600 font-medium mb-3">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" fill="#0284c7" />
                        <polyline points="12 6.5 12 12 15.5 14" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Entrega manual</span>
                    </div>
                  )}

                  {/* Price Row */}
                  <div className="flex items-baseline gap-2 mb-1.5">
                    <span className="text-xl font-black text-zinc-900 tracking-tight">
                      R$ {product.price.toFixed(2).replace(".", ",")}
                    </span>
                    {origPrice > product.price && (
                      <span className="text-xs text-zinc-400 line-through font-semibold">
                        R$ {origPrice.toFixed(2).replace(".", ",")}
                      </span>
                    )}
                  </div>

                  {/* Savings Pill */}
                  {savingsAmount > 0 && (
                    <div className="bg-[#ECFDF5] text-[#059669] text-[11px] font-bold px-2 py-0.5 rounded-md inline-block mb-2 w-fit">
                      Você economiza R$ {savingsAmount.toFixed(2).replace(".", ",")} ({discountPct}%)
                    </div>
                  )}

                  {/* Trending Sales Row (só se houver vendas) */}
                  {(product.salesCount || 0) > 0 && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 mb-3">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>{product.salesCount} vendidos</span>
                    </div>
                  )}

                  {/* Seller Store Row */}
                  <div className="pt-2 border-t border-zinc-100 flex items-center gap-1.5 text-xs text-zinc-500 mb-3">
                    <Store className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="truncate">{product.seller.name}</span>
                  </div>
                </div>

                {/* Buy Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectProduct(product);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-sm flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-[0.98]"
                >
                  <span>Comprar agora</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
