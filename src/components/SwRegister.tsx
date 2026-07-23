"use client";

import { useEffect } from "react";

// Registers the service worker. Deliberately not Serwist's SerwistProvider:
// it registers during the first client render, and SW install kicks off
// precache downloads that would contend with hydration and the LCP window on
// slow connections. Same idle-gate discipline as the map mount and the
// Realtime socket — the SW exists for the *next* visit; this one owes it
// nothing.
const IDLE_TIMEOUT_MS = 8_000;
const SAFARI_FALLBACK_MS = 8_000;

export function SwRegister() {
  useEffect(() => {
    // Dev servers + service workers = stale-cache debugging misery; the
    // check is build-time inlined so dev bundles skip registration entirely.
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      // Classic (non-module) worker: the route compiles sw.ts to iife, so
      // registration works on Safari < 16.4 too. Root scope must be REQUESTED
      // — the route's Service-Worker-Allowed header only permits it; the
      // default scope would be /serwist/ and the worker would control nothing.
      navigator.serviceWorker.register("/serwist/sw.js", { scope: "/" }).catch(() => {
        // A failed registration means the next visit is a normal web visit —
        // nothing to surface to the user.
      });
    };

    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(register, { timeout: IDLE_TIMEOUT_MS });
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(register, SAFARI_FALLBACK_MS);
    return () => clearTimeout(t);
  }, []);

  return null;
}
