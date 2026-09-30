import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LegalPage, List, Section } from "@/components/legal/legal-page";
import { COMPANY, legalReady } from "@/lib/legal/company";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Como a Rufino Clinical trata seus dados pessoais, de acordo com a LGPD.",
};

export default function PrivacyPage() {
  if (!legalReady()) notFound();
  const c = COMPANY;

  return (
    <LegalPage
      title="Política de privacidade"
      lead="Aqui explicamos quais dados pessoais usamos, para quê, com quem compartilhamos e como você exerce seus direitos, de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018)."
      current="/privacidade"
    >
      <Section title="1. Quem cuida dos seus dados">
        <p>
          A loja {c.tradeName} é operada por <strong>{c.legalName}</strong>, {c.document}, com endereço em {c.address}.
          Ela é a controladora dos dados pessoais tratados no site. Contato: <a href={`mailto:${c.email}`}>{c.email}</a>{" "}
          ou {c.phone}.
        </p>
      </Section>

      <Section title="2. Dados que coletamos">
        <List>
          <li>
            <strong>Cadastro:</strong> nome, e-mail, senha (guardada cifrada pelo serviço de login, nem nós temos
            acesso a ela), celular e CPF ou CNPJ.
          </li>
          <li>
            <strong>Entrega:</strong> os endereços que você cadastra.
          </li>
          <li>
            <strong>Pedidos:</strong> produtos, valores, cupom, forma de pagamento, situação do pedido e código de
            rastreio. Cada pedido guarda uma cópia do nome, contato, documento e endereço usados na compra.
          </li>
          <li>
            <strong>Pagamento:</strong> o pagamento é processado pelo Mercado Pago. Os dados do cartão vão direto do
            seu navegador para o Mercado Pago e nunca passam pela loja. Guardamos só a situação, o valor, as parcelas e
            o identificador da cobrança.
          </li>
          <li>
            <strong>Uso do site:</strong> um cookie de sessão para manter você conectado e o carrinho salvo no próprio
            navegador. Não usamos cookies de publicidade nem ferramentas de análise de navegação.
          </li>
          <li>
            <strong>Preferências:</strong> se você aceitou receber novidades por e-mail.
          </li>
        </List>
      </Section>

      <Section title="3. Para que usamos e com qual base legal">
        <List>
          <li>
            Criar e manter sua conta, processar pagamentos, entregar os pedidos e atender você: execução de contrato
            (art. 7º, V, da LGPD).
          </li>
          <li>
            Emitir nota fiscal e guardar registros de vendas e de acesso ao site: cumprimento de obrigação legal (art.
            7º, II).
          </li>
          <li>
            Evitar fraudes e manter o site seguro, como a verificação de pagamentos e o registro de alterações feitas
            pela equipe: legítimo interesse (art. 7º, IX).
          </li>
          <li>
            Enviar novidades e promoções por e-mail: seu consentimento (art. 7º, I), que você pode retirar a qualquer
            momento em <Link href="/conta/dados">Meus dados</Link>.
          </li>
        </List>
        <p>Não vendemos seus dados e não os usamos para decisões automatizadas.</p>
      </Section>

      <Section title="4. Com quem compartilhamos">
        <p>Só com quem precisa deles para a loja funcionar, e só o necessário:</p>
        <List>
          <li>
            <strong>Mercado Pago:</strong> pagamentos e prevenção a fraudes (nome, e-mail, documento, endereço e valor).
          </li>
          <li>
            <strong>Supabase:</strong> banco de dados e login, com servidores em São Paulo.
          </li>
          <li>
            <strong>Vercel:</strong> hospedagem do site.
          </li>
          <li>
            <strong>Resend:</strong> envio dos e-mails sobre seus pedidos.
          </li>
          <li>
            <strong>Correios ou transportadora:</strong> nome, endereço e telefone para a entrega.
          </li>
          <li>
            <strong>ViaCEP:</strong> consulta do endereço pelo CEP (só o CEP é enviado).
          </li>
          <li>
            <strong>Autoridades públicas:</strong> quando a lei ou uma ordem judicial exigir.
          </li>
        </List>
        <p>
          Vercel e Resend podem tratar dados fora do Brasil, nos Estados Unidos. Essas transferências seguem o art. 33
          da LGPD, com contratos que exigem proteção compatível com a lei brasileira.
        </p>
      </Section>

      <Section title="5. Por quanto tempo guardamos">
        <List>
          <li>
            <strong>Conta, perfil e endereços:</strong> enquanto a conta existir. Se você excluir a conta, eles são
            apagados na hora.
          </li>
          <li>
            <strong>Pedidos, pagamentos e notas fiscais:</strong> pelo prazo exigido pelas leis fiscais e de defesa do
            consumidor, em regra 5 anos, mesmo depois da exclusão da conta, sem ligação com ela.
          </li>
          <li>
            <strong>Registros de acesso ao site:</strong> 6 meses, como exige o Marco Civil da Internet (Lei
            12.965/2014).
          </li>
        </List>
      </Section>

      <Section title="6. Seus direitos">
        <p>Pelo art. 18 da LGPD, você pode, a qualquer momento:</p>
        <List>
          <li>confirmar se tratamos seus dados e ter acesso a eles;</li>
          <li>corrigir dados incompletos, errados ou desatualizados;</li>
          <li>pedir a anonimização, o bloqueio ou a eliminação de dados desnecessários ou tratados em excesso;</li>
          <li>receber seus dados em formato estruturado (portabilidade);</li>
          <li>saber com quem compartilhamos seus dados;</li>
          <li>retirar o consentimento para e-mails de novidades;</li>
          <li>excluir sua conta e os dados tratados com base no consentimento.</li>
        </List>
        <p>
          Boa parte disso você resolve direto em <Link href="/conta/dados">Minha conta → Meus dados</Link>: corrigir o
          cadastro, baixar uma cópia dos seus dados e excluir a conta. Para o resto, escreva para{" "}
          <a href={`mailto:${c.dpoEmail}`}>{c.dpoEmail}</a>. Respondemos em até 15 dias. Você também pode reclamar à
          Autoridade Nacional de Proteção de Dados (ANPD).
        </p>
      </Section>

      <Section title="7. Segurança">
        <p>
          O site usa conexão criptografada (HTTPS). Senhas são guardadas cifradas. Só a equipe acessa o painel da loja,
          com verificação em duas etapas, e cada alteração fica registrada. Cada cliente só consegue ver os próprios
          dados.
        </p>
      </Section>

      <Section title="8. Encarregado de dados">
        <p>
          O encarregado pelo tratamento de dados pessoais é <strong>{c.dpoName}</strong>, pelo e-mail{" "}
          <a href={`mailto:${c.dpoEmail}`}>{c.dpoEmail}</a>.
        </p>
      </Section>

      <Section title="9. Mudanças nesta política">
        <p>
          Se esta política mudar, a data no topo da página é atualizada. Mudanças importantes são avisadas também na
          página inicial da loja.
        </p>
      </Section>
    </LegalPage>
  );
}
