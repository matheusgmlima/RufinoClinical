"use client";

import { unstable_rethrow } from "next/navigation";
import { useActionState, useTransition, type FormEvent } from "react";

import type { FormState } from "@/lib/forms";

const OFFLINE: FormState = { status: "error", message: "Sem conexão com a loja. Confira a internet e tente de novo." };

/**
 * Form wired to a server action. Submits from onSubmit (not the form `action` prop) so React does
 * not reset the fields: what the admin typed stays on screen when validation fails.
 */
export function useAdminForm(action: (prev: FormState, data: FormData) => Promise<FormState>) {
  const [state, dispatch, pending] = useActionState<FormState, FormData>(
    (prev, data) =>
      action(prev, data).catch((error: unknown) => {
        unstable_rethrow(error); // redirects after create/delete
        return OFFLINE;
      }),
    { status: "idle" },
  );
  const [, start] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    start(() => dispatch(data));
  }

  return { state, errors: state.fieldErrors ?? {}, onSubmit, pending };
}
