import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

// Security headers (§0.10 / §5.5 posture; hardened 2026-07-11 at Alan's
// request — "the University itself may look at this"):
// - X-Frame-Options: no embedding → no clickjacking overlays on our UI.
// - nosniff: responses can never be reinterpreted as executable content.
// - Referrer-Policy: outbound clicks don't leak full URLs.
// - Permissions-Policy: geolocation only for our own origin (the "Closest"
//   sort + Phase 4 spot pre-select use it); camera/mic/etc. flatly denied.
// A full Content-Security-Policy is deliberately NOT here yet: Next inline
// hydration scripts and MapLibre's blob: workers need a tested nonce/allow
// list — shipping a blind CSP breaks the app. Tracked for the Phase 5
// hardening pass alongside the service worker.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "geolocation=(self), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// Only marks esbuild as a server-external package so the Serwist route
// (src/app/serwist/[path]/route.ts) can compile the service worker at build.
export default withSerwist(nextConfig);
