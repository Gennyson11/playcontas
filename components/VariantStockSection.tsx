"use client";

import React from "react";
import { Plus, Trash2, Package, ChevronDown } from "lucide-react";

export interface VariantStockItem {
  id: string;
  name: string;
  price: string;
  stock: string;
  credentials?: string;
  separator?: string;
}

interface VariantStockSectionProps {
  variants: VariantStockItem[];
  defaultSeparator: string;
  onUpdateVariant: (id: string, field: keyof VariantStockItem, value: string) => void;
  onUpdateFullVariant: (id: string, updates: Partial<VariantStockItem>) => void;
  onAddVariant: () => void;
  onRemoveVariant: (id: string) => void;
  onSeparatorChange?: (sep: string) => void;
  isSingleItem?: boolean;
  /** Título do anúncio: no anúncio único o nome do item é travado com este valor */
  lockedName?: string;
}

export function VariantStockSection({
  variants,
  defaultSeparator,
  onUpdateVariant,
  onUpdateFullVariant,
  onAddVariant,
  onRemoveVariant,
  onSeparatorChange,
  isSingleItem = false,
  lockedName,
}: VariantStockSectionProps) {
  const isNameLocked = isSingleItem && lockedName !== undefined;
  const resolveName = (v: VariantStockItem, idx: number) =>
    isNameLocked ? lockedName!.trim() || "SEU ANÚNCIO" : v.name.trim() || `ITEM #${idx + 1}`;

  // Helper para contar as contas/credenciais baseado no separador
  const countCredentials = (text?: string, sep = "--"): number => {
    if (!text || !text.trim()) return 0;
    const trimmed = text.trim();
    if (sep === "\\n\\n") {
      return trimmed.split(/\n\s*\n+/).filter((b) => b.trim().length > 0).length;
    }
    if (trimmed.includes(sep)) {
      return trimmed.split(sep).filter((b) => b.trim().length > 0).length;
    }
    return trimmed.split("\n").filter((b) => b.trim().length > 0).length;
  };

  const getSep = (v: VariantStockItem) => v.separator || defaultSeparator || "--";

  const getVariantStockCount = (v: VariantStockItem): number => {
    if (v.credentials !== undefined) {
      return countCredentials(v.credentials, getSep(v));
    }
    return 0;
  };

  // Atualiza as credenciais direto no item e recalcula o estoque na hora
  const handleCredentialsChange = (v: VariantStockItem, value: string, sep = getSep(v)) => {
    const count = countCredentials(value, sep);
    onUpdateFullVariant(v.id, {
      credentials: value,
      separator: sep,
      stock: String(count),
    });
  };

  const handleInsertSeparator = (v: VariantStockItem) => {
    const sep = getSep(v);
    const sepText = sep === "\\n\\n" ? "\n\n" : `\n${sep}\n`;
    const current = v.credentials || "";
    const textarea = document.getElementById(`creds-${v.id}`) as HTMLTextAreaElement | null;

    if (!textarea) {
      handleCredentialsChange(v, current + sepText);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = current.substring(0, start) + sepText + current.substring(end);
    handleCredentialsChange(v, next);

    requestAnimationFrame(() => {
      const el = document.getElementById(`creds-${v.id}`) as HTMLTextAreaElement | null;
      if (el) {
        el.focus({ preventScroll: true });
        const pos = start + sepText.length;
        el.setSelectionRange(pos, pos);
      }
    });
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Cabeçalho informativo no padrão clean do site */}
      <div className="rounded-2xl bg-blue-50/70 border border-blue-200/80 p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0066FF] text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20">
              <Package className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-black text-zinc-950 uppercase tracking-tight flex items-center gap-1.5">
                <span>{isSingleItem ? "Preço e Estoque da Entrega" : "Estoque por Item / Variação"}</span>
                <span className="text-[10px] font-bold text-[#0066FF] bg-white px-2 py-0.5 rounded border border-blue-200">
                  Entrega Automática
                </span>
              </h4>
              <p className="text-xs text-zinc-600 mt-0.5 leading-relaxed">
                {isSingleItem
                  ? "Defina o preço e insira as credenciais que o comprador receberá automaticamente após a aprovação."
                  : "Cada item anunciado possui seu estoque e contas separadas. Ao vender, o sistema entrega automaticamente a conta daquele plano específico."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Caixas — o estoque é inserido direto em cada card, sem popup */}
      <div className="space-y-3.5">
        {variants.map((v, idx) => {
          const count = getVariantStockCount(v);
          const hasStock = count > 0;
          const sep = getSep(v);

          return (
            <div
              key={v.id}
              className="rounded-2xl bg-white border border-zinc-200/90 hover:border-[#0066FF]/50 p-4 sm:p-5 shadow-xs transition-all"
            >
              {/* Top Row: Número, Título e Badge de Estoque */}
              <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-50 text-[#0066FF] border border-blue-200/90 font-black text-sm sm:text-base flex items-center justify-center shrink-0 shadow-2xs">
                    {idx + 1}
                  </div>

                  <div className="min-w-0">
                    <h3 className="font-black text-zinc-950 text-sm sm:text-base uppercase tracking-tight truncate">
                      {resolveName(v, idx)}
                    </h3>
                    <span className="text-zinc-900 font-extrabold text-xs sm:text-sm">R$ {v.price}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {hasStock ? (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3.5 py-1 rounded-full text-xs font-bold shadow-2xs whitespace-nowrap">
                      {count} {count === 1 ? "Disponível" : "Disponíveis"}
                    </span>
                  ) : (
                    <span className="bg-rose-50 text-rose-600 border border-rose-200 px-3.5 py-1 rounded-full text-xs font-bold shadow-2xs whitespace-nowrap">
                      0 Disponíveis
                    </span>
                  )}

                  {variants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onRemoveVariant(v.id)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Remover este item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Campos diretos no card */}
              <div className="mt-4 pt-4 border-t border-zinc-100 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      Nome do Item / Opção *
                    </label>
                    <input
                      type="text"
                      value={isNameLocked ? lockedName!.trim() : v.name}
                      onChange={(e) => onUpdateVariant(v.id, "name", e.target.value)}
                      readOnly={isNameLocked}
                      disabled={isNameLocked}
                      placeholder="Ex: Netflix 7 Dias"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white text-xs font-bold text-zinc-900 focus:outline-none focus:border-[#0066FF] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      Preço (R$) *
                    </label>
                    <div className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 focus-within:bg-white focus-within:border-[#0066FF] transition-all">
                      <span className="text-xs font-bold text-zinc-400">R$</span>
                      <input
                        type="text"
                        value={v.price}
                        onChange={(e) => onUpdateVariant(v.id, "price", e.target.value)}
                        placeholder="7,90"
                        className="w-full bg-transparent text-xs font-black text-zinc-950 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Separador de Credenciais */}
                <div className="space-y-1.5 bg-zinc-50/80 p-3.5 rounded-xl border border-zinc-200">
                  <label className="block text-[11px] font-bold text-zinc-800 uppercase tracking-wider">
                    Separador de Credenciais
                  </label>
                  <p className="text-[11px] text-zinc-500">
                    Cada bloco separado representa 1 conta vendável entregue ao comprador.
                  </p>
                  <div className="relative pt-0.5">
                    <select
                      value={sep}
                      onChange={(e) => {
                        onSeparatorChange?.(e.target.value);
                        handleCredentialsChange(v, v.credentials || "", e.target.value);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-white text-xs font-bold text-zinc-900 focus:outline-none focus:border-[#0066FF] appearance-none cursor-pointer pr-8"
                    >
                      <option value="--">Horizontal ( -- )</option>
                      <option value="\n\n">Quebra de linha ( Enter duplo )</option>
                      <option value="|">Barra vertical ( | )</option>
                      <option value="---">Hífen triplo ( --- )</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Estoque: contas / credenciais */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-zinc-800 uppercase tracking-wider">
                      Estoque — Contas / Chaves deste Item
                    </label>
                    <span className="text-[11px] font-bold text-[#0066FF] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {count} {count === 1 ? "conta pronta" : "contas prontas"}
                    </span>
                  </div>

                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 focus-within:bg-white focus-within:border-[#0066FF] focus-within:ring-2 focus-within:ring-[#0066FF]/20 transition-all">
                    <textarea
                      id={`creds-${v.id}`}
                      rows={6}
                      value={v.credentials || ""}
                      onChange={(e) => handleCredentialsChange(v, e.target.value)}
                      placeholder={`Cole as contas separadas por: ${sep === "\\n\\n" ? "Enter duplo" : sep}\n\nExemplo:\nemail1@netflix.com:senha123\n${sep === "\\n\\n" ? "\n" : sep}\nemail2@netflix.com:senha456`}
                      className="w-full text-xs font-mono text-zinc-900 placeholder:text-zinc-400 focus:outline-none resize-y leading-relaxed bg-transparent"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleInsertSeparator(v)}
                    className="w-full py-2.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-[0.99]"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#0066FF]" />
                    <span>Inserir Separador ({sep === "\\n\\n" ? "Enter duplo" : sep})</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Botão Adicionar Outro Item / Variação */}
      {!isSingleItem && (
        <button
          type="button"
          onClick={onAddVariant}
          className="w-full py-3.5 rounded-2xl border-2 border-dashed border-zinc-200 hover:border-[#0066FF] bg-white hover:bg-blue-50/40 text-zinc-700 hover:text-[#0066FF] text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-[0.99]"
        >
          <Plus className="w-4 h-4 text-[#0066FF]" />
          <span>Adicionar Outro Item / Variação</span>
        </button>
      )}
    </div>
  );
}
