"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function VendasPage() {
  const router = useRouter();

  useEffect(() => {
    try {
      sessionStorage.setItem("minha_conta_active_tab", "vendas");
    } catch {}
    router.replace("/minha-conta");
  }, [router]);

  return null;
}
