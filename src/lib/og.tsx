import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Shared OG-card system (§Phase 5 SEO). Server-only: the TTFs in
// src/assets/og exist because satori can't use next/font. Same brand law as
// the app — flat navy, Check-Pin gold, Space Grotesk for the lockup ONLY,
// Figtree (the UI face's webfont half) for content. No live status ever goes
// into a card: link previews get cached by messengers indefinitely, and a
// baked-in verdict is §4.4's "stale data presented as current" in its purest
// form.

export const OG_SIZE = { width: 1200, height: 630 };

const NAVY = "#141A28";
const INK = "#EFEEE9";
const MUTED = "#99A0B2";
const GOLD = "#FFC20E";

const FONT_DIR = join(process.cwd(), "src/assets/og");

export async function loadOgFonts() {
  const [grotBold, grotRegular, figBold, figMedium] = await Promise.all([
    readFile(join(FONT_DIR, "SpaceGrotesk-Bold.ttf")),
    readFile(join(FONT_DIR, "SpaceGrotesk-Regular.ttf")),
    readFile(join(FONT_DIR, "Figtree-Bold.ttf")),
    readFile(join(FONT_DIR, "Figtree-Medium.ttf")),
  ]);
  return [
    { name: "Space Grotesk", data: grotBold, weight: 700 as const },
    { name: "Space Grotesk", data: grotRegular, weight: 400 as const },
    { name: "Figtree", data: figBold, weight: 700 as const },
    { name: "Figtree", data: figMedium, weight: 500 as const },
  ];
}

// The Check-Pin at card scale (same path as BrandMark.tsx).
function Pin({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <path
        fill={GOLD}
        fillRule="evenodd"
        d="M32 3C18.7 3 8 13.6 8 26.7 8 39.8 20.4 50.6 32 62 43.6 50.6 56 39.8 56 26.7 56 13.6 45.3 3 32 3Zm-4.6 39.4-10.2-10.2 5.4-5.4 4.8 4.8L41 18l5.4 5.4-19 19Z"
      />
    </svg>
  );
}

/** The 1200×630 card. `title` is the big line; `subtitle` the muted one. */
export function OgCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: NAVY,
        padding: 80,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <Pin size={64} />
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            fontFamily: "Space Grotesk",
            fontSize: 54,
            letterSpacing: "-0.01em",
            color: INK,
          }}
        >
          <span style={{ fontWeight: 700 }}>Grit</span>
          <span style={{ fontWeight: 400 }}>Check</span>
          <span style={{ color: GOLD, marginLeft: 6 }}>•</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            fontFamily: "Figtree",
            fontWeight: 700,
            fontSize: 92,
            lineHeight: 1.05,
            letterSpacing: "-0.015em",
            color: INK,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: "Figtree",
            fontWeight: 500,
            fontSize: 38,
            color: MUTED,
          }}
        >
          {subtitle}
        </div>
      </div>
    </div>
  );
}
