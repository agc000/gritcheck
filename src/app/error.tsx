"use client";

import { useEffect } from "react";
import Link from "next/link";
import { BrandLockup } from "@/components/BrandMark";

// Route-segment error boundary (§Phase 6). Catches a render or data error in
// any page under the root layout and keeps the app usable instead of showing a
// blank tab.
//
// The logger is imported DYNAMICALLY, inside the effect, for two reasons: the
// error screen must still render if the analytics module is itself what broke,
// and nothing about error handling should sit on the critical path (§Phase 5
// perf architecture — every byte here would otherwise ship with the first
// paint). Grits-ified empty states are Phase 7; this is the plain version.
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void import("@/lib/errors")
      .then((m) => m.logClientError(error, "route"))
      .catch(() => {});
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-4 bg-sheet px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-ink">
      <BrandLockup />
      <h1 className="text-lg font-extrabold">This page stopped working.</h1>
      <p className="text-sm text-muted">
        The rest of the app still works. Try again, or go back to the map.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        {/* Flat fill, not gold: gold is reserved for signal (§4.1). */}
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded-control bg-soft px-5 text-sm font-semibold text-ink"
        >
          Try again
        </button>
        <Link
          href="/"
          className="min-h-11 rounded-control px-5 text-sm font-semibold text-muted leading-[2.75rem]"
        >
          Back to the map
        </Link>
      </div>
    </main>
  );
}
