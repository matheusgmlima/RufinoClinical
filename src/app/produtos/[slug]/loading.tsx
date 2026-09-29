export default function Loading() {
  return (
    <div className="container-page pb-20 pt-8 lg:pt-10" aria-busy="true" aria-label="Carregando produto">
      <div className="h-4 w-48 animate-pulse rounded-full bg-blush" />
      <div className="mt-6 grid gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="aspect-square animate-pulse rounded-2xl bg-blush lg:col-span-7" />
        <div className="space-y-4 lg:col-span-5">
          <div className="h-10 w-4/5 animate-pulse rounded-full bg-blush" />
          <div className="h-5 w-3/5 animate-pulse rounded-full bg-blush" />
          <div className="mt-8 h-9 w-40 animate-pulse rounded-full bg-blush" />
          <div className="h-4 w-56 animate-pulse rounded-full bg-blush" />
          <div className="mt-8 h-13 w-full animate-pulse rounded-full bg-blush" />
        </div>
      </div>
    </div>
  );
}
