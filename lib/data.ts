import { CategoryItem, Product } from "@/types";

export const CATEGORIES: CategoryItem[] = [
  {
    id: "ia",
    name: "Inteligência Artificial",
    slug: "inteligencia-artificial",
    iconName: "Sparkles",
    count: 342,
    popular: true,
  },
  {
    id: "assinaturas",
    name: "Assinaturas Premium",
    slug: "assinaturas-premium",
    iconName: "Sparkles",
    count: 215,
    popular: true,
  },
  {
    id: "software",
    name: "Software & Licenças",
    slug: "software",
    iconName: "Wrench",
    count: 280,
    popular: true,
  },
  {
    id: "streaming",
    name: "Streaming & Vídeo",
    slug: "streaming",
    iconName: "Sparkles",
    count: 140,
    popular: true,
  },
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: "muse-ai-pro",
    title: "MUSE AI PRO | 1 BILHÃO DE TOKENS",
    description: "Acesso completo ao Muse AI Pro com 1 bilhão de tokens. Geração ilimitada de vídeos, avatares e vozes neurais com máxima fidelidade e entrega rápida garantida.",
    category: "INTELIGÊNCIA ARTIFICIAL",
    price: 7.90,
    originalPrice: 12.64,
    image: "https://lazueuycrcqirdykdppm.supabase.co/storage/v1/object/public/products/prod-0c8ec785-d1e7-42cd-9125-e379921bc797.png",
    deliveryType: "MANUAL",
    autoDeliveryContent: [
      "ACESSO: muse.pro.vip@centralias.com | TOKEN: MUSE-1B-TOKENS-2026-VIP",
    ],
    stock: 10,
    featured: true,
    popular: true,
    salesCount: 0,
    tags: ["Muse AI", "Vídeo", "IA", "Tokens"],
    warrantyDays: 30,
    createdAt: "2026-10-26",
    hasVariations: true,
    variants: [
      {
        id: "var-1",
        name: "CONTA",
        description: "1 BILHÃO DE TOKENS (CONTA PRÓPRIA)",
        price: 7.90,
        stock: 5,
        credentials: "LOGIN: muse.pro@centralias.com | SENHA: Muse#2026",
      },
      {
        id: "var-2",
        name: "CONTA COMPARTILHADA",
        description: "ACESSO COMPARTILHADO 30 DIAS",
        price: 4.90,
        stock: 5,
        credentials: "LOGIN: muse.shared@centralias.com | SENHA: Shared#2026",
      },
    ],
    seller: {
      id: "usr-gennyson",
      name: "Gennyson Marinho",
      avatar: "https://lazueuycrcqirdykdppm.supabase.co/storage/v1/object/public/avatars/avatar-gennysonmarinhodemacedo_gmail_com.gif",
      isVerified: true,
      salesCount: 0,
      rating: 5.0,
      responseTime: "1 min",
      memberSince: "26/10/2026",
      level: "Elite",
    },
  },
];
