export interface Seller {
  id: string;
  name: string;
  avatar: string;
  email?: string;
  isVerified: boolean;
  salesCount: number;
  rating: number; // e.g. 4.9
  responseTime: string; // e.g. "5 min"
  memberSince: string;
  level: "Bronze" | "Prata" | "Ouro" | "Diamante" | "Elite";
}

export interface Question {
  id: string;
  user: string;
  avatar: string;
  question: string;
  date: string;
  answer?: string;
  answeredAt?: string;
  userId?: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  price: number;
  stock: number;
  originalPrice?: number;
  description?: string;
  credentials?: string;
}

export interface Product {
  id: string;
  adCode?: string; // Código sequencial formatado, ex: "#0912"
  title: string;
  description: string;
  category: string;
  price: number;
  originalPrice?: number;
  image: string;
  deliveryType: "AUTOMATIC" | "MANUAL";
  autoDeliveryContent?: string[]; // e.g. license keys or credentials
  stock: number;
  featured?: boolean;
  popular?: boolean;
  salesCount: number;
  tags: string[];
  seller: Seller;
  questions?: Question[];
  warrantyDays: number;
  createdAt: string;
  status?: "active" | "paused" | "deleted" | "pending_review" | "pending_approval" | "rejected";
  rejectionReason?: string;
  reviewedAt?: string;
  listingType?: "UNICA" | "MULTIPLA";
  hasVariations?: boolean;
  variants?: ProductVariant[];
  /** Transitório (só na criação): contas por grupo para o cofre do banco. Nunca é salvo no navegador. */
  vaultGroups?: { variantId: string | null; items: string[] }[];
}

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  iconName: string;
  count: number;
  popular?: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedVariantId?: string;
  selectedVariantName?: string;
  selectedOptionLabel?: string;
  finalPrice?: number;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: "admin" | "seller" | "buyer";
  balance: number;
  avatar: string;
  createdAt: string;
  hasChangedName?: boolean;
  isVerified?: boolean;
  phone?: string;
  cpf?: string;
  verificationStatus?: "none" | "pending" | "approved" | "rejected";
}

export interface VerificationData {
  // Contato
  email: string;
  phone: string;
  pixKey?: string;
  pixType?: "cpf" | "email" | "phone" | "random";
  // Dados Pessoais
  fullName: string;
  cpf: string;
  birthDate: string;
  motherName: string;
  nationality: string;
  // Endereço
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  addressProofFile?: string; // Data URL ou nome do arquivo
  addressProofName?: string;
  // Identidade
  documentType: "RG" | "CNH" | "Passaporte";
  documentNumber: string;
  issuingAgency?: string;
  docFrontFile?: string;
  docFrontName?: string;
  docBackFile?: string;
  docBackName?: string;
  docSelfieFile?: string;
  docSelfieName?: string;
  // Status
  status: "none" | "pending" | "approved" | "rejected";
  approvedAt?: string;
  submittedAt?: string;
  rejectionReason?: string;
}

export interface VerificationSubmission extends VerificationData {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  submittedAt: string;
  rejectionReason?: string;
  notes?: string;
}

export interface OrderItem {
  id: string;
  buyerEmail: string;
  productTitle: string;
  variantLabel: string;
  amount: number;
  status: "completed" | "pending" | "cancelled";
  paymentMethod: "PIX" | "Cartão" | "Saldo";
  deliveredData?: string;
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  sellerId: string;
  sellerName: string;
  scope: "store" | "product";
  productId?: string;
  productTitle?: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  usageLimit?: number | null;
  usageCount: number;
  expiresAt?: string | null;
  isActive: boolean;
  createdAt: string;
}
