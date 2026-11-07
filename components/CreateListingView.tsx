"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Product, ProductVariant } from "@/types";
import { ALL_CATEGORIES } from "@/lib/categories";
import { getProductUrl } from "@/lib/slug";
import { optimizeImageFile } from "@/lib/imageOptimizer";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  Search,
  Zap,
  ShieldCheck,
  Gamepad2,
  Sparkles,
  Layers,
  Repeat,
  Package,
  Key,
  PlayCircle,
  Clock,
  Plus,
  Trash2,
  Upload,
  Image as ImageIcon,
  FileText,
  Lock,
  Truck,
  AlertTriangle,
  Info,
  DollarSign,
  HelpCircle,
  ChevronDown,
} from "lucide-react";
import confetti from "canvas-confetti";
import { getNextAdCode, registerProductAdCode } from "@/lib/adCode";
import { splitCredentialBlocks } from "@/lib/productVault";
import { VariantStockSection, VariantStockItem } from "./VariantStockSection";

export interface VariantItem {
  id: string;
  name: string;
  price: string;
  stock: string;
  credentials?: string;
  separator?: string;
}

interface CreateListingViewProps {
  onBack: () => void;
  onListingCreated: (product: Product) => void;
  onViewProduct?: (product: Product) => void;
}

export function CreateListingView({
  onBack,
  onListingCreated,
  onViewProduct,
}: CreateListingViewProps) {
  const router = useRouter();
  // Step tracker: 1 (Tipo), 2 (Detalhes), 3 (Entrega), 4 (Concluído)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [publishedAdCode, setPublishedAdCode] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState(0);
  const [publishStepText, setPublishStepText] = useState("");
  const [lastCreatedProduct, setLastCreatedProduct] = useState<Product | null>(null);

  // Step 1: Category & Types
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryTab, setCategoryTab] = useState<"TODOS" | "POPULARES" | "SERVICOS">("TODOS");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categoryError, setCategoryError] = useState(false);
  const [announcementType, setAnnouncementType] = useState<"CONTA" | "ITEM">("CONTA");
  const [listingType, setListingType] = useState<"UNICA" | "MULTIPLA">("UNICA");

  const handleProceedToStep2 = () => {
    if (!selectedCategory || !selectedCategory.trim()) {
      setCategoryError(true);
      const el = document.getElementById("categoria-step-1");
      el?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    setCategoryError(false);
    setCurrentStep(2);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Step 2: Details
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step2Errors, setStep2Errors] = useState<{
    title?: boolean;
    description?: boolean;
    image?: boolean;
  }>({});

  const isStep2Valid = Boolean(
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    uploadedImages.length > 0
  );

  const handleProceedToStep3 = () => {
    const errors: { title?: boolean; description?: boolean; image?: boolean } = {};
    if (!title.trim()) errors.title = true;
    if (!description.trim()) errors.description = true;
    if (uploadedImages.length === 0) errors.image = true;

    if (Object.keys(errors).length > 0) {
      setStep2Errors(errors);
      if (errors.title) {
        document.getElementById("step2-title-container")?.scrollIntoView({ behavior: "smooth" });
      } else if (errors.description) {
        document.getElementById("step2-description-container")?.scrollIntoView({ behavior: "smooth" });
      } else if (errors.image) {
        document.getElementById("step2-image-container")?.scrollIntoView({ behavior: "smooth" });
      }
      return;
    }

    setStep2Errors({});
    setCurrentStep(3);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const [variants, setVariants] = useState<VariantItem[]>([
    { id: "v-1", name: "Padrão", price: "29,90", stock: "0", credentials: "" },
  ]);

  // Step 3: Delivery
  const [accountOrigin, setAccountOrigin] = useState<"CRIADOR" | "REVENDA">("CRIADOR");
  const [isAutomaticDelivery, setIsAutomaticDelivery] = useState(true);
  const [stockLines, setStockLines] = useState("");
  const [warrantyDays, setWarrantyDays] = useState(30);
  const [credentialSeparator, setCredentialSeparator] = useState("--");
  const credentialsRef = useRef<HTMLTextAreaElement>(null);

  const countStockItems = () => {
    if (!stockLines.trim()) return 0;
    if (credentialSeparator === "\\n\\n") {
      return stockLines.split(/\n\s*\n+/).filter((b) => b.trim().length > 0).length;
    }
    if (stockLines.includes(credentialSeparator)) {
      return stockLines.split(credentialSeparator).filter((b) => b.trim().length > 0).length;
    }
    return stockLines.split("\n").filter((b) => b.trim().length > 0).length;
  };

  const handleInsertSeparator = () => {
    const textarea = credentialsRef.current;
    const sepText = credentialSeparator === "\\n\\n" ? "\n\n" : `\n${credentialSeparator}\n`;
    if (!textarea) {
      setStockLines((prev) => (prev ? `${prev}${sepText}` : sepText));
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentWindowScroll = typeof window !== "undefined" ? window.scrollY : 0;
    const next = stockLines.substring(0, start) + sepText + stockLines.substring(end);
    setStockLines(next);

    requestAnimationFrame(() => {
      if (credentialsRef.current) {
        credentialsRef.current.focus({ preventScroll: true });
        const pos = start + sepText.length;
        credentialsRef.current.setSelectionRange(pos, pos);
        if (typeof window !== "undefined") {
          window.scrollTo({ top: currentWindowScroll, behavior: "instant" as ScrollBehavior });
        }
      }
    });
  };

  const filteredCategories = ALL_CATEGORIES.filter((c) => {
    if (categoryTab === "POPULARES" && !c.popular) return false;
    if (categoryTab === "SERVICOS" && c.group !== "Serviços & Softwares") return false;
    if (categorySearch.trim()) {
      return c.name.toLowerCase().includes(categorySearch.toLowerCase());
    }
    return true;
  });

  // Variant handlers
  const handleAddVariant = () => {
    if (variants.length >= 50) return;
    setVariants([
      ...variants,
      {
        id: `v-${Date.now()}`,
        name: "",
        price: "29,90",
        stock: "0",
        credentials: "",
      },
    ]);
  };

  const handleRemoveVariant = (id: string) => {
    if (variants.length <= 1) return;
    setVariants(variants.filter((v) => v.id !== id));
  };

  const handleUpdateVariant = (id: string, field: keyof VariantItem, value: string) => {
    setVariants(
      variants.map((v) => (v.id === id ? { ...v, [field]: value } : v))
    );
  };

  const handleUpdateFullVariant = (id: string, updates: Partial<VariantItem>) => {
    setVariants((prev) =>
      prev.map((v) => (v.id === id ? { ...v, ...updates } : v))
    );
  };

  // Real File Upload Handlers com Otimização Automática WebP (apenas 1 imagem)
  const processFiles = (files: FileList | File[]) => {
    if (uploadedImages.length >= 1) return;
    const file = Array.from(files)[0];
    if (!file || !file.type.startsWith("image/")) return;
    optimizeImageFile(file).then((optimized) => {
      if (optimized) {
        setUploadedImages([optimized]);
        setStep2Errors((prev) => ({ ...prev, image: false }));
      }
    });
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  // Paste from clipboard (Ctrl + V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (currentStep !== 2) return;
      if (uploadedImages.length >= 1) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            processFiles([file]);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [currentStep, uploadedImages]);

  const sampleImagePresets = [
    { label: "ChatGPT / OpenAI", url: "/categorias/gpt.webp" },
    { label: "Claude", url: "/categorias/claude.webp" },
    { label: "Steam", url: "/categorias/steam.webp" },
    { label: "Minecraft", url: "/categorias/minecraft.webp" },
  ];

  const submittedRef = useRef(false);

  const handleFinishListing = () => {
    if (submittedRef.current) return; // evita publicar duas vezes com cliques repetidos
    if (!selectedCategory || !selectedCategory.trim()) {
      handleProceedToStep2();
      return;
    }
    if (!title.trim() || !description.trim() || uploadedImages.length === 0) {
      handleProceedToStep3();
      return;
    }
    submittedRef.current = true;
    const lines =
      credentialSeparator === "\\n\\n"
        ? stockLines.split(/\n\s*\n+/).map((l) => l.trim()).filter((l) => l.length > 0)
        : stockLines.includes(credentialSeparator)
        ? stockLines.split(credentialSeparator)
            .map((l) => l.trim())
            .filter((l) => l.length > 0)
        : stockLines.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

    const isMultiple = listingType === "MULTIPLA" || variants.length > 1;
    const mappedVariants: ProductVariant[] = variants.map((v, idx) => {
      const p = parseFloat(v.price.replace(",", ".")) || 29.9;
      const vCreds = (v.credentials || "").trim();
      const sep = v.separator || credentialSeparator || "--";
      let countFromCreds = 0;
      if (vCreds) {
        if (sep === "\\n\\n") {
          countFromCreds = vCreds.split(/\n\s*\n+/).filter((b) => b.trim().length > 0).length;
        } else if (vCreds.includes(sep)) {
          countFromCreds = vCreds.split(sep).filter((b) => b.trim().length > 0).length;
        } else {
          countFromCreds = vCreds.split("\n").filter((b) => b.trim().length > 0).length;
        }
      }
      const s = isAutomaticDelivery && vCreds ? countFromCreds : (parseInt(v.stock) || 0);

      return {
        id: v.id || `var-${Date.now()}-${idx}`,
        name: v.name.trim() || `Opção ${idx + 1}`,
        price: p,
        stock: s,
        originalPrice: Number((p * 1.6).toFixed(2)),
        credentials: vCreds || undefined,
      };
    });

    const firstPrice =
      isMultiple && mappedVariants.length > 0
        ? mappedVariants[0].price
        : parseFloat(variants[0].price.replace(",", ".")) || 29.9;

    const totalVariantStock = isMultiple
      ? mappedVariants.reduce((sum, v) => sum + v.stock, 0)
      : parseInt(variants[0].stock) || 1;

    // Anúncio único: as contas digitadas no card de estoque ficam em variants[0].credentials
    const singleItems = !isMultiple
      ? splitCredentialBlocks(variants[0]?.credentials, variants[0]?.separator || credentialSeparator || "--")
      : [];

    // Coleta todas as linhas de entrega automática das variantes
    let allDeliveryLines = singleItems.length > 0 ? singleItems : lines;
    if (isMultiple && isAutomaticDelivery) {
      const varLines: string[] = [];
      mappedVariants.forEach((mv) => {
        if (mv.credentials) {
          const blocks = mv.credentials
            .split(/\n\s*--+\s*\n|\n\s*\n+/)
            .map((b) => b.trim())
            .filter(Boolean);
          if (blocks.length > 0) varLines.push(...blocks);
          else varLines.push(mv.credentials);
        }
      });
      if (varLines.length > 0) allDeliveryLines = varLines;
    }

    const finalImage =
      uploadedImages.length > 0
        ? uploadedImages[0]
        : sampleImagePresets[0].url;

    const newId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `prod-${Date.now()}`;
    const newAdCode = getNextAdCode();
    registerProductAdCode(newId, newAdCode);
    setPublishedAdCode(newAdCode);

    const newProd: Product = {
      id: newId,
      adCode: newAdCode,
      title: title || (selectedCategory ? `Pacote ${selectedCategory} Especial` : "Pacote Digital Especial"),
      description:
        description ||
        "Conta / Licença verificada com garantia total e suporte exclusivo.",
      category: selectedCategory || "Assinaturas Premium",
      price: firstPrice,
      originalPrice: Number((firstPrice * 1.6).toFixed(2)),
      image: finalImage,
      deliveryType: isAutomaticDelivery ? "AUTOMATIC" : "MANUAL",
      autoDeliveryContent:
        allDeliveryLines.length > 0 ? allDeliveryLines : undefined,
      stock:
        isMultiple
          ? totalVariantStock
          : isAutomaticDelivery && allDeliveryLines.length > 0
          ? allDeliveryLines.length
          : totalVariantStock,
      featured: true,
      popular: true,
      salesCount: 0,
      tags: [
        selectedCategory,
        announcementType === "CONTA" ? "Conta" : "Item",
        accountOrigin === "CRIADOR" ? "Dono Original" : "Revenda",
      ],
      warrantyDays: warrantyDays,
      createdAt: new Date().toISOString().split("T")[0],
      status: "pending_review",
      listingType: listingType,
      hasVariations: isMultiple,
      variants: isMultiple ? mappedVariants : undefined,
      // Contas por grupo (variação ou anúncio único). Vão para o cofre protegido do banco; nunca para a tabela pública.
      vaultGroups: isAutomaticDelivery
        ? isMultiple
          ? [
              ...mappedVariants.map((mv, idx) => ({
                variantId: mv.id as string | null,
                items: splitCredentialBlocks(
                  variants[idx]?.credentials,
                  variants[idx]?.separator || credentialSeparator || "--"
                ),
              })),
              { variantId: null as string | null, items: [] as string[] },
            ]
          : [{ variantId: null as string | null, items: allDeliveryLines }]
        : [],
      seller: {
        id: "me-seller",
        name: "PlayContas",
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=PlayContas",
        isVerified: true,
        salesCount: 0,
        rating: 5.0,
        responseTime: "1 min",
        memberSince: "26/10/2026",
        level: "Elite",
      },
    };

    setLastCreatedProduct(newProd);

    // Salva o anúncio em análise
    onListingCreated(newProd);
    setCurrentStep(4);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-zinc-900 pb-24 pt-6 select-none font-sans">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        
        {/* Top Header Row with White, Black and Blue Theme */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-zinc-200">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-bold text-zinc-600 hover:text-[#0066FF] transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Voltar ao Marketplace</span>
          </button>

          <div className="flex items-center gap-2 text-xs font-bold text-[#0066FF] bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200 shadow-2xs">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0066FF]" />
            <span>Assistente de Publicação</span>
          </div>
        </div>

        {/* 4 Steps Stepper in White, Black & Electric Blue */}
        <div className="mb-10 max-w-2xl mx-auto">
          <div className="relative flex items-center justify-between">
            <div className="absolute top-5 left-6 right-6 h-1 bg-zinc-200 -z-0" />
            <div
              className="absolute top-5 left-6 h-1 bg-[#0066FF] transition-all duration-300 -z-0"
              style={{
                width:
                  isPublishing || currentStep === 4
                    ? "100%"
                    : currentStep === 1
                    ? "0%"
                    : currentStep === 2
                    ? "33%"
                    : currentStep === 3
                    ? "66%"
                    : "100%",
              }}
            />

            {/* Step 1 */}
            <div className="flex flex-col items-center relative z-10">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-all ${
                  currentStep >= 1
                    ? "bg-[#0066FF] text-white shadow-md shadow-blue-500/25 ring-4 ring-[#0066FF]/20"
                    : "bg-white text-zinc-400 border border-zinc-300"
                }`}
              >
                {currentStep > 1 ? <Check className="w-5 h-5 stroke-[3]" /> : 1}
              </div>
              <span className={`text-xs mt-2 font-bold ${currentStep >= 1 ? "text-zinc-950" : "text-zinc-400"}`}>
                Tipo
              </span>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center relative z-10">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-all ${
                  currentStep >= 2
                    ? "bg-[#0066FF] text-white shadow-md shadow-blue-500/25 ring-4 ring-[#0066FF]/20"
                    : "bg-white text-zinc-400 border border-zinc-300"
                }`}
              >
                {currentStep > 2 ? <Check className="w-5 h-5 stroke-[3]" /> : 2}
              </div>
              <span className={`text-xs mt-2 font-bold ${currentStep >= 2 ? "text-zinc-950" : "text-zinc-400"}`}>
                Detalhes
              </span>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center relative z-10">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-all ${
                  currentStep >= 3
                    ? "bg-[#0066FF] text-white shadow-md shadow-blue-500/25 ring-4 ring-[#0066FF]/20"
                    : "bg-white text-zinc-400 border border-zinc-300"
                }`}
              >
                {currentStep > 3 ? <Check className="w-5 h-5 stroke-[3]" /> : 3}
              </div>
              <span className={`text-xs mt-2 font-bold ${currentStep >= 3 ? "text-zinc-950" : "text-zinc-400"}`}>
                Entrega
              </span>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col items-center relative z-10">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-all ${
                  currentStep === 4
                    ? "bg-[#0066FF] text-white shadow-md shadow-blue-500/25 ring-4 ring-[#0066FF]/20"
                    : "bg-white text-zinc-400 border border-zinc-300"
                }`}
              >
                {currentStep === 4 ? <Check className="w-5 h-5 stroke-[3]" /> : 4}
              </div>
              <span className={`text-xs mt-2 font-bold ${currentStep === 4 ? "text-zinc-950" : "text-zinc-400"}`}>
                Concluído
              </span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            ETAPA 1: TIPO DE ANÚNCIO & CATEGORIA
           ========================================================================= */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-fadeIn">
            {/* Box 1: Categoria */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/90 shadow-xs">
              <div className="mb-4">
                <span className="text-[10px] font-black text-white bg-[#0066FF] px-2.5 py-1 rounded-md uppercase tracking-wider mb-2 inline-block">
                  Passo 1 de 3
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
                  Selecione a Categoria do Produto
                </h2>
                <p className="text-xs text-zinc-500 mt-1">
                  Escolha onde o seu anúncio será listado para ser encontrado facilmente pelos compradores.
                </p>
              </div>

              {/* Busca de Categoria & Tabs */}
              <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    placeholder="Filtrar categorias..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#0066FF] bg-zinc-50 focus:bg-white transition-colors"
                  />
                </div>

                <div className="flex items-center gap-1.5 p-1 bg-zinc-100 rounded-xl border border-zinc-200">
                  <button
                    type="button"
                    onClick={() => setCategoryTab("TODOS")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      categoryTab === "TODOS"
                        ? "bg-[#0066FF] text-white shadow-2xs"
                        : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryTab("POPULARES")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      categoryTab === "POPULARES"
                        ? "bg-[#0066FF] text-white shadow-2xs"
                        : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    Populares
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryTab("SERVICOS")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      categoryTab === "SERVICOS"
                        ? "bg-[#0066FF] text-white shadow-2xs"
                        : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    IAs & Serviços
                  </button>
                </div>
              </div>

              {/* Grid de Seleção de Categorias */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {filteredCategories.map((c) => {
                  const isSelected = selectedCategory === c.name;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(c.name);
                        setCategoryError(false);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        isSelected
                          ? "bg-blue-50/70 border-[#0066FF] text-[#0066FF] font-black shadow-2xs ring-2 ring-[#0066FF]/20"
                          : "bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                      }`}
                    >
                      <span className="text-xs truncate">{c.name}</span>
                      {isSelected && <Check className="w-4 h-4 text-[#0066FF] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Box 2: Tipo de Anúncio (Conta vs Item) */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/90 shadow-xs">
              <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider mb-3">
                O que você está vendendo?
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() => setAnnouncementType("CONTA")}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                    announcementType === "CONTA"
                      ? "bg-blue-50/50 border-[#0066FF] shadow-xs"
                      : "bg-white border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-black text-zinc-900">Conta / Licença Completa</span>
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                        announcementType === "CONTA" ? "bg-[#0066FF] text-white" : "border border-zinc-300"
                      }`}
                    >
                      {announcementType === "CONTA" && "✓"}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Credenciais completas de acesso com e-mail, senha ou chave de ativação única.
                  </p>
                </div>

                <div
                  onClick={() => setAnnouncementType("ITEM")}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                    announcementType === "ITEM"
                      ? "bg-blue-50/50 border-[#0066FF] shadow-xs"
                      : "bg-white border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-black text-zinc-900">Itens / Créditos / Moedas</span>
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                        announcementType === "ITEM" ? "bg-[#0066FF] text-white" : "border border-zinc-300"
                      }`}
                    >
                      {announcementType === "ITEM" && "✓"}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Gift cards, tokens de API, diamantes, moedas de jogo ou serviços digitais.
                  </p>
                </div>
              </div>
            </div>

            {/* Box 3: Formato do Anúncio (Único vs Múltiplo) */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/90 shadow-xs">
              <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider mb-3">
                Formato da Publicação
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() => setListingType("UNICA")}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                    listingType === "UNICA"
                      ? "bg-blue-50/50 border-[#0066FF] shadow-xs"
                      : "bg-white border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-black text-zinc-900">Anúncio Padrão Único</span>
                    <span className="text-[10px] font-bold text-[#0066FF] bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                      Recomendado
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Um único produto com preço fixo e estoque simples.
                  </p>
                </div>

                <div
                  onClick={() => setListingType("MULTIPLA")}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                    listingType === "MULTIPLA"
                      ? "bg-blue-50/50 border-[#0066FF] shadow-xs"
                      : "bg-white border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-black text-zinc-900">Anúncio com Variações</span>
                    <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 px-2.5 py-0.5 rounded">
                      Planos múltiplos
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Permite definir opções (ex: 1 Mês, 6 Meses, 1 Ano) com preços diferentes.
                  </p>
                </div>
              </div>

              {/* Botão Avançar */}
              <div className="flex justify-end pt-6 mt-6 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={handleProceedToStep2}
                  disabled={!selectedCategory}
                  className={`px-8 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                    selectedCategory
                      ? "bg-[#0066FF] hover:bg-[#0052cc] text-white shadow-md shadow-blue-500/25 active:scale-95 cursor-pointer"
                      : "bg-zinc-200 text-zinc-400 cursor-not-allowed opacity-60"
                  }`}
                >
                  <span>Avançar para Detalhes</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            ETAPA 2: DETALHES (TÍTULO, DESCRIÇÃO, IMAGENS & PREÇO)
           ========================================================================= */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/90 shadow-xs">
              <span className="text-[10px] font-black text-white bg-[#0066FF] px-2.5 py-1 rounded-md uppercase tracking-wider mb-2 inline-block">
                Passo 2 de 3
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
                Título e Descrição do Anúncio
              </h2>
              <p className="text-xs text-zinc-500 mt-1 mb-6">
                Informe os detalhes atrativos para que os clientes confiem e comprem seu produto.
              </p>

              {/* Título */}
              <div id="step2-title-container" className="mb-5">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider">
                    Título do Anúncio
                  </label>
                  <span className={`text-[11px] font-bold ${title.length >= 61 ? "text-red-500" : title.length >= 50 ? "text-amber-500" : "text-zinc-400"}`}>
                    {title.length} / 61 caracteres
                  </span>
                </div>
                <input
                  type="text"
                  required
                  maxLength={61}
                  value={title}
                  onChange={(e) => {
                    const val = e.target.value.slice(0, 61);
                    setTitle(val);
                    if (step2Errors.title && val.trim()) {
                      setStep2Errors((prev) => ({ ...prev, title: false }));
                    }
                  }}
                  placeholder={selectedCategory ? `Ex: Conta ${selectedCategory} Plus Privada - Entrega Imediata` : "Ex: Conta Premium Privada - Entrega Imediata"}
                  className={`w-full px-4 py-3 rounded-xl border text-xs sm:text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none transition-all ${
                    step2Errors.title
                      ? "border-rose-500 bg-rose-50/20 focus:border-rose-600 ring-2 ring-rose-500/20"
                      : "border-zinc-200 bg-zinc-50 focus:bg-white focus:border-[#0066FF]"
                  }`}
                />
                {step2Errors.title && (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1.5 flex items-center gap-1 animate-fadeIn">
                    <span>⚠️</span> Preencha o título do anúncio para continuar.
                  </p>
                )}
              </div>

              {/* Descrição do Anúncio */}
              <div id="step2-description-container" className="mb-6">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider">
                    Descrição Completa
                  </label>
                </div>

                <div className={`rounded-2xl border bg-white overflow-hidden transition-all shadow-xs ${
                  step2Errors.description
                    ? "border-rose-500 ring-2 ring-rose-500/20"
                    : "border-zinc-200 focus-within:border-[#0066FF] focus-within:ring-2 focus-within:ring-[#0066FF]/20"
                }`}>
                  <textarea
                    ref={descriptionTextareaRef}
                    rows={8}
                    maxLength={5000}
                    value={description}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDescription(val);
                      if (step2Errors.description && val.trim()) {
                        setStep2Errors((prev) => ({ ...prev, description: false }));
                      }
                    }}
                    placeholder="Descreva detalhadamente o produto, termos de garantia, benefícios e como o cliente receberá o acesso..."
                    className="w-full p-4 text-xs sm:text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none resize-y leading-relaxed font-sans"
                  />

                  <div className="px-4 py-2.5 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-400">
                    <span>Organize seu texto livremente com parágrafos e tópicos</span>
                    <span className="font-bold text-zinc-500">{description.length} / 5000</span>
                  </div>
                </div>
                {step2Errors.description && (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1.5 flex items-center gap-1 animate-fadeIn">
                    <span>⚠️</span> Preencha a descrição do anúncio para continuar.
                  </p>
                )}
              </div>

              {/* Upload de Imagens */}
              <div id="step2-image-container" className="mb-6">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider">
                    Foto do Anúncio (Capa)
                  </label>
                  <span className={`text-[11px] font-bold ${uploadedImages.length >= 1 ? "text-blue-600" : "text-zinc-400"}`}>
                    {uploadedImages.length > 0 ? "1/1 imagem selecionada" : "0/1 imagem"}
                  </span>
                </div>

                {/* Dropzone de Upload (quando nenhuma foto foi enviada) */}
                {uploadedImages.length === 0 ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                      step2Errors.image
                        ? "border-rose-500 bg-rose-50/20"
                        : isDragging
                        ? "border-[#0066FF] bg-blue-50/40"
                        : "border-zinc-300 hover:border-[#0066FF] bg-zinc-50/50 hover:bg-white"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-2 ${
                      step2Errors.image ? "bg-rose-100 text-rose-600" : "bg-blue-50 text-[#0066FF]"
                    }`}>
                      <Upload className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-zinc-900 block">
                      Clique para selecionar ou arraste a imagem aqui
                    </span>
                    <span className="text-[11px] text-zinc-400 block mt-0.5">
                      Você também pode colar direto com <kbd className="px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700 text-[10px] font-mono">Ctrl + V</kbd>
                    </span>
                  </div>
                ) : (
                  /* Preview da Imagem Selecionada com Ações de Trocar / Excluir */
                  <div className="relative aspect-video max-w-sm rounded-2xl overflow-hidden border-2 border-[#0066FF] shadow-xs group">
                    <img
                      src={uploadedImages[0]}
                      alt="Capa do anúncio"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-md bg-[#0066FF] text-white text-[10px] font-black uppercase tracking-wider shadow-sm">
                      Foto da Capa
                    </span>
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1 rounded-lg bg-black/70 hover:bg-zinc-900 text-white text-xs font-bold transition-all cursor-pointer backdrop-blur-xs flex items-center gap-1"
                        title="Trocar imagem"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Trocar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUploadedImages([]);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="p-1.5 rounded-lg bg-black/70 hover:bg-rose-600 text-white transition-all cursor-pointer backdrop-blur-xs"
                        title="Remover imagem"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                  </div>
                )}
                {step2Errors.image && uploadedImages.length === 0 && (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1.5 flex items-center gap-1 animate-fadeIn">
                    <span>⚠️</span> A foto de capa do anúncio é obrigatória.
                  </p>
                )}
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center justify-between pt-6 mt-6 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-6 py-2.5 rounded-xl border border-zinc-200 hover:border-zinc-300 text-xs font-bold text-zinc-700 bg-white transition-colors"
                >
                  ← Voltar
                </button>

                <button
                  type="button"
                  onClick={handleProceedToStep3}
                  disabled={!isStep2Valid}
                  className={`px-8 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                    isStep2Valid
                      ? "bg-[#0066FF] hover:bg-[#0052cc] text-white shadow-md shadow-blue-500/25 active:scale-95 cursor-pointer"
                      : "bg-zinc-200 text-zinc-400 cursor-not-allowed opacity-60"
                  }`}
                >
                  <span>Avançar para Entrega</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            ETAPA 3: ENTREGA & GARANTIA
           ========================================================================= */}
        {currentStep === 3 && !isPublishing && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/90 shadow-xs">
              <span className="text-[10px] font-black text-white bg-[#0066FF] px-2.5 py-1 rounded-md uppercase tracking-wider mb-2 inline-block">
                Passo 3 de 3
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
                Entrega e Garantia do Produto
              </h2>
              <p className="text-xs text-zinc-500 mt-1 mb-6">
                Configure se o comprador recebe os acessos automaticamente pelo site após o PIX ou via chat manual.
              </p>

              {/* Tipo de Entrega: Automática vs Manual */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div
                  onClick={() => setIsAutomaticDelivery(true)}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                    isAutomaticDelivery
                      ? "bg-blue-50/50 border-[#0066FF] shadow-xs"
                      : "bg-white border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-black text-zinc-900 flex items-center gap-1.5">
                      <span>⚡</span>
                      <span>Entrega Automática Imediata</span>
                    </span>
                    <span className="text-[10px] font-black text-white bg-emerald-600 px-2 py-0.5 rounded">
                      Mais Vende
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    O sistema envia a chave ou conta ao comprador instantaneamente no momento da aprovação do pagamento.
                  </p>
                </div>

                <div
                  onClick={() => setIsAutomaticDelivery(false)}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                    !isAutomaticDelivery
                      ? "bg-blue-50/50 border-[#0066FF] shadow-xs"
                      : "bg-white border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-black text-zinc-900 flex items-center gap-1.5">
                      <span>💬</span>
                      <span>Entrega Manual via Chat</span>
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Você combina e entrega o acesso diretamente para o comprador através do chat da plataforma.
                  </p>
                </div>
              </div>

              {/* Caixa de Estoque Automático com Separador de Credenciais */}
              {isAutomaticDelivery && (
                <div className="space-y-4 mb-6 animate-fadeIn">
                  <VariantStockSection
                    variants={variants}
                    defaultSeparator={credentialSeparator}
                    onUpdateVariant={handleUpdateVariant}
                    onUpdateFullVariant={handleUpdateFullVariant}
                    onAddVariant={handleAddVariant}
                    onRemoveVariant={handleRemoveVariant}
                    onSeparatorChange={setCredentialSeparator}
                    isSingleItem={listingType === "UNICA" && variants.length <= 1}
                    lockedName={listingType === "UNICA" && variants.length <= 1 ? title : undefined}
                  />
                </div>
              )}

              {/* Garantia */}
              <div className="mb-6">
                <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-1.5">
                  Prazo de Garantia da Compra
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {[7, 15, 30, 60, 90].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setWarrantyDays(days)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold uppercase border transition-all ${
                        warrantyDays === days
                          ? "bg-[#0066FF] text-white border-[#0066FF] shadow-2xs"
                          : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300"
                      }`}
                    >
                      {days} Dias
                    </button>
                  ))}
                </div>
                <p className="flex items-start gap-1.5 mt-2.5 text-[11px] text-zinc-500 leading-snug">
                  <Info className="w-3.5 h-3.5 text-[#0066FF] shrink-0 mt-px" />
                  <span>
                    Defina a garantia do seu produto. Com variações (ex.: Netflix 7 e 30 dias), use sempre o prazo da maior. Padrão: <strong className="text-zinc-700">30 dias</strong>.
                  </span>
                </p>
              </div>
              {/* Botões de Ação Final */}
              <div className="flex items-center justify-between pt-6 mt-6 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-6 py-2.5 rounded-xl border border-zinc-200 hover:border-zinc-300 text-xs font-bold text-zinc-700 bg-white transition-colors"
                >
                  ← Voltar
                </button>

                <button
                  type="button"
                  disabled={isPublishing}
                  onClick={handleFinishListing}
                  className="px-9 py-3.5 rounded-xl bg-[#0066FF] hover:bg-[#0052cc] text-white font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-blue-500/25 active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isPublishing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Publicando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Publicar Anúncio Agora</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            ANIMAÇÃO DE PUBLICAÇÃO DO ANÚNCIO (DENTRO DA PÁGINA)
           ========================================================================= */}
        {isPublishing && (
          <div className="bg-white rounded-3xl p-8 sm:p-14 border border-zinc-200/90 shadow-sm text-center max-w-xl mx-auto my-6 relative overflow-hidden animate-scaleUp">
            {/* Background Glow Efeito */}
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Animated Icon Circle */}
            <div className="relative w-24 h-24 mx-auto mb-6 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-blue-100 animate-pulse" />
              <div
                className="absolute inset-0 rounded-full border-4 border-[#0066FF] border-t-transparent animate-spin"
                style={{ animationDuration: "1s" }}
              />
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#0066FF] to-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
                {publishProgress >= 100 ? (
                  <Check className="w-8 h-8 stroke-[3] animate-scaleUp" />
                ) : (
                  <Sparkles className="w-8 h-8 animate-pulse" />
                )}
              </div>
            </div>

            {/* Title & Step Text */}
            <h3 className="text-2xl font-black text-zinc-950 tracking-tight mb-2">
              {publishProgress >= 100 ? "Anúncio Publicado com Sucesso!" : "Publicando seu Anúncio..."}
            </h3>
            <p className="text-xs sm:text-sm font-semibold text-zinc-600 min-h-[32px] flex items-center justify-center px-2">
              {publishStepText}
            </p>

            {/* Progress Bar Container */}
            <div className="w-full bg-zinc-100 rounded-full h-3 overflow-hidden my-6 border border-zinc-200/80 p-0.5">
              <div
                className="h-full bg-gradient-to-r from-[#0066FF] to-[#00C6FF] rounded-full transition-all duration-500 ease-out shadow-xs"
                style={{ width: `${publishProgress}%` }}
              />
            </div>

            {/* Steps Checklist */}
            <div className="space-y-3 text-left bg-zinc-50 rounded-2xl p-5 border border-zinc-200/70 text-xs">
              <div className="flex items-center gap-3">
                {publishProgress >= 35 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-zinc-300 animate-spin shrink-0 border-t-blue-500" />
                )}
                <span className={publishProgress >= 35 ? "text-zinc-900 font-bold" : "text-zinc-500 font-medium"}>
                  Validar dados e fotos do anúncio
                </span>
              </div>

              <div className="flex items-center gap-3">
                {publishProgress >= 70 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : publishProgress >= 35 ? (
                  <div className="w-4 h-4 rounded-full border-2 border-zinc-300 animate-spin shrink-0 border-t-blue-500" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-zinc-300 shrink-0" />
                )}
                <span className={publishProgress >= 70 ? "text-zinc-900 font-bold" : "text-zinc-500 font-medium"}>
                  Configurar estoque e entrega
                </span>
              </div>

              <div className="flex items-center gap-3">
                {publishProgress >= 100 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : publishProgress >= 70 ? (
                  <div className="w-4 h-4 rounded-full border-2 border-zinc-300 animate-spin shrink-0 border-t-blue-500" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-zinc-300 shrink-0" />
                )}
                <span className={publishProgress >= 100 ? "text-zinc-900 font-bold" : "text-zinc-500 font-medium"}>
                  Registrar no catálogo do PlayContas
                </span>
              </div>
            </div>

            {publishProgress >= 100 && (
              <div className="mt-6 flex items-center justify-center gap-2 text-xs font-bold text-[#0066FF] animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Abrindo o seu anúncio agora...</span>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            ETAPA 4: ANÚNCIO ENVIADO PARA REVISÃO COM SUCESSO
           ========================================================================= */}
        {currentStep === 4 && (
          <div className="bg-white rounded-3xl p-8 sm:p-12 border border-zinc-200 shadow-sm text-center max-w-xl mx-auto animate-scaleUp">
            <div className="w-18 h-18 rounded-full bg-amber-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-amber-500/30 mb-4">
              <Clock className="w-10 h-10 stroke-[2.5]" />
            </div>

            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-50 border border-amber-200 mb-3">
              <span className="text-xs font-black text-amber-700 font-mono">
                {publishedAdCode || "#01"}
              </span>
              <span className="text-amber-300">•</span>
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                Aguardando Revisão
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
              Anúncio Enviado para Análise!
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 mt-2 mb-8 leading-relaxed max-w-md mx-auto">
              O seu anúncio foi enviado com sucesso para a moderação do PlayContas. O administrador analisará os detalhes e, assim que for aprovado, seu produto ficará visível para venda no catálogo.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/meus-produtos")}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#0066FF] hover:bg-[#0052cc] text-white font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-blue-500/25 active:scale-95 cursor-pointer"
              >
                Ver Meus Anúncios
              </button>

              <button
                type="button"
                onClick={() => {
                  setTitle("");
                  setDescription("");
                  setUploadedImages([]);
                  setStockLines("");
                  setCurrentStep(1);
                }}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-800 font-bold text-xs transition-colors cursor-pointer"
              >
                + Criar Outro Anúncio
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
