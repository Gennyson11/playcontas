"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { JamHeader } from "@/components/JamHeader";
import { JamFooter } from "@/components/JamFooter";
import { CartModal } from "@/components/CartModal";
import { AuthModal } from "@/components/AuthModal";
import { UserProfile, CartItem } from "@/types";
import { getStoredUserSync, clearStoredUser } from "@/lib/authStore";
import {
  RotateCcw,
  ShieldCheck,
  Building2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  HelpCircle,
  CreditCard,
  UserX,
  Scale,
  RefreshCw,
  FileText,
} from "lucide-react";

export default function ReembolsoPage() {
  const router = useRouter();

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // User state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getStoredUserSync());
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialTab, setAuthInitialTab] = useState<"login" | "register">("register");

  // Cart state
  const [cartModalOpen, setCartModalOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("central_cart");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  useEffect(() => {
    const syncUser = () => setCurrentUser(getStoredUserSync());
    window.addEventListener("central_auth_changed", syncUser);
    window.addEventListener("storage", syncUser);
    return () => {
      window.removeEventListener("central_auth_changed", syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  const cartCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-zinc-800 antialiased selection:bg-[#0066FF] selection:text-white">
      {/* Header */}
      <JamHeader
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          if (q.trim()) router.push(`/?search=${encodeURIComponent(q.trim())}`);
        }}
        cartCount={cartCount}
        onOpenCart={() => setCartModalOpen(true)}
        onOpenCreateListing={() => router.push("/anunciar")}
        currentUser={currentUser}
        onOpenAuth={(tab?: "login" | "register") => {
          setAuthInitialTab(tab || "login");
          setAuthModalOpen(true);
        }}
        onOpenAdmin={() => router.push("/admin")}
        onOpenSettings={() => router.push("/minha-conta")}
        onOpenMyProducts={() => router.push("/meus-produtos")}
        onGoHome={() => router.push("/")}
        onLogout={async () => {
          await clearStoredUser();
          setCurrentUser(null);
        }}
      />

      {/* Main Content */}
      <main className="flex-1 pb-16">
        {/* Hero Banner */}
        <div className="bg-gradient-to-b from-white via-blue-50/20 to-transparent pt-10 pb-12 sm:pt-14 sm:pb-16 text-center border-b border-zinc-200/60">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-[#0066FF] border border-blue-200 mb-4 shadow-2xs">
              <RotateCcw className="w-3.5 h-3.5 text-[#0066FF]" />
              Proteção ao Comprador & Devoluções
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-zinc-950 tracking-tight mb-3">
              Política de Reembolso
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 font-medium max-w-xl mx-auto">
              Última atualização: 23/10/2026
            </p>
          </div>
        </div>

        {/* Legal Text Content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-10">
          <div className="bg-white rounded-3xl border border-zinc-200/90 p-6 sm:p-10 md:p-12 shadow-xs space-y-10 text-zinc-700 text-sm leading-relaxed">
            {/* Introdução */}
            <div className="space-y-4">
              <p className="text-base text-zinc-800 leading-relaxed font-normal">
                Esta Política explica como funciona a proteção do comprador na <strong>PlayContas</strong>, em quais situações um pedido é cancelado e o valor devolvido e como pedir o reembolso. Ela faz parte dos{" "}
                <Link href="/termos" className="text-[#0066FF] font-semibold underline underline-offset-2 hover:text-blue-700">
                  Termos de Uso
                </Link>{" "}
                e não limita os direitos garantidos pelo Código de Defesa do Consumidor e pelo Decreto nº 7.962/2013.
              </p>

              {/* Box de Identificação e Suporte */}
              <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-2 text-xs sm:text-sm text-zinc-600">
                <div className="flex items-center gap-2 font-bold text-zinc-900 text-sm">
                  <Building2 className="w-4 h-4 text-[#0066FF]" />
                  <span>Responsável e Canais de Atendimento</span>
                </div>
                <p>
                  <strong>Responsável:</strong> GM Marketing LTDA, inscrita no CNPJ sob o nº 63.348.271/0001-02.
                </p>
                <p>
                  <strong>Atendimento:</strong> chat do pedido, Central de Ajuda ou pelo e-mail{" "}
                  <a href="mailto:contato@playcontas.com.br" className="text-[#0066FF] font-medium hover:underline">
                    contato@playcontas.com.br
                  </a>, que atende também quem está sem acesso à conta.
                </p>
              </div>
            </div>

            {/* 1. Como funciona a Garantia PlayContas */}
            <section className="space-y-3 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-2.5 font-black text-zinc-950 text-lg">
                <ShieldCheck className="w-5 h-5 text-[#0066FF]" />
                <h2>1. Como funciona a Garantia PlayContas</h2>
              </div>
              <ul className="space-y-2 pl-4 border-l-2 border-zinc-200 text-zinc-700">
                <li>
                  <strong>1.1.</strong> Quando você compra, o pagamento não vai direto para o vendedor: ele fica retido pela PlayContas. O vendedor entrega pelo pedido e, a partir da entrega, começa a garantia do anúncio (7, 14 ou 30 dias, informada na página do anúncio). Só quando a garantia termina sem nenhum problema aberto o valor é liberado para o vendedor.
                </li>
                <li>
                  <strong>1.2.</strong> A Garantia é um serviço da PlayContas que complementa os seus direitos legais e não os substitui. O fim da garantia, a conclusão do pedido ou a liberação do valor ao vendedor não acabam com os direitos previstos em lei (seção 5).
                </li>
                <li>
                  <strong>1.3.</strong> Negociações e pagamentos feitos fora da PlayContas não passam pelo pedido e não têm a Garantia.
                </li>
              </ul>
            </section>

            {/* 2. Quando o reembolso pode ser solicitado */}
            <section className="space-y-4 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-2.5 font-black text-zinc-950 text-lg">
                <CheckCircle2 className="w-5 h-5 text-[#0066FF]" />
                <h2>2. Quando o reembolso pode ser solicitado</h2>
              </div>
              <ul className="space-y-2.5 pl-4 border-l-2 border-zinc-200">
                <li>
                  <strong>Desistência antes da entrega:</strong> o pedido é cancelado e o valor devolvido (seções 3 e 7).
                </li>
                <li>
                  <strong>Produto não entregue ou entrega atrasada:</strong> você pode exigir a entrega ou o cancelamento com reembolso.
                </li>
                <li>
                  <strong>Produto diferente do anúncio:</strong> dados errados, conta diferente da descrita, item faltando, código inválido ou já usado. Você não é obrigado a aceitar um produto substituto ou um desconto.
                </li>
                <li>
                  <strong>Produto que parou de funcionar ou foi recuperado pelo vendedor:</strong> a conta foi recuperada, alterada ou bloqueada por quem vendeu (seção 8).
                </li>
                <li>
                  <strong>Vendedor sem estoque, que não responde ou que pediu o cancelamento:</strong> a equipe analisa e o valor é devolvido.
                </li>
                <li>
                  <strong>Pagamento confirmado depois que o anúncio saiu do ar:</strong> o pedido é cancelado e o valor volta automaticamente.
                </li>
                <li>
                  <strong>Cobrança em duplicidade ou pagamento que você não reconhece:</strong> a equipe verifica com a instituição de pagamento e devolve o que for devido.
                </li>
              </ul>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm">
                <strong>Importante:</strong> Não há reembolso de um produto entregue e que está como anunciado, nem de problemas causados pelo próprio comprador, como compartilhar a senha recebida ou descumprir as regras do jogo ou serviço.
              </div>
            </section>

            {/* 3. Direito de arrependimento */}
            <section className="space-y-3 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-2.5 font-black text-zinc-950 text-lg">
                <Scale className="w-5 h-5 text-[#0066FF]" />
                <h2>3. Direito de arrependimento</h2>
              </div>
              <ul className="space-y-2 pl-4 border-l-2 border-zinc-200">
                <li>
                  <strong>3.1.</strong> Você pode desistir da compra em até 7 dias, conforme o artigo 49 do Código de Defesa do Consumidor, <strong>enquanto o produto ainda não tiver sido entregue</strong>. Peça pelo chat do pedido, pela Central de Ajuda ou pelo e-mail{" "}
                  <a href="mailto:contato@playcontas.com.br" className="text-[#0066FF] font-medium hover:underline">
                    contato@playcontas.com.br
                  </a>. A desistência é confirmada, o pedido é cancelado e o valor do produto e do plano de proteção é devolvido.
                </li>
                <li>
                  <strong>3.2.</strong> Os produtos vendidos na PlayContas são digitais e, em geral, entregues na hora ou em poucos minutos. Depois de entregues e acessados, não podem ser devolvidos como um produto físico. Por isso, após a entrega, a proteção do comprador é a Garantia do anúncio, sem prejuízo dos direitos por defeito, falta de entrega ou produto diferente do anunciado.
                </li>
              </ul>
            </section>

            {/* 4. Prazo e forma de solicitação */}
            <section className="space-y-3 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-2.5 font-black text-zinc-950 text-lg">
                <Clock className="w-5 h-5 text-[#0066FF]" />
                <h2>4. Prazo e forma de solicitação</h2>
              </div>
              <ul className="space-y-2 pl-4 border-l-2 border-zinc-200">
                <li>
                  <strong>4.1.</strong> Durante a garantia do anúncio, abra o pedido no Chat e clique em <strong>Mediação</strong>. Escolha o motivo, descreva o que aconteceu e, se puder, anexe prints que mostrem o problema. A partir daí, a equipe da PlayContas acompanha o caso pelo chat do pedido e o valor fica retido até a decisão.
                </li>
                <li>
                  <strong>4.2.</strong> O plano de proteção escolhido no checkout define a partir de quantas horas após o pagamento a mediação pode ser aberta pelo botão; até lá, fale com o vendedor pelo chat do pedido. Em caso urgente, como a recuperação da conta comprada, ou se o vendedor não responder, você pode pedir ajuda a qualquer momento pela Central de Ajuda.
                </li>
                <li>
                  <strong>4.3.</strong> Se não conseguir abrir a mediação, por estar sem acesso à conta ou por qualquer falha, faça o pedido pela Central de Ajuda ou pelo e-mail{" "}
                  <a href="mailto:contato@playcontas.com.br" className="text-[#0066FF] font-medium hover:underline">
                    contato@playcontas.com.br
                  </a>, informando o número do pedido.
                </li>
                <li>
                  <strong>4.4.</strong> Vídeos e prints ajudam na análise, mas a falta deles não faz você perder o direito. <strong>Nunca envie senhas ou códigos de verificação como prova.</strong>
                </li>
              </ul>
            </section>

            {/* 5. Problemas depois da garantia */}
            <section className="space-y-3 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-2.5 font-black text-zinc-950 text-lg">
                <AlertTriangle className="w-5 h-5 text-[#0066FF]" />
                <h2>5. Problemas depois da garantia</h2>
              </div>
              <p>
                Depois que a garantia termina, o pedido é concluído e o valor é liberado ao vendedor, então a mediação pelo botão não fica mais disponível. Mesmo assim, você pode relatar defeitos, fraude ou recuperação da conta pela Central de Ajuda ou pelo e-mail{" "}
                <a href="mailto:contato@playcontas.com.br" className="text-[#0066FF] font-medium hover:underline">
                  contato@playcontas.com.br
                </a>, dentro dos prazos do Código de Defesa do Consumidor (art. 26): <strong>30 dias para produtos e serviços não duráveis</strong>, contados da entrega ou, no caso de defeito oculto, de quando ele aparecer. A equipe analisa o caso e busca a solução com o vendedor, sem prejuízo das responsabilidades previstas em lei.
              </p>
            </section>

            {/* 6. Análise e decisão */}
            <section className="space-y-3 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-2.5 font-black text-zinc-950 text-lg">
                <Scale className="w-5 h-5 text-[#0066FF]" />
                <h2>6. Análise e decisão</h2>
              </div>
              <ul className="space-y-2 pl-4 border-l-2 border-zinc-200">
                <li>
                  <strong>6.1.</strong> Recebemos o pedido na hora e respondemos em até 5 dias. Comprador e vendedor podem se manifestar e enviar provas, e a equipe analisa o chat do pedido, as provas e o histórico das partes.
                </li>
                <li>
                  <strong>6.2.</strong> A decisão pode ser: a entrega ou correção do produto, o reembolso integral ou, com a concordância do comprador, um reembolso parcial, ou a liberação do valor ao vendedor. Ela é registrada no chat do pedido com o motivo.
                </li>
                <li>
                  <strong>6.3.</strong> A falta de resposta de uma das partes é considerada junto com as demais provas, mas não decide o caso sozinha.
                </li>
                <li>
                  <strong>6.4.</strong> Quem discordar pode pedir a revisão da decisão pela Central de Ajuda em até 10 dias úteis, apresentando o erro ou provas novas. A revisão é feita por uma pessoa da equipe. A mediação não impede ninguém de procurar o Procon, o banco ou o Poder Judiciário.
                </li>
              </ul>
            </section>

            {/* 7. Valor e forma de reembolso */}
            <section className="space-y-3 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-2.5 font-black text-zinc-950 text-lg">
                <CreditCard className="w-5 h-5 text-[#0066FF]" />
                <h2>7. Valor e forma de reembolso</h2>
              </div>
              <p>
                <strong>7.1.</strong> O valor volta pelo mesmo meio do pagamento, sem nenhuma cobrança para você receber:
              </p>
              <ul className="space-y-1.5 pl-4 border-l-2 border-zinc-200">
                <li>
                  <strong>Pago com saldo:</strong> o valor volta para o saldo da sua conta e pode ser usado ou sacado normalmente.
                </li>
                <li>
                  <strong>Pago por PIX:</strong> o valor é devolvido por PIX para a conta que fez o pagamento. A PlayContas não troca um reembolso devido em dinheiro por crédito na plataforma.
                </li>
              </ul>
              <p>
                <strong>7.2.</strong> O reembolso inclui o valor do produto e a taxa do plano de proteção, quando houver. A taxa de processamento do PIX cobre o custo da transação já realizada e não é devolvida, salvo quando a lei exigir a restituição integral.
              </p>
              <p>
                <strong>7.3.</strong> A devolução é enviada assim que a decisão sai. No saldo, o valor aparece na hora; no PIX, o tempo para o valor aparecer depende do banco de quem pagou. Você é avisado pelas notificações e pelo chat do pedido e, se o valor não chegar, o suporte acompanha o caso com a instituição de pagamento.
              </p>
            </section>

            {/* 8. Recuperação de conta pelo vendedor */}
            <section className="space-y-3 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-2.5 font-black text-zinc-950 text-lg">
                <UserX className="w-5 h-5 text-[#0066FF]" />
                <h2>8. Recuperação de conta pelo vendedor</h2>
              </div>
              <p>
                <strong>8.1.</strong> Recuperar, acessar, alterar, revender ou bloquear uma conta depois de vendê-la é fraude, mesmo depois da conclusão do pedido e da liberação do valor.
              </p>
              <p>
                <strong>8.2.</strong> Se isso acontecer durante a garantia, abra uma mediação; comprovado o problema, o valor é devolvido. Depois da garantia, relate pela Central de Ajuda e guarde as provas. O vendedor pode ter a conta suspensa, os saldos retidos na medida do prejuízo e o caso comunicado às autoridades.
              </p>
            </section>

            {/* 9. Contestação no banco e PIX */}
            <section className="space-y-3 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-2.5 font-black text-zinc-950 text-lg">
                <RefreshCw className="w-5 h-5 text-[#0066FF]" />
                <h2>9. Contestação no banco e PIX</h2>
              </div>
              <p>
                <strong>9.1.</strong> Você pode contestar um pagamento no seu banco, inclusive pelo Mecanismo Especial de Devolução do PIX (MED), sem precisar passar antes pelo suporte. Se fizer isso, avise também a PlayContas, para evitar devolução em duplicidade.
              </p>
              <p>
                <strong>9.2.</strong> Se o mesmo valor for devolvido duas vezes (pela plataforma e pelo banco), o valor recebido a mais pode ser cobrado, com a demonstração do ocorrido.
              </p>
            </section>

            {/* 10. Uso indevido e fraude */}
            <section className="space-y-3 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-2.5 font-black text-zinc-950 text-lg">
                <AlertTriangle className="w-5 h-5 text-[#0066FF]" />
                <h2>10. Uso indevido e fraude</h2>
              </div>
              <p>
                Pedidos de reembolso com informações falsas, provas adulteradas ou feitos de má-fé, como alegar que não recebeu um produto que foi entregue e usado, são recusados após análise e podem levar à suspensão da conta. Usar o produto ou pedir um reembolso, por si só, não é considerado má-fé.
              </p>
            </section>

            {/* 11. Responsabilidade dos vendedores */}
            <section className="space-y-3 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-2.5 font-black text-zinc-950 text-lg">
                <Building2 className="w-5 h-5 text-[#0066FF]" />
                <h2>11. Responsabilidade dos vendedores</h2>
              </div>
              <p>
                O vendedor responde pelo que anuncia e entrega. Se não puder concluir uma venda, ele pede o cancelamento pelo chat explicando o motivo, e o pedido vai para análise da equipe, que decide o reembolso. Isso não afasta as responsabilidades que a lei atribui à PlayContas pelos serviços que ela presta.
              </p>
            </section>

            {/* 12. Alterações */}
            <section className="space-y-3 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-2.5 font-black text-zinc-950 text-lg">
                <FileText className="w-5 h-5 text-[#0066FF]" />
                <h2>12. Alterações</h2>
              </div>
              <p>
                Esta Política pode ser atualizada, com a data da última atualização nesta página. Pedidos já feitos seguem as condições do momento da compra.
              </p>
            </section>

            {/* Rodapé Interno com Contato e Links */}
            <div className="pt-6 border-t border-zinc-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-zinc-500">
              <div>
                Precisa de ajuda com um pedido? Envie um e-mail para{" "}
                <a href="mailto:contato@playcontas.com.br" className="text-[#0066FF] font-medium hover:underline">
                  contato@playcontas.com.br
                </a>
              </div>
              <div className="flex items-center gap-4">
                <Link
                  href="/termos"
                  className="text-[#0066FF] font-medium hover:underline"
                >
                  Termos de Uso
                </Link>
                <span>•</span>
                <Link
                  href="/privacidade"
                  className="text-[#0066FF] font-medium hover:underline"
                >
                  Privacidade
                </Link>
                <span>•</span>
                <Link
                  href="/tarifas"
                  className="text-[#0066FF] font-medium hover:underline"
                >
                  Tarifas e Prazos
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <JamFooter />

      {/* Modais de Carrinho e Autenticação */}
      <CartModal
        isOpen={cartModalOpen}
        onClose={() => setCartModalOpen(false)}
        onCheckout={() => {
          setCartModalOpen(false);
          router.push("/checkout");
        }}
      />

      <AuthModal
        isOpen={authModalOpen}
        initialTab={authInitialTab}
        onClose={() => setAuthModalOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setAuthModalOpen(false);
        }}
      />
    </div>
  );
}
