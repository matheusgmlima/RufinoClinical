// Placeholders shown the instant a panel link is clicked (loading.tsx), while the server fetches
// the data. Shapes echo the real pages so nothing jumps when the content arrives.

function Bar({ className, width }: { className: string; width?: number }) {
  return <div className={`rounded-full bg-ink/8 motion-safe:animate-pulse ${className}`} style={{ width }} />;
}

function Rows({ count }: { count: number }) {
  return (
    <div className="surface divide-y divide-line px-5">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex items-center justify-between gap-4 py-4">
          <div className="grid flex-1 gap-2">
            <Bar className="h-4 w-2/5" />
            <Bar className="h-3 w-3/5" />
          </div>
          <Bar className="h-6 w-20" />
        </div>
      ))}
    </div>
  );
}

function Loading({ children }: { children: React.ReactNode }) {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Carregando...
      </p>
      {children}
    </div>
  );
}

/** Any panel page: title, a strip of filters or cards and a list. */
export function PageSkeleton() {
  return (
    <Loading>
      <Bar className="mb-8 h-9 w-56" />
      <div className="mb-6 flex gap-2">
        {[96, 80, 112, 80].map((width, index) => (
          <Bar key={index} className="h-9" width={width} />
        ))}
      </div>
      <Rows count={6} />
    </Loading>
  );
}

/** Order or product detail: title, main column and a side column. */
export function DetailSkeleton() {
  return (
    <Loading>
      <Bar className="mb-3 h-4 w-24" />
      <Bar className="mb-8 h-9 w-64" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="grid content-start gap-6 xl:col-span-3">
          <div className="surface grid gap-3 p-6">
            <Bar className="h-5 w-32" />
            <Bar className="h-4 w-full" />
            <Bar className="h-4 w-4/5" />
            <Bar className="h-4 w-3/5" />
          </div>
          <Rows count={3} />
        </div>
        <div className="surface grid content-start gap-3 p-6 xl:col-span-2">
          <Bar className="h-5 w-28" />
          <Bar className="h-11 w-full" />
          <Bar className="h-11 w-2/3" />
        </div>
      </div>
    </Loading>
  );
}
