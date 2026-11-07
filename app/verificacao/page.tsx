"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function VerificacaoPage() {
  const router = useRouter();

  useEffect(() => {
    try {
      sessionStorage.setItem("minha_conta_active_tab", "verificacao");
    } catch {}
    router.replace("/minha-conta");
  }, [router]);

  return null;
}
