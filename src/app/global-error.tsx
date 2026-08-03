"use client";

import { useEffect } from "react";

// Root error boundary (§Phase 6): the last resort, for a failure in the root
// layout itself. Next replaces the ENTIRE document with this, so it must supply
// its own <html> and <body> — and it renders without the root layout, which
// means without the font variables and without any guarantee the stylesheet
// loaded at all.
//
// Hence inline styles rather than Tailwind classes. If this screen is showing,
// something fundamental failed, and depending on the CSS pipeline to render the
// message about the CSS pipeline having failed is a bad bet. The colours are
// the §4.1 tokens by value: --color-sheet, --color-ink, --color-muted.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void import("@/lib/errors")
      .then((m) => m.logClientError(error, "global"))
      .catch(() => {});
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "0 1.5rem",
          background: "#141a28",
          color: "#efeee9",
          textAlign: "center",
          fontFamily:
            "'Avenir Next', ui-sans-serif, system-ui, -apple-system, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.125rem", fontWeight: 800, margin: 0 }}>
          GritCheck stopped working.
        </h1>
        <p style={{ fontSize: "0.875rem", color: "#99a0b2", margin: 0, maxWidth: "28rem" }}>
          Reloading usually fixes it. If it keeps happening, the site is having
          a problem and it is not something you did.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            minHeight: "2.75rem",
            padding: "0 1.25rem",
            borderRadius: "6px",
            border: "none",
            background: "#1b2232",
            color: "#efeee9",
            fontSize: "0.875rem",
            fontWeight: 600,
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
