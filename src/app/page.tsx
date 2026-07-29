import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { FollowUpPrompt } from "@/components/FollowUpPrompt";
import { MapCanvas } from "@/components/MapCanvas";
import { LiveRefresh } from "@/components/LiveRefresh";
import { Sheet } from "@/components/Sheet";
import { SpotBrowser } from "@/components/SpotBrowser";
import { UpdateSheet } from "@/components/UpdateSheet";
import { buildingKey, type CampusBuilding } from "@/lib/buildings";
import { getSpotList } from "@/lib/spots";
import { liveVerdict, type Tone } from "@/lib/status";

// Rendered per-request so the sheet always shows live rows.
export const dynamic = "force-dynamic";

export default async function Home() {
  const { items, nowMs, error } = await getSpotList();

  // One map label per *building*, not per spot — the Commons alone holds ~10
  // vendors on one roof (§4.2: buildings are the tap targets). Anchor at the
  // mean of the building's spot coords. Naming normalized by buildingKey
  // (src/lib/buildings.ts — shared with the sheet's building filter).
  // Building glow tone: the BEST live tone among the building's spots of a
  // category (go beats hold beats skip). The map's job is "where should I
  // go" — one short-line vendor inside the Commons makes the building worth
  // walking to even if its neighbors are slammed; the per-spot warning lives
  // in the list and detail views. Null when nothing inside has a live,
  // confident verdict (glow off; dot falls back to open/closed).
  type GlowTone = Exclude<Tone, "closed"> | null;
  const bestTone = (a: GlowTone, b: Tone | null): GlowTone => {
    const next = b === "closed" ? null : b; // liveVerdict never yields it, but the type allows it
    if (a === null) return next;
    if (next === null) return a;
    const rank = { go: 0, hold: 1, skip: 2 } as const;
    return rank[a] <= rank[next] ? a : next;
  };
  const now = new Date(nowMs);
  const acc = new Map<
    string,
    {
      lat: number;
      lng: number;
      n: number;
      slugs: string[];
      food: boolean;
      study: boolean;
      open: boolean;
      foodTone: GlowTone;
      studyTone: GlowTone;
    }
  >();
  for (const item of items) {
    const key = buildingKey(item.building);
    const a =
      acc.get(key) ??
      {
        lat: 0, lng: 0, n: 0, slugs: [], food: false, study: false,
        open: false, foodTone: null, studyTone: null,
      };
    const tone = liveVerdict(item, now)?.tone ?? null;
    acc.set(key, {
      lat: a.lat + item.lat,
      lng: a.lng + item.lng,
      n: a.n + 1,
      slugs: [...a.slugs, item.slug],
      food: a.food || item.category === "food",
      study: a.study || item.category === "study",
      // Building-level open: open if ANY spot inside is open.
      open: a.open || item.isOpen,
      foodTone:
        item.category === "food" ? bestTone(a.foodTone, tone) : a.foodTone,
      studyTone:
        item.category === "study" ? bestTone(a.studyTone, tone) : a.studyTone,
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
    open: a.open,
    foodTone: a.foodTone,
    studyTone: a.studyTone,
  }));

  // Find Building tab roster: the interactive five + every OSM label point
  // (public/campus-labels.geojson, baked from the campus map 2026-07-24).
  // Read server-side so the list is in the SSR paint — no client fetch, no
  // loading state. readFile, not import: public/ is a static dir, and the
  // route is force-dynamic anyway.
  const labelsFile = JSON.parse(
    await readFile(
      join(process.cwd(), "public/campus-labels.geojson"),
      "utf-8",
    ),
  ) as GeoJSON.FeatureCollection;
  const interactive: CampusBuilding[] = buildings.map((b) => ({
    name: b.building,
    lat: b.lat,
    lng: b.lng,
    buildingKey: b.building,
    spots: b.spots,
  }));
  const seen = new Set(interactive.map((b) => b.name.toLowerCase()));
  const campusBuildings: CampusBuilding[] = [
    ...interactive,
    ...labelsFile.features.flatMap((f) =>
      f.geometry.type === "Point" && f.properties?.name &&
      !seen.has(String(f.properties.name).toLowerCase())
        ? [
            {
              name: String(f.properties.name),
              lng: f.geometry.coordinates[0],
              lat: f.geometry.coordinates[1],
            },
          ]
        : [],
    ),
  ].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="fixed inset-0 bg-map-bg">
      <MapCanvas buildings={buildings} />
      <Sheet>
        {error ? (
          <p className="px-5 py-4 text-sm text-skip">
            Failed to load spots: {error}
          </p>
        ) : (
          <SpotBrowser
            items={items}
            nowMs={nowMs}
            campusBuildings={campusBuildings}
          />
        )}
      </Sheet>
      {/* Modal update flow; portals to <body>, opened by the FAB's event. */}
      {!error && <UpdateSheet items={items} />}
      {/* Realtime: any INSERT on updates re-pulls server data (idle-gated). */}
      <LiveRefresh />
      {/* One-per-session "Did X pan out?" bar (§4.2). */}
      <FollowUpPrompt />
    </main>
  );
}
