import { supabase, isSupabaseConfigured } from "./supabaseClient";

/**
 * Utilitário oficial de upload para o Supabase Storage.
 * Faz o upload de arquivos (JPG, PNG, WebP) ou GIFs animados para os buckets
 * 'products' e 'avatars' no Supabase, retornando uma URL pública permanente.
 */
export async function uploadToSupabaseStorage(
  fileOrDataUrl: File | Blob | string,
  bucket: "products" | "avatars",
  customFileName?: string
): Promise<string | null> {
  if (!isSupabaseConfigured) {
    console.warn("[Supabase Storage] Supabase não está configurado.");
    return null;
  }

  try {
    let fileToUpload: Blob;
    let contentType = "image/webp";
    let ext = "webp";

    if (typeof fileOrDataUrl === "string") {
      // Se já for uma URL pública na internet, retorna ela diretamente
      if (!fileOrDataUrl.startsWith("data:")) {
        return fileOrDataUrl;
      }

      // Converte Data URL Base64 para Blob usando fetch nativo
      const res = await fetch(fileOrDataUrl);
      fileToUpload = await res.blob();
      contentType = fileToUpload.type || "image/webp";
    } else {
      fileToUpload = fileOrDataUrl;
      contentType = fileOrDataUrl.type || "image/webp";
    }

    if (contentType.includes("gif")) ext = "gif";
    else if (contentType.includes("png")) ext = "png";
    else if (contentType.includes("jpeg") || contentType.includes("jpg")) ext = "jpg";
    else if (contentType.includes("webp")) ext = "webp";

    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const finalFileName = customFileName
      ? `${customFileName.replace(/[^a-zA-Z0-9_-]/g, "_")}.${ext}`
      : `${uniqueId}.${ext}`;

    // Cache longo no navegador/CDN: o mesmo arquivo não é baixado de novo a cada visita (economiza tráfego).
    // Nomes únicos nunca mudam (1 ano); nomes fixos (ex.: avatar do usuário) usam 1 dia para permitir troca de foto.
    const cacheControl = customFileName ? "86400" : "31536000";

    const { error } = await supabase.storage
      .from(bucket)
      .upload(finalFileName, fileToUpload, {
        contentType,
        upsert: true,
        cacheControl,
      });

    if (error) {
      console.warn(`[Supabase Storage] Aviso ao enviar para bucket '${bucket}':`, error.message);
      return null;
    }

    // Obtém a URL pública definitiva
    const { data: publicData } = supabase.storage
      .from(bucket)
      .getPublicUrl(finalFileName);

    if (publicData?.publicUrl) {
      return publicData.publicUrl;
    }

    return null;
  } catch (err) {
    console.warn("[Supabase Storage] Erro inesperado:", err);
    return null;
  }
}
