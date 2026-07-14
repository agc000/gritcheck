"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import type { BuildingMarker } from "./MapView";

// MapLibre reaches for window/document, so the GL view is client-only and never
// server-rendered. Loading it this way is also our graceful degradation (§Phase
// 3): the dark map-bg fallback, the brand chrome below, and the whole sheet/list
// stay functional if the GL view or its tiles never arrive.
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-map-bg" />,
});

export function MapCanvas({ buildings }: { buildings: BuildingMarker[] }) {
  // Mount the GL map only after the browser goes idle: the list is the
  // product's 5-second answer (§1.1) and paints from SSR immediately — the
  // map must never compete with it for the main thread (Lighthouse gate:
  // maplibre eval was 4.3s of throttled TBT when mounted eagerly).
  const [mapReady, setMapReady] = useState(false);
  useEffect(() => {
    // timeout 4000 (was 1500, PSI audit): on slow devices the 1.5s cap made
    // maplibre eval land inside the LCP window, starving the main thread so
    // even server-painted text couldn't repaint (92% "render delay"). Idle
    // devices still mount immediately; only busy ones wait longer.
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(() => setMapReady(true), { timeout: 4000 });
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(() => setMapReady(true), 600); // Safari fallback
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="absolute inset-0">
      {mapReady && <MapView buildings={buildings} />}

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
