"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { MAP_COLORS } from "@/lib/map-colors";
import { BrandLockup } from "./BrandMark";
import type { BuildingMarker } from "./MapView";

// Pedestrian glyph for the walking-path row (Alan asked for "person walking
// for walk"). Drawn rather than imported so it inherits the path color.
function WalkIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="13" cy="4.2" r="2.2" fill="currentColor" stroke="none" />
      {/* torso → front leg */}
      <path d="M12.6 8.4 10.8 14l3 2.3.7 4.6" />
      {/* back leg */}
      <path d="M10.8 14 8 15.9l-1 4.3" />
      {/* arms */}
      <path d="m11.8 10.4 3.5 1.7M11.4 12.1 8.5 10.6" />
    </svg>
  );
}

// What the map's dots mean. Status is the map's ONLY color language (§4.3
// traffic-light semantics), so the legend reads as one scale: empty → full,
// plus the closed state, which is most of the map outside meal hours and
// would otherwise be an unexplained gray.
// Static markup — no state, no listeners — and only rendered once the map is
// up, so it adds nothing to the initial paint or to hydration.
const LEGEND: Array<{ swatch: string; label: string }> = [
  { swatch: "bg-go", label: "Empty" },
  { swatch: "bg-hold", label: "In between" },
  { swatch: "bg-skip", label: "Full" },
  { swatch: "bg-closed", label: "Closed" },
];

function MapLegend() {
  return (
    // pointer-events-none: chrome must never swallow a map gesture.
    <div className="pointer-events-none absolute top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] rounded-md bg-black/80 px-2.5 py-2">
      <ul className="flex flex-col gap-1.5">
        <li className="flex items-center gap-1.5">
          {/* Inline color, not a Tailwind class: one source of truth with
              the style JSON's line-color (src/lib/map-colors.ts). */}
          <span
            className="flex shrink-0"
            style={{ color: MAP_COLORS.path }}
          >
            <WalkIcon className="h-3.5 w-3.5" />
          </span>
          <span className="text-[10.5px] font-semibold text-muted">
            Walking path
          </span>
        </li>
        {LEGEND.map(({ swatch, label }) => (
          <li key={label} className="flex items-center gap-1.5">
            {/* Round and small, matching the map's status dots exactly. */}
            <span
              className={`ml-0.75 h-2 w-2 shrink-0 rounded-full ${swatch}`}
            />
            <span className="ml-0.75 text-[10.5px] font-semibold text-muted">
              {label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
// The map mounts off the user's FIRST GESTURE — but only after that gesture
// ENDS, in an idle slot (v2, Alan's drag-jank report 2026-07-24: mounting on
// pointerdown ran maplibre's eval synchronously inside the first sheet drag
// and dropped its frames). A quiet fallback still serves the passive viewer.
// Constants are feel-check material, not law — tune on a phone, log here.
const MOUNT_FALLBACK_MS = 10_000;
// If the browser never reports idle (busy tiles/hydration), mount anyway.
const POST_GESTURE_IDLE_TIMEOUT_MS = 2_000;

export function MapCanvas({ buildings }: { buildings: BuildingMarker[] }) {
  const [mapReady, setMapReady] = useState(false);
  useEffect(() => {
    let armed = false;
    let done = false;
    let idleId: number | null = null;
    let idleFallback: ReturnType<typeof setTimeout> | null = null;

    const mount = () => {
      if (done) return;
      done = true;
      cleanup();
      setMapReady(true);
    };
    // Post-gesture: take the next idle slot rather than mounting inside a
    // possible follow-up gesture (rIC can fire between drag frames, so a
    // plain rIC-on-pointerdown re-creates the same jank).
    const scheduleMount = () => {
      if ("requestIdleCallback" in window) {
        idleId = requestIdleCallback(mount, {
          timeout: POST_GESTURE_IDLE_TIMEOUT_MS,
        });
      } else {
        idleFallback = setTimeout(mount, 300); // Safari: brief settle beat
      }
    };
    const arm = (e: Event) => {
      if (armed || done) return;
      armed = true;
      if (e.type === "pointerdown") {
        // Wait the gesture out; cancel covers scroll-captured pointers.
        window.addEventListener("pointerup", scheduleMount, { once: true });
        window.addEventListener("pointercancel", scheduleMount, { once: true });
      } else {
        // wheel/keydown are discrete — no sustained gesture to wait for.
        scheduleMount();
      }
    };

    const t = setTimeout(scheduleMount, MOUNT_FALLBACK_MS);
    const cleanup = () => {
      clearTimeout(t);
      if (idleFallback !== null) clearTimeout(idleFallback);
      if (idleId !== null && "cancelIdleCallback" in window) {
        cancelIdleCallback(idleId);
      }
      for (const e of ["pointerdown", "keydown", "wheel"]) {
        window.removeEventListener(e, arm);
      }
      window.removeEventListener("pointerup", scheduleMount);
      window.removeEventListener("pointercancel", scheduleMount);
    };
    for (const e of ["pointerdown", "keydown", "wheel"]) {
      // passive: the listener must never add latency to the gesture itself.
      window.addEventListener(e, arm, { passive: true });
    }
    return cleanup;
  }, []);

  return (
    <div className="absolute inset-0">
      {mapReady && <MapView buildings={buildings} />}
      {/* Legend rides with the map — no map, nothing to explain. */}
      {mapReady && <MapLegend />}

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
