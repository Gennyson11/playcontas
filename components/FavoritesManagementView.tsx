"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Product, UserProfile } from "@/types";
import {
  ArrowLeft,
  Heart,
  Search,
  Trash2,
  ExternalLink,
  Zap,
  Clock,
  Store,
  ShoppingBag,
  SlidersHorizontal,
  ChevronDown,
  X,
  Sparkles,
  ArrowRight,
  TrendingDown,
} from "lucide-react";
import {
  getFavoriteProducts,
  removeFavorite,
  clearAllFavorites,
  getStoredFavorites,
} from "@/lib/favoriteStore";
import { getProductUrl } from "@/lib/slug";

type SortOption = "recent" | "price-asc" | "price-desc" | "discount";

interface FavoritesManagementViewProps {
  currentUser: UserProfile;
  onBack?: () => void;
  onSelectProduct?: (product: Product) => void;
}

export function FavoritesManagementView({
  currentUser,
  onBack,
  onSelectProduct,
}: FavoritesManagementViewProps) {
  const router = useRouter();

  // Lista de produtos favoritados
  const [favorites, setFavorites] = useState<Product[]>(() =>
    getFavoriteProducts(currentUser?.id)
  );

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  // Confirmação para limpar todos
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  // Carrega e ouve mudanças nos favoritos
  useEffect(() => {
    const syncFavs = () => {
      setFavorites(getFavoriteProducts(currentUser?.id));
    };

    syncFavs();
    window.addEventListener("central_favorites_changed", syncFavs);
    return () => {
      window.removeEventListener("central_favorites_changed", syncFavs);
    };
  }, [currentUser?.id]);

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-fav-dropdown]")) {
        setSortDropdownOpen(false);
        setCategoryDropdownOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleRemove = (e: React.MouseEvent, productId: string) => {
    e.stopPropagation();
    removeFavorite(productId, currentUser?.id);
  };

  const handleClearAll = () => {
    clearAllFavorites(currentUser?.id);
    setConfirmClearOpen(false);
  };

  const handleGoToProduct = (product: Product) => {
    if (onSelectProduct) {
      onSelectProduct(product);
    } else {
      router.push(getProductUrl(product));
    }
  };

  // Categorias disponíveis nos favoritos
  const categories = useMemo(() => {
    const set = new Set<string>();
    favorites.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [favorites]);

  // Lista filtrada e ordenada
  const filteredFavorites = useMemo(() => {
    let list = [...favorites];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.title?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q) ||
          p.seller?.name?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      );
    }

    if (selectedCategory !== "all") {
      list = list.filter((p) => p.category === selectedCategory);
    }

    if (sortBy === "price-asc") {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-desc") {
      list.sort((a, b) => b.price - a.price);
    } else if (sortBy === "discount") {
      list.sort((a, b) => {
        const discA = a.originalPrice ? (a.originalPrice - a.price) / a.originalPrice : 0;
        const discB = b.originalPrice ? (b.originalPrice - b.price) / b.originalPrice : 0;
        return discB - discA;
      });
    }

    return list;
  }, [favorites, searchQuery, selectedCategory, sortBy]);

  // Estatísticas rápidas
  const stats = useMemo(() => {
    const total = favorites.length;
    const instantDelivery = favorites.filter((p) => p.deliveryType === "AUTOMATIC").length;
    const withDiscount = favorites.filter(
      (p) => p.originalPrice && p.originalPrice > p.price
    ).length;
    return { total, instantDelivery, withDiscount };
  }, [favorites]);

  const sortLabels: Record<SortOption, string> = {
    recent: "Mais recentes",
    "price-asc": "Menor preço",
    "price-desc": "Maior preço",
    discount: "Maiores descontos",
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-14 font-sans">
      {/* HEADER PRINCIPAL NO CONCEITO PADRONIZADO */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="w-9 h-9 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-600 hover:text-black flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Voltar para Minha Conta"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h2 className="text-base sm:text-lg font-black text-zinc-950 tracking-tight flex items-center gap-2">
                <span>Favoritos</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100">
                  {favorites.length} {favorites.length === 1 ? "salvo" : "salvos"}
                </span>
              </h2>
              <p className="text-xs text-zinc-500 font-medium mt-0.5">
                Seus anúncios salvos para acompanhar preços, novidades e comprar quando quiser.
              </p>
            </div>
          </div>

          {favorites.length > 0 && (
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setConfirmClearOpen(true)}
                className="px-3.5 py-1.5 rounded-xl border border-zinc-200 hover:border-rose-200 hover:bg-rose-50 text-zinc-600 hover:text-rose-600 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar lista</span>
              </button>
            </div>
          )}
        </div>

        {/* 3 Métricas no topo */}
        {favorites.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-6 pt-6 border-t border-zinc-100">
            <div className="bg-zinc-50/80 border border-zinc-200/80 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                  Itens Salvos
                </span>
                <span className="text-xl sm:text-2xl font-black text-zinc-950">
                  {stats.total}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shadow-2xs">
                <Heart className="w-5 h-5 fill-rose-500" />
              </div>
            </div>

            <div className="bg-zinc-50/80 border border-zinc-200/80 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                  Entrega Imediata
                </span>
                <span className="text-xl sm:text-2xl font-black text-zinc-950">
                  {stats.instantDelivery}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-2xs">
                <Zap className="w-5 h-5 fill-emerald-500" />
              </div>
            </div>

            <div className="bg-zinc-50/80 border border-zinc-200/80 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                  Com Desconto
                </span>
                <span className="text-xl sm:text-2xl font-black text-zinc-950">
                  {stats.withDiscount}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shadow-2xs">
                <TrendingDown className="w-5 h-5" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE CONFIRMAÇÃO PARA LIMPAR FAVORITOS */}
      {confirmClearOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-zinc-200 shadow-2xl animate-scaleIn text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-zinc-950 mb-1.5">
              Limpar todos os favoritos?
            </h3>
            <p className="text-xs text-zinc-500 font-medium mb-6">
              Esta ação removerá todos os anúncios da sua lista de favoritos. Você poderá favoritá-los novamente a qualquer momento.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white transition-colors cursor-pointer shadow-xs"
              >
                Sim, limpar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO PRINCIPAL: FILTROS + GRID DE FAVORITOS */}
      {favorites.length === 0 ? (
        /* ESTADO VAZIO QUANDO NÃO HÁ FAVORITOS */
        <div className="bg-white rounded-3xl border border-zinc-200 p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4 border border-rose-100">
            <Heart className="w-8 h-8 fill-rose-500/20" />
          </div>
          <h3 className="text-base font-black text-zinc-950 mb-1.5">
            Sua lista de favoritos está vazia
          </h3>
          <p className="text-xs text-zinc-500 font-medium max-w-md mx-auto mb-6">
            Você ainda não favoritou nenhum anúncio. Ao navegar pelo catálogo do PlayContas, clique no ícone de coração para salvar itens aqui.
          </p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0066FF] hover:bg-blue-600 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Explorar Produtos</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* BARRA DE FILTROS E BUSCA */}
          <div className="bg-white rounded-2xl p-3 border border-zinc-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
            {/* Input de Busca */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por título, categoria ou vendedor..."
                className="w-full pl-10 pr-4 py-2 bg-zinc-50 hover:bg-zinc-100/70 focus:bg-white rounded-xl text-xs font-medium text-zinc-900 placeholder:text-zinc-400 border border-transparent focus:border-[#0066FF] focus:outline-none transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2" data-fav-dropdown>
              {/* Filtro de Categoria */}
              {categories.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryDropdownOpen(!categoryDropdownOpen);
                      setSortDropdownOpen(false);
                    }}
                    className="h-9 px-3 bg-zinc-50 hover:bg-zinc-100 rounded-xl text-xs font-semibold text-zinc-700 border border-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span className="text-zinc-500">Categoria:</span>
                    <span className="font-bold text-zinc-900 max-w-[120px] truncate">
                      {selectedCategory === "all" ? "Todas" : selectedCategory}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                  </button>

                  {categoryDropdownOpen && (
                    <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-2xl shadow-xl border border-zinc-200 py-1.5 z-30">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategory("all");
                          setCategoryDropdownOpen(false);
                        }}
                        className={`w-full px-3.5 py-1.5 text-left text-xs font-semibold flex items-center justify-between ${
                          selectedCategory === "all"
                            ? "text-[#0066FF] bg-blue-50/60 font-bold"
                            : "text-zinc-700 hover:bg-zinc-50"
                        }`}
                      >
                        <span>Todas as categorias</span>
                        {selectedCategory === "all" && <span className="w-1.5 h-1.5 rounded-full bg-[#0066FF]" />}
                      </button>
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setSelectedCategory(cat);
                            setCategoryDropdownOpen(false);
                          }}
                          className={`w-full px-3.5 py-1.5 text-left text-xs font-semibold flex items-center justify-between ${
                            selectedCategory === cat
                              ? "text-[#0066FF] bg-blue-50/60 font-bold"
                              : "text-zinc-700 hover:bg-zinc-50"
                          }`}
                        >
                          <span className="truncate">{cat}</span>
                          {selectedCategory === cat && <span className="w-1.5 h-1.5 rounded-full bg-[#0066FF]" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Ordenação */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setSortDropdownOpen(!sortDropdownOpen);
                    setCategoryDropdownOpen(false);
                  }}
                  className="h-9 px-3 bg-zinc-50 hover:bg-zinc-100 rounded-xl text-xs font-semibold text-zinc-700 border border-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="font-bold text-zinc-900">{sortLabels[sortBy]}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                </button>

                {sortDropdownOpen && (
                  <div className="absolute right-0 mt-1.5 w-44 bg-white rounded-2xl shadow-xl border border-zinc-200 py-1.5 z-30">
                    {(Object.keys(sortLabels) as SortOption[]).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setSortBy(key);
                          setSortDropdownOpen(false);
                        }}
                        className={`w-full px-3.5 py-1.5 text-left text-xs font-semibold flex items-center justify-between ${
                          sortBy === key
                            ? "text-[#0066FF] bg-blue-50/60 font-bold"
                            : "text-zinc-700 hover:bg-zinc-50"
                        }`}
                      >
                        <span>{sortLabels[key]}</span>
                        {sortBy === key && <span className="w-1.5 h-1.5 rounded-full bg-[#0066FF]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* GRID DE CARDS DOS FAVORITOS */}
          {filteredFavorites.length === 0 ? (
            <div className="bg-white rounded-3xl border border-zinc-200 p-10 text-center shadow-xs">
              <Search className="w-8 h-8 text-zinc-300 mx-auto mb-2.5" />
              <h4 className="text-sm font-bold text-zinc-900 mb-1">
                Nenhum anúncio encontrado
              </h4>
              <p className="text-xs text-zinc-500 mb-4">
                Não encontramos nenhum item favorito correspondente aos filtros atuais.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                  setSortBy("recent");
                }}
                className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-xs font-bold text-zinc-700 transition-colors cursor-pointer"
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {filteredFavorites.map((product) => {
                const origPrice = product.originalPrice || product.price * 1.5;
                const discountPct = Math.round(((origPrice - product.price) / origPrice) * 100);

                return (
                  <div
                    key={product.id}
                    onClick={() => handleGoToProduct(product)}
                    className="group relative bg-white hover:bg-zinc-50/40 rounded-3xl border border-zinc-200 hover:border-zinc-300 shadow-2xs hover:shadow-lg transition-all duration-200 p-4 flex flex-col justify-between cursor-pointer text-left"
                  >
                    <div>
                      {/* THUMBNAIL DO PRODUTO */}
                      <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-zinc-900 mb-3.5 border border-zinc-100">
                        <img
                          loading="lazy"
                          decoding="async"
                          src={product.image || "/categorias/gpt.webp"}
                          alt={product.title}
                          className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                        />

                        {/* Desconto Badge */}
                        {discountPct > 0 && (
                          <div className="absolute top-2.5 left-2.5 z-10 bg-[#E11D48] text-white text-[11px] font-black px-2 py-0.5 rounded-md shadow-xs">
                            -{discountPct}%
                          </div>
                        )}

                        {/* Botão de Remover dos Favoritos */}
                        <button
                          type="button"
                          onClick={(e) => handleRemove(e, product.id)}
                          className="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full bg-white/95 hover:bg-white text-rose-600 hover:text-rose-700 flex items-center justify-center shadow-md transition-transform hover:scale-110 cursor-pointer"
                          title="Remover dos favoritos"
                        >
                          <Heart className="w-4 h-4 fill-rose-600 text-rose-600" />
                        </button>
                      </div>

                      {/* CATEGORIA */}
                      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1 line-clamp-1">
                        {product.category || "PRODUTO DIGITAL"}
                      </div>

                      {/* TÍTULO */}
                      <h3 className="font-extrabold text-zinc-950 text-sm sm:text-base leading-snug line-clamp-2 min-h-[40px] mb-2 group-hover:text-[#0066FF] transition-colors">
                        {product.title}
                      </h3>

                      {/* TIPO DE ENTREGA */}
                      {product.deliveryType === "AUTOMATIC" ? (
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium mb-3">
                          <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0 fill-amber-500" />
                          <span>Entrega automática imediata</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium mb-3">
                          <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span>Entrega combinada</span>
                        </div>
                      )}
                    </div>

                    {/* RODAPÉ DO CARD: PREÇO + BOTÃO */}
                    <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-3 mt-2">
                      <div>
                        {product.originalPrice && product.originalPrice > product.price ? (
                          <div className="text-[11px] text-zinc-400 line-through font-semibold">
                            R$ {product.originalPrice.toFixed(2).replace(".", ",")}
                          </div>
                        ) : null}
                        <div className="text-base sm:text-lg font-black text-zinc-950 leading-tight">
                          R$ {product.price.toFixed(2).replace(".", ",")}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGoToProduct(product);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-[#0066FF] hover:bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                      >
                        <span>Ver anúncio</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
