"use client";

import React, { useRef } from "react";
import { Product } from "@/types";
import {
  Zap,
  Clock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface FeaturedProductsProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product, e: React.MouseEvent) => void;
}

export function FeaturedProducts({
  products,
  onSelectProduct,
  onAddToCart,
}: FeaturedProductsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const featured = products.filter((p) => p.featured);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollAmount = clientWidth * 0.8;
      scrollRef.current.scrollTo({
        left: direction === "left" ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <section className="py-12 bg-[#0b0c14] border-b border-[#222436] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FFE500] inline-block animate-pulse" />
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Em Destaque (VIP)
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
              Os anúncios mais recomendados com entrega ultra rápida
            </p>
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => scroll("left")}
              className="p-2 rounded-xl bg-[#13141f] border border-[#222436] text-zinc-300 hover:text-white hover:border-[#FFE500] transition-colors"
              title="Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="p-2 rounded-xl bg-[#13141f] border border-[#222436] text-zinc-300 hover:text-white hover:border-[#FFE500] transition-colors"
              title="Próximo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Carousel / Grid */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-4 pt-1 scrollbar-none snap-x snap-mandatory scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {featured.map((product) => (
            <div
              key={product.id}
              onClick={() => onSelectProduct(product)}
              className="w-[280px] sm:w-[300px] shrink-0 snap-start rounded-2xl bg-[#13141f] border border-[#222436] hover:border-[#FFE500]/50 transition-all duration-200 overflow-hidden cursor-pointer group hover:-translate-y-1 hover:shadow-2xl flex flex-col justify-between"
            >
              {/* Product Thumbnail */}
              <div className="relative h-44 w-full bg-[#0c0d14] overflow-hidden">
                <img loading="lazy" decoding="async"
                  src={product.image}
                  alt={product.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Top badges */}
                <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                  <span className="px-2 py-0.5 rounded-lg bg-black/80 backdrop-blur-md text-[10px] font-black text-[#FFE500] flex items-center gap-1 border border-[#FFE500]/30 shadow-sm">
                    <Sparkles className="w-3 h-3" /> VIP
                  </span>
                  {product.deliveryType === "AUTOMATIC" ? (
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-600/90 text-white text-[10px] font-bold flex items-center gap-1 shadow-sm">
                      <Zap className="w-3 h-3 fill-white" /> Entrega na Hora
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-lg bg-amber-600/90 text-white text-[10px] font-bold flex items-center gap-1 shadow-sm">
                      <Clock className="w-3 h-3" /> Entrega Manual
                    </span>
                  )}
                </div>
              </div>

              {/* Product Info */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mb-1.5">
                    <span className="px-2 py-0.5 rounded bg-[#1a1c29] text-zinc-300 font-semibold">
                      {product.category}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-white line-clamp-2 leading-snug group-hover:text-[#FFE500] transition-colors mb-3">
                    {product.title}
                  </h3>
                </div>

                <div>
                  {/* Price Tag */}
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-xl font-black text-[#FFE500] tracking-tight">
                      R$ {product.price.toFixed(2).replace(".", ",")}
                    </span>
                    {product.originalPrice && (
                      <span className="text-xs text-zinc-500 line-through">
                        R$ {product.originalPrice.toFixed(2).replace(".", ",")}
                      </span>
                    )}
                  </div>

                  {/* Seller Info */}
                  <div className="pt-2.5 border-t border-[#1e2030] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <img loading="lazy" decoding="async"
                        src={product.seller.avatar}
                        alt={product.seller.name}
                        className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700"
                      />
                      <span className="text-zinc-300 font-semibold truncate max-w-[120px]">
                        {product.seller.name}
                      </span>
                      {product.seller.isVerified && (
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      )}
                    </div>
                    <span className="text-[11px] text-zinc-400 font-bold">
                      ({product.seller.salesCount})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
