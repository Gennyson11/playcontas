/**
 * Converte um texto/título de anúncio em um slug de URL amigável (SEO Friendly)
 * Ex: "MUSE AI PRO | 1 BILHÃO DE TOKENS" -> "muse-ai-pro-1-bilhao-de-tokens"
 */
export function slugify(text: string): string {
  if (!text) return "";
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // remove caracteres especiais exceto espaços e hifens
    .replace(/\s+/g, "-") // substitui espaços por hifens
    .replace(/-+/g, "-") // remove hifens repetidos
    .replace(/^-+|-+$/g, ""); // remove hifens no início e fim
}

/**
 * Extrai um identificador único curto (6 a 8 caracteres) a partir do ID do produto
 * Ex: UUID "0c8ec785-d1e7-42cd-9125-e379921bc797" -> "0c8ec785"
 * Ex: "prod-1730389283741" -> "283741"
 * Ex: "muse-ai-pro" -> "museaipr"
 */
export function getProductShortId(id: string): string {
  if (!id) return "";
  const cleanId = id.trim().toLowerCase();

  // 1. Se for UUID (padrão com hifens, ex: 0c8ec785-d1e7-42cd-...)
  const uuidMatch = cleanId.match(/^([0-9a-f]{8})-[0-9a-f]{4}/i);
  if (uuidMatch) {
    return uuidMatch[1].toLowerCase();
  }

  // 2. Se for prod-timestamp (ex: prod-1730389283741)
  if (cleanId.startsWith("prod-")) {
    const digits = cleanId.replace(/[^0-9a-z]/gi, "").replace(/^prod/i, "");
    if (digits.length >= 6) {
      return digits.slice(-6).toLowerCase();
    }
  }

  // 3. Se já for um identificador curto alfanumérico (ex: "muse-ai-pro")
  const alphanum = cleanId.replace(/[^a-z0-9]/gi, "");
  if (alphanum.length >= 4) {
    return alphanum.slice(0, 8).toLowerCase();
  }

  return cleanId.slice(0, 8) || "item";
}

/**
 * Retorna a rota completa do anúncio com ID único no final
 * Garante que dois anúncios com o mesmo nome nunca tenham conflito de URL
 * Ex: "/anuncio/anuncio-teste-0c8ec785"
 */
export function getProductUrl(product: { id: string; title: string }): string {
  const baseSlug = slugify(product.title) || "anuncio";
  const shortId = getProductShortId(product.id);
  const fullSlug = shortId ? `${baseSlug}-${shortId}` : baseSlug;
  return `/anuncio/${fullSlug}`;
}
