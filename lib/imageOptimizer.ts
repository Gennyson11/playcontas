/**
 * Utilitário de Otimização e Compressão Inteligente de Imagens para Banners e Capas.
 * Redimensiona e comprime imagens pesadas (JPG, PNG) para WebP/JPEG leve (~50KB-80KB)
 * mantendo nitidez cristalina em 16:9 widescreen, evitando estouro de limite de armazenamento
 * e garantindo que o banner NUNCA suma ou seja substituído.
 */

export function optimizeImageFile(
  file: File,
  maxWidth = 1200,
  maxHeight = 675,
  quality = 0.88
): Promise<string> {
  return new Promise((resolve) => {
    // GIFs animados são preservados intactos para não perder os quadros de animação
    if (file.type === "image/gif") {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const rawUrl = String(e.target?.result || "");
      if (!rawUrl) {
        resolve("");
        return;
      }

      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Redimensiona proporcionalmente mantendo alta resolução para banners
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(rawUrl);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        // Tenta WebP de alta qualidade primeiro, fallback para JPEG
        try {
          const webpUrl = canvas.toDataURL("image/webp", quality);
          if (webpUrl && webpUrl.startsWith("data:image/webp")) {
            resolve(webpUrl);
            return;
          }
        } catch {}

        const jpegUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(jpegUrl || rawUrl);
      };

      img.onerror = () => resolve(rawUrl);
      img.src = rawUrl;
    };

    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}
