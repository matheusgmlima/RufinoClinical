"use client";

import { Eye, EyeSlash } from "@phosphor-icons/react";
import { useState } from "react";

import { inputClass } from "@/components/ui/field";

export function PasswordInput({
  id,
  autoComplete,
  error,
  hint,
}: {
  id: string;
  autoComplete: "current-password" | "new-password";
  error?: string;
  hint?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ");
  return (
    <div className="relative">
      <input
        id={id}
        name={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required
        maxLength={72}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={`${inputClass} pr-12`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Esconder senha" : "Mostrar senha"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-1 my-auto flex size-10 items-center justify-center rounded-full text-ink-muted hover:text-wine"
      >
        {visible ? <EyeSlash size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
      </button>
    </div>
  );
}
