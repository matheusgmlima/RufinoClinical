"use client";

import { ArrowRight, List, X } from "@phosphor-icons/react";
import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useState } from "react";

import type { Category } from "@/lib/catalog/queries";

export function MobileMenu({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const links = [{ href: "/produtos", label: "Todos os produtos" }].concat(
    categories.map((c) => ({ href: `/produtos?categoria=${c.slug}`, label: c.name })),
  );

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className="inline-flex size-11 items-center justify-center rounded-full text-ink hover:bg-ink/5 lg:hidden"
        aria-label="Abrir menu"
      >
        <List size={24} aria-hidden="true" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay fixed inset-0 z-40 bg-ink/35" />
        <Dialog.Content className="drawer fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-cream px-6 py-5" aria-describedby={undefined}>
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold text-ink">Menu</Dialog.Title>
            <Dialog.Close
              className="inline-flex size-10 items-center justify-center rounded-full text-ink hover:bg-ink/5"
              aria-label="Fechar menu"
            >
              <X size={20} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <nav aria-label="Menu" className="mt-6">
            <ul className="divide-y divide-line">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between py-4 text-base font-semibold text-ink hover:text-wine"
                  >
                    {link.label}
                    <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
