"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CartItem } from "@/types";
import {
  getStoredCart,
  updateCartItemQuantity,
  removeFromCart,
} from "@/lib/cartStore";
import { getStoredUserSync, isProductOwner } from "@/lib/authStore";
import { X, ChevronUp, ChevronDown, ShoppingBag, AlertTriangle } from "lucide-react";

interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckout?: () => void;
  onRequireAuth?: () => void;
  warningNotice?: string | null;
  onClearWarning?: () => void;
}

export function CartModal({
  isOpen,
  onClose,
  onCheckout,
  onRequireAuth,
  warningNotice,
  onClearWarning,
}: CartModalProps) {
  const router = useRouter();
  const [warning, setWarning] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== "undefined") {
      return getStoredCart();
    }
    return [];
  });

  useEffect(() => {
    if (warningNotice) {
      setWarning(warningNotice);
    }
  }, [warningNotice]);

  useEffect(() => {
    if (!warning) return;
    const timer = setTimeout(() => {
      setWarning(null);
      if (onClearWarning) onClearWarning();
    }, 5000);
    return () => clearTimeout(timer);
  }, [warning, onClearWarning]);

  // Sincroniza com eventos do carrinho
  useEffect(() => {
    if (!isOpen) return;

    const syncCart = () => {
      setCart(getStoredCart());
    };

    syncCart();

    window.addEventListener("central_cart_updated", syncCart);
    window.addEventListener("storage", syncCart);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("central_cart_updated", syncCart);
      window.removeEventListener("storage", syncCart);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const total = cart.reduce(
    (acc, item) => acc + item.product.price * item.quantity,
    0
  );

  const handleIncrease = (item: CartItem) => {
    const maxStock = Number(item.product.stock ?? 9999);
    if (item.quantity >= maxStock) {
      setWarning(`Quantidade máxima disponível em estoque: ${maxStock} unidade(s).`);
      return;
    }
    setWarning(null);
    const updated = updateCartItemQuantity(item.product.id, item.quantity + 1, item.selectedVariantId);
    setCart(updated);
  };

  const handleDecrease = (item: CartItem) => {
    setWarning(null);
    if (item.quantity <= 1) {
      const updated = removeFromCart(item.product.id, item.selectedVariantId);
      setCart(updated);
    } else {
      const updated = updateCartItemQuantity(item.product.id, item.quantity - 1, item.selectedVariantId);
      setCart(updated);
    }
  };

  const handleRemove = (productId: string, variantId?: string) => {
    const updated = removeFromCart(productId, variantId);
    setCart(updated);
  };

  const currentUser = getStoredUserSync();
  const ownItem = cart.find((item) => isProductOwner(item.product, currentUser));

  const handleCheckoutClick = () => {
    if (ownItem) {
      alert(
        `Você é o vendedor do anúncio "${ownItem.product.title}" e não pode comprá-lo. Remova-o do carrinho para prosseguir.`
      );
      return;
    }

    if (!currentUser) {
      onClose();
      if (onRequireAuth) {
        onRequireAuth();
      } else {
        router.push("/finalizar-compra");
      }
      return;
    }

    onClose();
    if (onCheckout) {
      onCheckout();
    } else {
      router.push("/finalizar-compra");
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn font-sans"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-2xl w-full p-5 sm:p-7 relative border border-zinc-200 animate-scaleUp"
      >
        {/* Título Centralizado Azul */}
        <h2 className="text-xl sm:text-2xl font-black text-[#0066FF] tracking-tight text-center">
          Carrinho
        </h2>

        {/* Mensagem Elegante de Limite de Estoque dentro do Popup */}
        {warning && (
          <div className="mt-3.5 -mb-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm font-bold flex items-center justify-between gap-2.5 shadow-2xs animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{warning}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setWarning(null);
                if (onClearWarning) onClearWarning();
              }}
              className="p-1 text-amber-600 hover:text-amber-900 rounded-md hover:bg-amber-100 transition-colors cursor-pointer"
              title="Fechar aviso"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Botão de Fechar X Azul no Topo Direito */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 sm:top-6 sm:right-6 text-[#0066FF] hover:text-[#0052cc] p-1 transition-colors cursor-pointer"
          title="Fechar"
        >
          <X className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.6} />
        </button>

        {/* Faixa Cinza com Cabeçalho da Tabela */}
        <div className="bg-zinc-100/90 rounded-none px-4 py-2.5 mt-5 flex items-center justify-between text-[11px] font-black text-zinc-700 uppercase tracking-wider select-none">
          <span className="flex-1">PRODUTO / SERVIÇO</span>
          <span className="w-28 text-center">QUANTIDADE</span>
          <span className="w-24 text-right">SUBTOTAL</span>
        </div>

        {/* Lista de Itens do Carrinho */}
        <div className="max-h-[50vh] overflow-y-auto divide-y divide-zinc-150 pr-1">
          {cart.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0066FF] flex items-center justify-center mx-auto">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-zinc-700">Seu carrinho está vazio</p>
              <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                Adicione contas ou pacotes para finalizar seu pedido com entrega rápida.
              </p>
            </div>
          ) : (
            cart.map((item) => {
              const itemSubtotal = item.product.price * item.quantity;
              const isOwnerItem = isProductOwner(item.product, currentUser);

              return (
                <div
                  key={item.product.id}
                  className="py-4 flex items-center justify-between gap-3 sm:gap-4"
                >
                  {/* Esquerda: Botão X + Imagem + Título */}
                  <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleRemove(item.product.id, item.selectedVariantId)}
                      className="text-zinc-400 hover:text-rose-500 p-1 font-bold text-lg leading-none cursor-pointer transition-colors shrink-0"
                      title="Remover item"
                    >
                      <X className="w-4 h-4" strokeWidth={2.4} />
                    </button>

                    <img
                      src={item.product.image}
                      alt={item.product.title}
                      className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl object-cover border border-zinc-200 shrink-0 bg-zinc-900"
                    />

                    <div className="min-w-0 flex-1">
                      <h4
                        className="text-xs sm:text-sm font-bold text-zinc-900 leading-snug line-clamp-2"
                        title={item.product.title}
                      >
                        {item.product.title}
                      </h4>
                      {isOwnerItem && (
                        <span className="inline-block mt-0.5 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md">
                          Seu anúncio
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Centro: Controle de Quantidade com caixinha e setas verticais */}
                  <div className="w-28 flex items-center justify-center gap-1.5 shrink-0">
                    <div className="w-12 sm:w-14 h-9 sm:h-10 rounded-lg border border-zinc-200 bg-white flex items-center justify-center text-xs sm:text-sm font-black text-zinc-900 shadow-2xs select-none">
                      {item.quantity}
                    </div>

                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleIncrease(item)}
                        className="w-6 h-4 rounded bg-zinc-200/80 hover:bg-zinc-300 flex items-center justify-center text-zinc-700 transition-colors cursor-pointer"
                        title="Aumentar quantidade"
                      >
                        <ChevronUp className="w-3.5 h-3.5" strokeWidth={2.5} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDecrease(item)}
                        className="w-6 h-4 rounded bg-zinc-200/80 hover:bg-zinc-300 flex items-center justify-center text-zinc-700 transition-colors cursor-pointer"
                        title="Diminuir quantidade"
                      >
                        <ChevronDown className="w-3.5 h-3.5" strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>

                  {/* Direita: Subtotal em Azul */}
                  <div className="w-24 text-right shrink-0">
                    <span className="font-black text-sm sm:text-base text-[#0066FF] tracking-tight">
                      R$ {itemSubtotal.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé: Total + Botão Finalizar Compra */}
        {cart.length > 0 && (
          <div className="pt-5 mt-3 border-t border-zinc-150 flex items-center justify-end gap-5 sm:gap-6">
            <div className="text-center sm:text-right">
              <span className="text-[10px] font-black text-zinc-800 uppercase tracking-widest block leading-none mb-1">
                TOTAL
              </span>
              <span className="text-xl sm:text-2xl font-black text-[#0066FF] leading-none tracking-tight">
                R$ {total.toFixed(2).replace(".", ",")}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCheckoutClick}
              className="px-6 sm:px-7 py-3 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-md shadow-blue-500/25 active:scale-95 transition-all cursor-pointer"
            >
              Finalizar compra
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
