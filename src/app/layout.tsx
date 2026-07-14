import type { Metadata, Viewport } from "next";
import { Figtree, Spline_Sans_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "GritCheck",
  description:
    "Live food and study spots at UMBC — know the best place to go, and whether to trust it.",
};

// viewport-fit=cover exposes env(safe-area-inset-*) so content can clear the
// iOS notch/home indicator in standalone PWA mode.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} ${splineMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
