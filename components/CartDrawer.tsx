"use client";

import React from "react";
import { Product } from "@/types";
import { X, Trash2, ShoppingBag, ArrowRight, ShieldCheck, Zap } from "lucide-react";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: { product: Product; quantity: number }[];
  onRemoveItem: (id: string) => void;
  onCheckout: () => void;
}

export function CartDrawer({
  isOpen,
  onClose,
  items,
  onRemoveItem,
  onCheckout,
}: CartDrawerProps) {
  if (!isOpen) return null;

  const total = items.reduce((acc, item) => acc + item.product.price * item.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-[#13141f] border-l border-[#222436] h-full flex flex-col justify-between shadow-2xl">
        {/* Drawer Header */}
        <div className="p-5 border-b border-[#222436] flex items-center justify-between bg-[#0c0d14]">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#FFE500]" />
            <h2 className="text-base font-black text-white">Carrinho de Compras</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#1e2030] text-zinc-300 font-bold">
              {items.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#1b1c2b] text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <ShoppingBag className="w-12 h-12 text-zinc-700 mx-auto" />
              <p className="text-sm font-bold text-zinc-400">Seu carrinho está vazio</p>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                Explore os anúncios em destaque e adicione contas de IA, jogos e ferramentas digitais!
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.product.id}
                className="p-3.5 rounded-2xl bg-[#0c0d14] border border-[#222436] flex items-center gap-3"
              >
                <img
                  src={item.product.image}
                  alt={item.product.title}
                  className="w-14 h-14 rounded-xl object-cover border border-zinc-800 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-white truncate">{item.product.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-black text-[#FFE500]">
                      R$ {item.product.price.toFixed(2).replace(".", ",")}
                    </span>
                    {item.product.deliveryType === "AUTOMATIC" && (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                        <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400" /> Auto
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onRemoveItem(item.product.id)}
                  className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                  title="Remover"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer with Total and Checkout */}
        {items.length > 0 && (
          <div className="p-5 border-t border-[#222436] bg-[#0c0d14] space-y-4">
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-zinc-400">
                <span>Subtotal:</span>
                <span className="font-bold text-white">R$ {total.toFixed(2).replace(".", ",")}</span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span>Taxa de Intermediação & Proteção:</span>
                <span className="text-emerald-400 font-bold">GRÁTIS (R$ 0,00)</span>
              </div>
              <div className="pt-2 border-t border-[#1e2030] flex items-baseline justify-between text-white font-black text-base">
                <span>Total:</span>
                <span className="text-2xl text-[#FFE500]">R$ {total.toFixed(2).replace(".", ",")}</span>
              </div>
            </div>

            <button
              onClick={() => {
                onClose();
                onCheckout();
              }}
              className="w-full py-3.5 rounded-xl bg-[#FFE500] hover:bg-[#ebd400] text-black font-black text-sm tracking-wide flex items-center justify-center gap-2 shadow-glow transition-all active:scale-95 cursor-pointer"
            >
              <span>IR PARA PAGAMENTO PIX</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Garantia de Entrega e Pagamento Protegido</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
