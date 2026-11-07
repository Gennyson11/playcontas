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
  FileText,
  ShieldCheck,
  Building2,
  Mail,
  Globe,
  HelpCircle,
  Scale,
  Calendar,
} from "lucide-react";

export default function TermosPage() {
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

  const handleCheckoutFromModal = () => {
    setCartModalOpen(false);
    router.push("/finalizar-compra");
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      {/* Header */}
      <JamHeader
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          if (q.trim()) router.push(`/?search=${encodeURIComponent(q.trim())}`);
        }}
        cartCount={cart.reduce((acc, item) => acc + item.quantity, 0)}
        onOpenCart={() => setCartModalOpen(true)}
        onOpenCreateListing={() => router.push("/anunciar")}
        currentUser={currentUser}
        onOpenAuth={(tab?: "login" | "register") => {
          setAuthInitialTab(tab || "login");
          setAuthModalOpen(true);
        }}
        onOpenAdmin={() => router.push("/")}
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
              <Scale className="w-3.5 h-3.5 text-[#0066FF]" />
              Documento Jurídico Oficial
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-zinc-950 tracking-tight mb-3">
              Termos de Uso
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 font-medium max-w-xl mx-auto">
              Última atualização: 23/10/2026
            </p>
          </div>
        </div>

        {/* Legal Text Content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-10">
          <div className="bg-white rounded-3xl border border-zinc-200/90 p-6 sm:p-10 md:p-12 shadow-xs space-y-10 text-zinc-700 text-sm leading-relaxed">
            {/* Box de Identificação */}
            <div className="p-5 sm:p-6 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-3">
              <div className="flex items-center gap-2 font-black text-zinc-900 text-base">
                <Building2 className="w-5 h-5 text-[#0066FF]" />
                <span>Identificação da Plataforma</span>
              </div>
              <ul className="space-y-1.5 text-xs sm:text-sm text-zinc-600">
                <li>
                  <strong>Operadora da Plataforma:</strong> GM Marketing LTDA, inscrita no CNPJ sob o nº 63.348.271/0001-02, que utiliza o nome comercial PlayContas.
                </li>
                <li>
                  <strong>Site oficial:</strong>{" "}
                  <a href="https://playcontas.com.br" className="text-[#0066FF] font-medium hover:underline">
                    playcontas.com.br
                  </a>
                </li>
                <li>
                  <strong>Atendimento, reclamações e cancelamentos:</strong> Central de Ajuda, dentro da sua conta, ou pelo e-mail{" "}
                  <a href="mailto:contato@playcontas.com.br" className="text-[#0066FF] font-medium hover:underline">
                    contato@playcontas.com.br
                  </a>.
                </li>
                <li>
                  <strong>Privacidade e direitos sobre dados pessoais:</strong> pelos mesmos canais, conforme a{" "}
                  <Link href="/privacidade" className="text-[#0066FF] hover:underline font-medium">
                    Política de Privacidade
                  </Link>.
                </li>
                <li>
                  <strong>Notificações jurídicas e de propriedade intelectual:</strong> pelo e-mail{" "}
                  <a href="mailto:contato@playcontas.com.br" className="text-[#0066FF] font-medium hover:underline">
                    contato@playcontas.com.br
                  </a>.
                </li>
              </ul>
            </div>

            {/* 1. Introdução, definições e aceite */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950">
                1. Introdução, definições e aceite
              </h2>
              <p>
                <strong>1.1.</strong> Estes Termos de Uso regulam o acesso e o uso da Plataforma, plataforma online que aproxima pessoas que querem vender e comprar bens e serviços digitais, como contas de jogos, itens, moedas virtuais, gift cards, assinaturas e serviços.
              </p>
              <p>
                <strong>1.2.</strong> Para facilitar a leitura, usamos as seguintes definições:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-zinc-600">
                <li><strong>Plataforma:</strong> o site e os sistemas por meio dos quais os anúncios, os pedidos e os pagamentos acontecem.</li>
                <li><strong>Usuário:</strong> qualquer pessoa cadastrada na Plataforma.</li>
                <li><strong>Vendedor:</strong> o Usuário com a conta liberada para anunciar e vender.</li>
                <li><strong>Comprador:</strong> o Usuário que faz um pedido de um anúncio.</li>
                <li><strong>Anúncio:</strong> a oferta de um produto ou serviço digital publicada por um Vendedor.</li>
                <li><strong>Pedido:</strong> a compra de um Anúncio, com o pagamento, a entrega e o chat entre Comprador e Vendedor.</li>
                <li><strong>Saldo:</strong> o registro, na carteira do Usuário, dos valores ligados à conta, separados por situação (a liberar, disponível, em mediação ou retido).</li>
                <li><strong>Mediação:</strong> o procedimento interno em que a equipe analisa um problema em um Pedido.</li>
              </ul>
              <p>
                <strong>1.3.</strong> O cadastro só é concluído depois que o Usuário tem acesso a estes Termos, à{" "}
                <Link href="/privacidade" className="text-[#0066FF] hover:underline font-medium">
                  Política de Privacidade
                </Link>
                , à{" "}
                <Link href="/reembolso" className="text-[#0066FF] hover:underline font-medium">
                  Política de Reembolso
                </Link>{" "}
                e à página de{" "}
                <Link href="/tarifas" className="text-[#0066FF] hover:underline font-medium">
                  Tarifas e prazos
                </Link>
                , que fazem parte destes Termos, e manifesta o seu aceite. A Plataforma registra a data e a hora do aceite, e a versão vigente fica sempre disponível nesta página, podendo ser salva ou impressa.
              </p>
              <p>
                <strong>1.4.</strong> Em caso de dúvida, estes Termos são interpretados conforme a boa-fé e a transparência, prevalecendo sempre os direitos garantidos por lei, inclusive os do Código de Defesa do Consumidor. O aceite destes Termos não equivale a consentimento genérico para tratamento de dados pessoais, publicidade ou uso de imagem.
              </p>
            </section>

            {/* 2. Natureza dos serviços */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950">
                2. Natureza dos serviços
              </h2>
              <p>
                <strong>2.1.</strong> A Plataforma atua como intermediadora: oferece o espaço para os anúncios, o chat dos pedidos e a mediação, recebe o pagamento do Comprador por meio de instituição de pagamento parceira e só repassa o valor ao Vendedor depois que o pedido é concluído. A Plataforma não é dona, fabricante nem fornecedora dos produtos anunciados.
              </p>
              <p>
                <strong>2.2.</strong> O Vendedor define a sua oferta e responde pela legitimidade, pelas informações, pela entrega e pelo suporte do que vende. Essa divisão não afasta a responsabilidade da Plataforma pelos seus próprios serviços, atos e falhas, nos termos da lei.
              </p>
              <p>
                <strong>2.3.</strong> O uso da Plataforma não cria sociedade, vínculo de emprego, representação comercial ou exclusividade entre a operadora e os Usuários.
              </p>
              <p>
                <strong>2.4.</strong> As marcas de jogos e serviços citadas nos anúncios pertencem aos seus titulares. A exibição dessas marcas não significa vínculo, parceria ou autorização das empresas desenvolvedoras.
              </p>
            </section>

            {/* 3. Cadastro e verificação */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950">
                3. Cadastro e verificação
              </h2>
              <p>
                <strong>3.1.</strong> Para usar a Plataforma é preciso ter 18 anos ou mais e plena capacidade civil.
              </p>
              <p>
                <strong>3.2.</strong> O cadastro pede nome, e-mail, nome de usuário e senha, ou pode ser feito com a conta Google. Para vender, o Usuário também confirma dados pessoais (nome, CPF, data de nascimento e endereço) e o celular, e envia documento de identidade e selfie na área de Verificações. A liberação como Vendedor depende da aprovação desses documentos.
              </p>
              <p>
                <strong>3.3.</strong> Para sacar na chave PIX de uma empresa, o Vendedor verifica a empresa (CNPJ) enviando o Cartão CNPJ e o documento de constituição, e precisa ser sócio ou representante dela. Indicar um CNPJ não transfere a titularidade das vendas nem dos valores.
              </p>
              <p>
                <strong>3.4.</strong> Os dados informados devem ser verdadeiros, completos e atualizados. Cada pessoa pode ter apenas uma conta, e a conta não pode ser vendida, emprestada ou transferida. É proibido criar contas para contornar suspensões, esconder o verdadeiro beneficiário ou simular transações.
              </p>
              <p>
                <strong>3.5.</strong> A Plataforma pode pedir documentos e validações adicionais, na medida necessária ao risco da operação, e informa a finalidade do pedido. A falta desses dados pode impedir novas vendas ou saques até a regularização. Documentos falsos ou de terceiros levam ao encerramento da conta e às medidas legais cabíveis.
              </p>
            </section>

            {/* 4. Segurança da conta */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950">
                4. Segurança da conta
              </h2>
              <p>
                <strong>4.1.</strong> O Usuário é responsável por manter a senha em sigilo, usar os recursos de segurança disponíveis e avisar o suporte imediatamente se suspeitar de acesso indevido.
              </p>
              <p>
                <strong>4.2.</strong> Recomendamos ativar a verificação em duas etapas (2FA), em Painel › Segurança.
              </p>
              <p>
                <strong>4.3.</strong> A equipe nunca pede senha, códigos de verificação ou pagamentos por WhatsApp, redes sociais ou e-mails fora do domínio oficial. Não informe a sua senha a ninguém, nem a quem se apresente como atendente.
              </p>
              <p>
                <strong>4.4.</strong> O uso do login e da senha é considerado na análise de uma operação, mas não é prova absoluta de autoria. Em caso de invasão, as responsabilidades são apuradas conforme os fatos.
              </p>
              <p>
                <strong>4.5.</strong> Diante de suspeita de fraude, a Plataforma pode encerrar sessões, pedir autenticação adicional ou bloquear a conta preventivamente, mantendo o atendimento para a recuperação do acesso.
              </p>
            </section>

            {/* 5. Regras de conduta e proibições */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950">
                5. Regras de conduta e proibições
              </h2>
              <p>
                <strong>5.1.</strong> O Usuário deve agir com boa-fé e respeito com os demais usuários e com a equipe da Plataforma.
              </p>
              <p>
                <strong>5.2.</strong> É expressamente proibido:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-zinc-600">
                <li>Ofender, ameaçar, assediar ou discriminar outras pessoas, ou expor dados pessoais delas;</li>
                <li>Publicar spam ou conteúdo enganoso;</li>
                <li>Negociar, pagar ou trocar contatos fora da Plataforma;</li>
                <li>Manipular avaliações, comprar de si mesmo, encomendar avaliações ou usar contas falsas;</li>
                <li>Fazer compras simuladas, contestar pagamentos de má-fé ou alegar falsamente que não recebeu um produto;</li>
                <li>Usar a Plataforma para lavagem de dinheiro, movimentação de valores sem negócio real ou qualquer atividade ilegal;</li>
                <li>Tentar acessar contas de outras pessoas ou áreas restritas, contornar a autenticação ou usar robôs para coletar dados ou automatizar ações;</li>
                <li>Explorar falhas técnicas, que devem ser comunicadas imediatamente ao suporte.</li>
              </ul>
              <p>
                <strong>5.3.</strong> Reclamar, criticar de forma legítima, discordar de uma decisão ou procurar um advogado, o Procon ou outra autoridade nunca é considerado infração.
              </p>
              <p>
                <strong>5.4.</strong> Perguntas, mensagens e anúncios que violem estas regras podem ser denunciados por qualquer Usuário e são analisados pela equipe.
              </p>
            </section>

            {/* 6. Anúncios e obrigações do Vendedor */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950">
                6. Anúncios e obrigações do Vendedor
              </h2>
              <p>
                <strong>6.1.</strong> O Vendedor declara que tem o direito de negociar o que anuncia, inclusive perante as regras do jogo ou serviço de origem, e que as informações do anúncio (título, descrição, imagens, preço, estoque e garantia) são verdadeiras. Deve guardar provas lícitas da origem do que vende e apresentá-las quando a equipe pedir de forma justificada.
              </p>
              <p>
                <strong>6.2.</strong> Ter a senha ou o acesso a uma conta não prova, sozinho, o direito de vendê-la. É proibido anunciar:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-zinc-600">
                <li>Contas roubadas, invadidas, obtidas por força bruta ou ligadas a dados de terceiros sem autorização;</li>
                <li>Produtos ilícitos, piratas, falsificados ou de origem fraudulenta;</li>
                <li>Dados pessoais, documentos, cartões ou credenciais financeiras de terceiros;</li>
                <li>Códigos maliciosos e ferramentas para fraude, invasão ou para burlar verificações de identidade;</li>
                <li>Conteúdo adulto, ofensivo, discriminatório ou que viole direitos de terceiros;</li>
                <li>Esquemas de pirâmide, promessas de rendimento e qualquer item cuja venda seja proibida pela lei brasileira.</li>
              </ul>
              <p>
                <strong>6.3.</strong> O Vendedor deve informar no anúncio tudo o que for essencial para a compra: o que está incluso, região, plataforma, compatibilidade, validade, restrições de transferência e condições de suporte. É proibido esconder limitações, anunciar acesso completo e entregar acesso parcial, reutilizar códigos ou vender o mesmo item exclusivo a mais de um Comprador.
              </p>
              <p>
                <strong>6.4.</strong> Os anúncios podem passar por análise antes de ficarem visíveis e podem ser reprovados, pausados ou removidos quando descumprirem estes Termos. O Vendedor é avisado e pode pedir a revisão da decisão.
              </p>
              <p>
                <strong>6.5.</strong> O Vendedor escolhe o plano do anúncio (Prata, Ouro ou Diamante), que muda a exposição nas listagens e a taxa por venda, e a garantia oferecida ao Comprador (7, 14 ou 30 dias; 7 dias para conta vendida pelo criador original).
              </p>
              <p>
                <strong>6.6.</strong> Ao vender contas, o Vendedor garante que não vai recuperá-las, acessá-las, alterá-las, revendê-las ou bloqueá-las depois da entrega. Essa conduta é tratada como fraude.
              </p>
              <p>
                <strong>6.7.</strong> Os tributos sobre as vendas e as obrigações fiscais da atividade do Vendedor são de responsabilidade dele. A operadora responde pelas suas próprias obrigações fiscais, sobre as taxas que cobra.
              </p>
              <p>
                <strong>6.8.</strong> As avaliações devem refletir experiências reais. Avaliações só são removidas quando violam estas regras, e não por serem negativas.
              </p>
            </section>

            {/* 7. Pedido e entrega */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950">
                7. Pedido e entrega
              </h2>
              <p>
                <strong>7.1.</strong> Antes de confirmar a compra, o Comprador vê o Vendedor, a descrição, o preço total com as taxas, a garantia e a forma de entrega, e recebe a confirmação do pedido.
              </p>
              <p>
                <strong>7.2.</strong> O pagamento só é considerado confirmado quando a instituição de pagamento o confirma para a Plataforma. Comprovantes enviados pelo Comprador não substituem essa confirmação, mas ajudam a resolver divergências.
              </p>
              <p>
                <strong>7.3.</strong> Na entrega automática, os dados cadastrados no estoque são entregues ao Comprador assim que o pagamento é confirmado. Na entrega manual, o Vendedor entrega pelo chat do pedido e marca o pedido como entregue. O Vendedor é responsável pela validade do que entrega.
              </p>
              <p>
                <strong>7.4.</strong> Os dados de acesso devem ser entregues só pelo chat do pedido, nunca em perguntas públicas ou outros canais. Todo o histórico do pedido fica registrado e é usado como prova em caso de problema.
              </p>
              <p>
                <strong>7.5.</strong> O Comprador deve seguir as instruções do anúncio, proteger o acesso recebido (trocando a senha e os dados de recuperação quando for o caso) e colaborar na verificação de qualquer problema. A conclusão do pedido não afasta os direitos legais do Comprador em caso de vício, fraude ou informação omitida.
              </p>
            </section>

            {/* 8. Pagamentos e taxas */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950">
                8. Pagamentos e taxas
              </h2>
              <p>
                <strong>8.1.</strong> Criar conta e anunciar são gratuitos. Sobre cada venda concluída, a Plataforma desconta do Vendedor a comissão estipulada nas <Link href="/tarifas" className="text-[#0066FF] font-semibold hover:underline">Tarifas e Prazos</Link>.
              </p>
              <p>
                <strong>8.2.</strong> O Comprador paga por PIX ou com o saldo da conta. Quando houver, a taxa de processamento do PIX e o plano de proteção escolhido no checkout são mostrados antes da confirmação. A taxa de processamento cobre o custo da transação PIX já realizada e não é devolvida em reembolsos, salvo quando a lei exigir a restituição integral.
              </p>
              <p>
                <strong>8.3.</strong> Os pagamentos são processados por instituição de pagamento parceira, autorizada pelo Banco Central. O saldo mostrado na carteira é um registro dos valores ligados à conta e não é depósito bancário, investimento nem rende juros.
              </p>
              <p>
                <strong>8.4.</strong> Pagamentos feitos por terceiros ou com divergência de titularidade podem passar por análise e, se forem recusados, o valor é devolvido a quem pagou.
              </p>
            </section>

            {/* 9. Liberação e saques */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950">
                9. Liberação e saques
              </h2>
              <p>
                <strong>9.1.</strong> O valor fica retido durante a garantia do anúncio, contada a partir da entrega. No fim da garantia, sem mediação aberta, o pedido é concluído automaticamente e o valor, já sem a taxa, fica disponível na carteira do Vendedor.
              </p>
              <p>
                <strong>9.2.</strong> Os saques são feitos via PIX Flash para chave do próprio titular da conta (ou do CNPJ verificado): a partir de R$ 20,00, com taxa fixa de transferência de R$ 5,00 por saque (PIX Flash imediato), processado após a aprovação de segurança. É permitido um saque a cada 24 horas, dentro do limite diário.
              </p>
              <p>
                <strong>9.3.</strong> Se uma transferência for recusada ou devolvida pelo banco, o valor volta ao saldo do Usuário e ele é avisado para corrigir os dados.
              </p>
            </section>

            {/* 10. Retenção de valores */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950">
                10. Retenção de valores
              </h2>
              <p>
                <strong>10.1.</strong> A Plataforma só retém saldos diante de um motivo concreto: pedido em mediação, contestação de pagamento, inconsistência relevante nos dados, indício objetivo de fraude, descumprimento destes Termos ou ordem de autoridade competente.
              </p>
              <p>
                <strong>10.2.</strong> A retenção fica limitada ao valor necessário para cobrir o risco identificado, e os valores que não estão em discussão continuam liberados. O Usuário é informado do motivo geral, das operações afetadas e de como pedir a revisão.
              </p>
              <p>
                <strong>10.3.</strong> A retenção é revista pelo menos a cada 30 dias e dura no máximo 180 dias para o mesmo fato, salvo ordem judicial ou obrigação legal. Resolvida a causa, o saldo restante é liberado. A retenção nunca é usada para a Plataforma se apropriar de valores que pertencem ao Usuário.
              </p>
              <p>
                <strong>10.4.</strong> Valores devidos à Plataforma por um Usuário, como reembolsos pagos por culpa dele, podem ser descontados do seu saldo, com a demonstração do cálculo e a possibilidade de contestação.
              </p>
            </section>

            {/* 11. Contestações de pagamento e fraude */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950">
                11. Contestações de pagamento e fraude
              </h2>
              <p>
                <strong>11.1.</strong> O Comprador pode contestar um pagamento na sua instituição financeira, inclusive pelo Mecanismo Especial de Devolução do PIX (MED). Pedimos que avise também o suporte, para evitar devolução em duplicidade.
              </p>
              <p>
                <strong>11.2.</strong> São proibidas contestações sabidamente falsas e o pedido de devolução de um produto que foi recebido. Nesses casos, a operadora apresenta à instituição as provas do pedido e pode suspender a conta.
              </p>
              <p>
                <strong>11.3.</strong> Se o Comprador receber o reembolso duas vezes (pela Plataforma e pela instituição), o valor recebido a mais pode ser cobrado, com a demonstração do ocorrido.
              </p>
              <p>
                <strong>11.4.</strong> O Vendedor colabora com provas lícitas da origem e da entrega. O valor de uma contestação só é cobrado do Vendedor quando o problema for de responsabilidade dele.
              </p>
            </section>

            {/* 12. Mediação e solução de conflitos */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950">
                12. Mediação e solução de conflitos
              </h2>
              <p>
                <strong>12.1.</strong> Todo o pagamento, a entrega e a comunicação devem acontecer dentro da Plataforma, pelo pedido e pelo seu chat. Negociações feitas fora dela não têm a proteção da Plataforma.
              </p>
              <p>
                <strong>12.2.</strong> Se o produto não for entregue, não corresponder ao anúncio ou apresentar problema, o Comprador pode abrir uma mediação pelo chat do pedido durante a garantia. O Vendedor também pode pedir o cancelamento com reembolso, explicando o motivo.
              </p>
              <p>
                <strong>12.3.</strong> Na mediação, Comprador e Vendedor podem se manifestar e enviar provas. A equipe analisa o chat do pedido e as provas e decide entre liberar o valor ao Vendedor, reembolsar o Comprador total ou parcialmente, ou manter a retenção, informando o motivo da decisão, conforme a{" "}
                <Link href="/reembolso" className="text-[#0066FF] hover:underline font-medium">
                  Política de Reembolso
                </Link>
                . Enquanto o caso é analisado, o valor fica retido.
              </p>
              <p>
                <strong>12.4.</strong> A parte que discordar pode pedir a revisão da decisão pela Central de Ajuda, em até 10 dias úteis. Um fato novo relevante ou um erro pode justificar a reabertura do caso.
              </p>
              <p>
                <strong>12.5.</strong> A mediação é um serviço interno e não impede que qualquer parte procure o Procon, a sua instituição financeira ou o Poder Judiciário.
              </p>
            </section>

            {/* 13. Garantia, arrependimento e reembolsos */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950">
                13. Garantia, arrependimento e reembolsos
              </h2>
              <p>
                <strong>13.1.</strong> O Comprador pode desistir da compra em até 7 dias, conforme o artigo 49 do Código de Defesa do Consumidor, enquanto o produto ainda não tiver sido entregue, pelo chat do pedido ou pela Central de Ajuda.
              </p>
              <p>
                <strong>13.2.</strong> Como os produtos são digitais e não podem ser devolvidos depois de entregues e acessados, após a entrega a proteção do Comprador é a Garantia do anúncio, descrita na{" "}
                <Link href="/reembolso" className="text-[#0066FF] hover:underline font-medium">
                  Política de Reembolso
                </Link>
                , sem prejuízo dos direitos previstos em lei por vício, falta de entrega ou descumprimento da oferta.
              </p>
              <p>
                <strong>13.3.</strong> O reembolso é feito pelo mesmo meio do pagamento: o que foi pago com saldo volta para o saldo, e o que foi pago por PIX é devolvido por PIX para a conta que pagou.
              </p>
            </section>

            {/* 14. Contas e itens digitais */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950">
                14. Contas e itens digitais
              </h2>
              <p>
                <strong>14.1.</strong> Jogos e serviços podem ter regras próprias sobre transferência de contas, região e uso. O Vendedor deve verificar essas regras e informar no anúncio qualquer restrição relevante.
              </p>
              <p>
                <strong>14.2.</strong> Banimentos, mudanças de regras pela desenvolvedora ou recuperação da conta por terceiros são analisados conforme a causa, as informações do anúncio e a responsabilidade de cada parte.
              </p>
              <p>
                <strong>14.3.</strong> Gift cards, códigos e licenças devem ter a origem, a validade, a região e as condições de ativação informadas no anúncio.
              </p>
            </section>

            {/* 15. Suspensão e encerramento de contas */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950">
                15. Suspensão e encerramento de contas
              </h2>
              <p>
                <strong>15.1.</strong> Conforme a gravidade, a repetição e o risco, o descumprimento destes Termos pode levar a: aviso, pausa ou remoção de anúncios, limitação de funções, retenção de saldos (seção 10), suspensão temporária ou encerramento definitivo da conta.
              </p>
              <p>
                <strong>15.2.</strong> Fraude, invasão, documentos falsos, venda de produto ilícito, recuperação de conta vendida e tentativa de burlar uma suspensão podem levar à suspensão imediata.
              </p>
              <p>
                <strong>15.3.</strong> O Usuário é informado do motivo geral da medida e pode pedir a revisão pela Central de Ajuda ou pelo e-mail{" "}
                <a href="mailto:contato@playcontas.com.br" className="text-[#0066FF] font-medium hover:underline">
                  contato@playcontas.com.br
                </a>, mesmo com a conta bloqueada.
              </p>
              <p>
                <strong>15.4.</strong> O encerramento da conta não significa a perda automática do saldo lícito do Usuário. Pedidos em andamento, reembolsos e saldos são resolvidos conforme estes Termos e a lei.
              </p>
              <p>
                <strong>15.5.</strong> O Usuário pode pedir o encerramento da conta a qualquer momento pela Central de Ajuda. Pedidos em andamento e saldos são resolvidos antes do encerramento, e alguns dados são guardados pelo tempo exigido por lei.
              </p>
            </section>

            {/* 16. Responsabilidade */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950">
                16. Responsabilidade
              </h2>
              <p>
                <strong>16.1.</strong> A Plataforma responde pelos serviços que presta e se esforça para manter o ambiente disponível e seguro, mas não garante funcionamento ininterrupto. Manutenções e falhas de terceiros (internet, servidores, meios de pagamento) podem causar interrupções, que são comunicadas e resolvidas o quanto antes.
              </p>
              <p>
                <strong>16.2.</strong> A Plataforma não responde por negociações feitas fora do site, por ações das empresas donas dos jogos e serviços que não tenham relação com a Plataforma, nem por prejuízos causados por senhas compartilhadas pelo próprio Usuário.
              </p>
              <p>
                <strong>16.3.</strong> A Plataforma não garante resultado financeiro com as vendas nem a disponibilidade permanente de produtos de terceiros.
              </p>
              <p>
                <strong>16.4.</strong> Quem causar prejuízo por ato ilícito ou descumprimento destes Termos responde na medida da sua responsabilidade. O Vendedor ressarce a operadora pelos valores que ela tiver de pagar por conduta dele, como reembolsos e condenações, com a demonstração dos valores.
              </p>
            </section>

            {/* 17. Processos automatizados */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950">
                17. Processos automatizados
              </h2>
              <p>
                <strong>17.1.</strong> Algumas etapas acontecem de forma automática: a entrega automática após o pagamento, a conclusão do pedido e a liberação do valor no fim da garantia, a consulta de dados públicos do CNPJ na verificação de empresas e bloqueios de segurança (como limites de tentativas de login e de envio de mensagens).
              </p>
              <p>
                <strong>17.2.</strong> Decisões que afetem a conta, como reprovação de documentos, mediações, denúncias e suspensões, são tomadas pela equipe humana. O Usuário pode pedir a revisão de qualquer decisão, inclusive das automáticas, pela Central de Ajuda, conforme o artigo 20 da Lei Geral de Proteção de Dados.
              </p>
            </section>

            {/* 18. Propriedade intelectual */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950">
                18. Propriedade intelectual
              </h2>
              <p>
                <strong>18.1.</strong> A marca, o logotipo, o layout, os textos e o código da Plataforma pertencem à operadora e não podem ser copiados ou usados sem autorização. O Usuário recebe apenas o direito de usar a Plataforma normalmente.
              </p>
              <p>
                <strong>18.2.</strong> Ao publicar imagens e textos nos anúncios, o Vendedor declara ter o direito de usá-los e autoriza a Plataforma, de forma gratuita e não exclusiva, a exibi-los e adaptá-los enquanto o anúncio existir. Documentos, senhas e mensagens privadas nunca são usados em divulgação.
              </p>
              <p>
                <strong>18.3.</strong> Quem entender que um anúncio viola os seus direitos pode notificar a equipe pelo e-mail{" "}
                <a href="mailto:contato@playcontas.com.br" className="text-[#0066FF] font-medium hover:underline">
                  contato@playcontas.com.br
                </a>, indicando o titular, o direito violado e o endereço do anúncio. A notificação é analisada e o conteúdo pode ser removido, com aviso ao Vendedor.
              </p>
            </section>

            {/* 19. Privacidade e registros */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950">
                19. Privacidade e registros
              </h2>
              <p>
                <strong>19.1.</strong> O tratamento de dados pessoais segue a{" "}
                <Link href="/privacidade" className="text-[#0066FF] hover:underline font-medium">
                  Política de Privacidade
                </Link>{" "}
                e a Lei Geral de Proteção de Dados.
              </p>
              <p>
                <strong>19.2.</strong> Os registros de acesso são guardados pelo prazo do Marco Civil da Internet, e os dados dos pedidos pelo tempo necessário para cumprir obrigações legais e defender direitos.
              </p>
              <p>
                <strong>19.3.</strong> Dados cadastrais, registros de acesso e mensagens privadas só são fornecidos a autoridades ou terceiros quando houver base legal e, nos casos exigidos por lei, ordem judicial.
              </p>
            </section>

            {/* 20. Alterações dos termos */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950">
                20. Alterações dos termos
              </h2>
              <p>
                <strong>20.1.</strong> Estes Termos podem ser atualizados. A versão vigente fica sempre nesta página, com a data da última atualização.
              </p>
              <p>
                <strong>20.2.</strong> Mudanças relevantes, como novas taxas ou aumento das existentes, são avisadas pelo site ou por e-mail com pelo menos 30 dias de antecedência. Quem não concordar pode encerrar a conta antes da mudança, com os pedidos e saldos resolvidos normalmente.
              </p>
              <p>
                <strong>20.3.</strong> Pedidos já feitos seguem as condições do momento da compra. Mudanças urgentes por exigência legal ou de segurança podem valer de imediato, com aviso assim que possível.
              </p>
            </section>

            {/* 21. Atendimento e comunicações */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950">
                21. Atendimento e comunicações
              </h2>
              <p>
                <strong>21.1.</strong> O atendimento é feito pela Central de Ajuda, dentro da sua conta, e pelo e-mail{" "}
                <a href="mailto:contato@playcontas.com.br" className="text-[#0066FF] font-medium hover:underline">
                  contato@playcontas.com.br
                </a>. Respondemos às reclamações em até 5 dias, conforme o Decreto nº 7.962/2013.
              </p>
              <p>
                <strong>21.2.</strong> Avisos sobre pedidos, pagamentos e segurança chegam pelas notificações do site e pelo e-mail cadastrado, que o Usuário deve manter atualizado.
              </p>
              <p>
                <strong>21.3.</strong> Desconfie de qualquer contato em nome da Plataforma fora desses canais e denuncie pelo suporte.
              </p>
            </section>

            {/* 22. Foro e legislação aplicável */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950">
                22. Foro e legislação aplicável
              </h2>
              <p>
                <strong>22.1.</strong> Estes Termos são regidos pelas leis brasileiras, incluindo o Código de Defesa do Consumidor, o Decreto nº 7.962/2013 (comércio eletrônico), o Marco Civil da Internet e a Lei Geral de Proteção de Dados.
              </p>
              <p>
                <strong>22.2.</strong> Fica eleito o foro do domicílio do Usuário consumidor, sem prejuízo da tentativa de solução amigável pelo suporte. Não há arbitragem obrigatória.
              </p>
              <p>
                <strong>22.3.</strong> Se alguma cláusula for considerada inválida, as demais continuam valendo. A tolerância com um descumprimento não significa renúncia a direitos.
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <JamFooter />

      {/* Modais de Carrinho e Autenticação */}
      <CartModal
        isOpen={cartModalOpen}
        onClose={() => setCartModalOpen(false)}
        onCheckout={handleCheckoutFromModal}
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
