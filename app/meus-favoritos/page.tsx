"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MeusFavoritosPage() {
  const router = useRouter();

  useEffect(() => {
    try {
      sessionStorage.setItem("minha_conta_active_tab", "favoritos");
    } catch {}
    router.replace("/minha-conta");
  }, [router]);

  return null;
}
