"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  ShieldCheck,
  ArrowRight,
  Trophy,
  Crown,
  BadgeCheck,
} from "lucide-react";
import { GENNYSON_AVATAR_URL } from "@/lib/avatarStore";
import { getStoredProducts, isProductDeleted } from "@/lib/productStore";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

interface TopSellerItem {
  key: string;
  name: string;
  avatar: string;
  verified: boolean;
  isAdmin: boolean;
  revenue: number;
  sales: number;
}

const brl = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const shortMoney = (n: number) => {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(1).replace(".", ",")}k`;
  return brl(n);
};

const resolveAvatar = (name: string, avatar?: string) => {
  if (name.toLowerCase().includes("gennyson")) return GENNYSON_AVATAR_URL;
  if (avatar && !avatar.startsWith("idb:") && avatar.trim().length > 0) return avatar;
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name || "Vendedor")}`;
};

interface JamHeroProps {
  onSelectCategory?: (category: string) => void;
  onOpenAllCategories?: () => void;
  onSearchSubmit?: (query: string) => void;
}

export function JamHero({
  onSelectCategory,
  onOpenAllCategories,
  onSearchSubmit,
}: JamHeroProps) {
  const [heroSearch, setHeroSearch] = useState("");
  const [sellersRanking, setSellersRanking] = useState<TopSellerItem[]>([]);

  // Sincroniza dados 100% reais de vendedores, produtos e pedidos para o card do Hero
  useEffect(() => {
    const computeRealRanking = async () => {
      try {
        const prods = getStoredProducts().filter(
          (p) => p && !isProductDeleted(p) && p.status !== "rejected"
        );

        const map = new Map<string, TopSellerItem>();

        prods.forEach((p) => {
          if (!p.seller) return;
          const name = p.seller.name || "Vendedor";
          const id = p.seller.id || "";
          const key = (id || name).toLowerCase().trim();
          if (!key) return;

          const sales = Math.max(0, Number(p.salesCount) || 0);
          const revenue = (Number(p.price) || 0) * sales;
          const isAdm =
            name.toLowerCase().includes("gennyson") ||
            id === "bb25d258-3152-422b-aa04-7bd34e8a5927" ||
            (p.seller as any)?.role === "admin" ||
            (p.seller as any)?.isAdmin === true;

          const current = map.get(key);
          if (current) {
            current.revenue += revenue;
            current.sales += sales;
            if (p.seller.isVerified) current.verified = true;
            if (isAdm) current.isAdmin = true;
          } else {
            map.set(key, {
              key,
              name,
              avatar: resolveAvatar(name, p.seller.avatar),
              verified: Boolean(p.seller.isVerified),
              isAdmin: isAdm,
              revenue,
              sales,
            });
          }
        });

        // Vendas locais do localStorage (offline / dev)
        if (typeof window !== "undefined") {
          try {
            const raw = localStorage.getItem("central_seller_sales_v2");
            if (raw) {
              const sales = JSON.parse(raw);
              if (Array.isArray(sales)) {
                sales.forEach((s: any) => {
                  const key = (s.sellerId || s.sellerName || "").toLowerCase().trim();
                  if (!key) return;
                  const item = map.get(key);
                  if (item) {
                    item.revenue = Math.max(item.revenue, Number(s.total || s.price || 0));
                    item.sales = Math.max(item.sales, Number(s.quantity || 1));
                  }
                });
              }
            }
          } catch {}
        }

        // Vendas reais gravadas no Supabase (order_chats)
        if (isSupabaseConfigured) {
          try {
            const { data: orders } = await supabase
              .from("order_chats")
              .select("seller_id, seller_name, amount, price, quantity, status");

            if (orders && orders.length > 0) {
              const orderStats: Record<string, { revenue: number; sales: number }> = {};
              orders.forEach((o: any) => {
                if (o.status === "cancelled") return;
                const key = (o.seller_id || o.seller_name || "").toLowerCase().trim();
                if (!key) return;
                if (!orderStats[key]) orderStats[key] = { revenue: 0, sales: 0 };
                orderStats[key].revenue += Number(o.amount || o.price || 0);
                orderStats[key].sales += Number(o.quantity || 1);
              });

              Object.entries(orderStats).forEach(([key, st]) => {
                const item = map.get(key);
                if (item) {
                  item.revenue = Math.max(item.revenue, st.revenue);
                  item.sales = Math.max(item.sales, st.sales);
                }
              });
            }
          } catch {}
        }

        // Se o Gennyson não estiver nos produtos, assegura o perfil dele como administrador oficial
        if (!Array.from(map.values()).some((s) => s.isAdmin || s.name.toLowerCase().includes("gennyson"))) {
          map.set("admin-gennyson", {
            key: "admin-gennyson",
            name: "Gennyson Marinho",
            avatar: GENNYSON_AVATAR_URL,
            verified: true,
            isAdmin: true,
            revenue: 0,
            sales: 0,
          });
        }

        const sorted = Array.from(map.values())
          .sort((a, b) => {
            if (b.revenue !== a.revenue) return b.revenue - a.revenue;
            return b.sales - a.sales;
          })
          .slice(0, 3);

        setSellersRanking(sorted);
      } catch (err) {
        console.warn("Erro ao calcular ranking real do Hero:", err);
      }
    };

    computeRealRanking();
    window.addEventListener("central_products_changed", computeRealRanking);
    return () => {
      window.removeEventListener("central_products_changed", computeRealRanking);
    };
  }, []);

  const popularTags = [
    { label: "Steam", icon: "🎮", category: "Games" },
    { label: "Serviços Digitais", icon: "🌐", category: "Serviços" },
    { label: "Assinaturas Premium", icon: "👑", category: "Assinaturas" },
    { label: "Roblox", icon: "🎲", category: "Games" },
    { label: "Licenças de Software", icon: "🔑", category: "Softwares" },
    { label: "Cursos", icon: "🎓", category: "Cursos" },
    { label: "Xbox", icon: "🟩", category: "Games" },
    { label: "Free Fire (FF)", icon: "🔥", category: "Games" },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearchSubmit && heroSearch.trim()) {
      onSearchSubmit(heroSearch.trim());
    }
    const el = document.getElementById("em-destaque");
    el?.scrollIntoView({ behavior: "smooth" });
  };

  const first = sellersRanking[0];
  const second = sellersRanking[1];
  const third = sellersRanking[2];

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#F5F8FF] via-white to-white text-zinc-900 pt-8 pb-16 lg:py-16 border-b border-zinc-200/80">
      {/* Background Subtle Electric Blue Glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#0066FF]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-1/4 w-[500px] h-[500px] bg-[#00C6FF]/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          {/* ========================================================
              LEFT COLUMN: Headline + Busca Principal (7 cols)
              ======================================================== */}
          <div className="lg:col-span-7 space-y-6">
            {/* Title: Black + Electric Blue */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1]">
              <span className="text-zinc-950 block">Comprar e Vender</span>
              <span className="text-[#0066FF] block">
                Contas, itens e serviços
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-sm sm:text-base text-zinc-600 max-w-xl leading-relaxed">
              A referência brasileira em contas, itens e serviços digitais.
              Negocie com{" "}
              <strong className="text-zinc-900 font-bold">pagamento protegido</strong>{" "}
              e{" "}
              <strong className="text-zinc-900 font-bold">garantia de entrega</strong>.
            </p>

            {/* Live Search Bar */}
            <form onSubmit={handleSearch} className="relative max-w-2xl">
              <div className="relative flex items-center">
                <Search className="absolute left-4 w-5 h-5 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  value={heroSearch}
                  onChange={(e) => setHeroSearch(e.target.value)}
                  placeholder="O que você está procurando hoje? (ex: ChatGPT, Steam, Canva, Claude)"
                  className="w-full pl-12 pr-32 py-3.5 sm:py-4 rounded-2xl bg-white border-2 border-zinc-200 hover:border-[#0066FF]/50 focus:border-[#0066FF] focus:outline-none focus:ring-4 focus:ring-[#0066FF]/10 text-sm sm:text-base text-zinc-900 placeholder:text-zinc-400 shadow-lg shadow-blue-500/5 transition-all"
                />
                <button
                  type="submit"
                  className="absolute right-2 px-5 py-2.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs sm:text-sm transition-all active:scale-95 shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  Buscar
                </button>
              </div>
            </form>

            {/* Popular Filter Tags */}
            <div className="space-y-2 pt-1">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
                Mais buscados agora:
              </span>
              <div className="flex flex-wrap gap-2">
                {popularTags.map((tag) => (
                  <button
                    key={tag.label}
                    type="button"
                    onClick={() => {
                      if (onSelectCategory) onSelectCategory(tag.category);
                      const el = document.getElementById("em-destaque");
                      el?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-[#0066FF]/5 border border-zinc-200 hover:border-[#0066FF]/40 text-xs font-medium text-zinc-700 hover:text-[#0066FF] shadow-2xs transition-all cursor-pointer"
                  >
                    <span>{tag.icon}</span>
                    <span>{tag.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Action CTA Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("em-destaque");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="px-6 py-3 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs sm:text-sm shadow-lg shadow-blue-500/25 transition-all active:scale-95 cursor-pointer"
              >
                Explorar todos produtos
              </button>

              <Link
                href="/como-funciona"
                className="px-6 py-3 rounded-xl bg-black hover:bg-zinc-800 text-white font-bold text-xs sm:text-sm transition-all active:scale-95 shadow-md cursor-pointer inline-flex items-center"
              >
                Saiba como funciona
              </Link>
            </div>
          </div>

          {/* ========================================================
              RIGHT COLUMN: Top Vendedores da Plataforma (100% REAIS)
              ======================================================== */}
          <div className="lg:col-span-5 relative flex justify-center lg:justify-end">
            <div className="relative z-10 w-full max-w-md bg-white rounded-3xl border border-zinc-200 p-5 sm:p-6 shadow-xl shadow-blue-500/5 space-y-3.5">
              {/* Header do Card */}
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500 shadow-2xs">
                    <Trophy className="w-4 h-4 fill-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-zinc-950 leading-tight">Top Vendedores</h3>
                    <p className="text-[11px] text-zinc-400 font-medium">Os maiores destaques da plataforma</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById("top-vendedores");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="text-xs font-bold text-[#0066FF] hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <span>Ver todos</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* 1º Lugar (Real) */}
              {first && (
                <div
                  onClick={() => {
                    const el = document.getElementById("top-vendedores");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="relative flex items-center justify-between p-3 rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50/70 via-amber-50/30 to-white hover:border-amber-300 transition-all cursor-pointer group shadow-2xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={first.avatar}
                        alt={first.name}
                        className="w-11 h-11 rounded-full object-cover ring-2 ring-amber-400 border border-white bg-zinc-100"
                      />
                      <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-400 text-amber-950 font-black text-[10px] flex items-center justify-center shadow-xs">
                        1º
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-bold text-sm text-zinc-950 truncate">
                        <span className="truncate">{first.name}</span>
                        {first.isAdmin ? (
                          <span title="Administrador Oficial" className="inline-flex shrink-0">
                            <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                          </span>
                        ) : (
                          first.verified && <BadgeCheck className="w-3.5 h-3.5 text-[#0066FF] shrink-0" />
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-500 font-medium">
                        {first.sales} {first.sales === 1 ? "venda concluída" : "vendas concluídas"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 pl-2">
                    <div className="text-sm font-black text-zinc-950">{shortMoney(first.revenue)}</div>
                    <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-100/80">
                      Líder
                    </span>
                  </div>
                </div>
              )}

              {/* 2º Lugar (Real se houver) */}
              {second && (
                <div
                  onClick={() => {
                    const el = document.getElementById("top-vendedores");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="relative flex items-center justify-between p-3 rounded-2xl border border-zinc-200/80 bg-zinc-50/50 hover:bg-zinc-50 hover:border-zinc-300 transition-all cursor-pointer group shadow-2xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={second.avatar}
                        alt={second.name}
                        className="w-11 h-11 rounded-full object-cover ring-2 ring-zinc-300 border border-white bg-zinc-100"
                      />
                      <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-zinc-200 text-zinc-700 font-black text-[10px] flex items-center justify-center shadow-xs">
                        2º
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-bold text-sm text-zinc-900 truncate">
                        <span className="truncate">{second.name}</span>
                        {second.isAdmin ? (
                          <span title="Administrador Oficial" className="inline-flex shrink-0">
                            <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                          </span>
                        ) : (
                          second.verified && <BadgeCheck className="w-3.5 h-3.5 text-[#0066FF] shrink-0" />
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-500 font-medium">
                        {second.sales} {second.sales === 1 ? "venda concluída" : "vendas concluídas"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 pl-2">
                    <div className="text-sm font-black text-zinc-950">{shortMoney(second.revenue)}</div>
                    <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-100">
                      Prata
                    </span>
                  </div>
                </div>
              )}

              {/* 3º Lugar (Real se houver) */}
              {third && (
                <div
                  onClick={() => {
                    const el = document.getElementById("top-vendedores");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="relative flex items-center justify-between p-3 rounded-2xl border border-orange-200/70 bg-orange-50/30 hover:bg-orange-50/50 hover:border-orange-300 transition-all cursor-pointer group shadow-2xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={third.avatar}
                        alt={third.name}
                        className="w-11 h-11 rounded-full object-cover ring-2 ring-orange-300 border border-white bg-zinc-100"
                      />
                      <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-orange-200 text-orange-900 font-black text-[10px] flex items-center justify-center shadow-xs">
                        3º
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-bold text-sm text-zinc-900 truncate">
                        <span className="truncate">{third.name}</span>
                        {third.isAdmin ? (
                          <span title="Administrador Oficial" className="inline-flex shrink-0">
                            <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                          </span>
                        ) : (
                          third.verified && <BadgeCheck className="w-3.5 h-3.5 text-[#0066FF] shrink-0" />
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-500 font-medium">
                        {third.sales} {third.sales === 1 ? "venda concluída" : "vendas concluídas"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 pl-2">
                    <div className="text-sm font-black text-zinc-950">{shortMoney(third.revenue)}</div>
                    <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider text-orange-700 bg-orange-100/80">
                      Bronze
                    </span>
                  </div>
                </div>
              )}

              {/* Se ainda não houver 2º ou 3º vendedor, convite para anunciar */}
              {!second && (
                <div className="p-3.5 rounded-2xl border border-dashed border-zinc-200 text-center bg-zinc-50/60">
                  <p className="text-xs font-bold text-zinc-700">Seja o próximo Top Vendedor!</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Anuncie seus produtos e conquiste o pódio do marketplace.
                  </p>
                  <Link
                    href="/anunciar"
                    className="inline-block mt-2 px-3.5 py-1.5 bg-[#0066FF] hover:bg-[#0052cc] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    Começar a Vender
                  </Link>
                </div>
              )}

              {/* Rodapé do Card com Garantia de Segurança */}
              <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-zinc-600">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold">Vendedores Verificados</span>
                </div>
                <span className="font-semibold text-[#0066FF]">100% de Entrega</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
