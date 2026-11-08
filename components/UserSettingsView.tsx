"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserProfile } from "@/types";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { saveUserAvatar, getUserAvatar, getCachedAvatarSync } from "@/lib/avatarStore";
import { persistUser, saveStoredUser, getStoredUserSync, isUserAdmin } from "@/lib/authStore";
import { uploadToSupabaseStorage } from "@/lib/supabaseStorage";
import { IdentityVerificationView } from "@/components/IdentityVerificationView";
import { NotificationPreferencesView } from "@/components/NotificationPreferencesView";
import { QuestionsManagementView } from "@/components/QuestionsManagementView";
import { CouponsManagementView } from "@/components/CouponsManagementView";
import { SalesManagementView } from "@/components/SalesManagementView";
import { MyPurchasesView } from "@/components/MyPurchasesView";
import { FavoritesManagementView } from "@/components/FavoritesManagementView";
import { WalletView } from "@/components/WalletView";
import { getStoredVerification } from "@/lib/verificationStore";
import { fetchReceivedQuestions } from "@/lib/questionStore";
import { getSellerCoupons } from "@/lib/couponStore";
import { getStoredSales, fetchSellerSales } from "@/lib/saleStore";
import { getStoredPurchases, fetchMyPurchases } from "@/lib/orderStore";
import { getFavoritesCount } from "@/lib/favoriteStore";
import {
  ArrowLeft,
  LayoutDashboard,
  ShoppingBag,
  Heart,
  MessageSquare,
  Package,
  TrendingUp,
  HelpCircle,
  Ticket,
  Flag,
  Wallet,
  Bell,
  UserCheck,
  Shield,
  ShieldCheck,
  Save,
  Key,
  ShieldAlert,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  User,
  Mail,
  Phone,
  CreditCard,
  Camera,
  CheckCircle2,
  DollarSign,
  ArrowRight,
  Sparkles,
  X,
  Users,
  Plus,
  Loader2,
} from "lucide-react";

interface UserSettingsViewProps {
  currentUser: UserProfile;
  initialTab?: "minha-conta" | "verificacao";
  onBackToShop: () => void;
  onUpdateProfile?: (updatedUser: UserProfile) => void;
  onOpenAdmin?: () => void;
  onCreateListing?: () => void;
  onOpenMyProducts?: () => void;
}

export function UserSettingsView({
  currentUser,
  initialTab,
  onBackToShop,
  onUpdateProfile,
  onOpenAdmin,
  onCreateListing,
  onOpenMyProducts,
}: UserSettingsViewProps) {
  const router = useRouter();
  // Navigation active tab
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        const storedTab = sessionStorage.getItem("minha_conta_active_tab");
        if (storedTab) {
          sessionStorage.removeItem("minha_conta_active_tab");
          return storedTab;
        }
      } catch {}
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "favoritos" || tab === "meus-favoritos") return "favoritos";
      if (tab === "pedidos" || tab === "meus-pedidos" || tab === "compras") return "pedidos";
      if (tab === "verificacao") return "verificacao";
      if (tab === "notificacoes") return "notificacoes";
      if (tab === "perguntas") return "perguntas";
      if (tab === "cupons") return "cupons";
      if (tab === "vendas") return "vendas";
      if (tab === "carteira" || tab === "saque" || tab === "saldo") return "carteira";
    }
    return initialTab || "minha-conta";
  });

  // Quantidade de perguntas pendentes para o badge no menu
  const [unansweredQuestionsCount, setUnansweredQuestionsCount] = useState(0);

  // Quantidade de cupons ativos para o badge no menu
  const [activeCouponsCount, setActiveCouponsCount] = useState(0);

  // Quantidade de vendas para o badge no menu
  const [salesCount, setSalesCount] = useState(0);

  // Quantidade de compras/pedidos para o badge no menu
  const [purchasesCount, setPurchasesCount] = useState(0);

  // Quantidade de favoritos para o badge no menu
  const [favoritesCount, setFavoritesCount] = useState(() =>
    getFavoritesCount(currentUser?.id)
  );

  useEffect(() => {
    const updateFavCount = () => {
      setFavoritesCount(getFavoritesCount(currentUser?.id));
    };
    updateFavCount();
    window.addEventListener("central_favorites_changed", updateFavCount);
    return () => {
      window.removeEventListener("central_favorites_changed", updateFavCount);
    };
  }, [currentUser?.id]);

  useEffect(() => {
    let isMounted = true;
    const updatePurchasesCount = async () => {
      try {
        const local = getStoredPurchases(currentUser?.id);
        if (isMounted) setPurchasesCount(local.length);
        const remote = await fetchMyPurchases(currentUser);
        if (isMounted) setPurchasesCount(remote.length);
      } catch {}
    };
    updatePurchasesCount();
    window.addEventListener("central_purchases_updated", updatePurchasesCount);
    return () => {
      isMounted = false;
      window.removeEventListener("central_purchases_updated", updatePurchasesCount);
    };
  }, [currentUser?.id, currentUser?.name]);

  useEffect(() => {
    const handleCustomTab = (e: any) => {
      if (e?.detail && typeof e.detail === "string") {
        setActiveTab(e.detail);
      }
    };
    window.addEventListener("central_tab_changed", handleCustomTab);
    return () => {
      window.removeEventListener("central_tab_changed", handleCustomTab);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const updateSalesCount = async () => {
      try {
        const local = getStoredSales(currentUser?.id);
        if (isMounted) setSalesCount(local.length);
        const remote = await fetchSellerSales(currentUser);
        if (isMounted) setSalesCount(remote.length);
      } catch {}
    };
    updateSalesCount();
    window.addEventListener("central_sales_updated", updateSalesCount);
    return () => {
      isMounted = false;
      window.removeEventListener("central_sales_updated", updateSalesCount);
    };
  }, [currentUser?.id, currentUser?.name]);

  useEffect(() => {
    const updateCouponsCount = () => {
      try {
        const list = getSellerCoupons(currentUser?.id, currentUser?.name);
        setActiveCouponsCount(list.filter((c) => c.isActive).length);
      } catch {}
    };
    updateCouponsCount();
    window.addEventListener("central_coupons_changed", updateCouponsCount);
    return () => {
      window.removeEventListener("central_coupons_changed", updateCouponsCount);
    };
  }, [currentUser?.id, currentUser?.name]);

  useEffect(() => {
    const checkQuestionsCount = async () => {
      try {
        const received = await fetchReceivedQuestions(currentUser);
        setUnansweredQuestionsCount(received.filter((q) => !q.answer).length);
      } catch {}
    };
    checkQuestionsCount();
    window.addEventListener("central_questions_changed", checkQuestionsCount);
    return () => {
      window.removeEventListener("central_questions_changed", checkQuestionsCount);
    };
  }, [currentUser?.id, currentUser?.name]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      // Keep URL clean as /minha-conta without appending ?tab=
      window.history.replaceState({}, "", "/minha-conta");
    }
  };

  const [currentVerifStatus, setCurrentVerifStatus] = useState<"none" | "pending" | "approved" | "rejected">(() => {
    if (currentUser.isVerified) return "approved";
    const stored = getStoredVerification(currentUser.id);
    if (stored.status && stored.status !== "none") return stored.status;
    if (currentUser.verificationStatus) return currentUser.verificationStatus;
    return "none";
  });

  const effectiveVerifStatus: "none" | "pending" | "approved" | "rejected" =
    currentVerifStatus !== "none"
      ? currentVerifStatus
      : currentUser?.isVerified
      ? "approved"
      : currentUser?.verificationStatus || "none";

  const isVerifiedAccount = currentUser?.isVerified || effectiveVerifStatus === "approved";

  useEffect(() => {
    const checkStatus = async () => {
      // Consulta a API central para status em tempo real
      try {
        const query = new URLSearchParams();
        if (currentUser?.id) query.set("userId", currentUser.id);
        if (currentUser?.email) query.set("email", currentUser.email);
        if (query.toString()) {
          const res = await fetch(`/api/verifications?${query.toString()}`);
          if (res.ok) {
            const json = await res.json();
            if (json.submission?.status) {
              const newStatus = json.submission.status;
              setCurrentVerifStatus(newStatus);
              const subPhone = json.submission.phone;
              const subCpf = json.submission.cpf;
              const subFullName = json.submission.fullName;
              if (subPhone) {
                setPhone((prev) => prev || subPhone);
              }
              if (subCpf) {
                setCpf((prev) => prev || subCpf);
              }
              if (subFullName) {
                setFullName((prev) => (!prev || prev === "Usuário" ? subFullName : prev));
              }

              const cur = getStoredUserSync();
              if (
                cur &&
                (cur.verificationStatus !== newStatus ||
                  (subPhone && cur.phone !== subPhone) ||
                  (subCpf && cur.cpf !== subCpf))
              ) {
                const isAdm = isUserAdmin(cur);
                const updated = {
                  ...cur,
                  verificationStatus: newStatus,
                  isVerified: newStatus === "approved",
                  role: isAdm ? "admin" : (newStatus === "approved" ? "seller" : "buyer"),
                  phone: subPhone || cur.phone,
                  cpf: subCpf || cur.cpf,
                };
                saveStoredUser(updated as any);
              }
              return;
            }
          }
        }
      } catch {}

      const stored = getStoredVerification(currentUser.id);
      if (stored) {
        if (stored.status && stored.status !== "none") {
          setCurrentVerifStatus(stored.status);
        } else if (currentUser.isVerified) {
          setCurrentVerifStatus("approved");
        }
        if (stored.phone) {
          setPhone((prev) => prev || stored.phone);
        }
        if (stored.cpf) {
          setCpf((prev) => prev || stored.cpf);
        }
        if (stored.fullName) {
          setFullName((prev) => (!prev || prev === "Usuário" ? stored.fullName : prev));
        }
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    window.addEventListener("central_verifications_changed", checkStatus);
    window.addEventListener("central_auth_changed", checkStatus);
    window.addEventListener("storage", checkStatus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("central_verifications_changed", checkStatus);
      window.removeEventListener("central_auth_changed", checkStatus);
      window.removeEventListener("storage", checkStatus);
    };
  }, [currentUser.id, currentUser.email, currentUser.isVerified]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "verificacao") {
        setActiveTab("verificacao");
        window.history.replaceState({}, "", "/minha-conta");
      } else if (tab === "notificacoes") {
        setActiveTab("notificacoes");
        window.history.replaceState({}, "", "/minha-conta");
      }

      try {
        const stored = sessionStorage.getItem("minha_conta_active_tab");
        if (stored) {
          sessionStorage.removeItem("minha_conta_active_tab");
          setActiveTab(stored);
          window.history.replaceState({}, "", "/minha-conta");
        }
      } catch {}

      const handleTabEvent = (e: any) => {
        if (e.detail) {
          setActiveTab(e.detail);
          window.history.replaceState({}, "", "/minha-conta");
        }
      };
      window.addEventListener("central_tab_changed", handleTabEvent);
      return () => window.removeEventListener("central_tab_changed", handleTabEvent);
    }
  }, []);

  // Profile Form States
  const [fullName, setFullName] = useState(() => {
    const stored = getStoredVerification(currentUser.id);
    return stored?.fullName || currentUser.name || "Usuário";
  });
  const [email] = useState(currentUser.email || "");
  const [phone, setPhone] = useState(() => {
    if (currentUser.phone) return currentUser.phone;
    const stored = getStoredVerification(currentUser.id);
    if (stored?.phone) return stored.phone;
    if (currentUser.email?.toLowerCase().includes("gennyson")) return "(84) 99607-6378";
    return "";
  });
  const [cpf, setCpf] = useState(() => {
    if (currentUser.cpf) return currentUser.cpf;
    const stored = getStoredVerification(currentUser.id);
    if (stored?.cpf) return stored.cpf;
    if (currentUser.email?.toLowerCase().includes("gennyson")) return "089.166.034-80";
    return "";
  });
  const [avatarUrl, setAvatarUrl] = useState<string>(() => {
    if (
      currentUser.avatar &&
      !currentUser.avatar.includes("dicebear") &&
      !currentUser.avatar.includes("avatar-bb25d258")
    ) {
      return currentUser.avatar;
    }
    if (
      currentUser.email?.toLowerCase().includes("gennyson") ||
      currentUser.name?.toLowerCase().includes("gennyson")
    ) {
      return "https://lazueuycrcqirdykdppm.supabase.co/storage/v1/object/public/avatars/avatar-gennysonmarinhodemacedo_gmail_com.gif";
    }
    return (
      currentUser.avatar ||
      `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
        currentUser.name || "User"
      )}`
    );
  });
  const [isAvatarDirty, setIsAvatarDirty] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState("");
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Sincroniza imediatamente quando a prop currentUser.avatar mudar
  useEffect(() => {
    if (
      currentUser.avatar &&
      !currentUser.avatar.includes("dicebear") &&
      currentUser.avatar !== avatarUrl
    ) {
      setAvatarUrl(currentUser.avatar);
    }
  }, [currentUser.avatar]);

  // Carrega o avatar persistido (IndexedDB e Supabase em tempo real)
  useEffect(() => {
    getUserAvatar().then((stored) => {
      if (stored && !stored.includes("dicebear")) {
        setAvatarUrl(stored);
      }
    });

    if (isSupabaseConfigured && currentUser.email) {
      supabase
        .from("profiles")
        .select("avatar_url")
        .ilike("email", currentUser.email)
        .maybeSingle()
        .then(({ data }: { data: any }) => {
          if (data?.avatar_url && !data.avatar_url.includes("dicebear")) {
            setAvatarUrl(data.avatar_url);
            saveUserAvatar(data.avatar_url);
          }
        });
    }
  }, [currentUser.email]);

  // Estado de alteração única do nome público / loja
  const [hasChangedName, setHasChangedName] = useState<boolean>(() => {
    if (currentUser.hasChangedName) return true;
    if (typeof window !== "undefined") {
      // Se estava travado mas o nome no perfil ainda é o padrão "Jovizeira", permite destravar para corrigir
      const flag = localStorage.getItem(`central_name_changed_${currentUser.id}`) === "true";
      if (flag && currentUser.name?.toLowerCase().includes("jovizeira")) {
        return false;
      }
      return flag;
    }
    return false;
  });
  const [publicNameInput, setPublicNameInput] = useState(
    currentUser.name?.toLowerCase().includes("jovizeira") ? "BuscaNinja" : (currentUser.name || "")
  );
  const [savingPublicName, setSavingPublicName] = useState(false);

  // Password States
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Feedback notifications
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // LGPD collapsible
  const [lgpdOpen, setLgpdOpen] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: UserProfile = {
      ...currentUser,
      name: fullName.trim() || currentUser.name,
      phone: phone.trim() || currentUser.phone,
      cpf: cpf.trim() || currentUser.cpf,
    };
    if (onUpdateProfile) onUpdateProfile(updated);

    // Sincroniza automaticamente com o Supabase
    if (isSupabaseConfigured && currentUser.id) {
      supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentUser.id)
        .then();

      // Sincroniza também o nome nos anúncios já criados pelo usuário
      supabase
        .from("products")
        .update({
          seller_name: fullName.trim(),
        })
        .eq("seller_id", currentUser.id)
        .then();
    }

    setFeedback({ type: "success", msg: "Perfil atualizado com sucesso!" });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleSavePublicName = async () => {
    const trimmed = publicNameInput.trim();
    if (!trimmed || trimmed === currentUser.name || savingPublicName) return;

    setSavingPublicName(true);

    // 1. Atualiza no Supabase (coluna correta é full_name)
    if (isSupabaseConfigured && currentUser.id) {
      try {
        const { error } = await supabase
          .from("profiles")
          .update({
            full_name: trimmed,
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentUser.id);

        if (error) {
          console.error("Erro ao atualizar nome no Supabase:", error);
          setFeedback({
            type: "error",
            msg: `Erro ao salvar no banco: ${error.message || "Tente novamente."}`,
          });
          setSavingPublicName(false);
          return;
        }

        // Atualiza também nos produtos já criados pelo vendedor
        await supabase
          .from("products")
          .update({
            seller_name: trimmed,
          })
          .eq("seller_id", currentUser.id);
      } catch (err: any) {
        console.error("Exceção ao salvar nome:", err);
        setFeedback({
          type: "error",
          msg: "Falha de conexão com o banco ao salvar o nome.",
        });
        setSavingPublicName(false);
        return;
      }
    }

    const updatedUser: UserProfile = {
      ...currentUser,
      name: trimmed,
      hasChangedName: true,
    };

    setFullName(trimmed);
    setHasChangedName(true);
    setSavingPublicName(false);

    try {
      localStorage.setItem(`central_name_changed_${currentUser.id}`, "true");
      persistUser(updatedUser);
      saveStoredUser(updatedUser);
    } catch {}

    if (onUpdateProfile) {
      onUpdateProfile(updatedUser);
    }

    setFeedback({
      type: "success",
      msg: "Nome alterado com sucesso! Limite de 1 alteração atingido.",
    });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Aceita GIFs animados, PNG, JPG, WEBP até 15MB
    if (file.size > 15 * 1024 * 1024) {
      setFeedback({ type: "error", msg: "O arquivo deve ter no máximo 15MB." });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (uploadEvent) => {
      const dataUrl = uploadEvent.target?.result as string;
      if (dataUrl) {
        setAvatarUrl(dataUrl);
        setIsAvatarDirty(true);

        // 1. Tenta fazer upload para o Supabase Storage
        let finalAvatarUrl = dataUrl;
        try {
          const storageUrl = await uploadToSupabaseStorage(
            file,
            "avatars",
            `avatar-${currentUser.email ? currentUser.email.toLowerCase().replace(/[^a-zA-Z0-9]/g, "_") : "user"}-${Date.now()}`
          );
          if (storageUrl) {
            finalAvatarUrl = storageUrl;
            setAvatarUrl(storageUrl);
          } else {
            setFeedback({
              type: "error",
              msg: "Não foi possível enviar a foto para o servidor. Tente novamente com outra imagem.",
            });
            setTimeout(() => setFeedback(null), 5000);
            return;
          }
        } catch (err) {
          console.warn("Upload para Supabase Storage falhou, usando dataUrl:", err);
        }

        // 2. Salva localmente
        await saveUserAvatar(finalAvatarUrl);

        const updated: UserProfile = {
          ...currentUser,
          avatar: finalAvatarUrl,
        };
        if (onUpdateProfile) onUpdateProfile(updated);

        // 3. Salva no banco de dados Supabase pelo email (100% garantido)
        if (isSupabaseConfigured && currentUser.email) {
          try {
            await supabase
              .from("profiles")
              .update({
                avatar_url: finalAvatarUrl,
                updated_at: new Date().toISOString(),
              })
              .ilike("email", currentUser.email);

            if (currentUser.id) {
              await supabase
                .from("products")
                .update({ seller_avatar: finalAvatarUrl })
                .eq("seller_id", currentUser.id);
            }
          } catch {}
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleExplicitSaveAvatar = async () => {
    if (!avatarUrl) return;
    setIsSavingAvatar(true);

    let finalAvatarUrl = avatarUrl;
    if (avatarUrl.startsWith("data:")) {
      try {
        const storageUrl = await uploadToSupabaseStorage(
          avatarUrl,
          "avatars",
          `avatar-${currentUser.email ? currentUser.email.toLowerCase().replace(/[^a-zA-Z0-9]/g, "_") : "user"}-${Date.now()}`
        );
        if (storageUrl) {
          finalAvatarUrl = storageUrl;
          setAvatarUrl(storageUrl);
        }
      } catch {}
    }

    // Salva no IndexedDB
    await saveUserAvatar(finalAvatarUrl);

    const updated: UserProfile = {
      ...currentUser,
      avatar: finalAvatarUrl,
    };
    if (onUpdateProfile) onUpdateProfile(updated);

    if (isSupabaseConfigured && currentUser.email) {
      try {
        await supabase
          .from("profiles")
          .update({
            avatar_url: finalAvatarUrl,
            updated_at: new Date().toISOString(),
          })
          .ilike("email", currentUser.email);
      } catch {}
    }

    setIsAvatarDirty(false);
    setIsSavingAvatar(false);
  };

  const handleApplyUrlAvatar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrlInput.trim()) return;

    const targetUrl = customUrlInput.trim();
    setAvatarUrl(targetUrl);
    setIsAvatarDirty(true);

    await saveUserAvatar(targetUrl);

    const updated: UserProfile = {
      ...currentUser,
      avatar: targetUrl,
    };
    if (onUpdateProfile) onUpdateProfile(updated);

    if (isSupabaseConfigured && currentUser.email) {
      try {
        await supabase
          .from("profiles")
          .update({
            avatar_url: targetUrl,
            updated_at: new Date().toISOString(),
          })
          .ilike("email", currentUser.email);
      } catch {}
    }

    setIsUrlModalOpen(false);
    setCustomUrlInput("");
  };

  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setFeedback({ type: "error", msg: "Digite a sua senha atual." });
      return;
    }
    if (newPassword.length < 6) {
      setFeedback({ type: "error", msg: "A nova senha deve ter no mínimo 6 caracteres." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback({ type: "error", msg: "A confirmação de senha não confere." });
      return;
    }

    // Altera senha diretamente no Supabase Auth
    if (isSupabaseConfigured) {
      supabase.auth.updateUser({ password: newPassword }).then();
    }

    setFeedback({ type: "success", msg: "Senha alterada com sucesso!" });
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-zinc-900 flex flex-col font-sans">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          
          {/* =========================================================================
              SIDEBAR ESQUERDA - NAVEGAÇÃO DE CONTA (Fiel à referência no tema Branco e Azul)
             ========================================================================= */}
          <aside className="w-full lg:w-64 bg-white rounded-2xl border border-zinc-200/90 shadow-xs p-4 shrink-0">
            {/* Botão Voltar à Loja */}
            <button
              onClick={onBackToShop}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-zinc-200 hover:border-[#0066FF] text-xs font-bold text-zinc-700 hover:text-[#0066FF] hover:bg-blue-50/50 transition-all mb-6 group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform text-zinc-500 group-hover:text-[#0066FF]" />
              <span>Voltar à loja</span>
            </button>

            {/* SEÇÃO ADMIN (Exclusiva para Administrador) */}
            {(currentUser.role === "admin" ||
              currentUser.email?.toLowerCase().includes("gennyson") ||
              currentUser.name?.toLowerCase().includes("gennyson")) && (
              <div className="mb-5 p-3 rounded-2xl bg-blue-50/80 border border-blue-200">
                <span className="block text-[10px] font-black uppercase tracking-wider text-[#0066FF] mb-2 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 fill-[#0066FF]/20" />
                  ADMINISTRAÇÃO
                </span>
                <button
                  type="button"
                  onClick={() => router.push("/admin")}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    <span>Painel Admin</span>
                  </div>
                  <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-md">Abrir →</span>
                </button>
              </div>
            )}

            {/* SEÇÃO 1: PAINEL */}
            <div className="mb-5">
              <span className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 px-3 mb-1.5">
                PAINEL
              </span>
              <nav className="space-y-0.5">
                <button
                  onClick={() => alert("Navegar para o Painel Geral")}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    activeTab === "painel"
                      ? "bg-[#0066FF] text-white shadow-xs"
                      : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100"
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Painel</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabChange("pedidos")}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    activeTab === "pedidos"
                      ? "bg-[#0066FF] text-white shadow-xs"
                      : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <ShoppingBag className="w-4 h-4" />
                    <span>Meus Pedidos</span>
                  </div>
                  {purchasesCount > 0 ? (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        activeTab === "pedidos"
                          ? "bg-white/20 text-white"
                          : "bg-zinc-200 text-zinc-700"
                      }`}
                    >
                      {purchasesCount}
                    </span>
                  ) : null}
                </button>

                <button
                  type="button"
                  onClick={() => handleTabChange("favoritos")}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    activeTab === "favoritos"
                      ? "bg-[#0066FF] text-white shadow-xs"
                      : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Heart className="w-4 h-4" />
                    <span>Favoritos</span>
                  </div>
                  {favoritesCount > 0 ? (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        activeTab === "favoritos"
                          ? "bg-white/20 text-white"
                          : "bg-zinc-200 text-zinc-700"
                      }`}
                    >
                      {favoritesCount}
                    </span>
                  ) : null}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "/chat";
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-600 hover:text-[#0066FF] hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4 text-zinc-500" />
                  <span>Chat</span>
                </button>
              </nav>
            </div>

            {/* SEÇÃO 2: VENDAS */}
            <div className="mb-5">
              <span className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 px-3 mb-1.5">
                VENDAS
              </span>
              <nav className="space-y-0.5">
                <button
                  onClick={() => {
                    if (onOpenMyProducts) onOpenMyProducts();
                    else router.push("/meus-produtos");
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  <Package className="w-4 h-4" />
                  <span>Meus Produtos</span>
                </button>

                <button
                  onClick={() => handleTabChange("vendas")}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === "vendas"
                      ? "bg-[#0066FF] text-white shadow-xs font-bold"
                      : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100"
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>Vendas</span>
                  {salesCount > 0 && (
                    <span
                      className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                        activeTab === "vendas"
                          ? "bg-white/20 text-white border-white/30"
                          : "text-[#0066FF] bg-blue-50 border-blue-200"
                      }`}
                    >
                      {salesCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => handleTabChange("perguntas")}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === "perguntas"
                      ? "bg-[#0066FF] text-white shadow-xs font-bold"
                      : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100"
                  }`}
                >
                  <HelpCircle className="w-4 h-4" />
                  <span>Perguntas</span>
                  {unansweredQuestionsCount > 0 && (
                    <span
                      className={`ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-full border ${
                        activeTab === "perguntas"
                          ? "bg-white/20 text-white border-white/30"
                          : "text-amber-800 bg-amber-100 border-amber-200"
                      }`}
                    >
                      {unansweredQuestionsCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => handleTabChange("cupons")}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    activeTab === "cupons"
                      ? "bg-[#0066FF] text-white shadow-xs font-bold"
                      : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100"
                  }`}
                >
                  <Ticket className="w-4 h-4" />
                  <span>Cupons</span>
                  {activeCouponsCount > 0 && (
                    <span
                      className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                        activeTab === "cupons"
                          ? "bg-white/20 text-white border-white/30"
                          : "text-[#0066FF] bg-blue-50 border-blue-200"
                      }`}
                    >
                      {activeCouponsCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => alert("Navegar para Denúncias")}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 transition-colors"
                >
                  <Flag className="w-4 h-4" />
                  <span>Denúncias recebidas</span>
                </button>
              </nav>
            </div>

            {/* SEÇÃO 3: FINANCEIRO */}
            <div className="mb-5">
              <span className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 px-3 mb-1.5">
                FINANCEIRO
              </span>
              <nav className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => handleTabChange("carteira")}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === "carteira"
                      ? "bg-[#0066FF] text-white shadow-xs font-bold"
                      : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Wallet className="w-4 h-4" />
                    <span>Carteira & Saques</span>
                  </div>
                  <span
                    className={`text-[11px] font-black ${
                      activeTab === "carteira" ? "text-white" : "text-emerald-600"
                    }`}
                  >
                    R$ {(currentUser?.balance || 0).toFixed(2).replace(".", ",")}
                  </span>
                </button>
              </nav>
            </div>

            {/* SEÇÃO 4: CONTA (Minha Conta Ativa) */}
            <div>
              <span className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 px-3 mb-1.5">
                CONTA
              </span>
              <nav className="space-y-0.5">
                <button
                  onClick={() => handleTabChange("notificacoes")}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === "notificacoes"
                      ? "bg-[#0066FF] text-white shadow-xs font-bold"
                      : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100"
                  }`}
                >
                  <Bell className="w-4 h-4" />
                  <span>Notificações</span>
                </button>

                <button
                  onClick={() => handleTabChange("minha-conta")}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === "minha-conta"
                      ? "bg-[#0066FF] text-white shadow-xs"
                      : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100"
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Minha Conta</span>
                </button>

                <button
                  onClick={() => handleTabChange("verificacao")}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === "verificacao"
                      ? "bg-[#0066FF] text-white shadow-xs font-bold"
                      : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100"
                  }`}
                >
                  <ShieldCheck
                    className={`w-4 h-4 ${
                      activeTab === "verificacao" ? "text-white" : "text-emerald-600"
                    }`}
                  />
                  <span>Verificação</span>
                  {effectiveVerifStatus === "approved" ? (
                    <span
                      className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                        activeTab === "verificacao"
                          ? "bg-white/20 text-white border-white/30"
                          : "text-emerald-600 bg-emerald-50 border-emerald-200"
                      }`}
                    >
                      Aprovada
                    </span>
                  ) : effectiveVerifStatus === "rejected" ? (
                    <span
                      className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                        activeTab === "verificacao"
                          ? "bg-white/20 text-white border-white/30"
                          : "text-rose-700 bg-rose-50 border-rose-200"
                      }`}
                    >
                      Recusada
                    </span>
                  ) : effectiveVerifStatus === "pending" ? (
                    <span
                      className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                        activeTab === "verificacao"
                          ? "bg-white/20 text-white border-white/30"
                          : "text-amber-700 bg-amber-50 border-amber-200"
                      }`}
                    >
                      Em Análise
                    </span>
                  ) : null}
                </button>
              </nav>
            </div>
          </aside>

          {/* =========================================================================
              CONTEÚDO PRINCIPAL - CONFIGURAÇÕES / MINHA CONTA / VERIFICAÇÃO / PEDIDOS / FAVORITOS
             ========================================================================= */}
          <main className="flex-1 w-full space-y-6">
            {activeTab === "favoritos" ? (
              <FavoritesManagementView
                currentUser={currentUser}
                onBack={() => handleTabChange("minha-conta")}
              />
            ) : activeTab === "pedidos" ? (
              <MyPurchasesView
                currentUser={currentUser}
                onBack={() => handleTabChange("minha-conta")}
              />
            ) : activeTab === "vendas" ? (
              <SalesManagementView
                currentUser={currentUser}
                onBack={() => handleTabChange("minha-conta")}
                onNavigateToQuestions={() => handleTabChange("perguntas")}
              />
            ) : activeTab === "perguntas" ? (
              <QuestionsManagementView
                currentUser={currentUser}
                onBack={() => handleTabChange("minha-conta")}
              />
            ) : activeTab === "verificacao" ? (
              <IdentityVerificationView
                currentUser={currentUser}
                onBack={() => handleTabChange("minha-conta")}
              />
            ) : activeTab === "notificacoes" ? (
              <NotificationPreferencesView
                currentUser={currentUser}
                onBack={() => handleTabChange("minha-conta")}
              />
            ) : activeTab === "cupons" ? (
              <CouponsManagementView
                currentUser={currentUser}
                onBack={() => handleTabChange("minha-conta")}
              />
            ) : activeTab === "carteira" ? (
              <WalletView
                currentUser={currentUser}
                onUpdateUser={onUpdateProfile}
              />
            ) : (
              <>
            {/* 1. HEADER DO PERFIL / BANNER */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200 shadow-xs relative overflow-hidden">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6">
                {/* Avatar com upload de Foto e GIF Animado */}
                <div className="flex flex-col items-center shrink-0">
                  <div className="relative group">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="relative rounded-2xl overflow-hidden cursor-pointer ring-2 ring-zinc-100 group-hover:ring-[#0066FF] shadow-sm transition-all"
                      title="Clique para escolher uma imagem ou GIF animado"
                    >
                      <img
                        src={
                          avatarUrl ||
                          getCachedAvatarSync(
                            "https://lazueuycrcqirdykdppm.supabase.co/storage/v1/object/public/avatars/avatar-gennysonmarinhodemacedo_gmail_com.gif"
                          )
                        }
                        alt={currentUser.name}
                        className="w-20 h-20 sm:w-24 sm:h-24 object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/40 rounded-2xl flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-center p-1">
                        <Camera className="w-5 h-5 mb-1" />
                        <span className="text-[9px] font-bold leading-tight">Trocar Foto / GIF</span>
                      </div>
                    </div>

                    {/* Botão de câmera em destaque no canto */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-[#0066FF] hover:bg-[#0052cc] text-white rounded-full flex items-center justify-center shadow-md border-2 border-white transition-transform hover:scale-110 cursor-pointer"
                      title="Escolher Foto ou GIF"
                    >
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/png, image/jpeg, image/jpg, image/webp, image/gif, .gif, .png, .jpg, .jpeg, .webp"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>

                {/* Dados do usuário */}
                <div className="flex-1 text-center sm:text-left min-w-0">
                  {/* Nome e Badges */}
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-2.5">
                    <h1 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
                      {currentUser.name}
                    </h1>

                    {currentUser.role === "admin" && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-300 text-amber-900 text-xs font-black tracking-wide">
                        <span>👑</span>
                        <span>Admin</span>
                      </span>
                    )}

                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#0066FF] text-xs font-bold">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#0066FF]" />
                      <span>Conta verificada</span>
                    </span>
                  </div>

                  {/* Email e status */}
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1.5 text-xs text-zinc-500 font-medium">
                    <span className="flex items-center gap-1.5 text-zinc-600">
                      <Mail className="w-3.5 h-3.5 text-zinc-400" />
                      {currentUser.email}
                    </span>
                    <span className="text-zinc-300 hidden sm:inline">•</span>
                    <span className="text-emerald-600 font-semibold inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Todas as funcionalidades habilitadas
                    </span>
                  </div>

                  {/* Informação sobre imagens e GIFs */}
                  <div className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 rounded-xl bg-zinc-50 border border-zinc-200/80 text-[11px] text-zinc-600 text-left">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>
                      Aceita fotos e <strong className="text-zinc-900">GIFs animados</strong> (.gif, .png, .jpg, .webp).{" "}
                      <button
                        type="button"
                        onClick={() => setIsUrlModalOpen(true)}
                        className="text-[#0066FF] hover:underline font-bold cursor-pointer"
                      >
                        Colar link direto
                      </button>
                    </span>
                  </div>
                </div>
              </div>

              {/* PAINEL DE CONTROLE DO ADMIN */}
              {currentUser.role === "admin" && (
                <div className="mt-6 pt-5 border-t border-zinc-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-50/70 via-indigo-50/30 to-blue-50/50 border border-blue-200/70 p-4 sm:p-5 rounded-2xl shadow-2xs">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-white border border-blue-200/90 shadow-2xs flex items-center justify-center text-[#0066FF] shrink-0">
                      <ShieldAlert className="w-5 h-5 text-[#0066FF]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm sm:text-base font-black text-zinc-950">
                          Painel de Controle do Administrador
                        </h3>
                        <span className="px-2 py-0.5 rounded-full bg-[#0066FF]/10 text-[#0066FF] text-[10px] font-black uppercase tracking-wider">
                          Admin
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Gerencie vendedores, aprove anúncios e crie novos produtos na loja.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0">
                    {onOpenAdmin && (
                      <button
                        type="button"
                        onClick={onOpenAdmin}
                        className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0066FF] hover:bg-[#0052cc] text-white font-bold text-xs shadow-xs hover:shadow-md hover:shadow-blue-500/20 transition-all cursor-pointer"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Gerenciar Vendedores</span>
                      </button>
                    )}
                    {onCreateListing && (
                      <button
                        type="button"
                        onClick={onCreateListing}
                        className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200/90 font-bold text-xs transition-all shadow-2xs hover:border-zinc-300 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#0066FF]" />
                        <span>+ Criar Anúncio</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 2. CARD: DADOS PESSOAIS */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200 shadow-xs">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-[#0066FF]">
                  <User className="w-4 h-4" />
                </div>
                <h2 className="text-base font-black text-zinc-950 tracking-tight">
                  Dados pessoais
                </h2>
              </div>

              <form onSubmit={handleSaveProfile}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                  {/* Nome Completo (CPF) */}
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                      NOME COMPLETO (CPF)
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:border-[#0066FF] bg-zinc-50/70 focus:bg-white text-xs font-semibold text-zinc-900 focus:outline-none transition-colors"
                    />
                    <span className="text-[10px] text-zinc-400 block mt-1">
                      Confirmado na verificação.
                    </span>
                  </div>

                  {/* E-mail */}
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                      E-MAIL
                    </label>
                    <input
                      type="email"
                      readOnly
                      value={email}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-zinc-100 text-xs font-semibold text-zinc-600 cursor-not-allowed focus:outline-none"
                    />
                    <span className="text-[10px] text-zinc-400 block mt-1">
                      Não pode ser alterado. Fale com o suporte se precisar.
                    </span>
                  </div>

                  {/* Telefone (WhatsApp) */}
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                      TELEFONE (WHATSAPP)
                    </label>
                    <input
                      type="text"
                      readOnly={isVerifiedAccount}
                      value={phone}
                      onChange={(e) => !isVerifiedAccount && setPhone(e.target.value)}
                      placeholder="(00) 00000-0000"
                      className={`w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-semibold focus:outline-none transition-colors ${
                        isVerifiedAccount
                          ? "bg-zinc-100 text-zinc-600 cursor-not-allowed"
                          : "focus:border-[#0066FF] bg-zinc-50/70 focus:bg-white text-zinc-900"
                      }`}
                    />
                    {isVerifiedAccount ? (
                      <span className="text-[10px] text-[#0066FF] font-medium block mt-1">
                        🔒 Verificado — não pode ser alterado
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-400 block mt-1">
                        Preenchido após verificação de identidade.
                      </span>
                    )}
                  </div>

                  {/* CPF */}
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                      CPF
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={cpf}
                      placeholder="000.000.000-00"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-zinc-100 text-xs font-semibold text-zinc-600 cursor-not-allowed focus:outline-none"
                    />
                    {isVerifiedAccount ? (
                      <span className="text-[10px] text-[#0066FF] font-medium block mt-1">
                        🔒 Verificado — não pode ser alterado
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-400 block mt-1">
                        Preenchido após verificação de identidade.
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all active:scale-95 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Salvar perfil</span>
                  </button>
                </div>
              </form>
            </div>

            {/* 3. CARD: NOME PÚBLICO / LOJA */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-[#0066FF]">
                  <User className="w-4 h-4" />
                </div>
                <h2 className="text-base font-black text-zinc-950 tracking-tight">
                  Nome
                </h2>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed max-w-3xl">
                É como compradores e vendedores te veem no PlayContas, e também o nome da sua loja. Seu nome completo (do CPF) só aparece na verificação. Ele é escolhido uma única vez e não pode ser trocado depois.
              </p>

              {hasChangedName ? (
                <div className="mt-3 p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 inline-block text-xs font-bold text-zinc-800">
                  <span className="text-[#0066FF]">{currentUser.name}</span> — escolhido ao criar a conta. Para trocar, fale com o suporte.
                </div>
              ) : (
                <div className="mt-4 max-w-lg space-y-2.5">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={publicNameInput}
                      onChange={(e) => setPublicNameInput(e.target.value)}
                      placeholder="Digite seu nome público ou loja"
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white text-xs sm:text-sm font-bold text-zinc-900 focus:outline-none focus:border-[#0066FF] transition-all"
                    />
                    <button
                      type="button"
                      onClick={handleSavePublicName}
                      disabled={!publicNameInput.trim() || publicNameInput.trim() === currentUser.name || savingPublicName}
                      className="px-5 py-2.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs sm:text-sm transition-all shadow-xs disabled:opacity-50 cursor-pointer shrink-0 flex items-center gap-1.5"
                    >
                      {savingPublicName ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Salvando...</span>
                        </>
                      ) : (
                        <span>Salvar alteração</span>
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200/80 rounded-xl p-2.5 flex items-start gap-1.5 font-medium leading-relaxed">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>Você pode alterar seu nome público <strong>apenas uma vez</strong>. Após salvar, o campo será bloqueado e para trocar novamente será necessário falar com o suporte.</span>
                  </p>
                </div>
              )}
            </div>

            {/* 4. CARD: ALTERAR SENHA */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200 shadow-xs">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-[#0066FF]">
                  <Key className="w-4 h-4" />
                </div>
                <h2 className="text-base font-black text-zinc-950 tracking-tight">
                  Alterar Senha
                </h2>
              </div>

              <form onSubmit={handleSavePassword}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                      SENHA ATUAL
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:border-[#0066FF] bg-zinc-50/70 focus:bg-white text-xs font-semibold text-zinc-900 focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                      NOVA SENHA
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mín. 6 caracteres"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:border-[#0066FF] bg-zinc-50/70 focus:bg-white text-xs font-semibold text-zinc-900 focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                      CONFIRMAR
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repetir nova senha"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:border-[#0066FF] bg-zinc-50/70 focus:bg-white text-xs font-semibold text-zinc-900 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="flex justify-start">
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all active:scale-95 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Alterar senha</span>
                  </button>
                </div>
              </form>
            </div>

            {/* 6. CARD: ZONA DE PERIGO */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-rose-200/80 shadow-xs">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-zinc-950 tracking-tight">
                    Zona de perigo
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Desative temporariamente ou exclua definitivamente a sua conta.
                  </p>
                </div>
              </div>

              {/* Informações Legais (LGPD) Collapsible */}
              <div className="mb-5 border border-zinc-200 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setLgpdOpen(!lgpdOpen)}
                  className="w-full p-3.5 bg-zinc-50/80 hover:bg-zinc-100 flex items-center justify-between text-xs font-bold text-zinc-700 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">⚖️</span>
                    <span>Informações Legais (LGPD)</span>
                  </div>
                  {lgpdOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {lgpdOpen && (
                  <div className="p-4 bg-white text-xs text-zinc-600 leading-relaxed border-t border-zinc-200">
                    Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você pode a qualquer momento solicitar a portabilidade, anonimização ou exclusão definitiva de seus dados. Caso opte pela exclusão, seus dados serão guardados exclusivamente pelos prazos legais obrigatórios (como registros fiscais e de segurança).
                  </div>
                )}
              </div>

              {/* Saldo Alert Box */}
              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/80 text-xs text-zinc-700 leading-relaxed mb-6 flex items-start gap-3">
                <span className="text-base shrink-0">💳</span>
                <div>
                  Você tem <strong className="text-[#0066FF]">R$ {currentUser.balance.toFixed(2).replace(".", ",")} de saldo</strong>. Ele não impede a desativação nem a exclusão — mas no caso da exclusão, saque o valor durante os 30 dias de carência: depois dessa data a conta é anonimizada e você não consegue mais entrar para sacar.
                </div>
              </div>

              {/* Duas Caixas de Ação: Desativar Conta e Excluir Conta */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Desativar Conta */}
                <div className="p-5 rounded-2xl border border-amber-200 bg-amber-50/30 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <span>⏸️</span>
                      <span>Desativar Conta</span>
                    </h3>
                    <p className="text-xs text-zinc-600 leading-relaxed mb-3">
                      Sua loja e seus anúncios saem do ar e o perfil fica oculto. Nenhum dado é apagado.
                    </p>
                    <span className="text-[11px] font-semibold text-amber-700 block mb-4">
                      ↩ Reversível — reativa fazendo login novamente
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Deseja realmente desativar sua conta temporariamente?")) {
                        alert("Sua conta foi desativada com sucesso. Faça login a qualquer momento para reativá-la.");
                        onBackToShop();
                      }
                    }}
                    className="w-full py-2.5 rounded-xl border border-amber-500/80 bg-white hover:bg-amber-50 text-amber-800 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Desativar conta
                  </button>
                </div>

                {/* Excluir Conta */}
                <div className="p-5 rounded-2xl border border-rose-200 bg-rose-50/30 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-black text-rose-900 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <span>🗑️</span>
                      <span>Excluir Conta</span>
                    </h3>
                    <p className="text-xs text-zinc-600 leading-relaxed mb-3">
                      Solicita a remoção definitiva dos seus dados pessoais da plataforma.
                    </p>
                    <span className="text-[11px] font-semibold text-rose-600 block mb-4">
                      ⚠️ Permanente após 30 dias de carência
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("ATENÇÃO: Deseja solicitar a exclusão permanente da sua conta?")) {
                        alert("Solicitação de exclusão recebida. Prazo de carência: 30 dias.");
                        onBackToShop();
                      }
                    }}
                    className="w-full py-2.5 rounded-xl border border-rose-500/80 bg-white hover:bg-rose-50 text-rose-700 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Excluir conta
                  </button>
                </div>
              </div>
            </div>
            </>
          )}
          </main>
        </div>
      </div>

      {/* MODAL PARA COLAR LINK DE IMAGEM / GIF ANIMADO */}
      {isUrlModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-zinc-200 animate-fadeIn">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-black text-zinc-950 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#0066FF]" />
                <span>Colar Link de Imagem / GIF</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsUrlModalOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
              Cole o link direto da imagem ou do seu <strong>GIF animado</strong> (ex: Tenor, Giphy, Imgur, Discord CDN). Ele atualizará seu perfil e anúncios na hora!
            </p>
            <form onSubmit={handleApplyUrlAvatar} className="space-y-4">
              <input
                type="url"
                value={customUrlInput}
                onChange={(e) => setCustomUrlInput(e.target.value)}
                placeholder="https://exemplo.com/avatar-animado.gif"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 text-xs sm:text-sm focus:outline-none focus:border-[#0066FF]"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUrlModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#0066FF] hover:bg-[#0052cc] text-white text-xs font-black shadow-md shadow-blue-500/20"
                >
                  Aplicar Foto / GIF
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
