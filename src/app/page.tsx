import { Sheet } from "@/components/Sheet";
import { SpotBrowser } from "@/components/SpotBrowser";
import { supabase } from "@/lib/supabase";
import type { Category, SpotListItem } from "@/lib/types";

// Rendered per-request so the sheet always shows live rows.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [{ data: spots, error }, { data: statuses }] = await Promise.all([
    supabase
      .from("spots")
      .select("slug,name,category,building,consensus,attributes,baseline")
      .order("name"),
    supabase.from("spot_current_status").select("*"),
  ]);

  const statusBySlug = new Map((statuses ?? []).map((s) => [s.slug, s]));

  const items: SpotListItem[] = (spots ?? []).map((spot) => {
    const live = statusBySlug.get(spot.slug);
    return {
      slug: spot.slug,
      name: spot.name,
      category: spot.category as Category,
      building: spot.building,
      consensus: spot.consensus,
      attributes: spot.attributes,
      baseline: spot.baseline,
      isOpen: live?.is_open ?? false,
      confidence: live?.confidence ?? null,
      line: live?.line ?? null,
      crowd: live?.crowd ?? null,
      noise: live?.noise ?? null,
      worthItPct: live?.worth_it_pct ?? null,
      lastUpdateAt: live?.last_update_at ?? null,
    };
  });

  return (
    <main className="fixed inset-0 bg-map-bg">
      {/* Static dark placeholder this phase — MapLibre lands in Phase 3 (§Phase 2). */}
      <Sheet>
        {error ? (
          <p className="px-5 py-4 text-sm text-skip">
            Failed to load spots: {error.message}
          </p>
        ) : (
          <SpotBrowser items={items} />
        )}
      </Sheet>
    </main>
  );
}
