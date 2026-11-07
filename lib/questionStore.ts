import { Question, UserProfile, Product } from "@/types";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { getStoredProducts } from "./productStore";
import { addNotification } from "./notificationStore";

/**
 * Perguntas e respostas dos anúncios salvas no Supabase (tabela product_questions).
 * Todas as funções retornam null/false quando o Supabase não está disponível
 * (ou a tabela ainda não foi criada), para o site usar o cache local como reserva.
 */

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ManagedQuestion {
  id: string;
  productId: string;
  productTitle: string;
  productImage?: string;
  productPrice?: number;
  sellerId: string;
  sellerName: string;
  askerId?: string;
  askerName: string;
  askerAvatar: string;
  question: string;
  answer?: string;
  createdAt: string;
  answeredAt?: string;
  isReported?: boolean;
}

function formatDate(iso?: string | null): string {
  return iso || "";
}

function rowToQuestion(row: any): Question {
  let user = row.asker_name || "Comprador";
  if (user.toLowerCase().includes("jovizeira") || row.asker_id === "fcaba04d-92ec-45b3-a626-013318cc0f8c") {
    user = "BuscaNinja";
  }
  let avatar = row.asker_avatar || "";
  if (avatar.toLowerCase().includes("jovizeira")) {
    avatar = avatar.replace(/jovizeira/gi, "BuscaNinja");
  }
  return {
    id: row.id,
    user,
    avatar,
    question: row.question,
    date: formatDate(row.created_at),
    answer: row.answer || undefined,
    answeredAt: row.answered_at ? formatDate(row.answered_at) : undefined,
    userId: row.asker_id || undefined,
  };
}

export async function fetchQuestions(productId: string): Promise<Question[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from("product_questions")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    if (error || !data) return null;
    return data.map(rowToQuestion);
  } catch {
    return null;
  }
}

export interface NewQuestionInput {
  productId: string;
  productTitle: string;
  sellerId: string;
  sellerName: string;
  askerId?: string;
  askerName: string;
  askerAvatar: string;
  question: string;
}

export async function insertQuestion(input: NewQuestionInput): Promise<Question | null> {
  if (!isSupabaseConfigured || !input.askerId || !UUID_REGEX.test(input.askerId)) return null;
  try {
    const { data, error } = await supabase
      .from("product_questions")
      .insert({
        product_id: input.productId,
        product_title: input.productTitle,
        seller_id: input.sellerId,
        seller_name: input.sellerName,
        asker_id: input.askerId,
        asker_name: input.askerName,
        asker_avatar: input.askerAvatar,
        question: input.question,
      })
      .select()
      .single();
    if (error || !data) return null;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("central_questions_changed"));
    }
    return rowToQuestion(data);
  } catch {
    return null;
  }
}

export async function answerQuestionRemote(questionId: string, answer: string): Promise<boolean> {
  if (!isSupabaseConfigured || !UUID_REGEX.test(questionId)) return false;
  try {
    const { error } = await supabase
      .from("product_questions")
      .update({ answer, answered_at: new Date().toISOString() })
      .eq("id", questionId);
    if (!error && typeof window !== "undefined") {
      window.dispatchEvent(new Event("central_questions_changed"));
    }
    return !error;
  } catch {
    return false;
  }
}

export async function deleteQuestionRemote(questionId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !UUID_REGEX.test(questionId)) return false;
  try {
    const { error } = await supabase.from("product_questions").delete().eq("id", questionId);
    if (!error && typeof window !== "undefined") {
      window.dispatchEvent(new Event("central_questions_changed"));
    }
    return !error;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------
   SISTEMA DE GERENCIAMENTO DE PERGUNTAS (RECEBIDAS / FEITAS POR MIM)
   ------------------------------------------------------------------------- */

const REPORTED_QUESTIONS_KEY = "central_reported_questions_set";

export function getReportedQuestionsSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(REPORTED_QUESTIONS_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}

export function reportQuestionLocally(questionId: string): void {
  if (typeof window === "undefined") return;
  try {
    const set = getReportedQuestionsSet();
    set.add(questionId);
    localStorage.setItem(REPORTED_QUESTIONS_KEY, JSON.stringify(Array.from(set)));
    window.dispatchEvent(new Event("central_questions_changed"));
  } catch {}
}

export function unreportQuestionLocally(questionId: string): void {
  if (typeof window === "undefined") return;
  try {
    const set = getReportedQuestionsSet();
    set.delete(questionId);
    localStorage.setItem(REPORTED_QUESTIONS_KEY, JSON.stringify(Array.from(set)));
    window.dispatchEvent(new Event("central_questions_changed"));
  } catch {}
}

/**
 * Busca todas as perguntas recebidas nos anúncios do vendedor logado.
 */
export async function fetchReceivedQuestions(
  currentUser: UserProfile | null
): Promise<ManagedQuestion[]> {
  if (!currentUser) return [];

  const allProducts = getStoredProducts();
  const myProducts = allProducts.filter((p) => {
    const sellerId = (p.seller?.id || "").trim();
    const sellerName = (p.seller?.name || "").toLowerCase().trim();
    const sellerEmail = ((p.seller as any)?.email || "").toLowerCase().trim();

    const currentUserId = (currentUser.id || "").trim();
    const currentUserName = (currentUser.name || "").toLowerCase().trim();
    const currentUserEmail = (currentUser.email || "").toLowerCase().trim();

    const idMatches = currentUserId && sellerId && currentUserId === sellerId;
    const nameMatches = currentUserName && sellerName && currentUserName === sellerName;
    const emailMatches = currentUserEmail && sellerEmail && currentUserEmail === sellerEmail;

    return Boolean(idMatches || nameMatches || emailMatches);
  });

  const productMap = new Map<string, Product>();
  allProducts.forEach((p) => productMap.set(p.id, p));

  const questionsMap = new Map<string, ManagedQuestion>();
  const reportedSet = getReportedQuestionsSet();

  // 1. Carrega perguntas locais dos produtos do vendedor
  myProducts.forEach((p) => {
    const localQuestions: Question[] = [];
    if (p.questions && Array.isArray(p.questions)) {
      localQuestions.push(...p.questions);
    }
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(`central_questions_${p.id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) localQuestions.push(...parsed);
        }
      } catch {}
    }

    localQuestions.forEach((q) => {
      if (!q || !q.id) return;
      questionsMap.set(q.id, {
        id: q.id,
        productId: p.id,
        productTitle: p.title,
        productImage: p.image,
        productPrice: p.price,
        sellerId: p.seller?.id || currentUser.id,
        sellerName: p.seller?.name || currentUser.name,
        askerId: q.userId,
        askerName: q.user || "Comprador",
        askerAvatar:
          q.avatar ||
          `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(q.user || "usr")}`,
        question: q.question,
        answer: q.answer,
        createdAt: q.date || new Date().toISOString(),
        answeredAt: q.answeredAt,
        isReported: reportedSet.has(q.id),
      });
    });
  });

  // 2. Busca perguntas no Supabase para o vendedor
  if (isSupabaseConfigured) {
    try {
      let query = supabase.from("product_questions").select("*");
      if (currentUser.id && UUID_REGEX.test(currentUser.id)) {
        query = query.or(
          `seller_id.eq.${currentUser.id},seller_name.ilike.%${currentUser.name || ""}%`
        );
      } else if (currentUser.name) {
        query = query.ilike("seller_name", `%${currentUser.name}%`);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (!error && data) {
        data.forEach((row: any) => {
          const p = productMap.get(row.product_id);
          questionsMap.set(row.id, {
            id: row.id,
            productId: row.product_id,
            productTitle: row.product_title || p?.title || "Anúncio",
            productImage: p?.image,
            productPrice: p?.price,
            sellerId: row.seller_id,
            sellerName: row.seller_name,
            askerId: row.asker_id,
            askerName: row.asker_name || "Comprador",
            askerAvatar:
              row.asker_avatar ||
              `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
                row.asker_name || "usr"
              )}`,
            question: row.question,
            answer: row.answer || undefined,
            createdAt: row.created_at,
            answeredAt: row.answered_at || undefined,
            isReported: reportedSet.has(row.id),
          });
        });
      }
    } catch (err) {
      console.warn("Aviso ao buscar perguntas recebidas:", err);
    }
  }

  return Array.from(questionsMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Busca todas as perguntas feitas pelo usuário logado em qualquer anúncio.
 */
export async function fetchMyAskedQuestions(
  currentUser: UserProfile | null
): Promise<ManagedQuestion[]> {
  if (!currentUser) return [];

  const allProducts = getStoredProducts();
  const productMap = new Map<string, Product>();
  allProducts.forEach((p) => productMap.set(p.id, p));

  const questionsMap = new Map<string, ManagedQuestion>();
  const reportedSet = getReportedQuestionsSet();

  // 1. Busca perguntas locais feitas pelo usuário
  allProducts.forEach((p) => {
    const list: Question[] = [];
    if (p.questions && Array.isArray(p.questions)) list.push(...p.questions);
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(`central_questions_${p.id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) list.push(...parsed);
        }
      } catch {}
    }

    list.forEach((q) => {
      const isMyQuestion =
        (q.userId && q.userId === currentUser.id) ||
        (q.user && q.user.toLowerCase() === currentUser.name.toLowerCase());

      if (isMyQuestion && q.id) {
        questionsMap.set(q.id, {
          id: q.id,
          productId: p.id,
          productTitle: p.title,
          productImage: p.image,
          productPrice: p.price,
          sellerId: p.seller?.id || "",
          sellerName: p.seller?.name || "Vendedor",
          askerId: currentUser.id,
          askerName: currentUser.name,
          askerAvatar: currentUser.avatar,
          question: q.question,
          answer: q.answer,
          createdAt: q.date || new Date().toISOString(),
          answeredAt: q.answeredAt,
          isReported: reportedSet.has(q.id),
        });
      }
    });
  });

  // 2. Busca perguntas no Supabase feitas por este usuário
  if (isSupabaseConfigured) {
    try {
      let query = supabase.from("product_questions").select("*");
      if (currentUser.id && UUID_REGEX.test(currentUser.id)) {
        query = query.or(
          `asker_id.eq.${currentUser.id},asker_name.ilike.%${currentUser.name || ""}%`
        );
      } else if (currentUser.name) {
        query = query.ilike("asker_name", `%${currentUser.name}%`);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (!error && data) {
        data.forEach((row: any) => {
          const p = productMap.get(row.product_id);
          questionsMap.set(row.id, {
            id: row.id,
            productId: row.product_id,
            productTitle: row.product_title || p?.title || "Anúncio",
            productImage: p?.image,
            productPrice: p?.price,
            sellerId: row.seller_id,
            sellerName: row.seller_name,
            askerId: row.asker_id,
            askerName: row.asker_name,
            askerAvatar: row.asker_avatar,
            question: row.question,
            answer: row.answer || undefined,
            createdAt: row.created_at,
            answeredAt: row.answered_at || undefined,
            isReported: reportedSet.has(row.id),
          });
        });
      }
    } catch (err) {
      console.warn("Aviso ao buscar perguntas feitas por mim:", err);
    }
  }

  return Array.from(questionsMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Responde uma pergunta recebida e notifica o comprador
 */
export async function submitQuestionReply(
  question: ManagedQuestion,
  answerText: string
): Promise<boolean> {
  const trimmed = answerText.trim();
  if (!trimmed) return false;

  const nowIso = new Date().toISOString();

  // 1. Atualiza no Supabase se existir
  if (isSupabaseConfigured && UUID_REGEX.test(question.id)) {
    await answerQuestionRemote(question.id, trimmed);
  }

  // 2. Atualiza no cache local do produto e nos produtos em cache
  if (typeof window !== "undefined" && question.productId) {
    try {
      const key = `central_questions_${question.productId}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const list: Question[] = JSON.parse(raw);
        const updated = list.map((q) =>
          q.id === question.id
            ? { ...q, answer: trimmed, answeredAt: nowIso }
            : q
        );
        localStorage.setItem(key, JSON.stringify(updated));
      }

      // Atualiza também no catálogo de produtos em cache
      const rawProds = localStorage.getItem("central_cached_products");
      if (rawProds) {
        const prods = JSON.parse(rawProds);
        if (Array.isArray(prods)) {
          const synced = prods.map((p: any) => {
            if (p.id === question.productId && Array.isArray(p.questions)) {
              return {
                ...p,
                questions: p.questions.map((q: any) =>
                  q.id === question.id ? { ...q, answer: trimmed, answeredAt: nowIso } : q
                ),
              };
            }
            return p;
          });
          localStorage.setItem("central_cached_products", JSON.stringify(synced));
        }
      }
    } catch {}
  }

  // 3. Notifica o comprador
  try {
    await addNotification({
      kind: "answer",
      recipientId: question.askerId,
      recipientName: question.askerName,
      title: "O vendedor respondeu sua pergunta",
      body: `Em "${question.productTitle}": "${trimmed}"`,
      link: `/anuncio/${question.productId}`,
      productTitle: question.productTitle,
      productImage: question.productImage,
    });
  } catch {}

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("central_questions_changed"));
  }

  return true;
}

/**
 * Exclui uma pergunta
 */
export async function deleteManagedQuestion(question: ManagedQuestion): Promise<boolean> {
  if (isSupabaseConfigured && UUID_REGEX.test(question.id)) {
    await deleteQuestionRemote(question.id);
  }

  if (typeof window !== "undefined" && question.productId) {
    try {
      const key = `central_questions_${question.productId}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const list: Question[] = JSON.parse(raw);
        const updated = list.filter((q) => q.id !== question.id);
        localStorage.setItem(key, JSON.stringify(updated));
      }

      // Remove também do catálogo em cache
      const rawProds = localStorage.getItem("central_cached_products");
      if (rawProds) {
        const prods = JSON.parse(rawProds);
        if (Array.isArray(prods)) {
          const synced = prods.map((p: any) => {
            if (p.id === question.productId && Array.isArray(p.questions)) {
              return {
                ...p,
                questions: p.questions.filter((q: any) => q.id !== question.id),
              };
            }
            return p;
          });
          localStorage.setItem("central_cached_products", JSON.stringify(synced));
        }
      }
    } catch {}
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("central_questions_changed"));
  }

  return true;
}
