/**
 * What a page looks like in the half second before its figures arrive.
 *
 * Without this, tapping a menu item left the old page on screen while the new
 * one fetched - which reads as a frozen dashboard rather than a loading one.
 * A title bar, a row of cards and a few rows is enough to say "this is
 * coming", and it matches the shape of nearly every screen here.
 */
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <div className="h-7 w-44 rounded-lg bg-surface-hover" />
          <div className="mt-2 h-4 w-64 rounded bg-surface-hover" />
        </div>
        <div className="hidden h-10 w-32 rounded-xl bg-surface-hover sm:block" />
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card p-4">
            <div className="h-3 w-20 rounded bg-surface-hover" />
            <div className="mt-3 h-7 w-24 rounded bg-surface-hover" />
            <div className="mt-3 h-3 w-16 rounded bg-surface-hover" />
          </div>
        ))}
      </div>

      <div className="card mt-3 divide-y divide-line">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3.5">
            <div className="h-10 w-10 shrink-0 rounded-lg bg-surface-hover" />
            <div className="min-w-0 flex-1">
              <div className="h-4 w-1/3 rounded bg-surface-hover" />
              <div className="mt-2 h-3 w-1/4 rounded bg-surface-hover" />
            </div>
            <div className="hidden h-4 w-16 rounded bg-surface-hover sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
