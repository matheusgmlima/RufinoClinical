"use client";

import { MapPin, Plus } from "@phosphor-icons/react";
import { useState } from "react";

import { deleteAddress, setDefaultAddress } from "@/app/actions/addresses";
import { Button } from "@/components/ui/button";
import { formatCep } from "@/lib/validation/br";

import { AddressForm, type AddressValues } from "./address-form";

type Address = AddressValues & { id: string };

export function AddressList({ addresses, defaultName }: { addresses: Address[]; defaultName: string }) {
  const [editing, setEditing] = useState<string | "new" | null>(addresses.length === 0 ? "new" : null);
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <div className="grid gap-4">
      {addresses.map((address) =>
        editing === address.id ? (
          <AddressForm key={address.id} initial={address} defaultName={defaultName} onDone={() => setEditing(null)} />
        ) : (
          <article key={address.id} className="rounded-2xl border border-line p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="flex items-center gap-2 font-semibold text-ink">
                <MapPin size={18} className="text-wine" aria-hidden="true" />
                {address.label || address.recipient_name}
              </p>
              {address.is_default ? (
                <span className="rounded-full bg-blush px-3 py-1 text-xs font-semibold text-wine">Principal</span>
              ) : null}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              {address.recipient_name}
              <br />
              {address.street}, {address.number}
              {address.complement ? `, ${address.complement}` : ""}
              <br />
              {address.district}, {address.city} - {address.state}, {formatCep(address.zip_code)}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setEditing(address.id)} className="h-9 px-4">
                Editar
              </Button>
              {!address.is_default ? (
                <form action={setDefaultAddress.bind(null, address.id)}>
                  <Button type="submit" variant="ghost" className="h-9 px-4">
                    Tornar principal
                  </Button>
                </form>
              ) : null}
              {confirming === address.id ? (
                <form action={deleteAddress.bind(null, address.id)} className="flex gap-2">
                  <Button type="submit" className="h-9 px-4">
                    Confirmar remoção
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirming(null)} className="h-9 px-4">
                    Cancelar
                  </Button>
                </form>
              ) : (
                <Button variant="ghost" onClick={() => setConfirming(address.id)} className="h-9 px-4 text-ink-muted">
                  Remover
                </Button>
              )}
            </div>
          </article>
        ),
      )}

      {editing === "new" ? (
        <AddressForm defaultName={defaultName} onDone={() => setEditing(null)} />
      ) : addresses.length < 10 ? (
        <Button variant="secondary" onClick={() => setEditing("new")} className="justify-self-start">
          <Plus size={18} weight="bold" aria-hidden="true" />
          Adicionar endereço
        </Button>
      ) : null}
    </div>
  );
}
