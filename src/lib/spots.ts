import { cache } from "react";
import { supabase } from "./supabase";
import { nyClock, timeToMinutes, type HoursInterval } from "./time";
import type { Category, SpotListItem } from "./types";

type HoursRow = {
  spot_id: string;
  day_of_week: number;
  opens: string;
  closes: string;
};

// Today's intervals plus yesterday's cross-midnight stragglers (a spot open
// "Fri 18:00–02:00" is still open at 1 AM Saturday).
function todaysIntervals(rows: HoursRow[], dow: number): HoursInterval[] {
  const yesterday = (dow + 6) % 7;
  const intervals: HoursInterval[] = [];
  for (const row of rows) {
    const opens = timeToMinutes(row.opens);
    const closes = timeToMinutes(row.closes);
    if (row.day_of_week === dow) {
      intervals.push({ opens, closes, dayOffset: 0 });
    } else if (row.day_of_week === yesterday && closes <= opens) {
      intervals.push({ opens, closes, dayOffset: -1 });
    }
  }
  return intervals;
}

// Server-side data access for the browse list: joins `spots` statics with the
// `spot_current_status` view and today's hours, and stamps fetch time — the
// timestamp verdicts and hydration both key off. Impure by nature (I/O +
// clock), which is why it lives here and not in a component body.
export async function getSpotList(): Promise<{
  items: SpotListItem[];
  nowMs: number;
  error: string | null;
}> {
  const nowMs = Date.now();
  const { dow } = nyClock(new Date(nowMs));

  const [{ data: spots, error }, { data: statuses }, { data: hours }] =
    await Promise.all([
      supabase
        .from("spots")
        .select("id,slug,name,category,building,lat,lng,consensus,attributes,baseline")
        .order("name"),
      supabase.from("spot_current_status").select("*"),
      supabase.from("spot_hours").select("spot_id,day_of_week,opens,closes"),
    ]);

  const statusBySlug = new Map((statuses ?? []).map((s) => [s.slug, s]));
  const hoursBySpot = new Map<string, HoursRow[]>();
  for (const row of hours ?? []) {
    const list = hoursBySpot.get(row.spot_id) ?? [];
    list.push(row);
    hoursBySpot.set(row.spot_id, list);
  }

  const items: SpotListItem[] = (spots ?? []).map((spot) => {
    const live = statusBySlug.get(spot.slug);
    return {
      slug: spot.slug,
      name: spot.name,
      category: spot.category as Category,
      building: spot.building,
      lat: spot.lat,
      lng: spot.lng,
      consensus: spot.consensus,
      attributes: spot.attributes,
      baseline: spot.baseline,
      hours: todaysIntervals(hoursBySpot.get(spot.id) ?? [], dow),
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

// Single-spot fetch for the SSR detail page (§4.2). Returns null for unknown
// or inactive slugs (RLS already hides inactive rows) → the route 404s.
// cache(): generateMetadata and the page body both call this — dedupe to one
// Supabase round-trip per request.
export const getSpotDetail = cache(async function getSpotDetail(
  slug: string,
): Promise<{
  item: SpotListItem;
  nowMs: number;
} | null> {
  const nowMs = Date.now();
  const { dow } = nyClock(new Date(nowMs));

  const { data: spot } = await supabase
    .from("spots")
    .select("id,slug,name,category,building,lat,lng,consensus,attributes,baseline")
    .eq("slug", slug)
    .maybeSingle();
  if (!spot) return null;

  const [{ data: live }, { data: hours }] = await Promise.all([
    supabase
      .from("spot_current_status")
      .select("*")
      .eq("slug", slug)
      .maybeSingle(),
    supabase
      .from("spot_hours")
      .select("spot_id,day_of_week,opens,closes")
      .eq("spot_id", spot.id),
  ]);

  return {
    item: {
      slug: spot.slug,
      name: spot.name,
      category: spot.category as Category,
      building: spot.building,
      lat: spot.lat,
      lng: spot.lng,
      consensus: spot.consensus,
      attributes: spot.attributes,
      baseline: spot.baseline,
      hours: todaysIntervals(hours ?? [], dow),
      isOpen: live?.is_open ?? false,
      confidence: live?.confidence ?? null,
      line: live?.line ?? null,
      crowd: live?.crowd ?? null,
      noise: live?.noise ?? null,
      worthItPct: live?.worth_it_pct ?? null,
      lastUpdateAt: live?.last_update_at ?? null,
    },
    nowMs,
  };
});
