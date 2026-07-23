/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

// Service worker (§Phase 5): precache the shell, runtime-cache pages and
// static assets, fall back to /~offline for uncached navigations.
//
// §4.4 note — why serving cached pages offline is honest here: pages are
// NetworkFirst (defaultCache), so a cached copy is only ever served when the
// network fails, and verdicts/freshness re-verdict client-side on the live
// clock (src/lib/clock.ts) — a cached "8 min ago" ages out to "No recent
// data · typical" instead of replaying as current. OfflineBanner labels the
// whole state on top of that.
//
// Live reads never pass through here: browse/detail data arrives as RSC
// payload from the force-dynamic pages, and Realtime is a websocket. Writes
// (Edge Function, rpc, events) are POSTs — not intercepted.

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
