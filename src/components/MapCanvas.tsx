"use client";

import dynamic from "next/dynamic";

// MapLibre reaches for window/document, so the GL view is client-only and never
// server-rendered. Loading it this way is also our graceful degradation (§Phase
// 3): the dark map-bg fallback, the brand chrome below, and the whole sheet/list
// stay functional if the GL view or its tiles never arrive.
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-map-bg" />,
});

export function MapCanvas() {
  return (
    <div className="absolute inset-0">
      <MapView />

      {/* Top bar: Grits mark + wordmark (mockup .map-top). Visual only (§4.7).
          Padding clears the iOS notch/status bar in standalone PWA mode. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 flex items-center px-4 pt-[max(1rem,env(safe-area-inset-top))]"
        aria-hidden
      >
        {/* text-ink, not text-sheet: sheet is a surface color in the navy
            experiment, ink is guaranteed light-on-dark. */}
        <div className="flex items-center gap-2 text-[15px] font-extrabold tracking-[0.02em] text-ink">
          <svg viewBox="0 0 64 64" aria-hidden className="h-5.5 w-5.5">
            <ellipse cx="32" cy="34" rx="20" ry="19" fill="#FFC20E" />
            <path d="M13 26c-3-6 0-14 5-16 2 4 3 8 2 12z" fill="#FFC20E" />
            <path d="M51 26c3-6 0-14-5-16-2 4-3 8-2 12z" fill="#FFC20E" />
            <circle cx="25" cy="30" r="2.6" fill="#121110" />
            <circle cx="39" cy="30" r="2.6" fill="#121110" />
            <ellipse cx="32" cy="39" rx="3" ry="2.2" fill="#121110" />
          </svg>
          <span>
            GRIT<span className="text-gold">CHECK</span>
          </span>
        </div>
      </div>
    </div>
  );
}
