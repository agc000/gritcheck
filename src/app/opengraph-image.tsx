import { ImageResponse } from "next/og";
import { loadOgFonts, OgCard, OG_SIZE } from "@/lib/og";

// Site-wide link preview card. Static — generated once at build.
export const alt = "GritCheck — live food and study spots at UMBC";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <OgCard
        title="Live food & study spots at UMBC."
        subtitle="Know the best place to go — and whether to trust it."
      />
    ),
    { ...size, fonts: await loadOgFonts() },
  );
}
