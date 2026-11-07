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
  ShieldCheck,
  Building2,
  Mail,
  HelpCircle,
  Lock,
  Eye,
  Users,
  Globe,
  Cookie,
  Bell,
  Clock,
  UserCheck,
  Cpu,
  AlertCircle,
  ExternalLink,
  FileCheck,
} from "lucide-react";

export default function PrivacidadePage() {
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

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItem(productId);
      return;
    }
    setCart((prev) => {
      const updated = prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      );
      try {
        localStorage.setItem("central_cart", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleRemoveItem = (productId: string) => {
    setCart((prev) => {
      const updated = prev.filter((item) => item.product.id !== productId);
      try {
        localStorage.setItem("central_cart", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleClearCart = () => {
    setCart([]);
    try {
      localStorage.removeItem("central_cart");
    } catch {}
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-zinc-800 antialiased selection:bg-[#0066FF] selection:text-white">
      {/* Header */}
      <JamHeader
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          if (q.trim()) router.push(`/?search=${encodeURIComponent(q)}`);
        }}
        cartCount={cartCount}
        onOpenCart={() => setCartModalOpen(true)}
        onOpenCreateListing={() => {
          if (!currentUser) {
            setAuthInitialTab("register");
            setAuthModalOpen(true);
          } else {
            router.push("/anunciar");
          }
        }}
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
              <ShieldCheck className="w-3.5 h-3.5 text-[#0066FF]" />
              Privacidade e Proteção de Dados (LGPD)
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-zinc-950 tracking-tight mb-3">
              Política de Privacidade
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
                Esta Política explica quais dados pessoais a <strong>PlayContas</strong> trata quando você usa o site{" "}
                <strong className="text-zinc-950">playcontas.com.br</strong>, para que eles são usados, com qual fundamento legal, com quem são compartilhados, por quanto tempo são guardados e como você exerce os seus direitos, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, &quot;LGPD&quot;). Ela faz parte dos{" "}
                <Link href="/termos" className="text-[#0066FF] font-semibold underline underline-offset-2 hover:text-blue-700">
                  Termos de Uso
                </Link>.
              </p>
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/70 text-blue-950 text-xs sm:text-sm font-medium">
                Ler esta Política ou usar o site não significa consentimento genérico para qualquer tratamento. Quando um tratamento depender do seu consentimento, ele é pedido de forma específica e destacada.
              </div>
            </div>

            {/* 1. Quem é responsável pelos seus dados */}
            <section className="space-y-3 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-2.5 font-black text-zinc-950 text-lg">
                <Building2 className="w-5 h-5 text-[#0066FF]" />
                <h2>1. Quem é responsável pelos seus dados</h2>
              </div>
              <ul className="space-y-2 pl-4 border-l-2 border-zinc-200 text-zinc-700">
                <li>
                  <strong>Controlador:</strong> GM Marketing LTDA, inscrita no CNPJ sob o nº 63.348.271/0001-02, que opera a PlayContas.
                </li>
                <li>
                  <strong>Encarregado pelo tratamento de dados (DPO):</strong> atende pelo e-mail{" "}
                  <a href="mailto:contato@playcontas.com.br" className="text-[#0066FF] font-medium hover:underline">
                    contato@playcontas.com.br
                  </a>.
                </li>
                <li>
                  <strong>Canal de privacidade:</strong> a Central de Ajuda, dentro da sua conta, ou o e-mail{" "}
                  <a href="mailto:contato@playcontas.com.br" className="text-[#0066FF] font-medium hover:underline">
                    contato@playcontas.com.br
                  </a>, que também atende quem não tem conta ou está com a conta bloqueada ou encerrada.
                </li>
                <li>
                  Os prestadores de serviço citados na <strong>seção 6</strong> tratam dados seguindo as nossas instruções ou, em alguns casos, como controladores das suas próprias atividades (por exemplo, a instituição de pagamento nas suas obrigações regulatórias).
                </li>
              </ul>
            </section>

            {/* 2. Quais dados tratamos e de onde eles vêm */}
            <section className="space-y-4 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-2.5 font-black text-zinc-950 text-lg">
                <FileCheck className="w-5 h-5 text-[#0066FF]" />
                <h2>2. Quais dados tratamos e de onde eles vêm</h2>
              </div>
              <ul className="grid sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                <li className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80">
                  <strong className="block text-zinc-900 mb-1">Cadastro e acesso:</strong>
                  nome, e-mail, nome de usuário e senha (guardada só de forma cifrada, nunca em texto puro) ou, no login com o Google, nome, e-mail e a confirmação de que o e-mail é verificado. Não recebemos a sua senha do Google.
                </li>
                <li className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80">
                  <strong className="block text-zinc-900 mb-1">Verificação de vendedor:</strong>
                  CPF, data de nascimento, endereço, celular, documento de identidade com foto, selfie com o documento e comprovante de residência, informados por você.
                </li>
                <li className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80">
                  <strong className="block text-zinc-900 mb-1">Verificação de empresa:</strong>
                  CNPJ, razão social, Cartão CNPJ, documento de constituição e os dados públicos do CNPJ na Receita Federal, incluindo o quadro de sócios.
                </li>
                <li className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80">
                  <strong className="block text-zinc-900 mb-1">Perfil e anúncios:</strong>
                  foto, capa, &quot;Sobre você&quot;, anúncios, imagens, perguntas e respostas e avaliações.
                </li>
                <li className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80">
                  <strong className="block text-zinc-900 mb-1">Pedidos e pagamentos:</strong>
                  itens comprados, valores, situação dos pedidos, nome e CPF informados no pagamento, nome e documento de quem pagou o PIX (informados pela instituição de pagamento), reembolsos e dados de saque (titular e chave PIX).
                </li>
                <li className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80">
                  <strong className="block text-zinc-900 mb-1">Atendimento e segurança:</strong>
                  mensagens do chat dos pedidos, mediações, tickets de suporte, denúncias, anexos e os registros das decisões da equipe.
                </li>
                <li className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80">
                  <strong className="block text-zinc-900 mb-1">Dados técnicos:</strong>
                  endereço IP, data e hora de acesso, navegador, dispositivo e páginas visitadas.
                </li>
                <li className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80">
                  <strong className="block text-zinc-900 mb-1">Preferências:</strong>
                  escolhas de notificações e de cookies e o registro dessas escolhas.
                </li>
              </ul>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm">
                <strong>Atenção:</strong> Não pedimos dados sobre saúde, religião, opinião política ou outros dados sensíveis, além da selfie usada na verificação (seção 4). Não coloque senhas, documentos ou dados de outras pessoas em anúncios, perguntas, avaliações ou tickets.
              </div>
            </section>

            {/* 3. Para que usamos os dados e com qual fundamento */}
            <section className="space-y-3 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-2.5 font-black text-zinc-950 text-lg">
                <ShieldCheck className="w-5 h-5 text-[#0066FF]" />
                <h2>3. Para que usamos os dados e com qual fundamento</h2>
              </div>
              <ul className="space-y-2 pl-4 border-l-2 border-zinc-200 text-zinc-700">
                <li>
                  <strong>Criar e manter a conta, autenticar o acesso e recuperar a senha:</strong> execução do contrato (art. 7º, V, da LGPD).
                </li>
                <li>
                  <strong>Processar compras, entregas, repasses, reembolsos e saques:</strong> execução do contrato e cumprimento de obrigações legais (art. 7º, II e V).
                </li>
                <li>
                  <strong>Verificar a identidade de vendedores e empresas e a titularidade dos saques:</strong> execução do contrato, prevenção à fraude e segurança do titular (art. 7º, V, e art. 11, II, &quot;g&quot;).
                </li>
                <li>
                  <strong>Prevenir fraudes, golpes, contas falsas e acessos indevidos:</strong> legítimo interesse, limitado ao necessário e sem uso de dados sensíveis (art. 7º, IX).
                </li>
                <li>
                  <strong>Analisar mediações e denúncias e moderar anúncios:</strong> execução do contrato e exercício regular de direitos (art. 7º, V e VI).
                </li>
                <li>
                  <strong>Enviar avisos essenciais (confirmação de cadastro, códigos, recuperação de senha, pedidos, saques e segurança) por e-mail, SMS e notificações:</strong> execução do contrato.
                </li>
                <li>
                  <strong>Guardar registros exigidos por lei e atender ordens de autoridades:</strong> cumprimento de obrigação legal (art. 7º, II).
                </li>
                <li>
                  <strong>Defender direitos em processos judiciais ou administrativos:</strong> exercício regular de direitos (art. 7º, VI).
                </li>
                <li>
                  <strong>Enviar novidades e ofertas por e-mail:</strong> consentimento, que você pode retirar a qualquer momento em Painel › Notificações.
                </li>
              </ul>
              <p className="text-xs text-zinc-500 pt-1">
                Os dados exigidos para uma função (como os documentos para vender) são necessários para usá-la; sem eles, só essa função fica indisponível. Não usamos os dados para uma finalidade nova e incompatível sem avisar e, quando necessário, pedir um novo consentimento.
              </p>
            </section>

            {/* 4. Documentos e selfie */}
            <section className="space-y-3 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-2.5 font-black text-zinc-950 text-lg">
                <Lock className="w-5 h-5 text-[#0066FF]" />
                <h2>4. Documentos e selfie</h2>
              </div>
              <p>
                Os documentos e a selfie enviados na verificação são conferidos visualmente pela equipe, apenas para confirmar a identidade de quem vende e prevenir fraudes. A PlayContas <strong>não faz reconhecimento facial automatizado nem cria modelos biométricos</strong>.
              </p>
              <p>
                Esses arquivos ficam em área privada, sem endereço público, acessíveis só à equipe autorizada, e nunca são usados para publicidade ou qualquer outra finalidade.
              </p>
            </section>

            {/* 5. O que fica público */}
            <section className="space-y-3 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-2.5 font-black text-zinc-950 text-lg">
                <Eye className="w-5 h-5 text-[#0066FF]" />
                <h2>5. O que fica público</h2>
              </div>
              <ul className="space-y-2 pl-4 border-l-2 border-zinc-200">
                <li>
                  Nome de usuário, foto, capa, &quot;Sobre você&quot;, anúncios, perguntas públicas e avaliações podem ser vistos por qualquer visitante e aparecer em buscadores como o Google. <strong>Não coloque telefone, endereço ou outros dados privados nesses campos.</strong>
                </li>
                <li>
                  As mensagens do chat de um pedido são vistas só pelo comprador, pelo vendedor e, quando necessário para atendimento, mediação ou segurança, pela equipe. <strong>E-mail, CPF, endereço e documentos não são mostrados a outros usuários.</strong>
                </li>
                <li>
                  Ao excluir um conteúdo público, ele sai da PlayContas, mas cópias em buscadores ou feitas por terceiros podem demorar a desaparecer.
                </li>
              </ul>
            </section>

            {/* 6. Com quem compartilhamos */}
            <section className="space-y-3 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-2.5 font-black text-zinc-950 text-lg">
                <Users className="w-5 h-5 text-[#0066FF]" />
                <h2>6. Com quem compartilhamos</h2>
              </div>
              <p>
                <strong>A PlayContas não vende dados pessoais.</strong> Eles são compartilhados apenas no estritamente necessário para cada finalidade:
              </p>
              <ul className="space-y-1.5 pl-4 border-l-2 border-zinc-200">
                <li><strong>Rede de entrega e proteção do site:</strong> Cloudflare.</li>
                <li><strong>Hospedagem:</strong> o servidor contratado para manter o site no ar.</li>
                <li><strong>Envio de e-mails:</strong> Brevo.</li>
                <li><strong>Envio de SMS:</strong> GTI SMS.</li>
                <li><strong>Login com o Google:</strong> Google, quando você escolhe essa opção.</li>
                <li><strong>Pagamentos PIX, repasses e reembolsos:</strong> a instituição de pagamento parceira (atualmente a Woovi), autorizada pelo Banco Central.</li>
                <li><strong>Consulta de CNPJ:</strong> serviços de consulta dos dados públicos da Receita Federal.</li>
                <li><strong>Comprador e vendedor de um pedido:</strong> só o necessário para a compra, como o nome de usuário e as mensagens do pedido.</li>
                <li><strong>Assessores e autoridades:</strong> advogados e contadores, sob sigilo profissional, e autoridades, quando houver obrigação legal ou ordem judicial.</li>
              </ul>
              <p className="text-xs sm:text-sm text-zinc-600">
                Um pedido de outro usuário não autoriza a entrega do seu CPF, documentos, IP, registros de acesso ou conversas. Registros de acesso e comunicações privadas só são fornecidos a terceiros com ordem judicial, nos casos em que a lei exige. Você pode pedir a lista das empresas com quem os seus dados foram compartilhados.
              </p>
              <p className="text-xs sm:text-sm text-zinc-600">
                Se a PlayContas for vendida ou incorporada, os dados podem ser transferidos ao sucessor, que continuará obrigado a esta Política.
              </p>
            </section>

            {/* 7. Transferência internacional */}
            <section className="space-y-3 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-2.5 font-black text-zinc-950 text-lg">
                <Globe className="w-5 h-5 text-[#0066FF]" />
                <h2>7. Transferência internacional</h2>
              </div>
              <p>
                Alguns fornecedores (Cloudflare e Google, nos Estados Unidos, e Brevo, na União Europeia) podem tratar dados fora do Brasil. Essas transferências seguem o <strong>art. 33 da LGPD</strong> e as regras da ANPD, com base nas garantias contratuais oferecidas por esses fornecedores. Você pode pedir informações sobre essas transferências pelo canal de privacidade.
              </p>
            </section>

            {/* 8. Cookies e armazenamento do navegador */}
            <section className="space-y-3 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-2.5 font-black text-zinc-950 text-lg">
                <Cookie className="w-5 h-5 text-[#0066FF]" />
                <h2>8. Cookies e armazenamento do navegador</h2>
              </div>
              <p>
                Na primeira visita, um aviso pede a sua escolha, com as opções de aceitar, recusar ou configurar. Os cookies essenciais estão sempre ativos; os de análise, de marketing e de personalização só seriam usados com a sua permissão, e hoje a PlayContas não usa nenhum deles. Você muda a escolha a qualquer momento em{" "}
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new Event("open_cookie_preferences"))}
                  className="text-[#0066FF] font-semibold underline underline-offset-2 hover:text-blue-700 cursor-pointer inline"
                >
                  Preferências de cookies
                </button>
                , também no rodapé do site.
              </p>
              <ul className="space-y-1.5 pl-4 border-l-2 border-zinc-200">
                <li>
                  <strong>Essenciais:</strong> mantêm você conectado (sessão e &quot;Lembrar de mim&quot;) e protegem os formulários contra ataques. Sem eles a plataforma não funciona.
                </li>
                <li>
                  <strong>Armazenamento do navegador:</strong> o carrinho e algumas preferências (como a notificação do navegador neste dispositivo) ficam no seu próprio navegador.
                </li>
                <li>
                  <strong>Segurança e desempenho:</strong> a verificação contra robôs e as estatísticas agregadas de velocidade da nossa rede de entrega (Cloudflare).
                </li>
              </ul>
              <p className="text-xs text-zinc-500">Recusar cookies opcionais não impede o uso da plataforma.</p>
            </section>

            {/* 9. Comunicações */}
            <section className="space-y-3 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-2.5 font-black text-zinc-950 text-lg">
                <Bell className="w-5 h-5 text-[#0066FF]" />
                <h2>9. Comunicações</h2>
              </div>
              <p>
                Avisos de cadastro, acesso, pedidos, saques, atendimento e segurança são enviados sempre que necessários, porque fazem parte do serviço. E-mails de novidades e ofertas podem ser desligados a qualquer momento em <strong>Painel › Notificações</strong>, sem afetar os avisos essenciais.
              </p>
            </section>

            {/* 10. Por quanto tempo guardamos os dados */}
            <section className="space-y-3 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-2.5 font-black text-zinc-950 text-lg">
                <Clock className="w-5 h-5 text-[#0066FF]" />
                <h2>10. Por quanto tempo guardamos os dados</h2>
              </div>
              <ul className="space-y-2 pl-4 border-l-2 border-zinc-200">
                <li><strong>Cadastro e preferências:</strong> enquanto a conta estiver ativa.</li>
                <li><strong>Registros de acesso (IP, data e hora):</strong> 6 meses, como exige o Marco Civil da Internet (art. 15), ou mais quando houver ordem judicial.</li>
                <li><strong>Pedidos, pagamentos, saques e as mensagens e mediações ligadas a eles:</strong> 5 anos a partir da operação, pelos prazos fiscais e de prescrição de eventuais ações.</li>
                <li><strong>Documentos e selfie da verificação:</strong> enquanto a conta estiver ativa e, depois do encerramento, pelo prazo necessário à defesa em disputas sobre as operações feitas com aquela identidade, até 5 anos da última operação.</li>
                <li><strong>Tickets e denúncias:</strong> até a solução do caso e, depois, só o necessário para obrigações legais ou defesa de direitos.</li>
                <li><strong>Consentimentos e escolhas de cookies:</strong> enquanto valerem e, após a retirada, só o registro mínimo da escolha.</li>
                <li><strong>Registros de incidentes de segurança:</strong> pelo menos 5 anos, como exige a regulamentação da ANPD.</li>
                <li><strong>Cópias de segurança (backups):</strong> substituídas periodicamente, com acesso restrito.</li>
              </ul>
              <p className="text-xs text-zinc-600">
                Em casos concretos de fraude, mediação, denúncia ou processo, os dados relacionados podem ser guardados pelo tempo necessário para a apuração e a defesa de direitos, mesmo com a conta encerrada. Passados os prazos, os dados são excluídos ou anonimizados, conforme o art. 16 da LGPD.
              </p>
            </section>

            {/* 11. Seus direitos */}
            <section className="space-y-3 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-2.5 font-black text-zinc-950 text-lg">
                <UserCheck className="w-5 h-5 text-[#0066FF]" />
                <h2>11. Seus direitos</h2>
              </div>
              <p>Conforme o <strong>art. 18 da LGPD</strong>, você pode pedir, de graça:</p>
              <ul className="space-y-1.5 pl-4 border-l-2 border-zinc-200">
                <li>a confirmação de que tratamos os seus dados e o acesso a eles;</li>
                <li>a correção de dados incompletos, inexatos ou desatualizados;</li>
                <li>a anonimização, o bloqueio ou a exclusão de dados desnecessários, excessivos ou tratados em desconformidade com a lei;</li>
                <li>a portabilidade dos dados a outro fornecedor;</li>
                <li>a exclusão dos dados tratados com o seu consentimento;</li>
                <li>a informação sobre com quem compartilhamos os seus dados e sobre a possibilidade de não dar consentimento;</li>
                <li>a revogação do consentimento;</li>
                <li>a revisão de decisões tomadas de forma automatizada que afetem os seus interesses.</li>
              </ul>
              <p>
                Parte disso você faz direto no seu Painel (Verificações, Perfil, Segurança e Notificações). Os demais pedidos são feitos pela Central de Ajuda ou pelo e-mail{" "}
                <a href="mailto:contato@playcontas.com.br" className="text-[#0066FF] font-medium hover:underline">
                  contato@playcontas.com.br
                </a>. Podemos confirmar a sua identidade antes de entregar dados, para que eles não cheguem à pessoa errada.
              </p>
              <p className="text-xs text-zinc-600">
                Pedidos de confirmação e acesso são respondidos de imediato, no formato simplificado, ou em até 15 dias, no formato completo (art. 19 da LGPD). Se algum pedido não puder ser atendido, por exemplo por obrigação legal de guarda, explicamos o motivo. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
              </p>
            </section>

            {/* 12. Decisões automatizadas */}
            <section className="space-y-3 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-2.5 font-black text-zinc-950 text-lg">
                <Cpu className="w-5 h-5 text-[#0066FF]" />
                <h2>12. Decisões automatizadas</h2>
              </div>
              <p>
                Algumas etapas são automáticas, como a entrega automática, a conclusão do pedido no fim da garantia e os bloqueios de segurança por excesso de tentativas. Decisões que afetam a conta, como a análise de documentos, mediações, denúncias e suspensões, são tomadas pela equipe, e qualquer decisão pode ter a revisão pedida pela Central de Ajuda.
              </p>
              <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 text-blue-900 text-xs sm:text-sm font-medium">
                A PlayContas não envia documentos, selfies ou mensagens privadas para ferramentas de inteligência artificial.
              </div>
            </section>

            {/* 13. Menores de idade */}
            <section className="space-y-3 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-2.5 font-black text-zinc-950 text-lg">
                <AlertCircle className="w-5 h-5 text-[#0066FF]" />
                <h2>13. Menores de idade</h2>
              </div>
              <p>
                A PlayContas é destinada a <strong>maiores de 18 anos</strong>. Se identificarmos uma conta de menor de idade, ela é encerrada e os dados são excluídos, salvo os que a lei obriga a guardar. Pais ou responsáveis podem entrar em contato pelo canal de privacidade.
              </p>
            </section>

            {/* 14. Segurança e incidentes */}
            <section className="space-y-3 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-2.5 font-black text-zinc-950 text-lg">
                <Lock className="w-5 h-5 text-[#0066FF]" />
                <h2>14. Segurança e incidentes</h2>
              </div>
              <ul className="space-y-2 pl-4 border-l-2 border-zinc-200">
                <li>Toda a comunicação com o site é criptografada (HTTPS).</li>
                <li>Senhas são guardadas com algoritmo próprio para senhas (hash), e a chave da verificação em duas etapas fica criptografada.</li>
                <li>Documentos de verificação, de empresa e anexos de denúncias e tickets ficam em área privada, sem endereço público, vistos só pela equipe autorizada.</li>
                <li>O acesso da equipe aos dados é restrito e as ações são registradas.</li>
              </ul>
              <p className="text-xs sm:text-sm text-zinc-600">
                Nenhum sistema é imune a falhas. Se acontecer um incidente de segurança que possa trazer risco ou dano relevante a você, comunicaremos a ANPD e os titulares afetados em até 3 dias úteis, conforme a Resolução CD/ANPD nº 15/2024, informando o que aconteceu, os riscos e as medidas tomadas. Se você notar alguma falha, avise pelo canal de privacidade, sem enviar senhas ou dados de outras pessoas.
              </p>
            </section>

            {/* 15. Encerramento da conta e exclusão dos dados */}
            <section className="space-y-3 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-2.5 font-black text-zinc-950 text-lg">
                <FileCheck className="w-5 h-5 text-[#0066FF]" />
                <h2>15. Encerramento da conta e exclusão dos dados</h2>
              </div>
              <p>
                Você pode pedir o encerramento da conta e a exclusão dos seus dados pela Central de Ajuda ou pelo e-mail{" "}
                <a href="mailto:contato@playcontas.com.br" className="text-[#0066FF] font-medium hover:underline">
                  contato@playcontas.com.br
                </a>.
              </p>
              <p className="text-zinc-600">
                Pedidos em andamento, saldos e mediações são resolvidos, e o pedido de exclusão é analisado mesmo que existam pendências. Só ficam guardados os dados que a lei obriga a manter ou que são necessários a essas pendências, pelos prazos da seção 10, e depois são excluídos ou anonimizados.
              </p>
            </section>

            {/* 16. Links externos */}
            <section className="space-y-3 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-2.5 font-black text-zinc-950 text-lg">
                <ExternalLink className="w-5 h-5 text-[#0066FF]" />
                <h2>16. Links externos</h2>
              </div>
              <p>
                Anúncios, mensagens e páginas da plataforma podem ter links para sites de terceiros, como os de jogos e serviços. Esses sites têm políticas próprias; confira-as antes de informar seus dados.
              </p>
            </section>

            {/* 17. Atualizações e legislação */}
            <section className="space-y-3 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-2.5 font-black text-zinc-950 text-lg">
                <ShieldCheck className="w-5 h-5 text-[#0066FF]" />
                <h2>17. Atualizações e legislação</h2>
              </div>
              <p>
                Esta Política pode ser atualizada para refletir mudanças na plataforma ou na lei. A versão vigente fica sempre nesta página, com a data da última atualização, e mudanças relevantes (novas finalidades, dados ou compartilhamentos) são avisadas pelo site ou por e-mail antes de valerem. Quando for preciso um novo consentimento, ele será pedido antes.
              </p>
              <p className="text-zinc-600">
                Esta Política é regida pelas leis brasileiras e não limita o seu direito de procurar a ANPD, os órgãos de defesa do consumidor ou o Poder Judiciário, no foro do seu domicílio.
              </p>
            </section>

            {/* Rodapé Interno com Contato */}
            <div className="pt-6 border-t border-zinc-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-zinc-500">
              <div>
                Dúvidas sobre a privacidade dos seus dados? Contate nosso DPO em{" "}
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
                  href="/reembolso"
                  className="text-[#0066FF] font-medium hover:underline"
                >
                  Reembolso
                </Link>
                <span>•</span>
                <Link
                  href="/tarifas"
                  className="text-[#0066FF] font-medium hover:underline"
                >
                  Tarifas
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <JamFooter />

      {/* Modals */}
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
        onClose={() => setAuthModalOpen(false)}
        initialTab={authInitialTab}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setAuthModalOpen(false);
        }}
      />
    </div>
  );
}
