"use client";

import { Barcode, CreditCard, LockSimple, PixLogo, Plus } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";

import { placeOrder, quoteCheckout, type CheckoutQuote } from "@/app/actions/checkout";
import { AddressForm, type AddressValues } from "@/components/account/address-form";
import { useCart } from "@/components/cart/cart-provider";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, FormAlert, Input } from "@/components/ui/field";
import { cardClaim, cardOffer, formatBRL, type CardTerms } from "@/lib/money";
import { formatCep, formatDocument, isValidDocument, onlyDigits } from "@/lib/validation/br";

import { OrderSummary } from "./order-summary";

type Method = "pix" | "credit_card" | "boleto";

const PAYMENT_CHOICES = [
  { value: "pix", title: "Pix", Icon: PixLogo, detail: "aprovação na hora" },
  { value: "credit_card", title: "Cartão de crédito", Icon: CreditCard, detail: "" },
  { value: "boleto", title: "Boleto", Icon: Barcode, detail: "Vence em 3 dias · confirmação em até 3 dias úteis" },
] as const;
type Problem = CheckoutQuote["problems"][number];
type Props = {
  addresses: (AddressValues & { id: string })[];
  defaultName: string;
  needsDocument: boolean;
  pixDiscountPercent: number;
  card: CardTerms;
  enabled: boolean;
};

function problemMessage({ problem, available, min_subtotal_cents }: Problem): string {
  switch (problem) {
    case "coupon_invalid":
      return "Cupom inválido ou expirado.";
    case "coupon_min_subtotal":
      return `Este cupom vale para compras a partir de ${formatBRL(min_subtotal_cents ?? 0)}.`;
    case "insufficient_stock":
      return `Um dos itens tem só ${available ?? 0} em estoque.`;
    case "shipping_unavailable":
      return "Ainda não entregamos nesse endereço.";
    case "address_not_found":
      return "Escolha um endereço de entrega.";
    default:
      return "Um item do carrinho não está mais disponível.";
  }
}

function Choice(props: {
  name: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  detail: string;
  icon?: ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
        props.checked ? "border-wine bg-wine/[0.04]" : "border-line hover:border-wine/40"
      }`}
    >
      <input
        type="radio"
        name={props.name}
        checked={props.checked}
        onChange={props.onChange}
        className="mt-1 size-4 shrink-0 accent-wine"
      />
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          {props.icon}
          {props.title}
        </span>
        <span className="mt-0.5 block text-sm text-ink-muted">{props.detail}</span>
      </span>
    </label>
  );
}

export function CheckoutForm({ addresses, defaultName, needsDocument, pixDiscountPercent, card, enabled }: Props) {
  const router = useRouter();
  const { items, hydrated, clear } = useCart();
  const [addressId, setAddressId] = useState(addresses[0]?.id);
  const [adding, setAdding] = useState(addresses.length === 0);
  const [method, setMethod] = useState<Method>("pix");
  const [coupon, setCoupon] = useState("");
  const [couponDraft, setCouponDraft] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [documentDigits, setDocumentDigits] = useState("");
  const [documentTouched, setDocumentTouched] = useState(false);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [quoting, startQuote] = useTransition();
  const [placing, startPlacing] = useTransition();
  const request = useRef(0);

  // Falls back to the first address, e.g. right after the first one is added.
  const selectedId = (addresses.find((a) => a.id === addressId) ?? addresses[0])?.id;

  // Every change is priced again by the database (quote_order).
  useEffect(() => {
    if (!hydrated || items.length === 0 || !selectedId) return;
    const id = ++request.current;
    startQuote(async () => {
      const result = await quoteCheckout({ items, addressId: selectedId, method, coupon }).catch(() => null);
      if (id !== request.current) return;
      setQuote(result);
      setError(result ? null : "Não foi possível calcular o total. Verifique sua conexão e tente de novo.");
      const couponProblem = result?.problems.find((p) => p.problem.startsWith("coupon_"));
      if (couponProblem) {
        setCouponError(problemMessage(couponProblem));
        setCoupon("");
      }
    });
  }, [items, hydrated, selectedId, method, coupon]);

  if (done)
    return (
      <p role="status" className="mt-10 text-ink-muted">
        Abrindo seu pedido...
      </p>
    );
  if (hydrated && items.length === 0) {
    return (
      <div className="mt-10 flex flex-col items-start gap-4">
        <p className="text-ink-muted">Seu carrinho está vazio.</p>
        <ButtonLink href="/produtos">Ver produtos</ButtonLink>
      </div>
    );
  }

  const documentOk = !needsDocument || isValidDocument(documentDigits);
  const blocking = quote?.problems.filter((p) => !p.problem.startsWith("coupon_")) ?? [];
  const canPlace = enabled && selectedId && quote && blocking.length === 0 && documentOk && !quoting && !placing;
  const offer = quote && method === "credit_card" ? cardOffer(quote.total_cents, card) : null;
  const claim = cardClaim(card) ?? "à vista";

  function submit() {
    if (!selectedId) return;
    setError(null);
    startPlacing(async () => {
      const result = await placeOrder({ items, addressId: selectedId, method, coupon, document: documentDigits }).catch(
        () => ({ error: "Sem conexão com a loja. Confira sua internet e tente de novo." }),
      );
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDone(true);
      clear();
      router.push(`/pedido/${result.orderId}`);
    });
  }

  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-12">
      <div className="space-y-10 lg:col-span-7">
        <fieldset className="space-y-3">
          <legend className="mb-4 text-lg font-semibold text-ink">Entrega</legend>
          {addresses.map((a) => (
            <Choice
              key={a.id}
              name="address"
              checked={a.id === selectedId}
              onChange={() => setAddressId(a.id)}
              title={a.label || a.recipient_name}
              detail={`${a.street}, ${a.number}${a.complement ? `, ${a.complement}` : ""} · ${a.district}, ${a.city} - ${a.state}, ${formatCep(a.zip_code)}`}
            />
          ))}
          {adding ? (
            <AddressForm
              defaultName={defaultName}
              onDone={() => {
                setAdding(false);
                router.refresh();
              }}
            />
          ) : addresses.length < 10 ? (
            <Button variant="secondary" onClick={() => setAdding(true)}>
              <Plus size={18} weight="bold" aria-hidden="true" />
              Adicionar endereço
            </Button>
          ) : null}
        </fieldset>

        {needsDocument ? (
          <Field
            id="document"
            label="CPF ou CNPJ"
            hint="Necessário para o pagamento e a nota fiscal."
            error={documentTouched && !documentOk ? "CPF ou CNPJ inválido." : undefined}
          >
            <Input
              id="document"
              inputMode="numeric"
              autoComplete="off"
              value={formatDocument(documentDigits)}
              onChange={(e) => setDocumentDigits(onlyDigits(e.target.value).slice(0, 14))}
              onBlur={() => setDocumentTouched(true)}
              error={documentTouched && !documentOk ? "invalid" : undefined}
              hint
            />
          </Field>
        ) : null}

        <fieldset className="space-y-3">
          <legend className="mb-4 text-lg font-semibold text-ink">Pagamento</legend>
          {PAYMENT_CHOICES.map(({ value, title, Icon, detail }) => (
            <Choice
              key={value}
              name="method"
              checked={method === value}
              onChange={() => setMethod(value)}
              icon={<Icon size={18} className="text-wine" aria-hidden="true" />}
              title={title}
              detail={
                value === "credit_card"
                  ? claim[0].toUpperCase() + claim.slice(1)
                  : value === "pix" && pixDiscountPercent > 0
                    ? `${pixDiscountPercent}% de desconto · ${detail}`
                    : detail
              }
            />
          ))}
        </fieldset>

        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setCouponError(null);
            setCoupon(couponDraft.trim().toUpperCase());
          }}
        >
          <Field id="coupon" label="Cupom de desconto" optional error={couponError ?? undefined}>
            <div className="flex gap-2">
              <Input
                id="coupon"
                value={couponDraft}
                onChange={(e) => setCouponDraft(e.target.value.toUpperCase())}
                maxLength={30}
                autoComplete="off"
                error={couponError ?? undefined}
              />
              <Button type="submit" variant="secondary" disabled={!couponDraft.trim()} className="h-12">
                Aplicar
              </Button>
            </div>
          </Field>
          {quote?.coupon_code ? (
            <p className="text-sm text-ink">
              Cupom <strong>{quote.coupon_code}</strong> aplicado.{" "}
              <button type="button" onClick={() => setCoupon("")} className="font-semibold text-wine hover:underline">
                Remover
              </button>
            </p>
          ) : null}
        </form>
      </div>

      <aside className="h-fit space-y-5 rounded-2xl bg-blush p-6 lg:sticky lg:top-24 lg:col-span-5" aria-busy={quoting}>
        <h2 className="text-lg font-semibold text-ink">Resumo</h2>
        <p className="sr-only" aria-live="polite">
          {quote ? `Total do pedido: ${formatBRL(quote.total_cents)}` : ""}
        </p>
        {quote ? (
          <OrderSummary lines={quote.lines} totals={quote} />
        ) : (
          <p className="text-sm text-ink-muted">
            {selectedId ? "Calculando..." : "Cadastre um endereço para ver o frete e o total."}
          </p>
        )}
        {offer ? <p className="text-right text-xs text-ink-muted">em {offer}</p> : null}
        {quote?.shipping_max_days ? (
          <p className="text-xs text-ink-muted">
            Entrega em {quote.shipping_min_days} a {quote.shipping_max_days} dias úteis após a postagem.
          </p>
        ) : null}

        {blocking.length > 0 ? (
          <FormAlert>
            {problemMessage(blocking[0])}{" "}
            <Link href="/carrinho" className="font-semibold underline">
              Revisar carrinho
            </Link>
          </FormAlert>
        ) : null}
        {error ? <FormAlert>{error}</FormAlert> : null}
        {!enabled ? (
          <FormAlert>Os pagamentos estão sendo configurados. Em breve você poderá finalizar a compra.</FormAlert>
        ) : null}

        <Button size="lg" className="w-full" disabled={!canPlace} onClick={submit}>
          {placing ? "Criando pedido..." : "Finalizar pedido"}
        </Button>
        <p className="flex items-center justify-center gap-1.5 text-xs text-ink-muted">
          <LockSimple size={14} aria-hidden="true" />
          Pagamento processado com segurança pelo Mercado Pago
        </p>
      </aside>
    </div>
  );
}
