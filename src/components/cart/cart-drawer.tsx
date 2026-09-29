"use client";

import { ShoppingBag, X } from "@phosphor-icons/react";
import * as Dialog from "@radix-ui/react-dialog";

import { CartContents } from "./cart-contents";
import { useCart } from "./cart-provider";

export function CartButton() {
  const { count, hydrated, setOpen } = useCart();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="relative inline-flex size-11 items-center justify-center rounded-full text-ink transition hover:bg-ink/5 active:scale-95"
      aria-label={hydrated && count > 0 ? `Abrir carrinho, ${count} ${count === 1 ? "item" : "itens"}` : "Abrir carrinho"}
    >
      <ShoppingBag size={24} aria-hidden="true" />
      {hydrated && count > 0 ? (
        <span className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-wine px-1 text-[0.7rem] font-bold text-cream tabular-nums">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </button>
  );
}

export function CartDrawer() {
  const { open, setOpen, count } = useCart();
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay fixed inset-0 z-40 bg-ink/35" />
        <Dialog.Content
          className="drawer fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-cream shadow-[0_0_60px_-10px_rgb(63_6_17/0.35)]"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between px-6 py-5">
            <Dialog.Title className="text-lg font-semibold text-ink">
              Carrinho{count > 0 ? <span className="ml-2 text-sm font-medium text-ink-muted">({count})</span> : null}
            </Dialog.Title>
            <Dialog.Close
              className="inline-flex size-10 items-center justify-center rounded-full text-ink hover:bg-ink/5"
              aria-label="Fechar carrinho"
            >
              <X size={20} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <CartContents variant="drawer" onNavigate={() => setOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
