import type { ComponentProps, ReactNode } from "react";

// Inputs use a 12px radius (rounded-xl); buttons and pills stay fully rounded. See DESIGN.md.
export const inputClass =
  "h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink placeholder:text-ink-muted/70 transition focus:border-wine focus:outline-none focus:ring-2 focus:ring-wine/20 aria-[invalid=true]:border-wine disabled:opacity-60";

type FieldProps = {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  optional?: boolean;
};

/** Label above the control, hint below it, error below the hint (announced to screen readers). */
export function Field({ id, label, error, hint, children, optional }: FieldProps) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
        {optional ? <span className="font-normal text-ink-muted"> (opcional)</span> : null}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-wine">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({
  id,
  error,
  hint,
  className,
  ...props
}: ComponentProps<"input"> & { id: string; error?: string; hint?: boolean }) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ");
  return (
    <input
      id={id}
      name={props.name ?? id}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy || undefined}
      className={`${inputClass} ${className ?? ""}`}
      {...props}
    />
  );
}

export function FormAlert({ tone = "error", children }: { tone?: "error" | "success"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-2xl px-4 py-3 text-sm ${tone === "error" ? "bg-wine/10 text-wine" : "bg-blush text-ink"}`}
    >
      {children}
    </p>
  );
}
