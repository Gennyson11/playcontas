"use client";

import React, { useState } from "react";
import { Product, Question } from "@/types";
import {
  X,
  Zap,
  ShieldCheck,
  Star,
  CheckCircle2,
  Lock,
  MessageSquare,
  Send,
  ShoppingCart,
  Sparkles,
} from "lucide-react";

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
  onBuyNow: (product: Product) => void;
  onAddToCart: (product: Product) => void;
}

export function ProductModal({
  product,
  onClose,
  onBuyNow,
  onAddToCart,
}: ProductModalProps) {
  const [newQuestion, setNewQuestion] = useState("");
  const [questions, setQuestions] = useState<Question[]>(product?.questions || []);
  const [activeTab, setActiveTab] = useState<"detalhes" | "perguntas">("detalhes");

  if (!product) return null;

  const handleSendQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;

    const q: Question = {
      id: `q-${Date.now()}`,
      user: "Você (Comprador)",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Voce",
      question: newQuestion,
      date: "Agora mesmo",
    };

    setQuestions([q, ...questions]);
    setNewQuestion("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden my-6 max-h-[92vh] flex flex-col">
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-[#FFE500] text-black border border-black/10">
              {product.category}
            </span>
            {product.deliveryType === "AUTOMATIC" ? (
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" /> Entrega Automática (24/7)
              </span>
            ) : (
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 border border-blue-200">
                Entrega via Chat
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-black hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Media & Description */}
            <div className="lg:col-span-7 space-y-6">
              {/* Product Image */}
              <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                <img
                  src={product.image}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md px-3 py-1 rounded-lg text-xs text-white font-bold">
                  {product.stock} unidades disponíveis
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-slate-200 gap-6 text-sm font-bold">
                <button
                  onClick={() => setActiveTab("detalhes")}
                  className={`pb-3 relative transition-colors ${
                    activeTab === "detalhes" ? "text-black font-black" : "text-slate-500 hover:text-black"
                  }`}
                >
                  Descrição & Instruções
                  {activeTab === "detalhes" && (
                    <span className="absolute bottom-0 inset-x-0 h-1 bg-[#FFE500]" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("perguntas")}
                  className={`pb-3 relative transition-colors flex items-center gap-1.5 ${
                    activeTab === "perguntas" ? "text-black font-black" : "text-slate-500 hover:text-black"
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  Perguntas ({questions.length})
                  {activeTab === "perguntas" && (
                    <span className="absolute bottom-0 inset-x-0 h-1 bg-[#FFE500]" />
                  )}
                </button>
              </div>

              {/* Tab 1: Description */}
              {activeTab === "detalhes" && (
                <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <h4 className="font-black text-slate-900 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" /> Informações do Anúncio
                    </h4>
                    <p>{product.description}</p>
                  </div>

                  <div className="space-y-2">
                    <h5 className="font-black text-slate-900 text-xs uppercase tracking-wider">
                      Como funciona a entrega?
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-slate-900 block mb-0.5">Envio Imediato</strong>
                          <span className="text-slate-600">
                            Após a confirmação do pagamento, as credenciais e instruções são reveladas na sua tela.
                          </span>
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
                        <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-slate-900 block mb-0.5">Garantia de 30 Dias</strong>
                          <span className="text-slate-600">
                            Suporte exclusivo e reposição caso haja qualquer instabilidade.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Questions & Answers */}
              {activeTab === "perguntas" && (
                <div className="space-y-4">
                  {/* Ask question form */}
                  <form onSubmit={handleSendQuestion} className="space-y-2">
                    <div className="relative">
                      <input
                        type="text"
                        value={newQuestion}
                        onChange={(e) => setNewQuestion(e.target.value)}
                        placeholder="Faça uma pergunta ao vendedor antes de comprar..."
                        className="w-full pl-4 pr-12 py-3 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-black focus:bg-white"
                      />
                      <button
                        type="submit"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-[#FFE500] text-black hover:bg-[#ebd400] transition-colors"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="text-[11px] text-slate-500 block">
                      ⚠️ Não envie contatos externos (Discord, WhatsApp). Negocie apenas dentro da plataforma para manter sua garantia.
                    </span>
                  </form>

                  {/* Questions list */}
                  <div className="space-y-3 pt-2">
                    {questions.map((q) => (
                      <div
                        key={q.id}
                        className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between text-slate-500">
                          <span className="font-bold text-slate-900">{q.user}</span>
                          <span>{q.date}</span>
                        </div>
                        <p className="text-slate-800 font-medium">{q.question}</p>

                        {q.answer ? (
                          <div className="pl-3 border-l-2 border-[#FFE500] mt-2 pt-1 text-slate-700 bg-white p-2 rounded-r-lg border border-slate-100">
                            <span className="text-slate-900 font-black block mb-0.5">
                              Resposta do Vendedor:
                            </span>
                            <p>{q.answer}</p>
                          </div>
                        ) : (
                          <div className="text-slate-400 text-[11px] italic">
                            Aguardando resposta do vendedor...
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Buy Box & Seller Info */}
            <div className="lg:col-span-5 space-y-4">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                {product.title}
              </h2>

              {/* Price card */}
              <div className="p-5 rounded-2xl bg-slate-50 border-2 border-[#FFE500] shadow-sm space-y-4">
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-xs text-slate-500 block font-semibold">Preço à vista no PIX</span>
                    <span className="text-3xl font-black text-slate-900 tracking-tight">
                      R$ {product.price.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                  {product.originalPrice && (
                    <div className="text-right">
                      <span className="text-xs text-slate-400 line-through block">
                        R$ {product.originalPrice.toFixed(2).replace(".", ",")}
                      </span>
                      <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                        {Math.round((1 - product.price / product.originalPrice) * 100)}% OFF
                      </span>
                    </div>
                  )}
                </div>

                {/* Stock alert */}
                <div className="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-white border border-slate-200 text-slate-700">
                  <span>Estoque disponível:</span>
                  <strong className="text-slate-900 font-bold">{product.stock} un.</strong>
                </div>

                {/* Action buttons */}
                <div className="space-y-2 pt-1">
                  <button
                    onClick={() => onBuyNow(product)}
                    className="w-full py-3.5 px-4 rounded-xl bg-[#FFE500] hover:bg-[#ebd400] text-black font-black text-sm tracking-wide flex items-center justify-center gap-2 border border-black/10 shadow-sm transition-all active:scale-95 cursor-pointer"
                  >
                    <Zap className="w-4 h-4 fill-black" />
                    <span>COMPRAR AGORA</span>
                  </button>
                  <button
                    onClick={() => onAddToCart(product)}
                    className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs flex items-center justify-center gap-2 border border-slate-300 transition-colors"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Adicionar ao Carrinho
                  </button>
                </div>

                {/* Escrow Guarantee Badge */}
                <div className="pt-3 border-t border-slate-200 flex items-start gap-2.5 text-xs text-slate-700">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 block font-bold">Compra 100% Protegida</strong>
                    <span className="text-[11px] text-slate-500">
                      O pagamento fica seguro no PlayContas e só é repassado ao vendedor após você confirmar o recebimento.
                    </span>
                  </div>
                </div>
              </div>

              {/* Seller Box */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={product.seller.avatar}
                      alt={product.seller.name}
                      className="w-10 h-10 rounded-full border border-slate-200 bg-slate-100"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-slate-900">
                          {product.seller.name}
                        </span>
                        {product.seller.isVerified && (
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Nível {product.seller.level} • Desde {product.seller.memberSince}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center text-xs">
                  <div className="p-2 rounded-lg bg-slate-50">
                    <span className="text-slate-500 block text-[10px]">Vendas</span>
                    <strong className="text-slate-900 font-bold">{product.seller.salesCount}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50">
                    <span className="text-slate-500 block text-[10px]">Avaliação</span>
                    <strong className="text-amber-600 font-bold flex items-center justify-center gap-0.5">
                      <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> {product.seller.rating.toFixed(1)}
                    </strong>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50">
                    <span className="text-slate-500 block text-[10px]">Resposta</span>
                    <strong className="text-slate-900 font-bold">{product.seller.responseTime}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
