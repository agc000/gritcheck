import type { MetadataRoute } from "next";

import { getSpotList } from "@/lib/spots";

const BASE = "https://gritcheck.live";

// Home + every active spot detail page. Spot slugs come from the DB, so a
// newly activated spot appears here without a deploy.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { items } = await getSpotList();
  return [
    { url: BASE, changeFrequency: "hourly", priority: 1 },
    // Low priority, rarely changes — but indexable on purpose: "what does this
    // app collect" should be answerable without installing anything (§Phase 6).
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.1 },
    ...items.map((item) => ({
      url: `${BASE}/spots/${item.slug}`,
      changeFrequency: "hourly" as const,
      priority: 0.8,
    })),
  ];
}
