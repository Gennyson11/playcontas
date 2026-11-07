"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Product } from "@/types";
import { getProductUrl } from "@/lib/slug";
import { Zap, Clock, Heart, ArrowRight, Store, TrendingUp } from "lucide-react";
import { isProductFavorite, toggleFavorite } from "@/lib/favoriteStore";

interface ProductCardProps {
  product: Product;
  onSelectProduct: (product: Product) => void;
  onAddToCart?: (product: Product, e: React.MouseEvent) => void;
}

export function ProductCard({
  product,
  onSelectProduct,
  onAddToCart,
}: ProductCardProps) {
  const router = useRouter();
  const [isFavorite, setIsFavorite] = useState(() => isProductFavorite(product.id));

  useEffect(() => {
    setIsFavorite(isProductFavorite(product.id));
    const handleFavChange = () => {
      setIsFavorite(isProductFavorite(product.id));
    };
    window.addEventListener("central_favorites_changed", handleFavChange);
    return () => {
      window.removeEventListener("central_favorites_changed", handleFavChange);
    };
  }, [product.id]);

  const handleGoToProduct = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (onSelectProduct) {
      onSelectProduct(product);
    } else {
      router.push(getProductUrl(product));
    }
  };

  const hasVariants =
    (Boolean(product.hasVariations) ||
      product.listingType === "MULTIPLA" ||
      (Array.isArray(product.variants) && product.variants.length > 0)) &&
    Boolean(product.variants && product.variants.length > 0);

  const hasVariantStock = hasVariants
    ? product.variants!.some((v) => Number(v.stock ?? 0) > 0)
    : true;

  const isRejected = product.status === "rejected";
  const isPending = product.status === "pending_review" || product.status === "pending_approval";
  const isOutOfStockOrPaused =
    product.status === "paused" ||
    isRejected ||
    isPending ||
    (hasVariants && !hasVariantStock) ||
    (product.stock !== undefined && product.stock <= 0);

  const origPrice = product.originalPrice || product.price * 1.6;
  const discountPct = Math.round(((origPrice - product.price) / origPrice) * 100);
  const savingsAmount = origPrice - product.price;

  return (
    <div
      onClick={handleGoToProduct}
      className="group relative bg-white hover:bg-zinc-50/40 rounded-2xl border border-zinc-200 hover:border-zinc-300 shadow-2xs hover:shadow-lg transition-all duration-200 p-3.5 flex flex-col justify-between cursor-pointer text-left"
    >
      <div>
        {/* 1. THUMBNAIL IMAGE CONTAINER */}
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-zinc-900 mb-3 border border-zinc-100">
          <img loading="lazy" decoding="async"
            src={product.image}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
          />

          {/* Badge Top-Left: Reprovado, Em Análise, Pausado ou Desconto */}
          {isRejected ? (
            <div className="absolute top-2 left-2 z-10 bg-rose-600 text-white text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-md shadow-xs">
              REPROVADO
            </div>
          ) : isPending ? (
            <div className="absolute top-2 left-2 z-10 bg-amber-600 text-white text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-md shadow-xs">
              EM ANÁLISE
            </div>
          ) : isOutOfStockOrPaused ? (
            <div className="absolute top-2 left-2 z-10 bg-amber-600 text-white text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-md shadow-xs">
              PAUSADO
            </div>
          ) : discountPct > 0 ? (
            <div className="absolute top-2 left-2 z-10 bg-[#E11D48] text-white text-xs font-black px-2 py-0.5 rounded-md shadow-xs">
              -{discountPct}%
            </div>
          ) : null}

          {/* Favorite Heart Button Top-Right */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const next = toggleFavorite(product);
              setIsFavorite(next);
            }}
            className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-white/95 hover:bg-white text-zinc-500 hover:text-rose-600 flex items-center justify-center shadow-xs transition-colors cursor-pointer"
            title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          >
            <Heart
              className={`w-3.5 h-3.5 transition-colors ${
                isFavorite ? "fill-[#E11D48] text-[#E11D48]" : "text-zinc-600"
              }`}
            />
          </button>
        </div>

        {/* 2. CATEGORY (Plain text, uppercase, muted, exact match to reference image) */}
        <div className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 line-clamp-1">
          {product.category}
        </div>

        {/* 3. TITLE (Bold black, uppercase/title) */}
        <h3 className="font-extrabold text-zinc-900 text-sm sm:text-base leading-snug line-clamp-2 min-h-[40px] mb-1.5 group-hover:text-[#0066FF] transition-colors">
          {product.title}
        </h3>

        {/* 4. DELIVERY METHOD (Grey icon + grey text, matching reference) */}
        {product.deliveryType === "AUTOMATIC" ? (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium mb-2.5">
            <Zap className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span>Entrega automática</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium mb-2.5">
            <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span>Entrega manual</span>
          </div>
        )}

        {/* 5. PRICE ROW (Large bold black price + line-through original price) */}
        <div className="flex items-baseline gap-2 mb-1.5">
          <span className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
            R$ {product.price.toFixed(2).replace(".", ",")}
          </span>
          {origPrice > product.price && (
            <span className="text-xs sm:text-sm text-zinc-400 line-through font-normal">
              R$ {origPrice.toFixed(2).replace(".", ",")}
            </span>
          )}
        </div>

        {/* 6. SAVINGS PILL (Pale mint green background + bold green text) */}
        {savingsAmount > 0 && (
          <div className="bg-[#EAF8E8] text-[#16A34A] text-xs font-bold px-2.5 py-1 rounded-md inline-block mb-2.5">
            Você economiza R$ {savingsAmount.toFixed(2).replace(".", ",")} ({discountPct}%)
          </div>
        )}

        {/* 6.1 VENDIDOS (aparece só se o anúncio tiver vendas) */}
        {(product.salesCount || 0) > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 mb-2.5">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{product.salesCount} vendidos</span>
          </div>
        )}

        {/* 7. THIN DIVIDER LINE (Exact match to reference image) */}
        <hr className="border-t border-zinc-200/80 my-2.5" />

        {/* 8. SELLER ROW (Store icon + seller name only, no rating stars) */}
        <div className="flex items-center gap-1.5 text-xs text-zinc-600 mb-3 min-w-0">
          <Store className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="font-medium text-zinc-700 truncate">
            {product.seller?.name || "PlayContas"}
          </span>
        </div>
      </div>

      {/* 9. PROMINENT BLUE BUY BUTTON ("Comprar agora →") */}
      {isOutOfStockOrPaused ? (
        <button
          type="button"
          disabled
          className="w-full py-2.5 px-4 rounded-xl bg-zinc-100 text-zinc-400 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-not-allowed opacity-90 border border-zinc-200"
        >
          <span>
            {isRejected
              ? "Indisponível (Reprovado)"
              : isPending
              ? "Em Análise"
              : product.status === "paused"
              ? "Desativado"
              : "Pausado (Sem estoque)"}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleGoToProduct}
          className="w-full py-2.5 px-4 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer shadow-sm shadow-blue-500/15"
        >
          <span>Comprar agora</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
