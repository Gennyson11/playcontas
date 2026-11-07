"use client";

import React, { useMemo } from "react";
import { Product } from "@/types";
import { ProductCard } from "@/components/ProductCard";
import { ArrowRight } from "lucide-react";
import { isProductAvailableForSale } from "@/lib/productStore";

/**
 * Seções de categorias exibidas no início do site.
 * Cada seção só aparece quando existe pelo menos um anúncio da categoria.
 * Ordem: Assinaturas Premium, Steam, Serviços Digitais, Roblox.
 */
const HOME_SECTIONS: { name: string; subtitle: string }[] = [
  {
    name: "Assinaturas Premium",
    subtitle: "Streaming, IAs e ferramentas premium com o melhor preço.",
  },
  {
    name: "Steam",
    subtitle: "Contas, jogos e itens Steam com segurança.",
  },
  {
    name: "Serviços Digitais",
    subtitle: "Pacotes, automações e serviços prontos para usar.",
  },
  {
    name: "Roblox",
    subtitle: "Robux, contas e itens de Roblox.",
  },
];

const ITEMS_PER_SECTION = 4;

const normalize = (s: string) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

interface HomeCategorySectionsProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onAddToCart?: (product: Product, e: React.MouseEvent) => void;
  onViewCategory: (categoryName: string) => void;
  /** Conteúdo exibido logo abaixo da seção "Serviços Digitais" (ex.: Top Vendedores) */
  afterServicosDigitais?: React.ReactNode;
}

export function HomeCategorySections({
  products,
  onSelectProduct,
  onAddToCart,
  onViewCategory,
  afterServicosDigitais,
}: HomeCategorySectionsProps) {
  const sections = useMemo(
    () =>
      HOME_SECTIONS.map((section) => {
        const key = normalize(section.name);
        const items = products
          .filter(isProductAvailableForSale)
          .filter((p) => normalize(p.category).includes(key));
        return { ...section, items };
      }),
    [products]
  );

  return (
    <>
      {sections.map((section) => (
        <React.Fragment key={section.name}>
          {section.items.length > 0 && (
            <section
              id={`categoria-${normalize(section.name).replace(/\s+/g, "-")}`}
              className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 select-none"
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 pb-4 border-b border-zinc-200">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-2.5 h-6 rounded-full bg-[#0066FF]" />
                    <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
                      {section.name}
                    </h2>
                  </div>
                  <p className="text-sm text-zinc-500 font-medium">{section.subtitle}</p>
                </div>

                <button
                  type="button"
                  onClick={() => onViewCategory(section.name)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-zinc-300 hover:border-[#0066FF] bg-white text-zinc-800 hover:text-[#0066FF] font-bold text-xs transition-colors shadow-xs cursor-pointer self-start md:self-auto"
                >
                  <span>
                    Ver todos
                    {section.items.length > ITEMS_PER_SECTION ? ` (${section.items.length})` : ""}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {section.items.slice(0, ITEMS_PER_SECTION).map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onSelectProduct={onSelectProduct}
                    onAddToCart={onAddToCart}
                  />
                ))}
              </div>
            </section>
          )}

          {section.name === "Serviços Digitais" && afterServicosDigitais}
        </React.Fragment>
      ))}
    </>
  );
}
