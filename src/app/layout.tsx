import type { Metadata } from "next";
import { Figtree, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";

// UI type is Avenir Next (§4.1, amended 2026-07-10) — an Apple system font
// that can't be self-hosted. Figtree is the matched fallback that non-Apple
// devices download; the stack order in globals.css puts Avenir Next first.
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

// Spline Sans Mono is reserved for timestamps/data (freshness, worth-it %).
const splineMono = Spline_Sans_Mono({
  variable: "--font-spline-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GritCheck",
  description:
    "Live food and study spots at UMBC — know the best place to go, and whether to trust it.",
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
