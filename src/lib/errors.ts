import { logEvent } from "./events";

// Minimal client error logging (§Phase 6). Deliberately NOT a third-party
// service: §Phase 5's CSP allows exactly two connect-src origins (Supabase and
// the tile server), so Sentry or any hosted reporter would be silently blocked
// until that policy changed. The `events` table already accepts anonymous
// inserts and its props are JSONB, so this needs no migration and no new
// origin. Sentry stays a §8 trigger — "first crash Alan can't reproduce" —
// not a launch dependency.

/** Long messages are usually stack-ish noise; the first line identifies it. */
const MAX_MESSAGE = 200;

// "map" (Phase 7) is a COMPONENT-level boundary, unlike the other two: it
// contains a failure instead of replacing the screen, so a "map" error means
// the student still had a working app. Worth telling apart in the events
// table — a spike in "map" is a device-support story, a spike in "route" is an
// outage.
export type ErrorBoundaryKind = "route" | "global" | "map";

export function logClientError(
  error: Error & { digest?: string },
  boundary: ErrorBoundaryKind,
) {
  try {
    logEvent("client_error", {
      boundary,
      // `digest` is Next's hash of a server-side error — the only handle on a
      // production error whose real message was stripped before reaching the
      // browser. Without it, server errors are indistinguishable from each other.
      digest: error?.digest ?? "",
      message: (error?.message || "unknown").slice(0, MAX_MESSAGE),
      path: typeof window === "undefined" ? "" : window.location.pathname,
    });
  } catch {
    // An error screen that fails while reporting an error is strictly worse
    // than one that reports nothing.
  }
}
