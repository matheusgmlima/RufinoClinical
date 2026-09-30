import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LegalPage, List, Section } from "@/components/legal/legal-page";
import { COMPANY, legalReady } from "@/lib/legal/company";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: "Regras de compra na Rufino Clinical: cadastro, pagamento, entrega e cancelamento.",
};

export default function TermsPage() {
  if (!legalReady()) notFound();
  const c = COMPANY;

  return (
    <LegalPage
      title="Termos de uso"
      lead="As regras para comprar na loja. Ao criar uma conta ou fazer um pedido, você concorda com elas. Nada aqui tira os direitos que o Código de Defesa do Consumidor garante a você."
      current="/termos"
    >
      <Section title="1. Quem somos">
        <p>
          A loja {c.tradeName} é operada por <strong>{c.legalName}</strong>, {c.document}, com endereço em {c.address}.
          Contato: <a href={`mailto:${c.email}`}>{c.email}</a> ou {c.phone}.
        </p>
      </Section>

      <Section title="2. Cadastro">
        <List>
          <li>Para comprar é preciso ter uma conta, com dados verdadeiros e atualizados.</li>
          <li>A conta é pessoal. Guarde sua senha e não a compartilhe.</li>
          <li>Clínicas e profissionais podem comprar com CNPJ, nas mesmas condições.</li>
          <li>
            Você pode corrigir seus dados ou excluir a conta a qualquer momento em{" "}
            <Link href="/conta/dados">Meus dados</Link>.
          </li>
        </List>
      </Section>

      <Section title="3. Produtos">
        <List>
          <li>
            Mostramos fotos, medidas e descrições fiéis aos produtos. Pequenas diferenças de cor podem acontecer por
            causa da tela.
          </li>
          <li>
            São produtos para saúde. Use com orientação de um fisioterapeuta ou médico, principalmente no
            pós-operatório, e siga o modo de uso de cada produto.
          </li>
          <li>O estoque é reservado no momento do pedido e liberado se o pagamento não for feito no prazo.</li>
        </List>
      </Section>

      <Section title="4. Preços e pagamento">
        <List>
          <li>
            Os preços estão em reais. Eles podem mudar, mas o valor do seu pedido fica fixo depois que ele é feito.
          </li>
          <li>
            <strong>Pix:</strong> o código vale por 60 minutos. O desconto do Pix aparece no resumo antes do pagamento.
          </li>
          <li>
            <strong>Boleto:</strong> vence em 3 dias. A compensação pode levar até 3 dias úteis.
          </li>
          <li>
            <strong>Cartão de crédito:</strong> parcelamento nas condições mostradas no checkout. As parcelas sem juros
            aparecem indicadas; nas demais, os juros são cobrados pelo Mercado Pago e mostrados antes de você confirmar.
          </li>
          <li>O pedido é confirmado quando o pagamento é aprovado. Sem pagamento no prazo, ele é cancelado sozinho.</li>
          <li>
            Se houver um erro evidente de preço ou de cadastro de um produto, podemos cancelar o pedido. Nesse caso,
            avisamos você e devolvemos o valor integral.
          </li>
        </List>
      </Section>

      <Section title="5. Cupons">
        <p>
          Cada cupom tem suas regras (validade, valor mínimo do pedido e limite de usos), conferidas no checkout. Vale
          um cupom por pedido. O desconto do cupom é aplicado sobre os produtos, antes do frete.
        </p>
      </Section>

      <Section title="6. Entrega">
        <List>
          <li>Entregamos em todo o Brasil. Frete e prazo aparecem pelo CEP antes do pagamento.</li>
          <li>O prazo começa a contar quando o pagamento é aprovado.</li>
          <li>Quando o pedido sai, você recebe o código de rastreio, que também aparece em Minha conta.</li>
          <li>
            Confira o endereço antes de pagar. Se o pedido voltar por endereço errado ou ausência repetida, combinamos
            com você um novo envio.
          </li>
          <li>Se a embalagem chegar violada ou danificada, recuse a entrega e fale com a gente.</li>
        </List>
      </Section>

      <Section title="7. Cancelamento, trocas e devoluções">
        <p>
          Enquanto o pedido aguarda pagamento, você pode cancelar em Minha conta. Depois disso, e para desistir, trocar
          ou devolver, veja a <Link href="/trocas-e-devolucoes">política de trocas e devoluções</Link>.
        </p>
      </Section>

      <Section title="8. Uso do site">
        <p>
          Os textos, fotos e a marca {c.tradeName} pertencem à loja ou aos seus fornecedores e não podem ser copiados
          sem autorização. O site pode ficar fora do ar por manutenção ou falhas técnicas, e pedidos em andamento não
          são perdidos por isso.
        </p>
      </Section>

      <Section title="9. Privacidade">
        <p>
          O uso dos seus dados está na <Link href="/privacidade">política de privacidade</Link>.
        </p>
      </Section>

      <Section title="10. Lei e foro">
        <p>
          Estes termos seguem as leis brasileiras. Qualquer disputa pode ser resolvida no foro do seu domicílio, como
          garante o Código de Defesa do Consumidor. Antes disso, fale com a gente: quase tudo se resolve por{" "}
          <a href={`mailto:${c.email}`}>{c.email}</a>.
        </p>
      </Section>
    </LegalPage>
  );
}
