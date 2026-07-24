"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { BrandLockup } from "./BrandMark";
import type { BuildingMarker } from "./MapView";

// MapLibre reaches for window/document, so the GL view is client-only and never
// server-rendered. Loading it this way is also our graceful degradation (§Phase
// 3): the dark map-bg fallback, the brand chrome below, and the whole sheet/list
// stay functional if the GL view or its tiles never arrive.
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-map-bg" />,
});

// Phase 5 TBT adoption (gate decision 2026-07-23): idle-gating wasn't enough —
// idle arrives ~1s after hydration, so maplibre's parse/eval (~2.4s throttled)
// still landed inside the Lighthouse trace and any slow phone's settle window.
// The map now mounts on the user's FIRST GESTURE (they're engaging; the eval
// cost lands after the 5-second answer is already on screen) or after a quiet
// fallback so a passive viewer still gets the map. Both constants are
// feel-check material, not law — tune on a real phone, log changes here.
const MOUNT_FALLBACK_MS = 10_000;
const INTERACTION_EVENTS = ["pointerdown", "keydown", "wheel"] as const;

export function MapCanvas({ buildings }: { buildings: BuildingMarker[] }) {
  const [mapReady, setMapReady] = useState(false);
  useEffect(() => {
    let armed = false;
    const arm = () => {
      if (armed) return;
      armed = true;
      cleanup();
      setMapReady(true);
    };
    const t = setTimeout(arm, MOUNT_FALLBACK_MS);
    const cleanup = () => {
      clearTimeout(t);
      for (const e of INTERACTION_EVENTS) window.removeEventListener(e, arm);
    };
    for (const e of INTERACTION_EVENTS) {
      // passive: the listener must never add latency to the gesture itself.
      window.addEventListener(e, arm, { passive: true });
    }
    return cleanup;
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
        {/* The Check-Pin lockup (logo system PDF, 2026-07-14). Grits the
            retriever moves to mascot duty (empty states/404, §4.7). */}
        <BrandLockup />
      </div>
    </div>
  );
}
