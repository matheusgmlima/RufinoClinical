import type { ComponentProps, ReactNode } from "react";

import { Field, FormAlert, inputClass } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";

/** Success or general error of the last submit (field errors show next to each field). */
export function FormMessage({ state }: { state: FormState }) {
  if (!state.message) return null;
  return <FormAlert tone={state.status === "ok" ? "success" : "error"}>{state.message}</FormAlert>;
}

function describedBy(id: string, hint: boolean, error?: string) {
  return [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
}

type TextAreaProps = ComponentProps<"textarea"> & {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
};

export function TextAreaField({ id, label, error, hint, optional, rows = 3, ...props }: TextAreaProps) {
  return (
    <Field id={id} label={label} error={error} hint={hint} optional={optional}>
      <textarea
        id={id}
        name={props.name ?? id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, !!hint, error)}
        className={`${inputClass} h-auto py-3`}
        {...props}
      />
    </Field>
  );
}

type SelectProps = ComponentProps<"select"> & { id: string; label: string; error?: string; hint?: ReactNode };

export function SelectField({ id, label, error, hint, children, ...props }: SelectProps) {
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <select
        id={id}
        name={props.name ?? id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, !!hint, error)}
        className={inputClass}
        {...props}
      >
        {children}
      </select>
    </Field>
  );
}

type CheckboxProps = Omit<ComponentProps<"input">, "type"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};

export function Checkbox({ id, label, hint, error, ...props }: CheckboxProps) {
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="flex items-start gap-3 text-sm text-ink">
        <input
          id={id}
          name={props.name ?? id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, !!hint, error)}
          className="mt-0.5 size-5 shrink-0 accent-wine"
          {...props}
        />
        <span className="font-semibold">{label}</span>
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="pl-8 text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="pl-8 text-sm font-medium text-wine">
          {error}
        </p>
      ) : null}
    </div>
  );
}
