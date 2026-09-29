import type { SVGProps } from "react";

// Monogram R: three tape strips with round caps (grid 146x200, stroke 24). See DESIGN.md.
export function LogoSymbol(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 146 200" fill="none" aria-hidden="true" {...props}>
      <g stroke="currentColor" strokeWidth={24} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 22V178" />
        <path d="M52 22H74C106 22 126 43 126 70C126 97 106 118 74 118H52" />
        <path d="M95 148L125 178" />
      </g>
    </svg>
  );
}

type LogoProps = {
  className?: string;
  orientation?: "horizontal" | "vertical";
};

export function Logo({ className, orientation = "horizontal" }: LogoProps) {
  const vertical = orientation === "vertical";
  return (
    <span
      role="img"
      aria-label="Rufino Clinical"
      className={`inline-flex items-center ${vertical ? "flex-col gap-4" : "gap-3"} ${className ?? ""}`}
    >
      <LogoSymbol className={vertical ? "h-16 w-auto" : "h-9 w-auto"} />
      <span aria-hidden="true" className={`flex flex-col font-brand leading-none ${vertical ? "items-center" : ""}`}>
        <span className={`font-bold tracking-[0.3em] ${vertical ? "text-xl" : "text-base"}`}>RUFINO</span>
        <span className={`mt-1.5 tracking-[0.6em] ${vertical ? "text-[0.6rem]" : "text-[0.5rem]"}`}>CLINICAL</span>
      </span>
    </span>
  );
}
