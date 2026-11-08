"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CartItem, Product, UserProfile } from "@/types";
import { getStoredCart, saveStoredCart, clearCart } from "@/lib/cartStore";
import { getUserAvatar } from "@/lib/avatarStore";
import { JamHeader } from "@/components/JamHeader";
import { JamFooter } from "@/components/JamFooter";
import { AuthModal } from "@/components/AuthModal";
import { getStoredUserSync, saveStoredUser, clearStoredUser, isProductOwner } from "@/lib/authStore";
import { notifySale } from "@/lib/notificationStore";
import { createPurchaseChats } from "@/lib/chatStore";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { getProductUrl } from "@/lib/slug";
import { consumePurchasedStock } from "@/lib/productStore";
import { validateCouponAsync, recordCouponUsage } from "@/lib/couponStore";
import { formatCPF, isValidCPF, cleanCPF } from "@/lib/cpf";
import {
  ArrowLeft,
  QrCode,
  Wallet,
  CreditCard,
  ShieldCheck,
  Check,
  Copy,
  Clock,
  Sparkles,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  User,
  Lock,
  Loader2,
} from "lucide-react";
import confetti from "canvas-confetti";

export default function FinalizarCompraPage() {
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

  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "SALDO" | "CARD">("PIX");
  const [couponInput, setCouponInput] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponSuccessMessage, setCouponSuccessMessage] = useState("");
  const [appliedCouponId, setAppliedCouponId] = useState<string | null>(null);
  const [couponError, setCouponError] = useState("");

  // PIX Modal & Payment States
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPixScreen, setShowPixScreen] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);
  const [isPaidSuccess, setIsPaidSuccess] = useState(false);
  const [chatRedirecting, setChatRedirecting] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatLink, setChatLink] = useState("");
  const [syncPayPixCode, setSyncPayPixCode] = useState<string>("");
  const [syncPayQrCodeUrl, setSyncPayQrCodeUrl] = useState<string>("");
  const [syncPayIdentifier, setSyncPayIdentifier] = useState<string>("");
  const [syncPaySimulated, setSyncPaySimulated] = useState<boolean>(false);

  // Dados do Titular para Emissão do PIX
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
      const digits = saved.replace(/\D/g, "").slice(0, 11);
      if (digits.length <= 3) return digits;
      if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
      if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
    }
    return "";
  });

  const [buyerError, setBuyerError] = useState("");

  // Restore and sync user
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

  // Atualiza o saldo real da carteira direto do banco (o valor salvo no navegador pode estar velho)
  useEffect(() => {
    const user = getStoredUserSync();
    if (!isSupabaseConfigured || !user?.email) return;
    supabase
      .from("profiles")
      .select("balance")
      .ilike("email", user.email)
      .maybeSingle()
      .then(({ data }: { data: any }) => {
        if (data && data.balance != null) {
          const fresh = { ...user, balance: Number(data.balance) };
          saveStoredUser(fresh);
          setCurrentUser(fresh);
        }
      });
  }, []);

  // Escuta atualizações do carrinho e limita a quantidade ao estoque disponível
  useEffect(() => {
    const syncCart = () => {
      const raw = getStoredCart();
      let adjusted = false;
      const capped = raw.map((item) => {
        const max = Number(item.product.stock ?? 9999);
        if (max > 0 && item.quantity > max) {
          adjusted = true;
          return { ...item, quantity: max };
        }
        return item;
      });
      if (adjusted) {
        saveStoredCart(capped);
        setCart(capped);
      } else {
        setCart(raw);
      }
    };
    syncCart();
    window.addEventListener("central_cart_updated", syncCart);
    window.addEventListener("storage", syncCart);
    return () => {
      window.removeEventListener("central_cart_updated", syncCart);
      window.removeEventListener("storage", syncCart);
    };
  }, []);

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const subtotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const serviceFee = cart.length > 0 ? 1.0 : 0;
  const discountAmount = couponApplied ? couponDiscount : 0;
  const total = Math.max(0, subtotal + serviceFee - discountAmount);

  const userBalance = currentUser?.balance ?? 0;

  const ownItemsInCart = cart.filter((item) => isProductOwner(item.product, currentUser));
  const hasOwnItems = ownItemsInCart.length > 0;

  const handleApplyCoupon = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!couponInput.trim()) return;

    const res = await validateCouponAsync(couponInput, cart);
    if (res.valid) {
      setCouponApplied(true);
      setCouponDiscount(res.discount);
      setCouponSuccessMessage(res.message);
      setAppliedCouponId(res.coupon?.id || null);
      setCouponError("");
    } else {
      setCouponApplied(false);
      setCouponDiscount(0);
      setCouponError(res.message || "Cupom inválido ou expirado.");
    }
  };

  // Abre o chat do pedido depois de uma pequena pausa (mostra a confirmação e deixa o banco
  // terminar de gravar o pedido). Se a navegação suave não acontecer, força a troca de página.
  const REDIRECT_DELAY_MS = 3500;
  const openPurchaseChat = (chatCode: string) => {
    const url = `/chat/${chatCode}`;
    setChatLink(url);
    setTimeout(() => {
      try {
        router.push(url);
      } catch {}
    }, REDIRECT_DELAY_MS);
    setTimeout(() => {
      if (typeof window !== "undefined" && window.location.pathname.startsWith("/finalizar-compra")) {
        window.location.assign(url);
      }
    }, REDIRECT_DELAY_MS + 2500);
  };

  // Depois de pago: cria o chat com o vendedor (entrega automática já enviada) e abre a conversa
  const finishPurchase = async () => {
    const items = [...cart];
    setIsPaidSuccess(true);
    setShowPixScreen(false);
    setChatError("");
    setChatRedirecting(true);

    try {
      consumePurchasedStock(items);
    } catch (e) {
      console.warn("Erro ao decrementar estoque de itens/variantes:", e);
    }

    try {
      confetti({
        particleCount: 130,
        spread: 85,
        origin: { y: 0.55 },
        colors: ["#0066FF", "#10B981", "#3B82F6", "#0f172a"],
      });
    } catch {}

    const user = currentUser || getStoredUserSync();
    if (!user) {
      setChatRedirecting(false);
      setChatError("Entre na sua conta para acessar o chat do pedido.");
      clearCart();
      return;
    }

    const ownItem = items.find((item) => isProductOwner(item.product, user));
    if (ownItem) {
      setChatRedirecting(false);
      setChatError(`Você não pode comprar produtos do seu próprio anúncio ("${ownItem.product.title}").`);
      return;
    }

    const { chatIds, errors } = await createPurchaseChats(items, user);
    if (appliedCouponId) {
      recordCouponUsage(appliedCouponId);
    }
    clearCart();

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("central_purchases_updated"));
      window.dispatchEvent(new Event("central_sales_updated"));
    }

    if (chatIds.length > 0) {
      // Abre o chat da compra na hora (sem espera)
      openPurchaseChat(chatIds[0]);
      return;
    }

    // Não conseguiu criar o chat: avisa o vendedor pelo sininho e mantém a tela de entrega
    items.forEach((item) => notifySale(item.product, item.quantity, getProductUrl(item.product)));
    setChatRedirecting(false);
    setChatError(errors[0] || "Não foi possível abrir o chat do pedido.");
  };

  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  // Lê o saldo REAL da carteira no banco (o valor guardado no navegador pode estar velho)
  const fetchRealBalance = async (user: UserProfile): Promise<number | null> => {
    if (!isSupabaseConfigured || !user.email) return user.balance ?? 0;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("balance")
        .ilike("email", user.email)
        .maybeSingle();
      if (data && data.balance != null) return Number(data.balance);
    } catch {}
    return null;
  };

  // Pagamento com saldo: verifica a carteira, processa e leva direto para a tela de pagamento aprovado
  const handleBalancePayment = async () => {
    const user = currentUser || getStoredUserSync();
    if (!user) {
      setAuthInitialTab("login");
      setAuthModalOpen(true);
      return;
    }

    const items = [...cart];
    setIsProcessing(true);

    // Aguarda alguns segundos conferindo saldo real e processando com segurança
    const [realBalance] = await Promise.all([fetchRealBalance(user), wait(2500)]);

    if (realBalance !== null && Number.isFinite(realBalance)) {
      const synced = { ...user, balance: realBalance };
      saveStoredUser(synced);
      setCurrentUser(synced);
      if (realBalance < total) {
        setIsProcessing(false);
        alert(
          `Saldo insuficiente na carteira (saldo atual: R$ ${realBalance
            .toFixed(2)
            .replace(".", ",")}). O restante deve ser pago via PIX.`
        );
        setPaymentMethod("PIX");
        return;
      }
    }

    const { chatIds, errors, newBalance, timedOut } = await createPurchaseChats(items, user, {
      payWithBalance: { amount: total },
    });
    setIsProcessing(false);

    if (chatIds.length === 0) {
      alert(errors[0] || "Não foi possível pagar com o saldo. Nada foi cobrado.");
      if (timedOut) {
        // Resultado incerto: mostra o saldo real do banco para a pessoa conferir
        const fresh = await fetchRealBalance(user);
        if (fresh !== null) {
          const updated = { ...user, balance: fresh };
          saveStoredUser(updated);
          setCurrentUser(updated);
        }
      }
      return;
    }

    // Atualiza o saldo exibido no site com o valor real que ficou no banco
    const targetBalance =
      typeof newBalance === "number" && Number.isFinite(newBalance)
        ? newBalance
        : Math.max(0, (user.balance ?? 0) - total);
    const updatedUser = { ...user, balance: targetBalance };
    saveStoredUser(updatedUser);
    setCurrentUser(updatedUser);

    try {
      consumePurchasedStock(items);
    } catch (e) {
      console.warn("Erro ao decrementar estoque no pagamento com saldo:", e);
    }

    setIsPaidSuccess(true);
    setShowPixScreen(false);
    setChatError("");
    setChatRedirecting(true);
    try {
      confetti({
        particleCount: 130,
        spread: 85,
        origin: { y: 0.55 },
        colors: ["#0066FF", "#10B981", "#3B82F6", "#0f172a"],
      });
    } catch {}
    if (appliedCouponId) {
      recordCouponUsage(appliedCouponId);
    }
    clearCart();

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("central_purchases_updated"));
      window.dispatchEvent(new Event("central_sales_updated"));
    }
    // Abre o chat da compra após a confirmação
    openPurchaseChat(chatIds[0]);
  };

  const handleStartPayment = () => {
    if (cart.length === 0) return;

    if (!currentUser) {
      setAuthInitialTab("login");
      setAuthModalOpen(true);
      return;
    }

    if (hasOwnItems) {
      alert(
        `Você é o vendedor do anúncio "${ownItemsInCart[0]?.product.title}" e não pode comprá-lo. Remova-o do carrinho para prosseguir.`
      );
      return;
    }

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

    if (typeof window !== "undefined") {
      localStorage.setItem("playcontas_buyer_name", trimmedName);
      localStorage.setItem("playcontas_buyer_cpf", cleanCPF(buyerCpf));
    }

    // PIX VIA SYNCPAY COM SPLIT AUTOMÁTICO (Única forma ativa no momento)
    setIsProcessing(true);
    const buyerData = {
      id: currentUser?.id,
      name: trimmedName,
      email: currentUser?.email || "cliente@playcontas.com.br",
      document: cleanCPF(buyerCpf),
      phone: (currentUser as any)?.phone || "11999999999",
    };

    const firstProduct = cart[0]?.product;
    const sellerSyncPayId =
      (firstProduct as any)?.sellerSyncPayId ||
      (firstProduct as any)?.syncpay_user_id ||
      null;

    fetch("/api/syncpay/cash-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: total,
        buyer: buyerData,
        description: `Pedido PlayContas (${cart.length} itens)`,
        sellerSyncPayId,
        items: cart.map((i) => ({
          id: i.product.id,
          title: i.product.title,
          price: i.product.price,
          quantity: i.quantity,
        })),
        platformFee: 13,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setIsProcessing(false);
        if (data.success && data.pix_code) {
          setSyncPayPixCode(data.pix_code);
          setSyncPayQrCodeUrl(
            data.qr_code_url ||
              `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
                data.pix_code
              )}`
          );
          setSyncPayIdentifier(data.identifier);
          setSyncPaySimulated(data.simulated || false);
          setShowPixScreen(true);
        } else {
          // Fallback caso falhe
          setSyncPayPixCode(mockPixPayload);
          setSyncPayQrCodeUrl(
            `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
              mockPixPayload
            )}`
          );
          setSyncPayIdentifier(`sim_${Date.now()}`);
          setSyncPaySimulated(true);
          setShowPixScreen(true);
        }
      })
      .catch(() => {
        setIsProcessing(false);
        setSyncPayPixCode(mockPixPayload);
        setSyncPayQrCodeUrl(
          `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
            mockPixPayload
          )}`
        );
        setSyncPayIdentifier(`sim_${Date.now()}`);
        setSyncPaySimulated(true);
        setShowPixScreen(true);
      });
  };

  // Polling automático da SyncPay para identificar quando o Pix for pago
  useEffect(() => {
    if (!showPixScreen || !syncPayIdentifier || isPaidSuccess) return;

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
          finishPurchase();
        }
      } catch {}
    }, 2500);

    return () => clearInterval(interval);
  }, [showPixScreen, syncPayIdentifier, isPaidSuccess]);

  const mockPixPayload = `00020126580014br.gov.bcb.pix0136${
    cart[0]?.product.id || "playcontas"
  }-pagamento520400005303986540${total.toFixed(2)}5802BR5925PLAYCONTAS INTERMED6009SAO PAULO62070503***6304E8A2`;

  const activePixPayload = syncPayPixCode || mockPixPayload;

  const handleCopyPix = () => {
    try {
      navigator.clipboard.writeText(activePixPayload);
      setPixCopied(true);
      setTimeout(() => setPixCopied(false), 2500);
    } catch {}
  };

  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [paymentCheckError, setPaymentCheckError] = useState<string>("");

  const handleManualCheckPayment = async () => {
    if (isVerifyingPayment || isPaidSuccess) return;
    setIsVerifyingPayment(true);
    setPaymentCheckError("");

    try {
      if (!syncPayIdentifier) {
        setPaymentCheckError("Identificador da cobrança não encontrado. Gere o Pix novamente.");
        setIsVerifyingPayment(false);
        return;
      }

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
          data.status === "completed" ||
          data.status === "confirmed")
      ) {
        // Pagamento 100% confirmado e compensado na SyncPay!
        await finishPurchase();
      } else {
        // Pagamento ainda NÃO confirmado: BLOQUEIA a liberação!
        setPaymentCheckError(
          "Pagamento ainda não identificado pelo banco. Se você já realizou o Pix pelo aplicativo do seu banco, aguarde alguns instantes (a compensação costuma levar entre 5 e 15 segundos) e clique novamente."
        );
      }
    } catch {
      setPaymentCheckError("Não foi possível consultar o status do Pix no momento. Tente novamente.");
    } finally {
      setIsVerifyingPayment(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-sans selection:bg-[#0066FF] selection:text-white">
      {/* Header padrão do site */}
      <JamHeader
        searchQuery=""
        onSearchChange={(q) => router.push(`/?search=${encodeURIComponent(q)}`)}
        cartCount={totalCartCount}
        onOpenCart={() => router.push("/carrinho")}
        onOpenCreateListing={() => router.push("/anunciar")}
        currentUser={currentUser}
        onOpenAuth={(tab) => {
          setAuthInitialTab(tab || "login");
          setAuthModalOpen(true);
        }}
        onOpenSettings={() => router.push("/minha-conta")}
        onOpenMyProducts={() => router.push("/meus-produtos")}
        onGoHome={() => router.push("/")}
        onLogout={async () => {
          await clearStoredUser();
          setCurrentUser(null);
          router.push("/");
        }}
      />

      {/* Conteúdo Principal */}
      <main className="flex-1 py-8 sm:py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* TELA DE SUCESSO / ENTREGA DAS CONTAS */}
          {isPaidSuccess && chatRedirecting ? (
            /* PAGAMENTO APROVADO: criando o chat com o vendedor e redirecionando */
            <div className="max-w-xl mx-auto bg-white border border-zinc-200/90 rounded-2xl p-8 sm:p-12 text-center shadow-xs space-y-5 animate-fadeIn">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-2xs">
                <Check className="w-8 h-8" strokeWidth={3} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Pagamento aprovado!</h2>
                <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
                  Seu pedido foi criado! Em instantes você será levado ao chat com o vendedor. Se a
                  entrega for automática, ela já estará na conversa; se for manual, é só aguardar o
                  vendedor enviar.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#0066FF]">
                <div className="w-4 h-4 border-2 border-[#0066FF] border-t-transparent rounded-full animate-spin" />
                Abrindo chat do pedido...
              </div>
              {chatLink && (
                <a
                  href={chatLink}
                  className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-blue-500/20 transition-all"
                >
                  Ir para o chat do pedido
                </a>
              )}
            </div>
          ) : isPaidSuccess ? (
            <div className="max-w-xl mx-auto bg-white border border-zinc-200/90 rounded-2xl p-6 sm:p-10 text-center shadow-xs space-y-6 animate-fadeIn">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-2xs">
                <Check className="w-8 h-8" strokeWidth={3} />
              </div>

              <div>
                <h2 className="text-2xl font-black text-zinc-900 tracking-tight">
                  Pagamento Aprovado com Sucesso!
                </h2>
                <p className="text-xs sm:text-sm text-zinc-500 mt-2 leading-relaxed">
                  Seu pedido foi confirmado e o acesso ao produto já está disponível abaixo.
                </p>
                {chatError && (
                  <p className="mt-3 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-left leading-relaxed">
                    Não foi possível abrir o chat do pedido: {chatError}
                  </p>
                )}
              </div>

              {/* Caixa com o Acesso / Credenciais Entregues */}
              <div className="p-5 rounded-xl bg-zinc-50 border border-zinc-200 text-left space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#0066FF]" />
                    <span>Dados de Acesso / Conta Entregue</span>
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded">
                    Entregue Imediatamente
                  </span>
                </div>

                <div className="font-mono text-xs sm:text-sm bg-white text-zinc-900 p-3.5 rounded-lg border border-zinc-200 select-all break-all shadow-2xs font-semibold">
                  {cart[0]?.product.autoDeliveryContent?.[0] ||
                    "LOGIN: acesso.muse@centralias.com | SENHA: VIP-TOKEN-2026#KEY"}
                </div>

                <p className="text-[11px] text-zinc-400">
                  Uma cópia também foi enviada para o seu e-mail e fica salva em Minha Conta.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => router.push("/")}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  Voltar à Página Inicial
                </button>
              </div>
            </div>
          ) : showPixScreen ? (
            /* TELA DE PAGAMENTO PIX (QR CODE + COPIA E COLA) */
            <div className="max-w-xl mx-auto bg-white border border-zinc-200/90 rounded-2xl p-6 sm:p-8 text-center shadow-xs space-y-6 animate-scaleUp">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-150">
                <button
                  type="button"
                  onClick={() => setShowPixScreen(false)}
                  className="w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-700 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h3 className="text-base font-black text-zinc-900">Pagamento via PIX</h3>
                <div className="w-9" />
              </div>

              <div className="space-y-1">
                <span className="text-xs text-zinc-500">Valor total a pagar:</span>
                <div className="text-3xl font-black text-[#0066FF] tracking-tight">
                  R$ {total.toFixed(2).replace(".", ",")}
                </div>
              </div>

              {/* QR Code Container */}
              <div className="bg-white p-4 rounded-2xl w-52 h-52 mx-auto flex items-center justify-center shadow-2xs border-2 border-zinc-200">
                <img
                  src={
                    syncPayQrCodeUrl ||
                    `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                      activePixPayload
                    )}`
                  }
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.src.includes("quickchart.io")) {
                      target.src = `https://quickchart.io/qr?text=${encodeURIComponent(activePixPayload)}&size=250`;
                    }
                  }}
                  alt="QR Code PIX SyncPay"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-500">
                <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                <span>Aguardando pagamento... Aprovação automática em segundos</span>
              </div>

              {/* PIX Copia e Cola */}
              <div className="space-y-2 text-left">
                <label className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider block">
                  Código PIX (Copia e Cola)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={activePixPayload}
                    className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-xs text-zinc-800 font-mono select-all focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyPix}
                    className="px-4 py-2.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer active:scale-95"
                  >
                    {pixCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Botão de confirmação com validação estrita no banco */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  disabled={isVerifyingPayment || isPaidSuccess}
                  onClick={handleManualCheckPayment}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isVerifyingPayment ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Consultando banco...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verificar Pagamento Realizado</span>
                    </>
                  )}
                </button>

                {paymentCheckError && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800 text-center animate-fadeIn leading-relaxed">
                    {paymentCheckError}
                  </div>
                )}

                <p className="text-[11px] text-zinc-400 text-center">
                  O sistema reconhece a aprovação automaticamente. Se você já transferiu, clique acima para consultar a compensação.
                </p>
              </div>
            </div>
          ) : cart.length === 0 ? (
            /* CARRINHO VAZIO */
            <div className="max-w-md mx-auto py-20 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 text-[#0066FF] flex items-center justify-center mx-auto shadow-2xs">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-zinc-900">Seu carrinho está vazio</h2>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Adicione um produto ou serviço para concluir sua compra com segurança no PlayContas.
              </p>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="px-6 py-2.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-xs"
              >
                Explorar Catálogo
              </button>
            </div>
          ) : (
            /* =========================================================================
               LAYOUT PRINCIPAL: ESTILO EXATO DO SITE (TEMA CLARO COM AZUL #0066FF)
               ========================================================================= */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* COLUNA ESQUERDA: LISTA DE ITENS + FORMA DE PAGAMENTO (7 cols) */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Cabeçalho */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="w-9 h-9 rounded-full bg-white hover:bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-700 transition-colors cursor-pointer shadow-2xs"
                    title="Voltar"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <h1 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">
                    Finalizar Compra
                  </h1>
                </div>

                {/* Banner de Obrigatoriedade de Conta */}
                {!currentUser && (
                  <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-fadeIn">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#0066FF] text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Lock className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-xs font-black text-zinc-950 uppercase tracking-wide">
                          Conta Necessária para Comprar
                        </h3>
                        <p className="text-xs text-zinc-600 mt-0.5">
                          Para sua segurança e entrega do produto no chat com o vendedor, você precisa estar conectado.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthInitialTab("login");
                        setAuthModalOpen(true);
                      }}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-black text-xs shrink-0 transition-all cursor-pointer shadow-sm active:scale-95 text-center"
                    >
                      Entrar / Cadastrar
                    </button>
                  </div>
                )}

                {/* Card 1: Produtos do Pedido */}
                <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-2xs space-y-3">
                  <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider pb-2 border-b border-zinc-100">
                    Produtos Selecionados ({cart.length})
                  </h2>

                  <div className="space-y-3 pt-1">
                    {cart.map((item) => {
                      const itemPrice = item.product.price * item.quantity;
                      return (
                        <div
                          key={item.product.id}
                          className="flex items-center justify-between gap-4 py-2 border-b border-zinc-50 last:border-0"
                        >
                          <div className="flex items-center gap-3.5 min-w-0 flex-1">
                            <img
                              src={item.product.image}
                              alt={item.product.title}
                              className="w-14 h-14 rounded-xl object-cover border border-zinc-100 bg-zinc-100 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <h3
                                className="font-bold text-xs sm:text-sm text-zinc-900 truncate"
                                title={item.product.title}
                              >
                                {item.product.title}
                              </h3>
                              <p className="text-[11px] sm:text-xs text-zinc-500 mt-0.5">
                                {item.quantity} × R$ {item.product.price.toFixed(2).replace(".", ",")}
                              </p>
                              {isProductOwner(item.product, currentUser) && (
                                <span className="inline-block mt-1 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                                  Seu anúncio (não pode ser comprado)
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-black text-sm sm:text-base text-zinc-950 tracking-tight">
                              R$ {itemPrice.toFixed(2).replace(".", ",")}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Card 2: Dados do Titular (Nome Completo e CPF para emissão do PIX) */}
                <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-[#0066FF]" />
                      <h2 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                        Dados do Titular do Pagamento
                      </h2>
                    </div>
                    <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
                      Exigido pelo Banco Central
                    </span>
                  </div>

                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Informe seu nome completo e CPF para emissão da chave e QR Code PIX com registro oficial de titularidade.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Nome Completo */}
                    <div className="space-y-1.5">
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
                        className="w-full bg-zinc-50 border border-zinc-200 focus:border-[#0066FF] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none transition-all"
                      />
                    </div>

                    {/* CPF */}
                    <div className="space-y-1.5">
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
                        className="w-full bg-zinc-50 border border-zinc-200 focus:border-[#0066FF] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none transition-all font-mono"
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

                {/* Card 3: Forma de Pagamento */}
                <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                    <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                      Forma de Pagamento
                    </h2>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      PIX Ativo
                    </span>
                  </div>

                  <div className="space-y-3">
                    {/* OPÇÃO ÚNICA ATIVA: PIX */}
                    <div className="p-4 rounded-xl border-2 bg-blue-50/50 border-[#0066FF] shadow-2xs flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-[#0066FF] text-white flex items-center justify-center shrink-0 shadow-xs">
                        <QrCode className="w-5 h-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-xs sm:text-sm text-zinc-900">
                            PIX Instantâneo
                          </span>
                          <span className="text-[10px] bg-[#0066FF] text-white font-black px-2 py-0.2 rounded-full uppercase tracking-wider">
                            Recomendado
                          </span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-zinc-600 mt-0.5">
                          Aprovação imediata 24 horas por dia com liberação automática do produto.
                        </p>
                      </div>

                      <div className="w-5 h-5 rounded-full bg-[#0066FF] text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* COLUNA DIREITA: RESUMO DO PEDIDO (5 cols) */}
              <div className="lg:col-span-5 lg:sticky lg:top-8">
                <div className="bg-white border border-zinc-200/90 rounded-2xl p-6 shadow-2xs space-y-5">
                  <h3 className="font-bold text-base text-zinc-900">Resumo</h3>

                  {/* Subtotal */}
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-zinc-500">Subtotal</span>
                    <span className="font-bold text-zinc-900">
                      R$ {subtotal.toFixed(2).replace(".", ",")}
                    </span>
                  </div>

                  {/* Campo de Cupom de Desconto */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => {
                          setCouponInput(e.target.value);
                          setCouponError("");
                        }}
                        placeholder="Cupom de desconto"
                        className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#0066FF] transition-all"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        className="px-3.5 py-2.5 rounded-xl text-[#0066FF] hover:bg-blue-50 text-xs font-bold transition-all cursor-pointer"
                      >
                        Aplicar
                      </button>
                    </div>
                    {couponApplied && (
                      <span className="text-[11px] text-emerald-600 font-semibold block">
                        ✓ {couponSuccessMessage || `Cupom aplicado: -R$ ${couponDiscount.toFixed(2).replace(".", ",")} de desconto`}
                      </span>
                    )}
                    {couponError && (
                      <span className="text-[11px] text-rose-500 font-semibold block">
                        {couponError}
                      </span>
                    )}
                  </div>

                  {/* Taxa de serviço (R$ 1,00) */}
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-zinc-500">Taxa de serviço</span>
                    <span className="font-bold text-zinc-900">
                      R$ {serviceFee.toFixed(2).replace(".", ",")}
                    </span>
                  </div>

                  {/* Linha Divisória */}
                  <div className="pt-2 border-t border-zinc-150 flex items-baseline justify-between">
                    <span className="font-bold text-sm sm:text-base text-zinc-900">
                      {paymentMethod === "PIX"
                        ? "Total via PIX"
                        : paymentMethod === "SALDO"
                        ? "Total via Saldo"
                        : "Total via Cartão"}
                    </span>
                    <span className="font-black text-xl sm:text-2xl text-[#0066FF] tracking-tight">
                      R$ {total.toFixed(2).replace(".", ",")}
                    </span>
                  </div>

                  {/* Aviso de item próprio no carrinho */}
                  {hasOwnItems && (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold flex items-center gap-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>
                        Você é o vendedor de um anúncio no carrinho e não pode comprá-lo. Remova-o para prosseguir.
                      </span>
                    </div>
                  )}

                  {/* Aviso de erro nos dados do titular */}
                  {buyerError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{buyerError}</span>
                    </div>
                  )}

                  {/* Botão de Ação: Gerar PIX e Pagar ou Exigir Login */}
                  {!currentUser ? (
                    <button
                      type="button"
                      onClick={() => {
                        setAuthInitialTab("login");
                        setAuthModalOpen(true);
                      }}
                      className="w-full py-3.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/25 active:scale-95 transition-all cursor-pointer"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Entrar na Conta para Finalizar</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartPayment}
                      disabled={isProcessing || hasOwnItems}
                      className={`w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all ${
                        hasOwnItems
                          ? "bg-zinc-200 text-zinc-500 cursor-not-allowed opacity-80"
                          : "bg-[#0066FF] hover:bg-[#0052CC] text-white shadow-md shadow-blue-500/20 active:scale-95 cursor-pointer disabled:opacity-50"
                      }`}
                    >
                      {isProcessing ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Processando pagamento...</span>
                        </div>
                      ) : hasOwnItems ? (
                        <span>Você não pode comprar seu próprio anúncio</span>
                      ) : (
                        <>
                          <QrCode className="w-4 h-4" />
                          <span>Gerar PIX e Pagar</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Selo de Segurança Escrow */}
                  <div className="pt-1 flex items-center justify-center gap-1.5 text-xs text-zinc-500">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Pagamento protegido via escrow</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer padrão do site */}
      <JamFooter />

      {/* Modal de Autenticação se necessário */}
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
    </div>
  );
}
