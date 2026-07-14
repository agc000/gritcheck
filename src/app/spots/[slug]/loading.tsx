import Link from "next/link";

// Instant loading state for the SSR detail page: the route paints the moment
// a row is tapped instead of freezing until Supabase answers. Also gives the
// router's default dynamic-route prefetch a boundary to prefetch down to.
// §4.6 bans skeleton shimmer, so this is the real page frame — nav + surface,
// no fake content, no pulse.
export default function Loading() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg bg-sheet px-4.5 pb-10 text-ink">
      <nav className="pt-4">
        <Link
          href="/"
          className="-my-3 -ml-2 inline-block px-2 py-3 text-sm font-semibold text-muted"
        >
          ← Map
        </Link>
      </nav>
    </main>
  );
}
