import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";

// Serves the compiled service worker at /serwist/sw.js. Turbopack has no
// bundler plugin hook, so Serwist compiles sw.ts with esbuild inside this
// force-static route — generated once at build time, not per request. The
// route sets Service-Worker-Allowed: "/" so the worker can claim root scope
// from this subpath.

// Versions the precached /~offline HTML: a new deploy busts the old copy.
const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout ??
  crypto.randomUUID();

export const { GET, dynamic, dynamicParams, revalidate, generateStaticParams } =
  createSerwistRoute({
    swSrc: "src/app/sw.ts",
    additionalPrecacheEntries: [{ url: "/~offline", revision }],
    globIgnores: [
      "**/node_modules/**",
      // iOS fetches exactly one matching splash via its <link> tag before the
      // SW ever runs — precaching all ten (~200 KB) helps no one.
      "public/splash/**",
      // create-next-app leftovers, not referenced anywhere.
      "public/{file,globe,next,vercel,window}.svg",
    ],
    useNativeEsbuild: true,
    // iife + classic registration (SwRegister) instead of an ES-module worker:
    // module service workers need Safari 16.4+, and old iPhones are exactly
    // the devices we keep being burned by (Phase 3 debt note).
    esbuildOptions: { format: "iife" },
  });
