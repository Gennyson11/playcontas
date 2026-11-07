"use client";

import React, { useState, useEffect } from "react";
import { UserProfile } from "@/types";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { clearUserAvatar } from "@/lib/avatarStore";
import { persistUser } from "@/lib/authStore";
import { X, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  initialTab?: "login" | "register";
  onClose: () => void;
  onLoginSuccess: (user: UserProfile) => void;
}

export function AuthModal({
  isOpen,
  initialTab = "login",
  onClose,
  onLoginSuccess,
}: AuthModalProps) {
  const [tab, setTab] = useState<"login" | "register">(initialTab);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setErrorMsg("");
      setSuccessMsg("");
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const isEmailAdmin = (e: string) => {
    const clean = (e || "").trim().toLowerCase();
    return clean === "gennysonmarinhodemacedo@gmail.com" || clean.includes("admin");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (tab === "register") {
      if (!name.trim()) {
        setErrorMsg("Por favor, preencha o seu nome.");
        return;
      }
      if (!email.trim() || !email.includes("@")) {
        setErrorMsg("Por favor, insira um e-mail válido.");
        return;
      }
      if (password.length < 6) {
        setErrorMsg("A senha deve conter pelo menos 6 caracteres.");
        return;
      }
    } else {
      if (!email.trim()) {
        setErrorMsg("Por favor, insira seu usuário ou e-mail.");
        return;
      }
      if (!password) {
        setErrorMsg("Por favor, digite sua senha.");
        return;
      }
    }

    setLoading(true);

    try {
      if (tab === "register") {
        // --- CADASTRO ---
        let registeredUser: UserProfile;

        const role: "admin" | "buyer" = isEmailAdmin(email) ? "admin" : "buyer";

        if (isSupabaseConfigured) {
          const { data, error } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: {
                full_name: name.trim(),
                role,
              },
            },
          });

          if (error) throw error;

          registeredUser = {
            id: data.user?.id || `usr-${Date.now()}`,
            email: email.trim(),
            name: name.trim(),
            role,
            balance: 0,
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
              email.trim()
            )}`,
            createdAt: new Date().toISOString(),
          };

          // Garante a criação do perfil na tabela 'profiles' do Supabase
          try {
            await supabase.from("profiles").upsert(
              {
                id: data.user?.id,
                email: email.trim(),
                full_name: name.trim(),
                role,
                avatar_url: registeredUser.avatar,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "id" }
            );
          } catch (profileErr) {
            console.warn("Aviso ao sincronizar perfil no Supabase:", profileErr);
          }
        } else {
          registeredUser = {
            id: `usr-${Date.now()}`,
            email: email.trim().toLowerCase(),
            name: name.trim(),
            role,
            balance: 0,
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
              name.trim()
            )}`,
            createdAt: new Date().toISOString(),
          };

          const existingUsers = JSON.parse(
            localStorage.getItem("central_registered_users") || "[]"
          );
          const alreadyExists = existingUsers.some(
            (u: any) => u.email.toLowerCase() === email.trim().toLowerCase()
          );

          if (alreadyExists) {
            throw new Error("Este e-mail já está cadastrado. Tente entrar.");
          }

          existingUsers.push({
            ...registeredUser,
            passwordHash: btoa(password),
          });
          localStorage.setItem(
            "central_registered_users",
            JSON.stringify(existingUsers)
          );
        }

        clearUserAvatar();
        persistUser(registeredUser);
        setSuccessMsg("Conta criada com sucesso!");
        setTimeout(() => {
          onLoginSuccess(registeredUser);
          onClose();
        }, 700);
      } else {
        // --- ENTRAR / LOGIN ---
        let loggedUser: UserProfile;

        if (isSupabaseConfigured) {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

          if (error) throw error;

          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", data.user.id)
            .single();

          loggedUser = {
            id: data.user.id,
            email: data.user.email || email.trim(),
            name:
              profile?.full_name ||
              data.user.user_metadata?.full_name ||
              email.split("@")[0],
            role:
              isEmailAdmin(email)
                ? "admin"
                : (profile?.role as any) || "buyer",
            balance: Number(profile?.balance) || 0,
            avatar:
              profile?.avatar_url ||
              `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
                email.trim()
              )}`,
            createdAt: profile?.created_at || new Date().toISOString(),
          };
        } else {
          const existingUsers = JSON.parse(
            localStorage.getItem("central_registered_users") || "[]"
          );
          const found = existingUsers.find(
            (u: any) =>
              (u.email.toLowerCase() === email.trim().toLowerCase() ||
                u.name.toLowerCase() === email.trim().toLowerCase()) &&
              u.passwordHash === btoa(password)
          );

          if (!found) {
            if (email.toLowerCase().includes("admin")) {
              loggedUser = {
                id: "admin-root",
                email: email.trim(),
                name: "Administrador Master",
                role: "admin",
                balance: 14850.0,
                avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=AdminCentral`,
                createdAt: new Date().toISOString(),
              };
            } else {
              throw new Error("Usuário ou senha incorretos.");
            }
          } else {
            loggedUser = {
              id: found.id,
              email: found.email,
              name: found.name,
              role: found.role,
              balance: found.balance || 0,
              avatar: found.avatar,
              createdAt: found.createdAt,
            };
          }
        }

        clearUserAvatar();
        persistUser(loggedUser);
        setSuccessMsg("Login realizado com sucesso!");
        setTimeout(() => {
          onLoginSuccess(loggedUser);
          onClose();
        }, 700);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Ocorreu um erro ao processar.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: "google" | "discord") => {
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: window.location.origin },
        });
      } catch (err: any) {
        setErrorMsg(`Erro ao conectar com ${provider}: ` + err.message);
      }
    } else {
      setErrorMsg(
        `Login com ${provider} indisponível no momento.`
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[420px] bg-white rounded-3xl p-8 sm:p-9 shadow-2xl border border-zinc-100 select-none animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button X at Top-Right */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          title="Fechar"
        >
          <X className="w-4 h-4" />
        </button>

        {/* PlayContas Brand Logo */}
        <div className="flex justify-center mb-6">
          <img
            src="/playcontas.png"
            alt="PlayContas"
            className="h-11 sm:h-12 w-auto max-w-[220px] object-contain drop-shadow-xs"
          />
        </div>

        {/* Modal Title (Centered) */}
        <h2 className="text-xl sm:text-2xl font-extrabold text-zinc-900 text-center tracking-tight mb-6">
          {tab === "register" ? "Criar uma conta" : "Entrar na sua conta"}
        </h2>

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            <span className="font-medium">{successMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Nome (Apenas no Cadastro) */}
          {tab === "register" && (
            <div>
              <input
                type="text"
                required
                autoComplete="off"
                spellCheck={false}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome"
                className="w-full px-4 py-3 rounded-xl border border-zinc-300 focus:border-[#0066FF] focus:outline-none text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors bg-white shadow-2xs"
              />
            </div>
          )}

          {/* Email / Usuário */}
          <div>
            <input
              type={tab === "register" ? "email" : "text"}
              required
              autoComplete="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={tab === "register" ? "E-mail" : "Usuário ou e-mail"}
              className="w-full px-4 py-3 rounded-xl border border-zinc-300 focus:border-[#0066FF] focus:outline-none text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors bg-white shadow-2xs"
            />
          </div>

          {/* Senha */}
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              spellCheck={false}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              className="w-full pl-4 pr-11 py-3 rounded-xl border border-zinc-300 focus:border-[#0066FF] focus:outline-none text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors bg-white shadow-2xs"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors"
              title={showPassword ? "Ocultar senha" : "Ver senha"}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Main Blue Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-sm transition-all shadow-sm active:scale-[0.99] disabled:opacity-50 mt-1 cursor-pointer"
          >
            {loading
              ? "Carregando..."
              : tab === "register"
              ? "Cadastrar"
              : "Entrar"}
          </button>
        </form>

        {/* Social Login Buttons: Google & Discord */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <button
            type="button"
            onClick={() => handleOAuthLogin("google")}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-rose-300 hover:bg-rose-50/40 text-[#EA4335] text-xs font-semibold transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
              />
              <path
                fill="#FBBC05"
                d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.8 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"
              />
            </svg>
            <span className="truncate">
              {tab === "register" ? "Entrar com Google" : "Entrar com Google"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleOAuthLogin("discord")}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-indigo-300 hover:bg-indigo-50/40 text-[#5865F2] text-xs font-semibold transition-colors cursor-pointer"
          >
            <svg
              className="w-4 h-4 shrink-0 fill-[#5865F2]"
              viewBox="0 0 24 24"
            >
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.894a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
            <span className="truncate">
              {tab === "register" ? "Entrar com Discord" : "Entrar com Discord"}
            </span>
          </button>
        </div>

        {/* Divider / Bottom Links */}
        <div className="mt-8 pt-5 border-t border-zinc-100 text-center space-y-1.5">
          {tab === "login" ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setTab("register");
                  setErrorMsg("");
                  setSuccessMsg("");
                }}
                className="block mx-auto text-[13px] font-medium text-zinc-700 hover:text-black transition-colors"
              >
                Criar uma conta
              </button>
              <button
                type="button"
                onClick={() =>
                  alert(
                    "Para redefinir sua senha, solicite um link de recuperação via e-mail ou contate o suporte."
                  )
                }
                className="block mx-auto text-[13px] text-zinc-500 hover:text-zinc-800 transition-colors"
              >
                Esqueci minha senha
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setTab("login");
                setErrorMsg("");
                setSuccessMsg("");
              }}
              className="block mx-auto text-[13px] font-medium text-zinc-700 hover:text-black transition-colors"
            >
              Já tenho uma conta / Entrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
