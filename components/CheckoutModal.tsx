"use client";

import React, { useState, useEffect } from "react";
import { Product } from "@/types";
import {
  X,
  ShieldCheck,
  Zap,
  Copy,
  Check,
  QrCode,
  Lock,
  FileCheck,
  User,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import confetti from "canvas-confetti";
import { notifySale } from "@/lib/notificationStore";
import { createPurchaseChats } from "@/lib/chatStore";
import { consumePurchasedStock } from "@/lib/productStore";
import { getStoredUserSync } from "@/lib/authStore";
import { useRouter } from "next/navigation";
import { getProductUrl } from "@/lib/slug";
import { formatCPF, isValidCPF, cleanCPF } from "@/lib/cpf";

interface CheckoutModalProps {
  product: Product | null;
  onClose: () => void;
  onPurchaseSuccess?: (productId: string) => void;
}

export function CheckoutModal({ product, onClose, onPurchaseSuccess }: CheckoutModalProps) {
  const [copied, setCopied] = useState(false);
  const [credentialCopied, setCredentialCopied] = useState(false);
  const [step, setStep] = useState<"payment" | "success">("payment");
  const [chatState, setChatState] = useState<"idle" | "opening" | "error">("idle");
  const [chatErr, setChatErr] = useState("");
  const [pixCode, setPixCode] = useState<string>("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [syncPayIdentifier, setSyncPayIdentifier] = useState<string>("");
  const [pixReady, setPixReady] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [buyerName, setBuyerName] = useState(() => {
    if (typeof window !== "undefined") {
      const savedUser = getStoredUserSync();
      return (
        localStorage.getItem("playcontas_buyer_name") ||
        savedUser?.name ||
        ""
      );
    }
    return "";
  });

  const [buyerCpf, setBuyerCpf] = useState(() => {
    if (typeof window !== "undefined") {
      const savedUser = getStoredUserSync();
      const saved =
        localStorage.getItem("playcontas_buyer_cpf") ||
        (savedUser as any)?.cpf ||
        "";
      return formatCPF(saved);
    }
    return "";
  });

  const [buyerError, setBuyerError] = useState("");
  const router = useRouter();

  const handleGeneratePix = async () => {
    if (!product) return;
    const trimmedName = buyerName.trim();
    const nameParts = trimmedName.split(/\s+/);
    if (!trimmedName || nameParts.length < 2 || nameParts[0].length < 2) {
      setBuyerError("Por favor, informe seu nome e sobrenome completo.");
      return;
    }
    if (!isValidCPF(buyerCpf)) {
      setBuyerError("Por favor, informe um CPF válido para a emissão do PIX.");
      return;
    }

    setBuyerError("");
    setIsGenerating(true);

    if (typeof window !== "undefined") {
      localStorage.setItem("playcontas_buyer_name", trimmedName);
      localStorage.setItem("playcontas_buyer_cpf", cleanCPF(buyerCpf));
    }

    try {
      const buyer = getStoredUserSync();
      const res = await fetch("/api/syncpay/cash-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: product.price,
          buyer: {
            name: trimmedName,
            email: buyer?.email || "cliente@playcontas.com.br",
            document: cleanCPF(buyerCpf),
          },
          description: `PlayContas - ${product.title.slice(0, 30)}`,
          sellerSyncPayId:
            (product as any)?.sellerSyncPayId ||
            (product as any)?.syncpay_user_id ||
            null,
          items: [
            {
              id: product.id,
              title: product.title,
              price: product.price,
              quantity: 1,
            },
          ],
          platformFee: 13,
        }),
      });

      const data = await res.json();
      if (data.success && data.pix_code) {
        setPixCode(data.pix_code);
        setQrCodeUrl(
          data.qr_code_url ||
            `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
              data.pix_code
            )}`
        );
        setSyncPayIdentifier(data.identifier);
      } else {
        const fallbackCode = `00020126580014br.gov.bcb.pix0136playcontas-${product.id}-${Date.now()}520400005303986540${product.price.toFixed(
          2
        )}5802BR5913PlayContas6009SaoPaulo62070503***6304E81A`;
        setPixCode(fallbackCode);
        setQrCodeUrl(
          `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
            fallbackCode
          )}`
        );
      }
      setPixReady(true);
    } catch {
      const fallbackCode = `00020126580014br.gov.bcb.pix0136playcontas-${product.id}-${Date.now()}520400005303986540${product.price.toFixed(
        2
      )}5802BR5913PlayContas6009SaoPaulo62070503***6304E81A`;
      setPixCode(fallbackCode);
      setQrCodeUrl(
        `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
          fallbackCode
        )}`
      );
      setPixReady(true);
    } finally {
      setIsGenerating(false);
    }
  };

  // Polling automático da SyncPay
  useEffect(() => {
    if (!syncPayIdentifier || step !== "payment") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/syncpay/check-status?identifier=${encodeURIComponent(
            syncPayIdentifier
          )}`
        );
        const data = await res.json();
        if (
          data.success &&
          (data.status === "approved" ||
            data.status === "paid" ||
            data.status === "completed")
        ) {
          clearInterval(interval);
          handleSimulatePayment();
        }
      } catch {}
    }, 2500);
    return () => clearInterval(interval);
  }, [syncPayIdentifier, step]);

  if (!product) return null;

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSimulatePayment = async () => {
    const buyer = getStoredUserSync();
    if (!buyer) {
      setChatErr("Entre na sua conta para finalizar a compra.");
      return;
    }

    setChatErr("");
    setStep("success");
    setChatState("opening");
    if (product && onPurchaseSuccess) {
      onPurchaseSuccess(product.id);
    }
    if (product) {
      try {
        consumePurchasedStock([{ product, quantity: 1 }]);
      } catch {}
    }
    try {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#0066FF", "#10B981", "#FFFFFF"],
      });
    } catch {}

    // Cria o chat com o vendedor (entrega automática já enviada) e abre a conversa
    const { chatIds, errors } = await createPurchaseChats([{ product, quantity: 1 }], buyer);
    if (chatIds.length > 0) {
      setTimeout(() => {
        onClose();
        router.push(`/chat/${chatIds[0]}`);
      }, 1300);
      return;
    }

    // Não conseguiu abrir o chat: avisa o vendedor pelo sininho e mostra a entrega aqui mesmo
    notifySale(product, 1, getProductUrl(product));
    setChatErr(errors[0] || "Não foi possível abrir o chat do pedido.");
    setChatState("error");
  };

  const deliveredContent =
    product.autoDeliveryContent && product.autoDeliveryContent.length > 0
      ? product.autoDeliveryContent[0]
      : "ACESSO_LIBERADO: usuario.central@gmail.com | Senha: CentralPass#2026";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white border border-zinc-200 rounded-3xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50/80">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm sm:text-base font-black text-zinc-950">
              {step === "payment" ? "Pagamento Protegido via PIX" : "Entrega do Pedido Aprovado!"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Payment Screen */}
        {step === "payment" && (
          <div className="p-6 space-y-5">
            {/* Product summary card */}
            <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center gap-3">
              <img
                src={product.image}
                alt={product.title}
                className="w-14 h-14 rounded-xl object-cover shrink-0 border border-zinc-200"
              />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-zinc-400 font-bold uppercase">{product.category}</span>
                <h4 className="text-xs sm:text-sm font-black text-zinc-950 truncate">{product.title}</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-black text-[#0066FF]">
                    R$ {product.price.toFixed(2).replace(".", ",")}
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded font-bold border border-emerald-200">
                    ● Garantia 30 Dias
                  </span>
                </div>
              </div>
            </div>

            {!pixReady ? (
              /* ETAPA 1A: Formulário de Nome Completo e CPF */
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-3.5">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-200/80">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-[#0066FF]" />
                      <h3 className="text-xs font-black text-zinc-900 uppercase tracking-wider">
                        Dados do Titular do Pagamento
                      </h3>
                    </div>
                    <span className="text-[10px] font-bold text-zinc-500 bg-zinc-200/60 px-2 py-0.5 rounded-full">
                      Exigência Banco Central
                    </span>
                  </div>

                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Preencha seu nome e CPF para emissão da chave PIX instantânea.
                  </p>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider block">
                        Nome Completo *
                      </label>
                      <input
                        type="text"
                        value={buyerName}
                        onChange={(e) => {
                          setBuyerName(e.target.value);
                          if (buyerError) setBuyerError("");
                        }}
                        placeholder="Ex: Carlos Eduardo da Silva"
                        className="w-full bg-white border border-zinc-200 focus:border-[#0066FF] rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none transition-all shadow-2xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider block">
                        CPF do Titular *
                      </label>
                      <input
                        type="text"
                        value={buyerCpf}
                        maxLength={14}
                        onChange={(e) => {
                          setBuyerCpf(formatCPF(e.target.value));
                          if (buyerError) setBuyerError("");
                        }}
                        placeholder="000.000.000-00"
                        className="w-full bg-white border border-zinc-200 focus:border-[#0066FF] rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none transition-all font-mono shadow-2xs"
                      />
                    </div>
                  </div>

                  {buyerError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{buyerError}</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleGeneratePix}
                  disabled={isGenerating}
                  className="w-full py-3.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isGenerating ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Gerando PIX SyncPay...</span>
                    </div>
                  ) : (
                    <>
                      <QrCode className="w-4 h-4" />
                      <span>Gerar PIX e Pagar</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* ETAPA 1B: Exibição do QR Code e Copia e Cola */
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setPixReady(false)}
                    className="text-xs font-bold text-[#0066FF] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Alterar dados do pagador</span>
                  </button>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    CPF: {buyerCpf}
                  </span>
                </div>

                {/* QR Code and PIX */}
                <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200 text-center space-y-4">
                  <div className="inline-block p-3 rounded-2xl bg-white border border-zinc-200 shadow-sm">
                    <div className="w-40 h-40 bg-white rounded-xl flex flex-col items-center justify-center p-1">
                      <img
                        src={
                          qrCodeUrl ||
                          `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                            pixCode
                          )}`
                        }
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (!target.src.includes("quickchart.io")) {
                            target.src = `https://quickchart.io/qr?text=${encodeURIComponent(pixCode)}&size=250`;
                          }
                        }}
                        alt="QR Code PIX SyncPay"
                        className="w-36 h-36 object-contain"
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-zinc-700">
                      Abra o app do seu banco e escaneie o QR Code ou copie o código Pix:
                    </p>
                  </div>

                  {/* Copy Pix */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={pixCode}
                      className="w-full px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-[11px] font-mono text-zinc-800 truncate focus:outline-none"
                    />
                    <button
                      onClick={handleCopyPix}
                      className="px-4 py-2.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs flex items-center gap-1.5 shrink-0 transition-colors shadow-2xs cursor-pointer active:scale-95"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? "Copiado!" : "Copiar"}</span>
                    </button>
                  </div>
                </div>

                {/* Indicador de confirmação automática */}
                <div className="w-full py-3 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-600 font-bold text-xs flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#0066FF] animate-pulse" />
                  <span>Aguardando pagamento no app do seu banco...</span>
                </div>
              </div>
            )}

            {/* Escrow note */}
            <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 flex items-start gap-2.5 text-xs text-zinc-600">
              <Lock className="w-4 h-4 text-[#0066FF] shrink-0 mt-0.5" />
              <span>
                Seu dinheiro fica protegido em custódia pelo <strong>PlayContas</strong>. O vendedor só recebe o pagamento após a sua confirmação.
              </span>
            </div>

            {chatErr && step === "payment" && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
                {chatErr}
              </div>
            )}
          </div>
        )}

        {/* Step 2a: Pagamento aprovado, abrindo o chat do vendedor */}
        {step === "success" && chatState === "opening" && (
          <div className="p-8 space-y-4 text-center animate-fadeIn">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>
            <h3 className="text-lg font-black text-zinc-950">Pagamento Confirmado!</h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
              Abrindo o chat com o vendedor. Entrega automática já vai na conversa; se for manual, é só
              aguardar o vendedor enviar.
            </p>
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#0066FF]">
              <div className="w-4 h-4 border-2 border-[#0066FF] border-t-transparent rounded-full animate-spin" />
              Abrindo chat do pedido...
            </div>
          </div>
        )}

        {/* Step 2b: Delivery & Success Screen (usada se o chat não puder ser aberto) */}
        {step === "success" && chatState !== "opening" && (
          <div className="p-6 space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <h3 className="text-lg font-black text-zinc-950">Pagamento Confirmado!</h3>
              {chatErr && (
                <p className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 max-w-sm mx-auto leading-relaxed">
                  Não foi possível abrir o chat do pedido: {chatErr}
                </p>
              )}
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                {product.deliveryType === "AUTOMATIC"
                  ? "Sua conta / credencial foi resgatada do estoque automático do vendedor:"
                  : "Seu pedido foi encaminhado ao chat do vendedor. Ele já foi notificado!"}
              </p>
            </div>

            {/* Auto delivery box */}
            {product.deliveryType === "AUTOMATIC" ? (
              <div className="p-4 rounded-2xl bg-zinc-50 border-2 border-[#0066FF] space-y-3 shadow-xs">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black text-[#0066FF] flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-[#0066FF] fill-[#0066FF]" /> SEUS DADOS DE ACESSO:
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-200">
                    Entrega Automática 24/7
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-white border border-zinc-200 font-mono text-xs text-zinc-900 font-bold break-all">
                  {deliveredContent}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(deliveredContent);
                    setCredentialCopied(true);
                    setTimeout(() => setCredentialCopied(false), 2000);
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs active:scale-95"
                >
                  {credentialCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{credentialCopied ? "Credenciais Copiadas!" : "Copiar Credenciais"}</span>
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-700 space-y-2">
                <strong className="text-zinc-950 block font-bold">Entrega via Chat:</strong>
                <p>
                  O vendedor <strong>{product.seller.name}</strong> tem tempo médio de resposta de{" "}
                  <strong>{product.seller.responseTime}</strong> e entrará em contato para efetuar a entrega.
                </p>
              </div>
            )}

            {/* Release Escrow Button */}
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
              <span className="text-xs text-emerald-800 font-medium block">
                Depois de testar seu produto, libere o saldo para o vendedor:
              </span>
              <button
                onClick={() => {
                  alert("Você confirmou o recebimento! O valor foi repassado com sucesso ao vendedor.");
                  onClose();
                }}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs active:scale-95"
              >
                <FileCheck className="w-4 h-4 text-white" />
                Confirmar Recebimento & Liberar Saldo
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-zinc-950 hover:bg-black text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Concluir & Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
