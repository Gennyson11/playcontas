/**
 * Sistema de numeração sequencial de anúncios:
 * Começa em #01 e vai incrementando sequencialmente (#02, #03, #04...).
 */

const INITIAL_CODE_MAP: Record<string, string> = {
  // O anúncio Muse AI cadastrado pelo usuário é o primeiro (#01)
  "0c8ec785-d1e7-42cd-9125-e379921bc797": "#01",
};

/**
 * Formata um número como código de anúncio:
 * 1 -> "#01", 2 -> "#02", 10 -> "#10", 100 -> "#100"
 */
export function formatCodeNumber(num: number): string {
  if (num < 10) return `#0${num}`;
  return `#${num}`;
}

/**
 * Obtém o mapa de códigos persistido no navegador
 */
export function getStoredAdCodeMap(): Record<string, string> {
  if (typeof window === "undefined") return INITIAL_CODE_MAP;
  try {
    const raw = localStorage.getItem("central_ad_code_map_v2");
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...INITIAL_CODE_MAP, ...parsed };
    }
  } catch {}
  return INITIAL_CODE_MAP;
}

/**
 * Salva o mapa de códigos no localStorage
 */
export function saveStoredAdCodeMap(map: Record<string, string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("central_ad_code_map_v2", JSON.stringify(map));
  } catch {}
}

/**
 * Retorna o próximo código sequencial disponível (ex: #02, #03...)
 */
export function getNextAdCode(): string {
  const map = getStoredAdCodeMap();
  const existingNums = Object.values(map)
    .map((code) => parseInt(code.replace(/[^0-9]/g, ""), 10))
    .filter((n) => !isNaN(n));

  const maxNum = existingNums.length > 0 ? Math.max(...existingNums) : 0;
  const nextNum = maxNum + 1;
  return formatCodeNumber(nextNum);
}

/**
 * Retorna o código do produto (#01, #02...).
 * Se não existir, gera o próximo código sequencial e persiste.
 */
export function getProductAdCode(product: { id: string; adCode?: string }): string {
  if (product.adCode && product.adCode.startsWith("#")) {
    return product.adCode;
  }
  const map = getStoredAdCodeMap();
  if (map[product.id]) {
    return map[product.id];
  }

  const newCode = getNextAdCode();
  map[product.id] = newCode;
  saveStoredAdCodeMap(map);

  return newCode;
}

/**
 * Registra formalmente um produto com o próximo código sequencial
 */
export function registerProductAdCode(productId: string, customCode?: string): string {
  const map = getStoredAdCodeMap();
  if (map[productId]) return map[productId];

  const assignedCode = customCode || getNextAdCode();
  map[productId] = assignedCode;
  saveStoredAdCodeMap(map);
  return assignedCode;
}
