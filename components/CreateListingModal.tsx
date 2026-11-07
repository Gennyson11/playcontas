"use client";

import React, { useState } from "react";
import { Product } from "@/types";
import {
  X,
  PlusCircle,
  Zap,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import confetti from "canvas-confetti";

interface CreateListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProduct: (newProduct: Product) => void;
}

export function CreateListingModal({
  isOpen,
  onClose,
  onAddProduct,
}: CreateListingModalProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Inteligência Artificial");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [deliveryType, setDeliveryType] = useState<"AUTOMATIC" | "MANUAL">("AUTOMATIC");
  const [stockLines, setStockLines] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [warrantyDays, setWarrantyDays] = useState(30);

  if (!isOpen) return null;

  const samplePresets = [
    { label: "IA / ChatGPT / Claude", url: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=800&q=80" },
    { label: "Assinaturas & Tech", url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80" },
    { label: "Jogos & Contas", url: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80" },
    { label: "Streaming", url: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=800&q=80" },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !price) {
      alert("Por favor, preencha o título e o preço do anúncio.");
      return;
    }

    const lines = stockLines
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const numericPrice = parseFloat(price.replace(",", "."));
    const numericOriginal = originalPrice ? parseFloat(originalPrice.replace(",", ".")) : undefined;

    const newProd: Product = {
      id: `prod-${Date.now()}`,
      title,
      description: description || "Entrega rápida garantida com suporte VIP 24 horas por dia.",
      category,
      price: numericPrice,
      originalPrice: numericOriginal,
      image: image || samplePresets[0].url,
      deliveryType,
      autoDeliveryContent: lines.length > 0 ? lines : ["CONTA_DEMO_ACESSO: login@ia.com | pass: VIP#2026"],
      stock: lines.length > 0 ? lines.length : 10,
      featured: true,
      popular: true,
      salesCount: 0,
      tags: [category, "Novo"],
      warrantyDays,
      createdAt: new Date().toISOString().split("T")[0],
      seller: {
        id: "me-seller",
        name: "Você (Vendedor)",
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=VoceVendedor",
        isVerified: true,
        salesCount: 0,
        rating: 5.0,
        responseTime: "1 min",
        memberSince: "Hoje",
        level: "Prata",
      },
      questions: [],
    };

    onAddProduct(newProd);

    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#FFE500", "#FFFFFF", "#10B981"],
      });
    } catch {}

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#13141f] border border-[#26283b] rounded-3xl shadow-2xl overflow-hidden my-6 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222436] bg-[#0c0d14]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#FFE500] text-black flex items-center justify-center font-black">
              <PlusCircle className="w-5 h-5 fill-black text-[#FFE500]" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Criar Novo Anúncio</h2>
              <p className="text-[11px] text-zinc-400">Venda seus ativos digitais com segurança garantida</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-[#1b1c2b] text-zinc-400 hover:text-white hover:bg-[#25283b] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs sm:text-sm">
          {/* Title */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-white block">
                Título do Anúncio <span className="text-[#FFE500]">*</span>
              </label>
              <span className={`text-xs font-bold ${title.length >= 61 ? "text-red-400" : "text-zinc-400"}`}>
                {title.length} / 61 caracteres
              </span>
            </div>
            <input
              type="text"
              required
              maxLength={61}
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 61))}
              placeholder="Ex: Gemini AI Pro 18 Meses + 5TB Cloud (Entrega Imediata)"
              className="w-full px-4 py-3 rounded-xl bg-[#0c0d14] border border-[#222436] text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFE500]"
            />
          </div>

          {/* Category & Warranty */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-white block">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#0c0d14] border border-[#222436] text-white focus:outline-none focus:border-[#FFE500]"
              >
                <option value="Inteligência Artificial">Inteligência Artificial</option>
                <option value="Assinaturas & Streaming">Assinaturas & Streaming</option>
                <option value="Jogos & Contas Gamer">Jogos & Contas Gamer</option>
                <option value="Ferramentas & Dev">Ferramentas & Dev</option>
                <option value="BMs & Automação">BMs & Automação</option>
                <option value="Redes Sociais & Perfis">Redes Sociais & Perfis</option>
                <option value="Proxies & VPN">Proxies & VPN</option>
                <option value="Outros">Outros</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-white block">Dias de Garantia</label>
              <select
                value={warrantyDays}
                onChange={(e) => setWarrantyDays(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl bg-[#0c0d14] border border-[#222436] text-white focus:outline-none focus:border-[#FFE500]"
              >
                <option value={7}>7 Dias de Garantia</option>
                <option value={15}>15 Dias de Garantia</option>
                <option value={30}>30 Dias de Garantia (Recomendado)</option>
                <option value={90}>90 Dias de Garantia</option>
              </select>
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-white block">
                Preço de Venda (R$) <span className="text-[#FFE500]">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">R$</span>
                <input
                  type="text"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="8,90"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#0c0d14] border border-[#222436] text-white font-bold placeholder-zinc-500 focus:outline-none focus:border-[#FFE500]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-white block">Preço Original / De (R$)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">R$</span>
                <input
                  type="text"
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value)}
                  placeholder="19,90"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#0c0d14] border border-[#222436] text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFE500]"
                />
              </div>
            </div>
          </div>

          {/* Delivery Mode Choice */}
          <div className="space-y-2">
            <label className="font-bold text-white block">Forma de Entrega</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDeliveryType("AUTOMATIC")}
                className={`p-3.5 rounded-xl text-left border transition-all ${
                  deliveryType === "AUTOMATIC"
                    ? "bg-[#18192a] border-2 border-[#FFE500] shadow-glow"
                    : "bg-[#0c0d14] border-[#222436] hover:border-zinc-500"
                }`}
              >
                <div className="flex items-center gap-2 text-white font-bold mb-1">
                  <Zap className="w-4 h-4 text-[#FFE500] fill-[#FFE500]" />
                  <span>Entrega Automática (Bot)</span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  O sistema envia uma chave/login cadastrada no estoque imediatamente após o PIX.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDeliveryType("MANUAL")}
                className={`p-3.5 rounded-xl text-left border transition-all ${
                  deliveryType === "MANUAL"
                    ? "bg-[#18192a] border-2 border-[#FFE500] shadow-glow"
                    : "bg-[#0c0d14] border-[#222436] hover:border-zinc-500"
                }`}
              >
                <div className="flex items-center gap-2 text-white font-bold mb-1">
                  <MessageSquare className="w-4 h-4 text-blue-400" />
                  <span>Entrega Manual (Chat)</span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Você entrega diretamente no chat da compra após a notificação do pagamento.
                </p>
              </button>
            </div>
          </div>

          {/* Stock input if automatic delivery */}
          {deliveryType === "AUTOMATIC" && (
            <div className="space-y-1.5 p-4 rounded-xl bg-[#0c0d14] border border-[#222436]">
              <label className="font-bold text-white flex items-center justify-between">
                <span>Estoque Automático (1 linha por conta / chave)</span>
                <span className="text-[10px] text-[#FFE500] font-bold">
                  {stockLines.split("\n").filter((l) => l.trim()).length} unidade(s)
                </span>
              </label>
              <textarea
                rows={3}
                value={stockLines}
                onChange={(e) => setStockLines(e.target.value)}
                placeholder="Exemplo:&#10;login1@gmail.com:senha123&#10;login2@gmail.com:senha456"
                className="w-full px-3 py-2 rounded-lg bg-[#13141f] border border-[#26283b] text-white font-mono text-xs placeholder-zinc-500 focus:outline-none focus:border-[#FFE500]"
              />
              <span className="text-[10px] text-zinc-400 block">
                🔒 Seus dados ficam protegidos e só são liberados linha por linha a cada pedido aprovado.
              </span>
            </div>
          )}

          {/* Image selection */}
          <div className="space-y-1.5">
            <label className="font-bold text-white block">Imagem do Anúncio (URL ou Presets)</label>
            <input
              type="text"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="Cole a URL da imagem ou escolha um preset abaixo..."
              className="w-full px-4 py-2.5 rounded-xl bg-[#0c0d14] border border-[#222436] text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFE500]"
            />
            <div className="flex flex-wrap gap-2 pt-1">
              {samplePresets.map((preset) => (
                <button
                  type="button"
                  key={preset.label}
                  onClick={() => setImage(preset.url)}
                  className="px-2.5 py-1 rounded-lg bg-[#18192a] border border-[#26283b] hover:border-[#FFE500] text-[11px] text-zinc-300 font-semibold"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="font-bold text-white block">Descrição e Instruções</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes completos sobre o que o cliente recebe, garantia e suporte..."
              className="w-full px-4 py-2.5 rounded-xl bg-[#0c0d14] border border-[#222436] text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFE500]"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 px-4 rounded-xl bg-[#FFE500] hover:bg-[#ebd400] text-black font-black text-sm tracking-wide flex items-center justify-center gap-2 shadow-glow transition-all active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 fill-black" />
              <span>PUBLICAR ANÚNCIO AGORA</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
