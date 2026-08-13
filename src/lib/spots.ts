import { cache } from "react";
import { supabase } from "./supabase";
import { nyClock, timeToMinutes, type HoursInterval } from "./time";
import type { Category, SpotListItem } from "./types";

// Columns come back nullable because spot_effective_hours is a view (Postgres
// infers no NOT NULL through one). The underlying spot_hours columns are all
// NOT NULL, so `complete` below is a type narrowing, not a data guard.
type HoursRow = {
  spot_id: string | null;
  day_of_week: number | null;
  opens: string | null;
  closes: string | null;
};

type CompleteHoursRow = { [K in keyof HoursRow]: NonNullable<HoursRow[K]> };

const complete = (row: HoursRow): row is CompleteHoursRow =>
  row.spot_id !== null &&
  row.day_of_week !== null &&
  row.opens !== null &&
  row.closes !== null;

// Today's intervals plus yesterday's cross-midnight stragglers (a spot open
// "Fri 18:00–02:00" is still open at 1 AM Saturday).
function todaysIntervals(rows: HoursRow[], dow: number): HoursInterval[] {
  const yesterday = (dow + 6) % 7;
  const intervals: HoursInterval[] = [];
  for (const row of rows.filter(complete)) {
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
      // spot_effective_hours, not spot_hours: the view resolves manual >
      // scraped > manual-provisional to ONE tier per spot (20260730000100), so
      // leftover seed rows can never widen a scraped spot's open window.
      supabase
        .from("spot_effective_hours")
        .select("spot_id,day_of_week,opens,closes"),
    ]);

  const statusBySlug = new Map((statuses ?? []).map((s) => [s.slug, s]));
  const hoursBySpot = new Map<string, HoursRow[]>();
  for (const row of (hours ?? []).filter(complete)) {
    const list = hoursBySpot.get(row.spot_id) ?? [];
    list.push(row);
    hoursBySpot.set(row.spot_id, list);
  }

  const items: SpotListItem[] = (spots ?? []).map((spot) => {
    const live = statusBySlug.get(spot.slug);
    return {
      id: spot.id,
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
export type SpotComment = {
  id: number;
  comment: string | null;
  created_at: string;
};

// Recent-comments window: comments are color, not status — a week keeps them
// honest without a graveyard of stale takes.
const COMMENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const COMMENT_LIMIT = 5;

export const getSpotDetail = cache(async function getSpotDetail(
  slug: string,
): Promise<{
  item: SpotListItem;
  comments: SpotComment[];
  nowMs: number;
} | null> {
  const nowMs = Date.now();
  const { dow } = nyClock(new Date(nowMs));

  // TWO stages, not three deep. `spot_current_status` keys on slug — the same
  // key we already have — so it does NOT need to wait for the spots row, and it
  // is the expensive one here (the §5 decay/vote aggregation). Hoisting it into
  // the first stage runs it concurrently with a trivial indexed lookup instead
  // of serially after it, which takes it off the critical path entirely.
  //
  // Hours and comments genuinely need `spot.id`, so they stay in stage two.
  // Collapsing all of it into ONE round trip via PostgREST embedding was
  // considered and not done: `spot_effective_hours` is a CTE-based view, and
  // whether PostgREST can trace an embeddable FK through it is a question that
  // has to be answered against a live database, not guessed at (§Phase 6 —
  // assert the state). Left as the next step, with the reason recorded.
  const [{ data: spot }, { data: live }] = await Promise.all([
    supabase
      .from("spots")
      .select("id,slug,name,category,building,lat,lng,consensus,attributes,baseline")
      .eq("slug", slug)
      .maybeSingle(),
    supabase
      .from("spot_current_status")
      .select("*")
      .eq("slug", slug)
      .maybeSingle(),
  ]);
  if (!spot) return null;

  const [{ data: hours }, { data: comments }] =
    await Promise.all([
      supabase
        .from("spot_effective_hours")
        .select("spot_id,day_of_week,opens,closes")
        .eq("spot_id", spot.id),
      // RLS already filters hidden rows (§3.5) — no client-side moderation.
      supabase
        .from("updates")
        .select("id,comment,created_at")
        .eq("spot_id", spot.id)
        .not("comment", "is", null)
        .gte("created_at", new Date(nowMs - COMMENT_WINDOW_MS).toISOString())
        .order("created_at", { ascending: false })
        .limit(COMMENT_LIMIT),
    ]);

  return {
    item: {
      id: spot.id,
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
    comments: comments ?? [],
    nowMs,
  };
});
