"use client";

import React, { useRef } from "react";
import { Product } from "@/types";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";

interface DiscountGamesSectionProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product, e: React.MouseEvent) => void;
  onViewAll?: () => void;
}

export function DiscountGamesSection({
  products,
  onSelectProduct,
  onAddToCart,
  onViewAll,
}: DiscountGamesSectionProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 360;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <section id="games-discount" className="px-8 py-6">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Mais vendidos & Ofertas
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Os produtos que a galera mais compra, com vendas reais.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onViewAll}
            className="text-xs font-bold text-[#0084FF] hover:text-[#0070DE] transition-colors"
          >
            View all
          </button>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => scroll("left")}
              className="w-8 h-8 rounded-xl bg-[#101722] border border-[#17212F] text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
              title="Anterior"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="w-8 h-8 rounded-xl bg-[#101722] border border-[#17212F] text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
              title="Próximo"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Cards Grid / Carousel */}
      <div
        ref={scrollContainerRef}
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 pt-3 pb-4"
      >
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onSelectProduct={onSelectProduct}
            onAddToCart={onAddToCart}
          />
        ))}
      </div>
    </section>
  );
}
