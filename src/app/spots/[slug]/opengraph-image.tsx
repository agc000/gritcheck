import { ImageResponse } from "next/og";
import { loadOgFonts, OgCard, OG_SIZE } from "@/lib/og";
import { supabase } from "@/lib/supabase";

// Per-spot link preview: name + building + category. Statics only — never
// live status (see src/lib/og.tsx on why §4.4 bans it here). Unknown slugs
// get the site card rather than a 404: messengers that already fetched the
// URL deserve an image, not a broken tile.
export const alt = "GritCheck spot card";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data: spot } = await supabase
    .from("spots")
    .select("name,building,category")
    .eq("slug", slug)
    .maybeSingle();

  const card = spot ? (
    <OgCard
      title={spot.name}
      subtitle={`${spot.building} · ${
        spot.category === "food" ? "Food" : "Study spot"
      } at UMBC`}
    />
  ) : (
    <OgCard
      title="Live food & study spots at UMBC."
      subtitle="Know the best place to go — and whether to trust it."
    />
  );

  return new ImageResponse(card, { ...size, fonts: await loadOgFonts() });
}
