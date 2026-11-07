"use client";

import React from "react";
import { Product } from "@/types";
import { ShoppingBag, ArrowRight, Zap, Clock, Check } from "lucide-react";

interface JamProductCardProps {
  product: Product;
  onSelectProduct: (product: Product) => void;
  onAddToCart?: (product: Product, e: React.MouseEvent) => void;
  isHoveredFeatured?: boolean;
}

export function JamProductCard({
  product,
  onSelectProduct,
  onAddToCart,
  isHoveredFeatured = false,
}: JamProductCardProps) {
  return (
    <div
      onClick={() => onSelectProduct(product)}
      className="bg-white rounded-3xl border border-zinc-200/90 shadow-xs hover:shadow-xl transition-all duration-300 p-4 flex flex-col justify-between group cursor-pointer relative"
    >
      <div>
        {/* Game Cover Artwork */}
        <div className="relative w-full h-44 rounded-2xl overflow-hidden mb-3 bg-zinc-100 border border-zinc-100">
          <img loading="lazy" decoding="async"
            src={product.image}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />

          {/* Delivery auto/manual tag */}
          {product.deliveryType === "AUTOMATIC" ? (
            <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[#0066FF] text-[10px] font-black flex items-center gap-1 border border-blue-500/20">
              <Zap className="w-2.5 h-2.5 fill-[#0066FF]" />
              <span>Auto 24h</span>
            </div>
          ) : (
            <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-amber-400 text-[10px] font-black flex items-center gap-1 border border-amber-500/20">
              <Clock className="w-2.5 h-2.5" />
              <span>Manual</span>
            </div>
          )}
        </div>

        {/* Category / Platform Tag */}
        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
          {product.category}
        </span>

        {/* Title */}
        <h3 className="font-bold text-zinc-900 text-sm leading-snug line-clamp-2 min-h-[38px] group-hover:text-black transition-colors mb-2">
          {product.title}
        </h3>

        {/* Price Row */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-base sm:text-lg font-black text-rose-500 tracking-tight">
            ${product.price.toFixed(2)}
          </span>
          {product.originalPrice && product.originalPrice > product.price && (
            <span className="text-xs text-zinc-400 line-through font-medium">
              ${product.originalPrice.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {/* Button at bottom matching the 2nd card in the print! */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (onAddToCart) onAddToCart(product, e);
          else onSelectProduct(product);
        }}
        className={`w-full py-2.5 px-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 ${
          isHoveredFeatured
            ? "bg-[#FF6B4A] hover:bg-[#E04B28] text-white shadow-md shadow-orange-500/20"
            : "bg-[#FFE500] hover:bg-[#ebd400] text-black shadow-xs group-hover:bg-black group-hover:text-[#FFE500]"
        }`}
      >
        <ShoppingBag className="w-3.5 h-3.5" />
        <span>Add to Cart</span>
      </button>
    </div>
  );
}
