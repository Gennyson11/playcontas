import { CartItem, Product } from "@/types";

const CART_KEY = "central_cart";

// In-memory cache to guarantee instant synchronization across views and protection against localStorage quota errors
let memoryCart: CartItem[] = [];

export function getStoredCart(): CartItem[] {
  if (typeof window === "undefined") return [];

  // Se já temos na memória durante a sessão, retorne imediatamente
  if (memoryCart.length > 0) {
    return memoryCart;
  }

  try {
    const raw = localStorage.getItem(CART_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryCart = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Erro ao ler carrinho do localStorage:", err);
  }

  return memoryCart;
}

export function saveStoredCart(items: CartItem[]): void {
  memoryCart = items;

  if (typeof window === "undefined") return;

  try {
    // Sanitiza imagens base64 gigantes para nunca estourar o limite de 5MB do localStorage
    const safeItems = items.map((item) => {
      const img = item.product.image || "";
      const isHugeBase64 = img.startsWith("data:") && img.length > 30000;
      return {
        ...item,
        product: {
          ...item.product,
          // Se for base64 gigante, armazena uma URL leve no localStorage (a memória mantém o original)
          image: isHugeBase64
            ? "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80"
            : img,
        },
      };
    });

    localStorage.setItem(CART_KEY, JSON.stringify(safeItems));
  } catch (err) {
    console.warn("Aviso ao salvar no localStorage (mantendo em memória):", err);
  }

  try {
    window.dispatchEvent(new Event("central_cart_updated"));
  } catch {}
}

export function addToCart(
  product: Product,
  quantity: number = 1,
  selectedOptionLabel?: string,
  customPrice?: number,
  selectedVariantId?: string
): CartItem[] {
  const current = getStoredCart();
  const itemPrice = customPrice !== undefined ? customPrice : product.price;

  // Encontra a variante selecionada caso o produto tenha variações
  const variant = product.variants?.find((v) =>
    (selectedVariantId && v.id === selectedVariantId) ||
    (selectedOptionLabel && v.name.toLowerCase() === selectedOptionLabel.toLowerCase())
  );

  let variantAutoDelivery = product.autoDeliveryContent;
  if (variant?.credentials) {
    const credText = variant.credentials.trim();
    const blocks = credText
      .split(/\n\s*--+\s*\n|\n\s*\n+/)
      .map((b) => b.trim())
      .filter(Boolean);
    if (blocks.length > 0) {
      variantAutoDelivery = blocks;
    } else {
      variantAutoDelivery = credText.split("\n").map((b) => b.trim()).filter(Boolean);
    }
  }

  // Só acrescenta a opção ao título quando o anúncio tem variações de verdade.
  // Em anúncio único a tela cria uma opção interna "Padrão" que não deve aparecer no título do pedido.
  const hasRealVariations = (product.variants?.length || 0) > 1;
  const maxStock = Number(variant ? variant.stock : product.stock) || 0;
  if (
    product.status === "rejected" ||
    product.status === "paused" ||
    product.status === "pending_review" ||
    product.status === "pending_approval" ||
    maxStock <= 0
  ) {
    return current;
  }

  const customizedProduct: Product = {
    ...product,
    price: itemPrice,
    title:
      selectedOptionLabel && hasRealVariations
        ? selectedOptionLabel
        : product.title,
    autoDeliveryContent: variantAutoDelivery,
    stock: maxStock,
  };

  const matchedVarId = variant?.id || selectedVariantId;
  const existingIndex = current.findIndex(
    (item) =>
      item.product.id === product.id &&
      (matchedVarId ? item.selectedVariantId === matchedVarId : true)
  );

  let updated: CartItem[];
  if (existingIndex > -1) {
    const curQty = current[existingIndex].quantity;
    const cappedQty = Math.min(maxStock, curQty + quantity);
    updated = current.map((item, idx) =>
      idx === existingIndex
        ? { ...item, quantity: cappedQty }
        : item
    );
  } else {
    const initialQty = Math.min(maxStock, Math.max(1, quantity));
    updated = [
      ...current,
      {
        product: customizedProduct,
        quantity: initialQty,
        selectedVariantId: matchedVarId,
        selectedVariantName: variant?.name || selectedOptionLabel,
        selectedOptionLabel,
        finalPrice: itemPrice,
      },
    ];
  }

  saveStoredCart(updated);
  return updated;
}

export function updateCartItemQuantity(productId: string, quantity: number, variantId?: string): CartItem[] {
  const current = getStoredCart();
  let updated: CartItem[];
  if (quantity <= 0) {
    updated = current.filter((item) =>
      variantId
        ? !(item.product.id === productId && item.selectedVariantId === variantId)
        : item.product.id !== productId
    );
  } else {
    updated = current.map((item) => {
      const isMatch = variantId
        ? item.product.id === productId && item.selectedVariantId === variantId
        : item.product.id === productId;
      if (!isMatch) return item;
      const maxStock = Number(item.product.stock ?? 9999);
      const safeQty = maxStock > 0 ? Math.min(quantity, maxStock) : quantity;
      return { ...item, quantity: safeQty };
    });
  }
  saveStoredCart(updated);
  return updated;
}

export function removeFromCart(productId: string, variantId?: string): CartItem[] {
  const current = getStoredCart();
  const updated = current.filter((item) =>
    variantId
      ? !(item.product.id === productId && item.selectedVariantId === variantId)
      : item.product.id !== productId
  );
  saveStoredCart(updated);
  return updated;
}

export function clearCart(): void {
  memoryCart = [];
  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem(CART_KEY);
      window.dispatchEvent(new Event("central_cart_updated"));
    }
  } catch {}
}
