import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

// Security headers (§0.10 / §5.5 posture; hardened 2026-07-11 at Alan's
// request — "the University itself may look at this"):
// - X-Frame-Options: no embedding → no clickjacking overlays on our UI.
// - nosniff: responses can never be reinterpreted as executable content.
// - Referrer-Policy: outbound clicks don't leak full URLs.
// - Permissions-Policy: geolocation only for our own origin (the "Closest"
//   sort + Phase 4 spot pre-select use it); camera/mic/etc. flatly denied.
// Content-Security-Policy (the Phase 5 hardening pass this comment used to
// defer to). Everything the app legitimately talks to, nothing else:
// - connect-src: Supabase REST/Realtime/Functions (http + ws forms of the one
//   env URL) and OpenFreeMap tiles/glyphs/sprites — MapLibre fetches all of
//   those itself, images arrive as blobs (hence img-src blob:).
// - worker-src blob:: MapLibre spawns its workers from blob URLs; 'self'
//   covers the service worker at /serwist/sw.js.
// - script-src keeps 'unsafe-inline': Next's hydration bootstrap is inline
//   scripts, and a nonce pipeline (middleware + strict-dynamic) isn't worth
//   its complexity while the app renders zero user HTML (§5.5:
//   dangerouslySetInnerHTML banned, comments are escaped text). The CSP's
//   real work here is closing exfiltration, embedding, and plugin vectors.
// Dev is exempt: HMR needs eval and ships no CSP anyway.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${supabaseUrl} ${supabaseUrl.replace(/^http/, "ws")} https://tiles.openfreemap.org`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "geolocation=(self), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()",
  },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Content-Security-Policy", value: contentSecurityPolicy }]
    : []),
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// Only marks esbuild as a server-external package so the Serwist route
// (src/app/serwist/[path]/route.ts) can compile the service worker at build.
export default withSerwist(nextConfig);
