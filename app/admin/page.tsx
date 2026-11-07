"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminDashboard } from "@/components/AdminDashboard";
import { getStoredUserSync, isUserAdmin, saveStoredUser } from "@/lib/authStore";
import { getStoredProducts } from "@/lib/productStore";
import { UserProfile, Product } from "@/types";
import { AuthModal } from "@/components/AuthModal";
import { ShieldAlert, ArrowLeft, Loader2, LogIn } from "lucide-react";

export default function AdminPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    const user = getStoredUserSync();
    setCurrentUser(user);
    setProducts(getStoredProducts());
    setIsLoading(false);

    const handleAuthChange = () => {
      const u = getStoredUserSync();
      setCurrentUser(u);
    };

    window.addEventListener("central_auth_changed", handleAuthChange);
    return () => window.removeEventListener("central_auth_changed", handleAuthChange);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#0066FF] animate-spin" />
      </div>
    );
  }

  const isAdmin = isUserAdmin(currentUser);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black tracking-tight">Acesso Restrito ao Administrador</h1>
        <p className="text-sm text-zinc-400 max-w-md">
          Esta área é exclusiva para administradores da plataforma PlayContas. Faça login com a sua conta de administrador para continuar.
        </p>
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="px-6 py-2.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-blue-500/25"
          >
            <LogIn className="w-4 h-4" />
            <span>Fazer Login</span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="px-6 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 border border-zinc-800"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar à Loja</span>
          </button>
        </div>

        <AuthModal
          isOpen={authModalOpen}
          initialTab="login"
          onClose={() => setAuthModalOpen(false)}
          onLoginSuccess={(user) => {
            saveStoredUser(user);
            setCurrentUser(user);
            setAuthModalOpen(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <AdminDashboard
        currentUser={currentUser!}
        products={products}
        onBackToShop={() => router.push("/")}
        onUpdateProducts={(updated) => setProducts(updated)}
        onCreateProduct={() => router.push("/anunciar")}
      />
    </div>
  );
}
