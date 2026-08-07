import type { Metadata } from "next";
import Link from "next/link";
import { BrandLockup } from "@/components/BrandMark";

// 404 (§Phase 7). Until this existed, an unknown URL fell through to Next's
// stock white "This page could not be found." — a light page in a dark app,
// with no branding and, worse, no way back. It is reachable in normal use: a
// QR code printed against an old slug, a link shared into a group chat months
// later, a spot renamed between semesters.
//
// PLACEHOLDER — Alan to replace: §4.7 gives the 404 to Grits (the mascot,
// visually only). No Grits artwork exists in the repo yet; docs/"GritCheck Logo
// System-print.pdf" is the likely source. The Check-Pin holds the slot so the
// page is branded rather than blank, and the layout below leaves room for the
// illustration above the heading without moving anything else.
export const metadata: Metadata = {
  title: "Not found — GritCheck",
  // A 404 has nothing to offer a crawler, and indexing it would put a dead
  // page in search results next to the real spot pages.
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-4 bg-sheet px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-ink">
      <BrandLockup />
      <h1 className="text-lg font-extrabold">This page is not here.</h1>
      <p className="max-w-xs text-sm leading-relaxed text-muted">
        The link may be old, or the spot may have a new name.
      </p>
      {/* The stock 404 stranded you. h-11 = the §4.8 44px floor. */}
      <Link
        href="/"
        className="mt-1 inline-flex h-11 items-center rounded-md border border-line bg-soft px-4 text-sm font-bold text-ink transition-transform duration-150 ease-out active:scale-97 motion-reduce:transition-none"
      >
        Go to the map
      </Link>
    </main>
  );
}
