import type { MetadataRoute } from "next";

// Web app manifest (§Phase 5): makes GritCheck installable. Served at
// /manifest.webmanifest and linked automatically by Next.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GritCheck",
    short_name: "GritCheck",
    description:
      "Live food and study spots at UMBC — know the best place to go, and whether to trust it.",
    // Stable identity independent of start_url, so tweaking start_url later
    // never makes browsers treat the install as a different app.
    id: "/",
    // Tagged so a home-screen launch is attributable in the §7.4 source
    // breakdown — without it every installed user reports no source forever,
    // even the ones who originally arrived from an orientation-week QR code.
    // Safe to change precisely because `id` above is stable: browsers key the
    // install on `id`, so this doesn't orphan anyone's existing install. The
    // service worker ignores `src` when matching the precache (see sw.ts).
    start_url: "/?src=homescreen",
    display: "standalone",
    // The product is a phone-in-hand glance (§1.1); landscape is never designed
    // for. iOS ignores this; Android honors it.
    orientation: "portrait",
    // Splash background matches the icon's navy so the Android launch screen
    // reads as the mark expanding, not an icon on a foreign color.
    background_color: "#141a28",
    // Chrome around the app tints to the map charcoal — that's what sits at
    // the top of the viewport (§4.1 --color-map-bg).
    theme_color: "#191813",
    icons: [
      // "any": the rounded-rect Check-Pin as shipped in src/app/icon.svg.
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // "maskable": full-bleed navy with the mark scaled into the 80% safe
      // zone — platforms crop these to circles/squircles, which would clip
      // the rounded-rect variant.
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
