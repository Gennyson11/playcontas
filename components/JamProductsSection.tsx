"use client";

import React, { useState } from "react";
import { Product } from "@/types";
import { ProductCard } from "@/components/ProductCard";
import { ArrowRight, ChevronDown, Sparkles } from "lucide-react";
import { isProductAvailableForSale } from "@/lib/productStore";

interface JamProductsSectionProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onAddToCart?: (product: Product, e: React.MouseEvent) => void;
  onOpenAllCategories?: () => void;
}

export function JamProductsSection({
  products,
  onSelectProduct,
  onAddToCart,
  onOpenAllCategories,
}: JamProductsSectionProps) {
  const [visibleCount, setVisibleCount] = useState<number>(12);

  const available = products.filter(isProductAvailableForSale);
  const displayedProducts = available.slice(0, visibleCount);

  return (
    <section id="em-destaque" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 select-none">
      {/* SECTION HEADER: High Contrast & Visibility */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 pb-5 border-b border-zinc-200">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2.5 h-6 rounded-full bg-[#0066FF]" />
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-zinc-950 tracking-tight">
              Em Destaque
            </h2>
          </div>
          <p className="text-sm text-zinc-500 font-medium">
            Contas verificadas, jogos originais e serviços digitais com entrega automática imediata.
          </p>
        </div>

        <div>
          {/* "Ver todos os produtos →" Button */}
          <button
            onClick={onOpenAllCategories}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-zinc-300 hover:border-[#0066FF] bg-white text-zinc-800 hover:text-[#0066FF] font-bold text-xs transition-colors shadow-xs"
          >
            <span>Ver catálogo completo</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Grid of Product Cards: 4 columns on desktop for maximum visibility and spacious presence */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-12">
        {displayedProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onSelectProduct={onSelectProduct}
            onAddToCart={onAddToCart}
          />
        ))}
      </div>

      {/* Show More Button if more products exist */}
      {visibleCount < available.length && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => setVisibleCount((prev) => prev + 8)}
            className="flex items-center gap-2 px-8 py-3.5 rounded-xl border-2 border-zinc-200 hover:border-[#0066FF] bg-white text-zinc-900 hover:text-[#0066FF] font-black text-sm tracking-wide transition-all shadow-xs hover:shadow-md"
          >
            <span>Carregar mais produtos ({available.length - visibleCount} restantes)</span>
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}
    </section>
  );
}
