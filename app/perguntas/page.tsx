"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PerguntasPage() {
  const router = useRouter();

  useEffect(() => {
    try {
      sessionStorage.setItem("minha_conta_active_tab", "perguntas");
    } catch {}
    router.replace("/minha-conta");
  }, [router]);

  return null;
}
