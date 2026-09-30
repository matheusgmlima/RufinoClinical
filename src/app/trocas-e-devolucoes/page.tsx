import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LegalPage, List, Section } from "@/components/legal/legal-page";
import { COMPANY, legalReady } from "@/lib/legal/company";

export const metadata: Metadata = {
  title: "Trocas e devoluções",
  description: "Como desistir de uma compra, trocar ou devolver um produto na Rufino Clinical.",
};

export default function ReturnsPage() {
  if (!legalReady()) notFound();
  const c = COMPANY;
  const contact = (
    <>
      <a href={`mailto:${c.email}`}>{c.email}</a> ou {c.phone}
    </>
  );

  return (
    <LegalPage
      title="Trocas e devoluções"
      lead="Como desistir de uma compra, trocar ou devolver um produto, conforme o Código de Defesa do Consumidor."
      current="/trocas-e-devolucoes"
    >
      <Section title="1. Desistência da compra (7 dias)">
        <p>
          Você pode desistir da compra em até <strong>7 dias corridos a partir do recebimento</strong>, sem precisar
          explicar o motivo (art. 49 do Código de Defesa do Consumidor).
        </p>
        <List>
          <li>
            Como são produtos para saúde, pedimos que o produto volte sem uso, de preferência na embalagem original e
            com todos os acessórios.
          </li>
          <li>O frete da devolução é por nossa conta. Enviamos as instruções de postagem.</li>
          <li>Devolvemos o valor integral, incluindo o frete pago na compra.</li>
        </List>
      </Section>

      <Section title="2. Produto com defeito">
        <p>
          Se o produto apresentar defeito, avise em até <strong>30 dias</strong> do recebimento (produtos de uso
          contínuo, como fitas e géis) ou <strong>90 dias</strong> (produtos duráveis, como equipamentos), conforme o
          art. 26 do Código de Defesa do Consumidor. Envie o número do pedido e fotos do problema.
        </p>
        <p>
          Resolvemos em até 30 dias. Se não for possível, você escolhe entre a troca por um produto igual, a devolução
          do valor pago ou um abatimento proporcional no preço (art. 18).
        </p>
      </Section>

      <Section title="3. Produto errado, faltando ou avariado no transporte">
        <p>
          Se chegar um produto diferente do pedido, faltar algum item ou a embalagem estiver danificada, avise em até 7
          dias do recebimento. Enviamos o produto certo sem custo, ou devolvemos o valor, como você preferir.
        </p>
      </Section>

      <Section title="4. Como pedir">
        <List>
          <li>
            Fale com a gente por {contact}, com o número do pedido (está em <Link href="/conta">Minha conta</Link>).
          </li>
          <li>Enviamos as instruções e o código de postagem, quando houver devolução.</li>
          <li>Quando o produto chega e é conferido, fazemos a troca ou o reembolso.</li>
        </List>
      </Section>

      <Section title="5. Reembolso">
        <List>
          <li>O valor volta pelo mesmo meio de pagamento.</li>
          <li>Pix: o valor volta para a conta de origem em até 2 dias úteis após a aprovação do reembolso.</li>
          <li>Boleto: o Mercado Pago faz a devolução e pode pedir seus dados bancários para isso.</li>
          <li>Cartão de crédito: o estorno aparece em até duas faturas, conforme o banco emissor.</li>
        </List>
      </Section>

      <Section title="6. Cancelamento antes do envio">
        <p>
          Pedido aguardando pagamento: cancele direto em <Link href="/conta">Minha conta</Link>, na página do pedido.
          Pedido pago e ainda não enviado: fale com a gente e devolvemos o valor integral.
        </p>
      </Section>
    </LegalPage>
  );
}
