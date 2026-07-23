"use client";

import { useSyncExternalStore } from "react";

// §4.4's offline half: when the service worker serves cached pages, every
// verdict on screen is last-known, and the product must say so out loud.
// navigator.onLine via useSyncExternalStore (CI errors on set-state-in-
// effect); server snapshot says online, so SSR/hydration render nothing.
function subscribe(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );

  if (online) return null;

  return (
    // Fixed overlay above the map, below the sheets (z-20/30); no layout
    // shift. --muted on --soft is 6.07:1 (§4.8 floor).
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-0 z-10 flex justify-center pt-[max(0.5rem,env(safe-area-inset-top))]"
    >
      <span className="rounded-control bg-soft px-3 py-1.5 font-mono text-[12px] text-muted">
        Offline — showing last-known data
      </span>
    </div>
  );
}
