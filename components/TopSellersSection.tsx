"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Product } from "@/types";
import { GENNYSON_AVATAR_URL } from "@/lib/avatarStore";
import { Trophy, Crown, BadgeCheck, ChevronDown, ChevronUp } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

interface SellerRank {
  key: string;
  name: string;
  avatar: string;
  verified: boolean;
  isAdmin: boolean;
  revenue: number;
  sales: number;
}

const TOP_LIMIT = 10;
const INITIAL_LIST_COUNT = 3;

const brl = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Formata valor real no formato R$ 150,00 ou R$ 1,2k */
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

interface TopSellersSectionProps {
  products: Product[];
}

export function TopSellersSection({ products }: TopSellersSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [realOrderStats, setRealOrderStats] = useState<Record<string, { revenue: number; sales: number }>>({});

  // Sincroniza dados 100% reais de pedidos/vendas do banco de dados e do armazenamento local
  useEffect(() => {
    const loadRealSales = async () => {
      try {
        const stats: Record<string, { revenue: number; sales: number }> = {};

        // 1. Vendas locais
        if (typeof window !== "undefined") {
          try {
            const raw = localStorage.getItem("central_seller_sales_v2");
            if (raw) {
              const sales = JSON.parse(raw);
              if (Array.isArray(sales)) {
                sales.forEach((s: any) => {
                  const key = (s.sellerId || s.sellerName || "").toLowerCase().trim();
                  if (!key) return;
                  if (!stats[key]) stats[key] = { revenue: 0, sales: 0 };
                  stats[key].revenue += Number(s.total || s.price || 0);
                  stats[key].sales += Number(s.quantity || 1);
                });
              }
            }
          } catch {}
        }

        // 2. Vendas reais do Supabase (order_chats)
        if (isSupabaseConfigured) {
          const { data: orders } = await supabase
            .from("order_chats")
            .select("seller_id, seller_name, amount, price, quantity, status");

          if (orders && orders.length > 0) {
            orders.forEach((o: any) => {
              if (o.status === "cancelled") return;
              const key = (o.seller_id || o.seller_name || "").toLowerCase().trim();
              if (!key) return;
              if (!stats[key]) stats[key] = { revenue: 0, sales: 0 };
              const val = Number(o.amount || o.price || 0);
              const qty = Number(o.quantity || 1);
              stats[key].revenue += val;
              stats[key].sales += qty;
            });
          }
        }

        setRealOrderStats(stats);
      } catch (err) {
        console.warn("Aviso ao sincronizar vendas reais:", err);
      }
    };

    loadRealSales();
  }, []);

  // Faturamento e vendas 100% reais calculados exclusivamente a partir dos vendedores e produtos ativos
  const ranking = useMemo<SellerRank[]>(() => {
    const map = new Map<string, SellerRank>();

    products.forEach((p) => {
      if (!p || !p.seller) return;
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

    // Mescla com vendas reais registradas em pedidos / order_chats
    Object.entries(realOrderStats).forEach(([sellerKey, stat]) => {
      const existing = map.get(sellerKey);
      if (existing) {
        existing.revenue = Math.max(existing.revenue, stat.revenue);
        existing.sales = Math.max(existing.sales, stat.sales);
      }
    });

    // Retorna apenas vendedores reais ordenados pelo faturamento real
    return Array.from(map.values())
      .sort((a, b) => {
        if (b.revenue !== a.revenue) return b.revenue - a.revenue;
        return b.sales - a.sales;
      })
      .slice(0, TOP_LIMIT);
  }, [products, realOrderStats]);

  if (ranking.length === 0) return null;

  const [first, second, third] = ranking;
  const rest = ranking.slice(3);
  const visibleRest = expanded ? rest : rest.slice(0, INITIAL_LIST_COUNT);
  const hiddenCount = rest.length - INITIAL_LIST_COUNT;

  const VerifiedBadge = () => (
    <BadgeCheck className="w-4 h-4 text-[#0066FF] shrink-0" aria-label="Vendedor verificado" />
  );

  const AdminBadge = () => (
    <span title="Administrador Oficial do PlayContas" className="inline-flex shrink-0 cursor-default">
      <Crown className="w-4 h-4 text-amber-500 fill-amber-400 drop-shadow-2xs" />
    </span>
  );

  const PodiumCard = ({
    seller,
    place,
  }: {
    seller: SellerRank;
    place: 1 | 2 | 3;
  }) => {
    const styles = {
      1: {
        ring: "ring-4 ring-amber-400 border-amber-300",
        pill: "bg-amber-50 text-amber-700 border-amber-200",
        card: "border-amber-300 bg-gradient-to-b from-amber-50/70 to-white shadow-lg shadow-amber-500/10 md:-translate-y-4",
        avatar: "w-24 h-24",
        name: "text-base",
        value: "text-3xl",
        label: "1º Lugar",
      },
      2: {
        ring: "ring-4 ring-zinc-300 border-zinc-200",
        pill: "bg-zinc-100 text-zinc-600 border-zinc-200",
        card: "border-zinc-200 bg-white shadow-xs",
        avatar: "w-20 h-20",
        name: "text-sm",
        value: "text-2xl",
        label: "2º Lugar",
      },
      3: {
        ring: "ring-4 ring-orange-300 border-orange-200",
        pill: "bg-orange-50 text-orange-700 border-orange-200",
        card: "border-zinc-200 bg-white shadow-xs",
        avatar: "w-20 h-20",
        name: "text-sm",
        value: "text-2xl",
        label: "3º Lugar",
      },
    }[place];

    return (
      <div
        className={`relative rounded-3xl border px-5 pt-7 pb-6 text-center flex flex-col items-center transition-transform ${styles.card}`}
      >
        {place === 1 && (
          <Trophy className="absolute -top-5 left-1/2 -translate-x-1/2 w-8 h-8 text-amber-400 fill-amber-400 drop-shadow" />
        )}
        <img
          src={seller.avatar}
          alt={seller.name}
          className={`${styles.avatar} rounded-full object-cover bg-zinc-100 ${styles.ring}`}
        />
        <span
          className={`mt-4 px-3 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wider ${styles.pill}`}
        >
          {styles.label}
        </span>
        <div className={`mt-2 flex items-center justify-center gap-1.5 font-black text-zinc-950 max-w-full ${styles.name}`}>
          <span className="truncate">{seller.name}</span>
          {seller.isAdmin ? <AdminBadge /> : seller.verified && <VerifiedBadge />}
        </div>
        <div className={`mt-1 font-black text-zinc-950 tracking-tight ${styles.value}`}>
          {shortMoney(seller.revenue)}
        </div>
        <div className="text-[11px] font-semibold text-zinc-500 mt-0.5">
          {seller.sales} {seller.sales === 1 ? "venda" : "vendas"}
        </div>
      </div>
    );
  };

  return (
    <section
      id="top-vendedores"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-14 select-none"
    >
      {/* Cabeçalho */}
      <div className="mb-10 pb-4 border-b border-zinc-200">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-2.5 h-6 rounded-full bg-[#0066FF]" />
          <Trophy className="w-6 h-6 text-amber-500" />
          <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
            {ranking.length > 1 ? `Top ${ranking.length} Vendedores` : "Top Vendedores"}
          </h2>
        </div>
        <p className="text-sm text-zinc-500 font-medium">
          Os maiores nomes do nosso marketplace.
        </p>
      </div>

      {/* Pódio dos Vendedores Reais */}
      <div
        className={`grid grid-cols-1 gap-6 md:gap-5 items-end max-w-4xl mx-auto ${
          ranking.length >= 3
            ? "md:grid-cols-3"
            : ranking.length === 2
            ? "md:grid-cols-2 max-w-2xl"
            : "md:grid-cols-1 max-w-xs"
        }`}
      >
        {/* No mobile o 1º vem primeiro; no desktop o 2º fica à esquerda e o 1º no centro */}
        {second && (
          <div className="order-2 md:order-1">
            <PodiumCard seller={second} place={2} />
          </div>
        )}
        <div className="order-1 md:order-2 pt-4">
          <PodiumCard seller={first} place={1} />
        </div>
        {third && (
          <div className="order-3">
            <PodiumCard seller={third} place={3} />
          </div>
        )}
      </div>

      {/* Lista do 4º vendedor em diante (se existirem mais de 3 vendedores reais) */}
      {rest.length > 0 && (
        <div className="max-w-4xl mx-auto mt-8 space-y-2.5">
          {visibleRest.map((seller, i) => (
            <div
              key={seller.key}
              className="flex items-center gap-4 px-5 py-3 rounded-2xl border border-zinc-200 bg-white shadow-xs hover:border-[#0066FF]/40 transition-colors"
            >
              <span className="w-7 text-sm font-black text-zinc-400">#{i + 4}</span>
              <img
                src={seller.avatar}
                alt={seller.name}
                className="w-9 h-9 rounded-full object-cover bg-zinc-100 border border-zinc-200"
              />
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="text-sm font-bold text-zinc-900 truncate">{seller.name}</span>
                {seller.isAdmin ? <AdminBadge /> : seller.verified && <VerifiedBadge />}
              </div>
              <div className="text-right">
                <div className="text-sm font-black text-zinc-950">{shortMoney(seller.revenue)}</div>
                <div className="text-[10px] font-semibold text-zinc-400">
                  {seller.sales} {seller.sales === 1 ? "venda" : "vendas"}
                </div>
              </div>
            </div>
          ))}

          {hiddenCount > 0 && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1.5 px-5 py-2 rounded-full border border-zinc-300 hover:border-[#0066FF] bg-white text-zinc-700 hover:text-[#0066FF] text-xs font-bold transition-colors shadow-xs cursor-pointer"
              >
                <span>{expanded ? "Ver menos" : `Ver mais (${hiddenCount})`}</span>
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
