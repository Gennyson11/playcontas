"use client";

import React, { useState, useEffect, useMemo } from "react";
import { UserProfile } from "@/types";
import { listAllChatsAdmin, formatChatNumber, cleanOrderTitle, OrderChat } from "@/lib/chatStore";
import { getStoredDisputes } from "@/lib/disputeStore";
import {
  MessageSquare,
  Search,
  RefreshCw,
  ShoppingBag,
  Store,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Crown,
  DollarSign,
  Filter,
} from "lucide-react";

interface AdminAllChatsPanelProps {
  currentUser: UserProfile;
  onOpenChat: (orderCode: string) => void;
}

export function AdminAllChatsPanel({
  currentUser,
  onOpenChat,
}: AdminAllChatsPanelProps) {
  const [chats, setChats] = useState<OrderChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "dispute" | "pending" | "delivered">("all");

  const disputes = useMemo(() => getStoredDisputes(), []);

  const loadChats = async () => {
    setLoading(true);
    setError("");
    const res = await listAllChatsAdmin();
    setChats(res.chats || []);
    if (res.error && res.chats.length === 0) {
      setError(res.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadChats();
  }, []);

  const disputedChatIds = useMemo(() => {
    const set = new Set<string>();
    disputes
      .filter((d) => d.status === "open")
      .forEach((d) => {
        set.add(d.chatId);
        if (d.orderCode) set.add(d.orderCode);
      });
    return set;
  }, [disputes]);

  const filteredChats = useMemo(() => {
    const q = search.trim().toLowerCase();
    return chats.filter((c) => {
      const isDisputed =
        disputedChatIds.has(c.id) ||
        disputedChatIds.has(c.code) ||
        disputedChatIds.has(String(c.number));

      const matchSearch =
        !q ||
        c.code.toLowerCase().includes(q) ||
        String(c.number).includes(q) ||
        c.productTitle.toLowerCase().includes(q) ||
        c.buyerName.toLowerCase().includes(q) ||
        c.sellerName.toLowerCase().includes(q) ||
        (c.lastMessage && c.lastMessage.toLowerCase().includes(q));

      const matchFilter =
        filter === "all"
          ? true
          : filter === "dispute"
          ? isDisputed
          : filter === "pending"
          ? c.status === "pending" && !isDisputed
          : c.status === "delivered" && !isDisputed;

      return matchSearch && matchFilter;
    });
  }, [chats, search, filter, disputedChatIds]);

  const brl = (n: number) =>
    (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  const totalVolume = useMemo(
    () => chats.reduce((acc, c) => acc + (c.price || 0) * (c.quantity || 1), 0),
    [chats]
  );

  return (
    <div className="space-y-6 animate-fadeIn pb-12 select-none font-sans">
      {/* Banner de Controle Global de Conversas */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-50 via-white to-indigo-50/50 border border-blue-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#0066FF] text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/25">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-zinc-950 tracking-tight">
                Central de Todas as Conversas & Pedidos
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-[#0066FF]">
                👑 Acesso Irrestrito de Administrador
              </span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-600 mt-0.5 leading-relaxed font-medium">
              Como administrador, você pode monitorar e ingressar em qualquer conversa de compra da plataforma
              para prestar suporte oficial, dirimir dúvidas e atuar como mediador neutro.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadChats}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-zinc-200 hover:border-zinc-300 text-zinc-700 text-xs font-bold shadow-2xs hover:shadow-xs transition-all cursor-pointer self-start md:self-auto shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Estatísticas Rápidas de Atendimento */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
            Total de Pedidos/Chats
          </span>
          <span className="text-xl sm:text-2xl font-black text-zinc-950 mt-1 block">
            {chats.length}
          </span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
            Em Mediação (Saldo Retido)
          </span>
          <span className="text-xl sm:text-2xl font-black text-rose-600 mt-1 block">
            {disputedChatIds.size}
          </span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
            Aguardando Entrega
          </span>
          <span className="text-xl sm:text-2xl font-black text-amber-600 mt-1 block">
            {chats.filter((c) => c.status === "pending").length}
          </span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
            Volume Total dos Chats
          </span>
          <span className="text-xl sm:text-2xl font-black text-emerald-600 mt-1 block">
            {brl(totalVolume)}
          </span>
        </div>
      </div>

      {/* Barra de Busca & Filtros */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar pedido (#code), produto, comprador ou vendedor..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#0066FF] transition-all shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filter === "all"
                ? "bg-white text-zinc-950 shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Todos ({chats.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("dispute")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
              filter === "dispute"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            <span>Em Disputa</span>
            {disputedChatIds.size > 0 && (
              <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center">
                {disputedChatIds.size}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setFilter("pending")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filter === "pending"
                ? "bg-white text-zinc-950 shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Aguardando
          </button>
          <button
            type="button"
            onClick={() => setFilter("delivered")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filter === "delivered"
                ? "bg-white text-zinc-950 shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Entregues
          </button>
        </div>
      </div>

      {/* Lista de Conversas / Pedidos */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-zinc-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#0066FF]" />
            Carregando conversas da plataforma...
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-xs">
            Nenhuma conversa localizada com os filtros aplicados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase font-black tracking-wider text-[11px]">
                  <th className="py-4 px-5">Pedido</th>
                  <th className="py-4 px-5">Produto</th>
                  <th className="py-4 px-5">Comprador</th>
                  <th className="py-4 px-5">Vendedor</th>
                  <th className="py-4 px-5">Valor</th>
                  <th className="py-4 px-5">Status do Pedido</th>
                  <th className="py-4 px-5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium">
                {filteredChats.map((c) => {
                  const isDisputed =
                    disputedChatIds.has(c.id) ||
                    disputedChatIds.has(c.code) ||
                    disputedChatIds.has(String(c.number));

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-blue-50/30 transition-colors group cursor-pointer"
                      onClick={() => onOpenChat(c.code || String(c.number))}
                    >
                      {/* Código do Pedido */}
                      <td className="py-4 px-5">
                        <span className="font-mono font-black text-[#0066FF] bg-blue-50 border border-blue-100 px-2 py-1 rounded-lg">
                          #{c.code || formatChatNumber(c.number)}
                        </span>
                      </td>

                      {/* Produto */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3 max-w-xs">
                          {c.productImage ? (
                            <img
                              src={c.productImage}
                              alt={c.productTitle}
                              className="w-10 h-10 rounded-xl object-cover border border-zinc-200 shrink-0 bg-zinc-100"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-400 shrink-0">
                              <ShoppingBag className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="font-bold text-zinc-950 block truncate">
                              {cleanOrderTitle(c.productTitle)}
                            </span>
                            <span className="text-[11px] text-zinc-400 block truncate">
                              {c.lastMessage ? `"${c.lastMessage}"` : "Sem mensagens ainda"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Comprador */}
                      <td className="py-4 px-5">
                        <div className="font-bold text-zinc-900 truncate">
                          {c.buyerName}
                        </div>
                      </td>

                      {/* Vendedor */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-1.5 font-bold text-zinc-900 truncate">
                          <span>{c.sellerName}</span>
                          {c.sellerName.toLowerCase().includes("gennyson") && (
                            <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />
                          )}
                        </div>
                      </td>

                      {/* Valor */}
                      <td className="py-4 px-5 font-black text-zinc-950">
                        {brl(c.price * (c.quantity || 1))}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-5">
                        {isDisputed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            Em Mediação (Saldo Retido)
                          </span>
                        ) : c.status === "delivered" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Entregue
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            Aguardando Entrega
                          </span>
                        )}
                      </td>

                      {/* Ação */}
                      <td className="py-4 px-5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenChat(c.code || String(c.number));
                          }}
                          className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs shadow-2xs transition-all active:scale-95 cursor-pointer"
                        >
                          <span>Acessar</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
