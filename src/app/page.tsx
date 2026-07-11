import { MapCanvas } from "@/components/MapCanvas";
import { Sheet } from "@/components/Sheet";
import { SpotBrowser } from "@/components/SpotBrowser";
import { getSpotList } from "@/lib/spots";

// Rendered per-request so the sheet always shows live rows.
export const dynamic = "force-dynamic";

export default async function Home() {
  const { items, nowMs, error } = await getSpotList();

  // One map label per *building*, not per spot — the Commons alone holds ~10
  // vendors on one roof (§4.2: buildings are the tap targets). Anchor at the
  // mean of the building's spot coords.
  // The `building` column is descriptive ("Commons ground floor", "True
  // Grit's (residential side)"), not a key — strip floor/parenthetical
  // qualifiers so one building gets one label. TODO(seed): a canonical
  // building key in spots.json is the honest fix; flag for Alan's next
  // data pass.
  const buildingKey = (b: string) =>
    b
      .replace(/\s*\(.+\)$/, "")
      .replace(/\s+(ground|\d+(?:st|nd|rd|th))\s+floor$/i, "")
      .trim();
  const acc = new Map<
    string,
    {
      lat: number;
      lng: number;
      n: number;
      slugs: string[];
      food: boolean;
      study: boolean;
    }
  >();
  for (const item of items) {
    const key = buildingKey(item.building);
    const a =
      acc.get(key) ??
      { lat: 0, lng: 0, n: 0, slugs: [], food: false, study: false };
    acc.set(key, {
      lat: a.lat + item.lat,
      lng: a.lng + item.lng,
      n: a.n + 1,
      slugs: [...a.slugs, item.slug],
      food: a.food || item.category === "food",
      study: a.study || item.category === "study",
    });
  }
  const buildings = [...acc.entries()].map(([building, a]) => ({
    building,
    lat: a.lat / a.n,
    lng: a.lng / a.n,
    spots: a.n,
    slugs: a.slugs,
    food: a.food,
    study: a.study,
  }));

  return (
    <main className="fixed inset-0 bg-map-bg">
      <MapCanvas buildings={buildings} />
      <Sheet>
        {error ? (
          <p className="px-5 py-4 text-sm text-skip">
            Failed to load spots: {error}
          </p>
        ) : (
          <SpotBrowser items={items} nowMs={nowMs} />
        )}
      </Sheet>
    </main>
  );
}
