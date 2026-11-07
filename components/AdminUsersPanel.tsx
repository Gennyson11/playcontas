"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Product, UserProfile } from "@/types";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { UUID_REGEX } from "@/lib/questionStore";
import {
  Search,
  RefreshCw,
  Wallet,
  Plus,
  Minus,
  Equal,
  X,
  Crown,
  Store,
  User,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Users,
  ChevronDown,
  Copy,
  Check,
  Pencil,
} from "lucide-react";

type Role = "admin" | "seller" | "buyer";
type BalanceMode = "credit" | "debit" | "set";

interface AdminUsersPanelProps {
  currentUser: UserProfile;
  users: UserProfile[];
  products: Product[];
  loading: boolean;
  loadError: string;
  onReload: () => void;
  onUsersChange: (users: UserProfile[]) => void;
}

const GROUPS: {
  role: Role;
  label: string;
  singular: string;
  hint: string;
  dot: string;
  badge: string;
  border: string;
  avatar: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    role: "admin",
    label: "Administradores",
    singular: "Admin",
    hint: "Acesso total ao painel",
    dot: "bg-amber-500",
    badge: "bg-amber-100 text-amber-900 border-amber-300",
    border: "border-l-amber-400",
    avatar: "bg-amber-500 text-white",
    icon: Crown,
  },
  {
    role: "seller",
    label: "Vendedores",
    singular: "Vendedor",
    hint: "Criam e gerenciam anúncios",
    dot: "bg-[#0066FF]",
    badge: "bg-blue-100 text-[#0066FF] border-blue-300",
    border: "border-l-[#0066FF]",
    avatar: "bg-[#0066FF] text-white",
    icon: Store,
  },
  {
    role: "buyer",
    label: "Clientes",
    singular: "Cliente",
    hint: "Compram na plataforma",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    border: "border-l-emerald-400",
    avatar: "bg-emerald-600 text-white",
    icon: User,
  },
];

const roleOf = (u: UserProfile): Role =>
  u.role === "admin" || u.role === "seller" ? u.role : "buyer";

const brl = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const initials = (name: string) => {
  const parts = (name || "?").trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name || "?").trim().slice(0, 2).toUpperCase();
};

// Aceita "10", "10.50", "10,50" e "1.000,50"
const parseAmount = (raw: string): number => {
  const value = raw.trim();
  if (!value) return NaN;
  const normalized = value.includes(",")
    ? value.replace(/\./g, "").replace(",", ".")
    : value;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};

const MODE_INFO: Record<BalanceMode, { label: string; icon: React.ComponentType<{ className?: string }>; help: string }> = {
  credit: { label: "Adicionar", icon: Plus, help: "Soma o valor ao saldo atual" },
  debit: { label: "Remover", icon: Minus, help: "Subtrai o valor do saldo atual" },
  set: { label: "Definir", icon: Equal, help: "Troca o saldo pelo valor informado" },
};

export function AdminUsersPanel({
  currentUser,
  users,
  products,
  loading,
  loadError,
  onReload,
  onUsersChange,
}: AdminUsersPanelProps) {
  const [filter, setFilter] = useState<"all" | Role>("all");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [roleBusyId, setRoleBusyId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<{ user: UserProfile; newName: string } | null>(null);
  const [savingName, setSavingName] = useState(false);

  const handleSaveUserName = async () => {
    if (!editingUser) return;
    const trimmed = editingUser.newName.trim();
    if (!trimmed) {
      setToast({ type: "error", text: "O nome não pode ficar em branco." });
      return;
    }
    setSavingName(true);
    try {
      if (isSupabaseConfigured && UUID_REGEX.test(editingUser.user.id)) {
        const { error } = await supabase
          .from("profiles")
          .update({
            full_name: trimmed,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingUser.user.id);
        if (error) throw error;
      }
      onUsersChange(
        users.map((u) => (u.id === editingUser.user.id ? { ...u, name: trimmed } : u))
      );
      setToast({
        type: "success",
        text: `Nome de "${editingUser.user.name}" alterado para "${trimmed}" com sucesso!`,
      });
      setEditingUser(null);
    } catch (err: any) {
      setToast({ type: "error", text: err?.message || "Erro ao salvar nome no banco." });
    } finally {
      setSavingName(false);
    }
  };

  const copyEmail = (user: UserProfile) => {
    try {
      navigator.clipboard.writeText(user.email);
      setCopiedId(user.id);
      setTimeout(() => setCopiedId((id) => (id === user.id ? null : id)), 1800);
    } catch {}
  };

  // Modal de saldo
  const [target, setTarget] = useState<UserProfile | null>(null);
  const [mode, setMode] = useState<BalanceMode>("credit");
  const [amountText, setAmountText] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState("");
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const adsCount = useMemo(() => {
    const map: Record<string, number> = {};
    users.forEach((u) => {
      const name = (u.name || "").toLowerCase();
      map[u.id] = products.filter(
        (p) => p.seller?.id === u.id || (name && p.seller?.name?.toLowerCase() === name)
      ).length;
    });
    return map;
  }, [users, products]);

  const counts = useMemo(
    () => ({
      admin: users.filter((u) => roleOf(u) === "admin").length,
      seller: users.filter((u) => roleOf(u) === "seller").length,
      buyer: users.filter((u) => roleOf(u) === "buyer").length,
    }),
    [users]
  );

  const totalBalance = useMemo(
    () => users.reduce((sum, u) => sum + (Number(u.balance) || 0), 0),
    [users]
  );

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = users.filter((u) => {
      if (filter !== "all" && roleOf(u) !== filter) return false;
      if (!q) return true;
      return (
        (u.name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q)
      );
    });
    const showEmptyGroups = filter === "all" && !q;
    return GROUPS.map((g) => ({
      ...g,
      items: visible
        .filter((u) => roleOf(u) === g.role)
        .sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt-BR")),
    })).filter((g) => showEmptyGroups || g.items.length > 0);
  }, [users, filter, query]);

  /* ----------------------------- Papel do usuário ----------------------------- */

  const handleRoleChange = async (user: UserProfile, nextRole: Role) => {
    if (nextRole === roleOf(user) || user.id === currentUser.id) return;

    const from = GROUPS.find((g) => g.role === roleOf(user))!.singular;
    const to = GROUPS.find((g) => g.role === nextRole)!.singular;
    const confirmed = window.confirm(
      `Alterar ${user.name} (${user.email}) de ${from} para ${to}?`
    );
    if (!confirmed) return;

    if (!isSupabaseConfigured || !UUID_REGEX.test(user.id)) {
      setToast({ type: "error", text: "Este usuário não está cadastrado no banco de dados." });
      return;
    }

    setRoleBusyId(user.id);
    try {
      // 1. Tenta via RPC com privilégios de admin
      let rpcSuccess = false;
      try {
        const { error: rpcErr } = await supabase.rpc("admin_set_role", {
          target_id: user.id,
          new_role: nextRole,
        });
        if (!rpcErr) {
          rpcSuccess = true;
        }
      } catch {}

      // 2. Se o RPC não respondeu, faz o update direto
      if (!rpcSuccess) {
        const updatePayload: any = { role: nextRole };
        if (nextRole === "seller" || nextRole === "admin") {
          updatePayload.is_verified = true;
        }
        const { error } = await supabase
          .from("profiles")
          .update(updatePayload)
          .eq("id", user.id);
        if (error) throw error;
      }

      onUsersChange(users.map((u) => (u.id === user.id ? { ...u, role: nextRole } : u)));
      setToast({ type: "success", text: `${user.name} agora é ${to}.` });
    } catch (err: any) {
      setToast({ type: "error", text: err?.message || "Não foi possível alterar o tipo da conta." });
    } finally {
      setRoleBusyId(null);
    }
  };

  /* --------------------------------- Saldo --------------------------------- */

  const loadHistory = async (userId: string) => {
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) return;
    try {
      const { data, error } = await supabase
        .from("balance_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (!error && data) setHistory(data);
    } catch {}
  };

  const openBalanceModal = (user: UserProfile) => {
    setTarget(user);
    setMode("credit");
    setAmountText("");
    setNote("");
    setModalError("");
    setHistory([]);
    loadHistory(user.id);
  };

  const closeBalanceModal = () => {
    if (busy) return;
    setTarget(null);
  };

  const amount = parseAmount(amountText);
  const currentBalance = Number(target?.balance) || 0;
  const previewBalance = !Number.isFinite(amount)
    ? currentBalance
    : mode === "credit"
    ? currentBalance + amount
    : mode === "debit"
    ? currentBalance - amount
    : amount;
  const amountValid =
    Number.isFinite(amount) && (mode === "set" ? amount >= 0 : amount > 0) && previewBalance >= 0;

  const handleConfirmBalance = async () => {
    if (!target || busy) return;
    setModalError("");

    if (!amountValid) {
      setModalError(
        previewBalance < 0
          ? "O saldo não pode ficar negativo."
          : "Informe um valor válido."
      );
      return;
    }
    if (!isSupabaseConfigured || !UUID_REGEX.test(target.id)) {
      setModalError("Este usuário não está cadastrado no banco de dados.");
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("admin_adjust_balance", {
        target_user: target.id,
        adjust_mode: mode,
        adjust_amount: amount,
        adjust_note: note.trim() || null,
      });

      if (error) {
        const msg = error.message || "";
        if (error.code === "PGRST202" || msg.includes("Could not find the function")) {
          throw new Error(
            "A função de saldo ainda não existe no banco. Execute o script admin-saldo-usuarios.sql no SQL Editor."
          );
        }
        throw new Error(msg || "Não foi possível ajustar o saldo.");
      }

      const newBalance = Number(data);
      const finalBalance = Number.isFinite(newBalance) ? newBalance : previewBalance;
      onUsersChange(users.map((u) => (u.id === target.id ? { ...u, balance: finalBalance } : u)));
      setToast({
        type: "success",
        text: `Saldo de ${target.name} atualizado para ${brl(finalBalance)}.`,
      });
      setBusy(false);
      setTarget(null);
    } catch (err: any) {
      setModalError(err?.message || "Não foi possível ajustar o saldo.");
      setBusy(false);
    }
  };

  const targetGroup = target ? GROUPS.find((g) => g.role === roleOf(target)) : null;

  /* --------------------------------- Render --------------------------------- */

  return (
    <div className="space-y-6 animate-fadeIn select-text">
      {/* Resumo (os cards também funcionam como filtro) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(
          [
            {
              key: "all" as const,
              label: "Total de contas",
              value: String(users.length),
              icon: Users,
              tile: "bg-zinc-100 text-zinc-700",
              ring: "ring-zinc-900",
            },
            {
              key: "seller" as const,
              label: "Vendedores",
              value: String(counts.seller),
              icon: Store,
              tile: "bg-blue-50 text-[#0066FF]",
              ring: "ring-[#0066FF]",
            },
            {
              key: "buyer" as const,
              label: "Clientes",
              value: String(counts.buyer),
              icon: User,
              tile: "bg-emerald-50 text-emerald-600",
              ring: "ring-emerald-500",
            },
          ]
        ).map((c) => {
          const Icon = c.icon;
          const active = filter === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setFilter(active && c.key !== "all" ? "all" : c.key)}
              className={`text-left flex items-center gap-4 bg-white rounded-3xl border border-zinc-200 p-6 shadow-xs hover:border-zinc-300 hover:shadow-sm transition-all cursor-pointer ${
                active ? `ring-2 ${c.ring} ring-offset-2 ring-offset-[#F8FAFC]` : ""
              }`}
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${c.tile}`}>
                <Icon className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black uppercase tracking-wider text-zinc-500 truncate">
                  {c.label}
                </div>
                <div className="text-4xl font-black text-zinc-950 leading-tight">{c.value}</div>
              </div>
            </button>
          );
        })}

        <div className="flex items-center gap-4 bg-white rounded-3xl border border-zinc-200 p-6 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Wallet className="w-7 h-7" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-wider text-zinc-500 truncate">
              Saldo em contas
            </div>
            <div className="text-4xl font-black text-zinc-950 leading-tight truncate">
              {brl(totalBalance)}
            </div>
          </div>
        </div>
      </div>

      {/* Aviso de resultado */}
      {toast && (
        <div
          className={`flex items-start gap-2 rounded-2xl border px-4 py-3 text-xs font-semibold ${
            toast.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
          )}
          <span className="flex-1">{toast.text}</span>
          <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filtros e busca */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-xs p-6 sm:p-8 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { key: "all", label: "Todos", count: users.length },
                { key: "seller", label: "Vendedores", count: counts.seller },
                { key: "buyer", label: "Clientes", count: counts.buyer },
                { key: "admin", label: "Admins", count: counts.admin },
              ] as { key: "all" | Role; label: string; count: number }[]
            ).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-2.5 rounded-xl text-sm font-black transition-colors cursor-pointer border ${
                  filter === f.key
                    ? "bg-zinc-950 text-white border-zinc-950"
                    : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:text-zinc-900"
                }`}
              >
                {f.label} <span className="opacity-60">· {f.count}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 lg:w-72">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome ou e-mail..."
                className="w-full pl-10 pr-3 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-[#0066FF] text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
              />
            </div>
            <button
              onClick={onReload}
              disabled={loading}
              title="Atualizar lista"
              className="p-2.5 rounded-xl border border-zinc-200 hover:border-[#0066FF] text-zinc-600 hover:text-[#0066FF] transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {loadError && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
            <span>{loadError}</span>
          </div>
        )}

        {loading && users.length === 0 ? (
          <div className="py-12 flex items-center justify-center gap-2 text-xs font-bold text-zinc-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando usuários...
          </div>
        ) : grouped.length === 0 ? (
          <div className="py-12 text-center text-xs font-semibold text-zinc-400">
            {users.length === 0
              ? "Nenhum usuário encontrado."
              : "Nenhum usuário corresponde à busca ou ao filtro."}
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map((g) => {
              const Icon = g.icon;
              const isCollapsed = !!collapsed[g.role];
              return (
                <section
                  key={g.role}
                  className="rounded-2xl border border-zinc-200 bg-white overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setCollapsed((c) => ({ ...c, [g.role]: !c[g.role] }))}
                    className="w-full flex items-center justify-between gap-3 bg-zinc-50/80 hover:bg-zinc-50 px-4 py-3 text-left cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-1 h-7 rounded-full ${g.dot}`} />
                      <Icon className="w-4 h-4 text-zinc-700 shrink-0" />
                      <h3 className="text-base font-black text-zinc-950 tracking-tight">{g.label}</h3>
                      <span className="px-2 py-0.5 rounded-full bg-white border border-zinc-200 text-[11px] font-black text-zinc-700">
                        {g.items.length}
                      </span>
                      <span className="text-[11px] font-semibold text-zinc-400 hidden md:inline truncate">
                        {g.hint}
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform ${
                        isCollapsed ? "-rotate-90" : ""
                      }`}
                    />
                  </button>

                  {!isCollapsed && g.items.length === 0 && (
                    <div className="px-4 py-6 text-center text-xs font-semibold text-zinc-400 border-t border-zinc-100">
                      Nenhum {g.singular.toLowerCase()} por aqui ainda.
                    </div>
                  )}

                  {!isCollapsed && g.items.length > 0 && (
                    <div className="overflow-x-auto border-t border-zinc-100">
                      <table className="w-full min-w-[820px] text-left text-sm">
                        <thead>
                          <tr className="text-zinc-400 uppercase font-black tracking-wider text-[10px] border-b border-zinc-100">
                            <th className="py-3 px-5 w-[34%]">Usuário</th>
                            <th className="py-3 px-5">Anúncios</th>
                            <th className="py-3 px-5">Saldo</th>
                            <th className="py-3 px-5">Cadastro</th>
                            <th className="py-3 px-5 text-right">Tipo da conta</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {g.items.map((u) => {
                            const isSelf = u.id === currentUser.id;
                            const ads = adsCount[u.id] || 0;
                            const balance = Number(u.balance) || 0;
                            const hasPhoto = !!u.avatar && !u.avatar.includes("dicebear");
                            return (
                              <tr key={u.id} className="hover:bg-zinc-50/70 transition-colors">
                                <td className="py-4 px-5">
                                  <div className="flex items-center gap-3">
                                    {hasPhoto ? (
                                      <img
                                        src={u.avatar}
                                        alt={u.name}
                                        loading="lazy"
                                        className="w-12 h-12 rounded-2xl object-cover border border-zinc-200 shrink-0"
                                      />
                                    ) : (
                                      <div
                                        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-[11px] font-black shrink-0 ${g.avatar}`}
                                      >
                                        {initials(u.name)}
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <div className="font-bold text-zinc-900 truncate flex items-center gap-1.5">
                                        {u.name}
                                        {isSelf && (
                                          <span className="text-[10px] font-black text-[#0066FF] bg-blue-50 border border-blue-100 px-1.5 rounded">
                                            você
                                          </span>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => setEditingUser({ user: u, newName: u.name })}
                                          title={`Editar nome de ${u.name}`}
                                          className="p-1 rounded text-zinc-400 hover:text-[#0066FF] hover:bg-blue-50 transition-colors cursor-pointer shrink-0"
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </button>
                                      </div>
                                      <div className="flex items-center gap-1 text-xs text-zinc-500 min-w-0">
                                        <span className="truncate">{u.email}</span>
                                        <button
                                          type="button"
                                          onClick={() => copyEmail(u)}
                                          title="Copiar e-mail"
                                          className="p-0.5 rounded text-zinc-300 hover:text-[#0066FF] transition-colors cursor-pointer shrink-0"
                                        >
                                          {copiedId === u.id ? (
                                            <Check className="w-3 h-3 text-emerald-500" />
                                          ) : (
                                            <Copy className="w-3 h-3" />
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-4 px-5 text-zinc-700 font-bold whitespace-nowrap">
                                  {ads > 0 ? (
                                    <span>
                                      {ads}
                                      {g.role === "buyer" && (
                                        <span
                                          className="ml-1.5 text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded"
                                          title="Este cliente tem anúncios publicados. Considere promover a Vendedor."
                                        >
                                          tem anúncios
                                        </span>
                                      )}
                                    </span>
                                  ) : (
                                    <span className="text-zinc-300">—</span>
                                  )}
                                </td>
                                <td className="py-4 px-5 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`font-extrabold ${
                                        balance > 0 ? "text-emerald-600" : "text-zinc-400"
                                      }`}
                                    >
                                      {brl(balance)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => openBalanceModal(u)}
                                      title="Ajustar saldo"
                                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs transition-colors shadow-2xs cursor-pointer"
                                    >
                                      <Wallet className="w-3 h-3" />
                                      Ajustar
                                    </button>
                                  </div>
                                </td>
                                <td className="py-4 px-5 text-zinc-400 whitespace-nowrap">
                                  {u.createdAt || "—"}
                                </td>
                                <td className="py-4 px-5 text-right">
                                  <select
                                    value={roleOf(u)}
                                    disabled={isSelf || roleBusyId === u.id}
                                    onChange={(e) => handleRoleChange(u, e.target.value as Role)}
                                    title={
                                      isSelf
                                        ? "Você não pode alterar o tipo da sua própria conta"
                                        : "Alterar tipo da conta"
                                    }
                                    className={`px-3.5 py-2 rounded-lg border text-xs font-black uppercase tracking-wider focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${g.badge}`}
                                  >
                                    <option value="buyer">Cliente</option>
                                    <option value="seller">Vendedor</option>
                                    <option value="admin">Admin</option>
                                  </select>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de ajuste de saldo */}
      {target && targetGroup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeBalanceModal();
          }}
        >
          <div className="relative w-full max-w-md bg-white border border-zinc-200 rounded-3xl shadow-2xl my-6 overflow-hidden">
            <div className="flex items-start justify-between gap-3 p-5 border-b border-zinc-100">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center text-sm font-black shrink-0 ${targetGroup.avatar}`}
                >
                  {initials(target.name)}
                </div>
                <div className="min-w-0">
                  <div className="font-black text-zinc-950 truncate">{target.name}</div>
                  <div className="text-[11px] text-zinc-500 font-mono truncate">{target.email}</div>
                  <span
                    className={`inline-flex mt-1 px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider ${targetGroup.badge}`}
                  >
                    {targetGroup.singular}
                  </span>
                </div>
              </div>
              <button
                onClick={closeBalanceModal}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-2xl bg-zinc-50 border border-zinc-200 p-4 flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">
                  Saldo atual
                </span>
                <span className="text-xl font-black text-zinc-950">{brl(currentBalance)}</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-100 rounded-xl">
                {(Object.keys(MODE_INFO) as BalanceMode[]).map((m) => {
                  const Icon = MODE_INFO[m].icon;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-black transition-colors cursor-pointer ${
                        mode === m
                          ? "bg-white text-zinc-950 shadow-xs"
                          : "text-zinc-500 hover:text-zinc-800"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {MODE_INFO[m].label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-zinc-400 font-medium -mt-2">{MODE_INFO[mode].help}</p>

              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-zinc-500 block mb-1.5">
                  Valor (R$)
                </label>
                <input
                  autoFocus
                  inputMode="decimal"
                  value={amountText}
                  onChange={(e) => setAmountText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirmBalance();
                  }}
                  placeholder="0,00"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-[#0066FF] text-lg font-black text-zinc-950 placeholder:text-zinc-300 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-zinc-500">Novo saldo</span>
                <span
                  className={
                    previewBalance < 0
                      ? "text-rose-600"
                      : previewBalance > currentBalance
                      ? "text-emerald-600"
                      : previewBalance < currentBalance
                      ? "text-amber-600"
                      : "text-zinc-900"
                  }
                >
                  {brl(previewBalance)}
                </span>
              </div>

              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-zinc-500 block mb-1.5">
                  Motivo (opcional)
                </label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={140}
                  placeholder="Ex.: bônus de boas-vindas, estorno do pedido..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-[#0066FF] text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
                />
              </div>

              {modalError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-800">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                  <span>{modalError}</span>
                </div>
              )}

              {history.length > 0 && (
                <div>
                  <div className="text-[11px] font-black uppercase tracking-wider text-zinc-500 mb-1.5">
                    Últimas movimentações
                  </div>
                  <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 overflow-hidden">
                    {history.map((h) => (
                      <li key={h.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[11px]">
                        <div className="min-w-0">
                          <div className="font-bold text-zinc-800 truncate">
                            {h.kind === "credit" ? "Crédito" : h.kind === "debit" ? "Débito" : "Ajuste"}
                            {h.note ? ` · ${h.note}` : ""}
                          </div>
                          <div className="text-zinc-400">
                            {new Date(h.created_at).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div
                            className={`font-black ${
                              h.kind === "credit"
                                ? "text-emerald-600"
                                : h.kind === "debit"
                                ? "text-rose-600"
                                : "text-zinc-800"
                            }`}
                          >
                            {h.kind === "credit" ? "+" : h.kind === "debit" ? "-" : "="}
                            {brl(Number(h.kind === "set" ? h.balance_after : h.amount))}
                          </div>
                          <div className="text-zinc-400">saldo {brl(Number(h.balance_after))}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 bg-zinc-50 border-t border-zinc-100">
              <button
                onClick={closeBalanceModal}
                disabled={busy}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmBalance}
                disabled={busy || !amountValid}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black transition-colors cursor-pointer"
              >
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {mode === "credit"
                  ? "Adicionar saldo"
                  : mode === "debit"
                  ? "Remover saldo"
                  : "Definir saldo"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Editar Nome */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-zinc-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-[#0066FF]">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-zinc-900">Editar Nome do Usuário</h3>
                  <p className="text-[11px] text-zinc-400">{editingUser.user.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider">
                Novo Nome Público / Loja
              </label>
              <input
                type="text"
                value={editingUser.newName}
                onChange={(e) => setEditingUser({ ...editingUser, newName: e.target.value })}
                placeholder="Ex: BuscaNinja"
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white text-sm font-bold text-zinc-900 focus:outline-none focus:border-[#0066FF] transition-all"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={savingName || !editingUser.newName.trim()}
                onClick={handleSaveUserName}
                className="px-5 py-2 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {savingName ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>Salvar Alteração</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}