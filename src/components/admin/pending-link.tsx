"use client";

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";

function PendingMark() {
  const { pending } = useLinkStatus();
  // Always rendered (no layout shift). While pending it tints the link and flags the page, which
  // dims the lists (globals.css, [data-admin-content]) until the new data arrives.
  return (
    <span
      aria-hidden="true"
      data-pending={pending || undefined}
      className="pointer-events-none absolute inset-0 rounded-[inherit] bg-wine/0 transition-colors duration-150 data-[pending]:bg-wine/25"
    />
  );
}

/**
 * Link for filters and pagination: those stay on the same page, so there is no loading screen, and
 * this gives immediate feedback on the click instead.
 */
export function PendingLink({ className, children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link className={`relative ${className ?? ""}`} {...props}>
      {children}
      <PendingMark />
    </Link>
  );
}
