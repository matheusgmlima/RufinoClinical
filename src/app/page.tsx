import { Logo } from "@/components/brand/logo";

export default function Home() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-24">
      {/* Two tape strips crossing the background, echoing the monogram */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-1/4 h-16 w-[140%] -rotate-12 rounded-full bg-blush"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 bottom-[10%] h-10 w-[120%] rotate-6 rounded-full bg-nude/40"
      />

      <div className="relative flex max-w-xl flex-col items-center text-center">
        <Logo orientation="vertical" className="text-wine" />
        <p className="mt-14 font-brand text-[0.7rem] tracking-[0.35em] text-ink-muted">EM BREVE</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance text-ink sm:text-5xl">
          Produtos para fisioterapia dermatofuncional
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-pretty text-ink-muted">
          Tapes, bandagens e compressão selecionados por quem usa na prática clínica.
        </p>
      </div>
    </main>
  );
}
