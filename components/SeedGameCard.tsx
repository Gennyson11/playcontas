"use client";

import React from "react";
import { Product } from "@/types";
import { Gamepad2, Globe, Flame, Heart, Smile, Frown, Zap } from "lucide-react";

interface SeedGameCardProps {
  product: Product;
  onSelectProduct: (product: Product) => void;
  isFirstCardActive?: boolean;
}

export function SeedGameCard({
  product,
  onSelectProduct,
  isFirstCardActive = false,
}: SeedGameCardProps) {
  // Determine badges to show like the print
  const isHot = product.popular || product.salesCount > 100;
  const isCreatorsLove = product.featured || product.seller.rating >= 4.9;

  // Formatting visits / online numbers
  const onlineCount = (product.salesCount * 3 + 1200).toLocaleString();
  const visitsCount = product.salesCount > 200 ? "11M" : "4.8M";
  const ratingPct = Math.round(product.seller.rating * 20); // 4.9 -> 98%
  const isHighRating = ratingPct >= 60;

  return (
    <div
      onClick={() => onSelectProduct(product)}
      className="rounded-3xl bg-[#161B26] border border-[#222B3A] p-4 flex flex-col justify-between group hover:border-[#10B981]/50 hover:shadow-xl hover:shadow-[#10B981]/5 transition-all cursor-pointer select-none"
    >
      <div>
        {/* 1. Thumbnail Image Container */}
        <div className="relative w-full h-44 rounded-2xl overflow-hidden mb-3.5 bg-[#0F131C] border border-white/5">
          <img loading="lazy" decoding="async"
            src={product.image}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />

          {/* Badges on Top of Image */}
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap pointer-events-none">
            {isHot && (
              <span className="px-2 py-0.5 rounded-full bg-[#EF4444] text-white text-[10px] font-black flex items-center gap-1 shadow-md">
                <Flame className="w-3 h-3 fill-white" />
                <span>Hot</span>
              </span>
            )}
            {isCreatorsLove && (
              <span className="px-2 py-0.5 rounded-full bg-[#10B981] text-white text-[10px] font-black flex items-center gap-1 shadow-md">
                <Heart className="w-3 h-3 fill-white" />
                <span>Creators Love</span>
              </span>
            )}
          </div>

          {/* Delivery & Price Tag at bottom right of thumbnail */}
          <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-md text-white text-[11px] font-bold border border-white/10">
            R$ {product.price.toFixed(2).replace(".", ",")}
          </div>
        </div>

        {/* 2. Game Title */}
        <h3 className="font-bold text-white text-[15px] leading-tight truncate mb-2 group-hover:text-[#10B981] transition-colors">
          {product.title}
        </h3>

        {/* 3. Creator & Votes Row */}
        <div className="flex items-center justify-between text-xs mb-3">
          <div className="flex items-center gap-1.5 text-zinc-400 truncate max-w-[140px]">
            <img loading="lazy" decoding="async"
              src={product.seller.avatar}
              alt={product.seller.name}
              className="w-3.5 h-3.5 rounded-full bg-zinc-800"
            />
            <span className="truncate text-zinc-400 font-medium text-[11px]">
              {product.seller.name}
            </span>
          </div>

          {/* Rating Vote Pill */}
          <div
            className={`flex items-center gap-1 font-bold text-[11px] ${
              isHighRating ? "text-[#10B981]" : "text-[#EF4444]"
            }`}
          >
            {isHighRating ? (
              <Smile className="w-3 h-3 text-[#10B981]" />
            ) : (
              <Frown className="w-3 h-3 text-[#EF4444]" />
            )}
            <span>{ratingPct}%</span>
            <span className="text-zinc-600 font-normal text-[10px]">
              {product.salesCount} Votes
            </span>
          </div>
        </div>

        {/* 4. Stats Row (Online & Visits with Yellow/Gold Icons) */}
        <div className="grid grid-cols-2 gap-2 p-2.5 rounded-2xl bg-[#111620] border border-[#1A2230] mb-4">
          {/* Online count */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center shrink-0">
              <Gamepad2 className="w-4 h-4 text-[#FBBF24]" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500 font-semibold leading-none">
                Online
              </span>
              <span className="text-xs font-bold text-white leading-tight mt-0.5">
                {onlineCount}
              </span>
            </div>
          </div>

          {/* Visits count */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4 text-[#FBBF24]" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500 font-semibold leading-none">
                Visits
              </span>
              <span className="text-xs font-bold text-white leading-tight mt-0.5">
                {visitsCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. View Game Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelectProduct(product);
        }}
        className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] ${
          isFirstCardActive
            ? "bg-[#10B981] hover:bg-[#059669] text-white shadow-emerald-500/20"
            : "bg-[#232B3B] hover:bg-[#10B981] text-zinc-300 hover:text-white"
        }`}
      >
        <span>View Game</span>
      </button>
    </div>
  );
}
