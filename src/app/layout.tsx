import type { Metadata } from "next";
import { Archivo, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";

// Archivo carries all UI text (§4.1). Variable font, so no weight list —
// 400–800 are all reachable via font-weight utilities.
const archivo = Archivo({
  variable: "--font-archivo",
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
      className={`${archivo.variable} ${splineMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
