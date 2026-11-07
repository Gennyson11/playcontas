"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Product, CartItem, UserProfile } from "@/types";
import {
  getStoredCart,
  updateCartItemQuantity,
  removeFromCart,
  clearCart,
  saveStoredCart,
} from "@/lib/cartStore";
import { JamHeader } from "@/components/JamHeader";
import { JamFooter } from "@/components/JamFooter";
import { CheckoutModal } from "@/components/CheckoutModal";
import { AuthModal } from "@/components/AuthModal";
import { getStoredUserSync, saveStoredUser, clearStoredUser } from "@/lib/authStore";
import {
  ArrowLeft,
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  ShieldCheck,
  Package,
  Sparkles,
  Gamepad2,
  Bot,
  Layers,
  CheckCircle2,
} from "lucide-react";

export default function CarrinhoPage() {
  const router = useRouter();

  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== "undefined") {
      return getStoredCart();
    }
    return [];
  });
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getStoredUserSync());
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialTab, setAuthInitialTab] = useState<"login" | "register">("login");
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Carrega e sincroniza usuário autenticado
  useEffect(() => {
    const syncUser = () => setCurrentUser(getStoredUserSync());
    syncUser();
    window.addEventListener("central_auth_changed", syncUser);
    window.addEventListener("storage", syncUser);
    return () => {
      window.removeEventListener("central_auth_changed", syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  // Carrega itens do carrinho e sincroniza eventos
  useEffect(() => {
    const loaded = getStoredCart();
    setCart(loaded);

    const handleCartUpdate = () => {
      setCart(getStoredCart());
    };

    window.addEventListener("central_cart_updated", handleCartUpdate);
    window.addEventListener("storage", handleCartUpdate);
    return () => {
      window.removeEventListener("central_cart_updated", handleCartUpdate);
      window.removeEventListener("storage", handleCartUpdate);
    };
  }, []);

  // Cálculos do resumo
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const serviceFee = cart.length > 0 ? 1.0 : 0;
  const total = subtotal + serviceFee;

  const handleUpdateQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      const updated = removeFromCart(productId);
      setCart(updated);
    } else {
      const updated = updateCartItemQuantity(productId, newQty);
      setCart(updated);
    }
  };

  const handleRemove = (productId: string) => {
    const updated = removeFromCart(productId);
    setCart(updated);
  };

  const handleClear = () => {
    if (confirm("Tem certeza que deseja limpar todos os itens do carrinho?")) {
      clearCart();
      setCart([]);
    }
  };

  const handleCheckoutSuccess = (productId: string) => {
    clearCart();
    setCart([]);
  };

  // Helper para ícone de categoria
  const getCategoryIcon = (cat?: string) => {
    const lower = (cat || "").toLowerCase();
    if (lower.includes("steam") || lower.includes("game") || lower.includes("jogo")) {
      return <Gamepad2 className="w-3.5 h-3.5 text-zinc-500" />;
    }
    if (lower.includes("ia") || lower.includes("gpt") || lower.includes("claude") || lower.includes("inteligência")) {
      return <Bot className="w-3.5 h-3.5 text-zinc-500" />;
    }
    return <Layers className="w-3.5 h-3.5 text-zinc-500" />;
  };

  return (
    <div className="min-h-screen bg-zinc-100/60 text-zinc-900 flex flex-col font-sans">
      {/* Header global */}
      <JamHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        cartCount={totalItems}
        onOpenCart={() => {}}
        onOpenCreateListing={() => router.push("/anunciar")}
        onOpenCategories={() => router.push("/")}
        currentUser={currentUser}
        onOpenAuth={(tab) => {
          setAuthInitialTab(tab || "login");
          setAuthModalOpen(true);
        }}
        onOpenMyProducts={() => router.push("/meus-produtos")}
        onOpenAdmin={() => router.push("/?admin=true")}
        onOpenSettings={() => router.push("/minha-conta")}
        onGoHome={() => router.push("/")}
        onLogout={async () => {
          await clearStoredUser();
          setCurrentUser(null);
        }}
      />

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Botão Superior Voltar */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-bold text-zinc-700 hover:text-[#0066FF] hover:border-[#0066FF] transition-all shadow-2xs group cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Voltar para a loja</span>
          </button>
        </div>

        {/* Título e Header do Carrinho */}
        <div className="flex items-center gap-3.5 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0066FF] flex items-center justify-center border border-blue-100 shadow-2xs">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
              Carrinho de Compras
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 font-medium mt-0.5">
              {totalItems === 0
                ? "Nenhum item no carrinho"
                : `${totalItems} ${totalItems === 1 ? "item no carrinho" : "itens no carrinho"}`}
            </p>
          </div>
        </div>

        {/* Quando o carrinho está vazio */}
        {cart.length === 0 ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-10 sm:p-16 text-center shadow-xs space-y-4 max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-blue-50 text-[#0066FF] flex items-center justify-center mx-auto border border-blue-100 shadow-2xs">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h3 className="text-lg sm:text-xl font-black text-zinc-950">
              Seu carrinho está vazio
            </h3>
            <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed max-w-md mx-auto">
              Explore os melhores anúncios de contas premium, jogos, inteligência artificial e softwares com entrega imediata no PlayContas.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="px-6 py-3 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-black text-xs uppercase tracking-wider shadow-md shadow-blue-500/25 active:scale-95 transition-all cursor-pointer"
              >
                Explorar Produtos
              </button>
            </div>
          </div>
        ) : (
          /* Grid com duas colunas */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Coluna Esquerda: Itens no Carrinho (8 cols) */}
            <div className="lg:col-span-8">
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-7 shadow-xs space-y-6">
                {/* Header do Card */}
                <div className="border-b border-zinc-100 pb-4">
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-base sm:text-lg font-black text-zinc-950">
                      Itens no Carrinho
                    </h2>
                    <span className="text-xs font-bold text-zinc-400">({totalItems})</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Revise os produtos e quantidades antes de finalizar
                  </p>
                </div>

                {/* Lista de Itens */}
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="p-4 sm:p-5 rounded-2xl border border-zinc-150 bg-zinc-50/70 hover:bg-zinc-50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs group"
                    >
                      {/* Thumbnail e Informações */}
                      <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
                        <img
                          src={item.product.image}
                          alt={item.product.title}
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-zinc-200 shrink-0 bg-zinc-900 shadow-2xs"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <h3
                            onClick={() => router.push(`/anuncio/${item.product.id}`)}
                            className="font-black text-sm sm:text-base text-zinc-950 truncate hover:text-[#0066FF] cursor-pointer transition-colors"
                            title={item.product.title}
                          >
                            {item.product.title}
                          </h3>

                          {/* Categoria com ícone */}
                          <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-semibold">
                            {getCategoryIcon(item.product.category)}
                            <span className="truncate">{item.product.category || "Assinaturas"}</span>
                          </div>

                          {/* Preço e Status de Estoque */}
                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            <span className="text-xs sm:text-sm font-black text-zinc-900">
                              R$ {item.product.price.toFixed(2).replace(".", ",")}
                              <span className="text-xs font-semibold text-zinc-400 ml-1">
                                × {item.quantity}
                              </span>
                            </span>
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                              <Package className="w-3 h-3 text-emerald-600" />
                              <span>Em estoque</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Controles de Quantidade e Excluir */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-200/60">
                        {/* Seletor de Quantidade [- 1 +] */}
                        <div className="flex items-center rounded-xl border border-zinc-200 bg-white p-1 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.product.id, item.quantity - 1)}
                            className="w-7 h-7 rounded-lg text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 flex items-center justify-center transition-colors cursor-pointer"
                            title="Diminuir quantidade"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="min-w-[28px] text-center font-bold text-xs sm:text-sm text-zinc-900 select-none">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.product.id, item.quantity + 1)}
                            className="w-7 h-7 rounded-lg text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 flex items-center justify-center transition-colors cursor-pointer"
                            title="Aumentar quantidade"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Botão de Remover */}
                        <button
                          type="button"
                          onClick={() => handleRemove(item.product.id)}
                          className="p-2 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remover produto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Rodapé do Card com Ações (Limpar Carrinho / Adicionar Mais) */}
                <div className="pt-4 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleClear}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Limpar Carrinho</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => router.push("/")}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 hover:text-[#0066FF] hover:border-[#0066FF] font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Mais</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Coluna Direita: Resumo do Pedido (4 cols) */}
            <div className="lg:col-span-4 lg:sticky lg:top-24">
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-7 shadow-xs space-y-5">
                <h3 className="font-black text-base text-zinc-950">
                  Resumo do Pedido
                </h3>

                <div className="space-y-2.5 text-xs text-zinc-600 font-medium">
                  <div className="flex items-center justify-between">
                    <span>
                      Subtotal ({totalItems} {totalItems === 1 ? "item" : "itens"}):
                    </span>
                    <span className="font-bold text-zinc-900 text-sm">
                      R$ {subtotal.toFixed(2).replace(".", ",")}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span>Taxa de Serviço:</span>
                    <span className="font-bold text-zinc-900 text-sm">
                      R$ {serviceFee.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-100 flex items-baseline justify-between">
                  <span className="font-black text-sm text-zinc-900 uppercase tracking-wider">
                    Total:
                  </span>
                  <span className="font-black text-2xl text-zinc-950">
                    R$ {total.toFixed(2).replace(".", ",")}
                  </span>
                </div>

                {/* Botão Finalizar Compra */}
                <button
                  type="button"
                  onClick={() => router.push("/finalizar-compra")}
                  className="w-full py-4 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-blue-500/25 active:scale-95 transition-all cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Finalizar Compra</span>
                </button>

                {/* Notas de Segurança */}
                <div className="pt-2 text-center space-y-1.5">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-600">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Pagamento protegido</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Ao finalizar, você concorda com os Termos de Serviço
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal de Pagamento PIX e Checkout */}
      {checkoutModalOpen && cart.length > 0 && (
        <CheckoutModal
          product={{
            id: cart[0].product.id,
            title:
              cart.length === 1
                ? cart[0].product.title
                : `${cart[0].product.title} e mais ${cart.length - 1} item(ns)`,
            price: total,
            category: cart[0].product.category,
            image: cart[0].product.image,
            deliveryType: cart.every((i) => i.product.deliveryType === "AUTOMATIC")
              ? "AUTOMATIC"
              : "MANUAL",
            autoDeliveryContent: cart.flatMap((i) => i.product.autoDeliveryContent || []),
            stock: 10,
            salesCount: 1,
            tags: [],
            seller: cart[0].product.seller,
            warrantyDays: cart[0].product.warrantyDays || 30,
            createdAt: new Date().toISOString(),
            description: "Pedido no carrinho PlayContas",
          }}
          onClose={() => setCheckoutModalOpen(false)}
          onPurchaseSuccess={handleCheckoutSuccess}
        />
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialTab={authInitialTab}
        onLoginSuccess={(user) => {
          if (user.email?.toLowerCase() === "gennysonmarinhodemacedo@gmail.com") {
            user.role = "admin";
          }
          saveStoredUser(user);
          setCurrentUser(user);
          setAuthModalOpen(false);
        }}
      />

      {/* Footer */}
      <JamFooter />
    </div>
  );
}
