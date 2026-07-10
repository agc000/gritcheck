import { supabase } from "./supabase";
import type { Category, SpotListItem } from "./types";

// Server-side data access for the browse list: joins `spots` statics with the
// `spot_current_status` view and stamps fetch time — the timestamp verdicts
// and hydration key off. Impure by nature (I/O + clock), which is why it lives
// here and not in a component body (react-hooks/purity).
export async function getSpotList(): Promise<{
  items: SpotListItem[];
  nowMs: number;
  error: string | null;
}> {
  const nowMs = Date.now();
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

  return { items, nowMs, error: error?.message ?? null };
}
