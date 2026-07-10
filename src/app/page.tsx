import { Sheet } from "@/components/Sheet";
import { supabase } from "@/lib/supabase";

// Rendered per-request so the sheet always shows live rows.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [{ data: spots, error }, { data: status }] = await Promise.all([
    supabase
      .from("spots")
      .select("slug,name,category,building,consensus")
      .order("category")
      .order("name"),
    supabase.from("spot_current_status").select("slug,is_open,confidence"),
  ]);

  const statusBySlug = new Map((status ?? []).map((s) => [s.slug, s]));

  return (
    <main className="fixed inset-0 bg-map-bg">
      {/* Static dark placeholder this phase — MapLibre lands in Phase 3 (§Phase 2). */}
      <Sheet>
        {error ? (
          <p className="px-5 py-4 text-sm text-skip">
            Failed to load spots: {error.message}
          </p>
        ) : (
          // PLACEHOLDER list markup — replaced by SpotRow/StatusBadge in task 3.
          <ul className="divide-y divide-line px-5">
            {spots?.map((spot) => {
              const live = statusBySlug.get(spot.slug);
              return (
                <li
                  key={spot.slug}
                  className="flex items-baseline justify-between gap-4 py-3"
                >
                  <div>
                    <div className="font-medium">{spot.name}</div>
                    <div className="text-sm text-muted">{spot.building}</div>
                  </div>
                  <div
                    className={`shrink-0 font-mono text-xs ${live?.is_open ? "text-go" : "text-closed"}`}
                  >
                    {live?.is_open ? "open" : "closed"}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Sheet>
    </main>
  );
}
