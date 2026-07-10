import { Sheet } from "@/components/Sheet";
import { SpotBrowser } from "@/components/SpotBrowser";
import { getSpotList } from "@/lib/spots";

// Rendered per-request so the sheet always shows live rows.
export const dynamic = "force-dynamic";

export default async function Home() {
  const { items, nowMs, error } = await getSpotList();

  return (
    <main className="fixed inset-0 bg-map-bg">
      {/* Static dark placeholder this phase — MapLibre lands in Phase 3 (§Phase 2). */}
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
