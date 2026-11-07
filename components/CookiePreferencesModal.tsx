"use client";

import React, { useState, useEffect } from "react";
import {
  Cookie,
  X,
  Lock,
  BarChart3,
  Megaphone,
  Sliders,
  ChevronDown,
  Check,
} from "lucide-react";

export interface CookiePreferences {
  essential: boolean; // Always true
  analytics: boolean;
  marketing: boolean;
  functionality: boolean;
}

const STORAGE_KEY = "playcontas_cookie_preferences";

const DEFAULT_PREFERENCES: CookiePreferences = {
  essential: true,
  analytics: true,
  marketing: true,
  functionality: true,
};

interface CookiePreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CookiePreferencesModal({
  isOpen,
  onClose,
}: CookiePreferencesModalProps) {
  const [preferences, setPreferences] = useState<CookiePreferences>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return DEFAULT_PREFERENCES;
  });

  // Controls expandable accordions
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    essential: true,
    analytics: true,
    marketing: true,
    functionality: false,
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSavedSuccess(false);
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) setPreferences(JSON.parse(saved));
      } catch {}
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleAccordion = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = (customPrefs?: CookiePreferences) => {
    const toSave = customPrefs || preferences;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {}
    setSavedSuccess(true);
    setTimeout(() => {
      onClose();
      setSavedSuccess(false);
    }, 400);
  };

  const handleRejectAll = () => {
    const rejected: CookiePreferences = {
      essential: true,
      analytics: false,
      marketing: false,
      functionality: false,
    };
    setPreferences(rejected);
    handleSave(rejected);
  };

  const handleAcceptAll = () => {
    const accepted: CookiePreferences = {
      essential: true,
      analytics: true,
      marketing: true,
      functionality: true,
    };
    setPreferences(accepted);
    handleSave(accepted);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-zinc-200/90 overflow-hidden my-auto animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="p-6 sm:p-7 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-[#0066FF] shrink-0">
                <Cookie className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
                Configurações de Cookies
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="mt-3 text-xs sm:text-sm text-zinc-500 leading-relaxed">
            Escolha quais tipos de cookies e tecnologias semelhantes você permite. Os
            essenciais não podem ser desativados porque são necessários para o
            funcionamento e a segurança do site. Se você recusar os demais, o site
            continua funcionando normalmente.
          </p>
        </div>

        {/* LISTA DE COOKIES */}
        <div className="px-6 sm:px-7 pb-4 space-y-3 max-h-[50vh] overflow-y-auto pr-2">
          {/* 1. Cookies Essenciais */}
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-4.5 transition-all">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => toggleAccordion("essential")}
                className="flex items-center gap-2.5 text-left font-bold text-zinc-900 text-sm hover:text-blue-600 transition-colors cursor-pointer flex-1"
              >
                <Lock className="w-4.5 h-4.5 text-[#0066FF] shrink-0" />
                <span>Cookies Essenciais</span>
                <ChevronDown
                  className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
                    expanded.essential ? "rotate-180" : ""
                  }`}
                />
              </button>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70 shrink-0">
                Sempre ativo
              </span>
            </div>
            {expanded.essential && (
              <p className="mt-2.5 text-xs text-zinc-500 leading-relaxed pl-7">
                Necessários para o funcionamento básico e a segurança do site e para
                guardar a sua escolha sobre cookies. Sem eles, o login, o carrinho e
                os pagamentos não funcionam.
              </p>
            )}
          </div>

          {/* 2. Cookies de Análise */}
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-4.5 transition-all">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => toggleAccordion("analytics")}
                className="flex items-center gap-2.5 text-left font-bold text-zinc-900 text-sm hover:text-blue-600 transition-colors cursor-pointer flex-1"
              >
                <BarChart3 className="w-4.5 h-4.5 text-[#0066FF] shrink-0" />
                <span>Cookies de Análise</span>
                <ChevronDown
                  className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
                    expanded.analytics ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Toggle Switch */}
              <button
                type="button"
                role="switch"
                aria-checked={preferences.analytics}
                onClick={() =>
                  setPreferences((prev) => ({ ...prev, analytics: !prev.analytics }))
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  preferences.analytics ? "bg-[#0066FF]" : "bg-zinc-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    preferences.analytics ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
            {expanded.analytics && (
              <p className="mt-2.5 text-xs text-zinc-500 leading-relaxed pl-7">
                Ajudariam a entender como os visitantes usam o site, para melhorar
                páginas e desempenho.
              </p>
            )}
          </div>

          {/* 3. Cookies de Marketing */}
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-4.5 transition-all">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => toggleAccordion("marketing")}
                className="flex items-center gap-2.5 text-left font-bold text-zinc-900 text-sm hover:text-blue-600 transition-colors cursor-pointer flex-1"
              >
                <Megaphone className="w-4.5 h-4.5 text-[#0066FF] shrink-0" />
                <span>Cookies de Marketing</span>
                <ChevronDown
                  className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
                    expanded.marketing ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Toggle Switch */}
              <button
                type="button"
                role="switch"
                aria-checked={preferences.marketing}
                onClick={() =>
                  setPreferences((prev) => ({ ...prev, marketing: !prev.marketing }))
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  preferences.marketing ? "bg-[#0066FF]" : "bg-zinc-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    preferences.marketing ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
            {expanded.marketing && (
              <p className="mt-2.5 text-xs text-zinc-500 leading-relaxed pl-7">
                Permitiriam medir campanhas e mostrar anúncios da PlayContas em outros
                sites, como Google e Meta.
              </p>
            )}
          </div>

          {/* 4. Cookies de Funcionalidade */}
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-4.5 transition-all">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => toggleAccordion("functionality")}
                className="flex items-center gap-2.5 text-left font-bold text-zinc-900 text-sm hover:text-blue-600 transition-colors cursor-pointer flex-1"
              >
                <Sliders className="w-4.5 h-4.5 text-[#0066FF] shrink-0" />
                <span>Cookies de Funcionalidade</span>
                <ChevronDown
                  className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
                    expanded.functionality ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Toggle Switch */}
              <button
                type="button"
                role="switch"
                aria-checked={preferences.functionality}
                onClick={() =>
                  setPreferences((prev) => ({
                    ...prev,
                    functionality: !prev.functionality,
                  }))
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  preferences.functionality ? "bg-[#0066FF]" : "bg-zinc-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    preferences.functionality ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
            {expanded.functionality && (
              <p className="mt-2.5 text-xs text-zinc-500 leading-relaxed pl-7">
                Permitem memorizar preferências de navegação e filtros salvos para
                melhorar a sua experiência no site.
              </p>
            )}
          </div>
        </div>

        {/* BOTÕES DE AÇÃO */}
        <div className="p-6 sm:p-7 pt-2 border-t border-zinc-100 bg-white space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleRejectAll}
              className="py-3 px-4 rounded-2xl border border-zinc-200/90 bg-white hover:bg-zinc-50 text-zinc-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
            >
              Rejeitar todos
            </button>
            <button
              type="button"
              onClick={handleAcceptAll}
              className="py-3 px-4 rounded-2xl border border-zinc-200/90 bg-white hover:bg-zinc-50 text-zinc-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
            >
              Aceitar todos
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleSave()}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#0066FF] hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4" />
                <span>Preferências salvas!</span>
              </>
            ) : (
              <span>Salvar preferências</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
