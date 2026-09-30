import "server-only";

import { serverEnv } from "@/lib/env/server";

import type { RenderedEmail } from "./order-emails";

export function emailEnabled() {
  return !!(serverEnv.RESEND_API_KEY && serverEnv.EMAIL_FROM);
}

/**
 * Sends one e-mail through Resend. The idempotency key makes a repeated send (a webhook retried,
 * a payment recorded twice) deliver once: Resend keeps each key for 24 hours.
 */
export async function sendEmail(to: string, email: RenderedEmail, idempotencyKey: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serverEnv.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: serverEnv.EMAIL_FROM,
      to: [to],
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(serverEnv.EMAIL_REPLY_TO ? { reply_to: serverEnv.EMAIL_REPLY_TO } : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
