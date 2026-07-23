"use client";

import { useSyncExternalStore } from "react";

// The honest clock (§4.4). Verdicts and freshness labels are pure functions
// of `now`, and until Phase 5 `now` was frozen at server render time: an open
// tab showed "3 min ago" forever, and a service-worker-cached page replayed
// hours-old data as current — the §5.4 guardrail ("a quiet update from 11 AM
// must never render as current at 3 PM") re-broken through the cache.
//
// useSyncExternalStore is the sanctioned shape (CI errors on set-state-in-
// effect): the server snapshot keeps hydration byte-identical, then the first
// client snapshot corrects the clock in a post-hydration re-render, off the
// critical path.
const MINUTE = 60_000;

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function notify() {
  for (const listener of listeners) listener();
}

// Background tabs throttle intervals to near-nothing; the visibilitychange
// kick is what makes a tab reopened after two hours re-verdict immediately
// instead of on the next (throttled) tick.
function onVisible() {
  if (document.visibilityState === "visible") notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    timer = setInterval(notify, MINUTE);
    document.addEventListener("visibilitychange", onVisible);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
      document.removeEventListener("visibilitychange", onVisible);
    }
  };
}

// Quantized to the minute: the snapshot must be referentially stable between
// ticks or every render would see a "new" value and loop.
function getSnapshot() {
  return Math.floor(Date.now() / MINUTE) * MINUTE;
}

/** Current time in ms, ticking once a minute; `serverNowMs` for SSR/hydration. */
export function useNowMs(serverNowMs: number): number {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverNowMs);
}
