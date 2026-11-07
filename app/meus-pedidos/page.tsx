"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MeusPedidosPage() {
  const router = useRouter();

  useEffect(() => {
    try {
      sessionStorage.setItem("minha_conta_active_tab", "pedidos");
    } catch {}
    router.replace("/minha-conta");
  }, [router]);

  return null;
}
