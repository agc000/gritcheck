import type { Metadata, Viewport } from "next";
import { Figtree, Space_Grotesk, Spline_Sans_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { OfflineBanner } from "@/components/OfflineBanner";
import { OpenTracker } from "@/components/OpenTracker";
import { SwRegister } from "@/components/SwRegister";
import "./globals.css";

// UI type is Avenir Next (§4.1, amended 2026-07-10) — an Apple system font
// that can't be self-hosted. Figtree is the matched fallback that non-Apple
// devices download; the stack order in globals.css puts Avenir Next first.
// display "optional" (PSI audit 2026-07-13): with the default "swap", a late
// webfont on slow 4G re-stamps the largest text's paint time and drags LCP
// out by seconds. "optional" paints the metric-matched fallback and skips the
// swap on slow first visits; Apple devices always use local Avenir Next and
// never notice; Figtree is cached for every later visit.
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  display: "optional",
});

// Spline Sans Mono is reserved for timestamps/data (freshness, worth-it %).
const splineMono = Spline_Sans_Mono({
  variable: "--font-spline-mono",
  subsets: ["latin"],
  display: "optional",
});

// Space Grotesk is the LOGO LOCKUP font only (§4.1 amendment 2026-07-14,
// GritCheck Logo System PDF) — never UI text. Two weights, tiny subset.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "optional",
});

// iOS launch screens: without an exact-size startup image iOS flashes a plain
// white screen before a dark app — the one place "no skeleton shimmer" (§4.6)
// would break. One solid-navy PNG per common iPhone footprint (CSS pt × DPR);
// iOS ignores any entry whose media query doesn't match exactly.
// [cssWidth, cssHeight, dpr] — files generated from the Check-Pin SVG live in
// public/splash/ as apple-splash-{w*dpr}x{h*dpr}.png.
const APPLE_SPLASH: Array<[number, number, number]> = [
  [375, 667, 2], // SE 2/3
  [375, 812, 3], // X/XS/11 Pro/12–13 mini
  [390, 844, 3], // 12/13/14/16e
  [393, 852, 3], // 14 Pro/15/16
  [402, 874, 3], // 16 Pro
  [414, 896, 2], // XR/11
  [414, 896, 3], // XS Max/11 Pro Max
  [428, 926, 3], // 12–14 Pro Max/Plus
  [430, 932, 3], // 14 Pro Max/15–16 Plus
  [440, 956, 3], // 16 Pro Max
];

export const metadata: Metadata = {
  // Absolute base for canonical/OG URL resolution on every page.
  metadataBase: new URL("https://gritcheck.live"),
  title: "GritCheck",
  description:
    "Live food and study spots at UMBC — know the best place to go, and whether to trust it.",
  // iOS add-to-home-screen behavior (§Phase 5): fullscreen standalone with the
  // status bar drawn over our own chrome — MapCanvas already pads for the
  // notch via env(safe-area-inset-top).
  appleWebApp: {
    capable: true,
    title: "GritCheck",
    statusBarStyle: "black-translucent",
    startupImage: APPLE_SPLASH.map(([w, h, dpr]) => ({
      url: `/splash/apple-splash-${w * dpr}x${h * dpr}.png`,
      media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
    })),
  },
};

// viewport-fit=cover exposes env(safe-area-inset-*) so content can clear the
// iOS notch/home indicator in standalone PWA mode.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Tints browser UI (Android status bar in standalone) to the map charcoal;
  // matches the manifest's theme_color.
  themeColor: "#191813",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} ${splineMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* Vercel Analytics (dashboard side already enabled by Alan). Loads
            its script async off the critical path — no TBT/LCP impact. */}
        <Analytics />
        {/* First-party open_app event (§3.1 names, §7.4 metrics). */}
        <OpenTracker />
        {/* Idle-gated SW registration; prod builds only. */}
        <SwRegister />
        {/* "Offline — showing last-known data" pill (§4.4). */}
        <OfflineBanner />
      </body>
    </html>
  );
}
