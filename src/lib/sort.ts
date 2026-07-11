import type { Json } from "./database.types";
import { baselineWord } from "./status";
import { minutesUntilClose, nyClock } from "./time";
import type { Category, SpotListItem } from "./types";

// Sorts (§1.3). The recommendation IS the sort order, so every sort shares
// one invariant: open spots always rank above closed ones — the top row
// becomes Best bet, and a closed recommendation is a broken promise.
//
// With zero live updates, rank falls back to the baseline word — the same
// "useful at zero users" posture as filters. Unknowns sort to the middle of
// their group, not the bottom: missing data is not evidence of badness.

export type SortContext = {
  now: Date;
  /** Set once the user grants geolocation for "Closest". */
  location: { lat: number; lng: number } | null;
};

export type SortOption = {
  id: string;
  label: string;
  key: (item: SpotListItem, ctx: SortContext) => number;
};

const UNKNOWN = 1.5;

function crowdRank(value: string | null): number | null {
  if (value === "empty" || value === "quiet") return 0;
  if (value === "normal") return 1;
  if (value === "packed") return 3;
  return null;
}

function liveOrTypicalCrowd(item: SpotListItem, ctx: SortContext): number {
  return (
    crowdRank(item.crowd) ??
    crowdRank(baselineWord(item.baseline, ctx.now)) ??
    UNKNOWN
  );
}

// Equirectangular approximation — exact enough across one campus.
function distanceKey(item: SpotListItem, ctx: SortContext): number {
  if (!ctx.location) return 0; // no location yet → leave order untouched
  const dLat = item.lat - ctx.location.lat;
  const dLng = (item.lng - ctx.location.lng) * Math.cos((item.lat * Math.PI) / 180);
  return dLat * dLat + dLng * dLng;
}

function attr(item: SpotListItem, key: string): Json | undefined {
  const a = item.attributes;
  if (typeof a !== "object" || a === null || Array.isArray(a)) return undefined;
  return (a as Record<string, Json | undefined>)[key];
}

const LINE_RANK: Record<string, number> = { short: 0, normal: 1, long: 2 };

const FOOD_SORTS: SortOption[] = [
  {
    id: "shortest-line",
    label: "Shortest line",
    key: (item, ctx) => {
      if (item.crowd === "packed") return 3;
      if (item.line && item.line in LINE_RANK) return LINE_RANK[item.line];
      return liveOrTypicalCrowd(item, ctx);
    },
  },
  {
    id: "most-worth-it",
    label: "Most worth it",
    // Descending %; spots with no votes sit below any measured spot.
    key: (item) => (item.worthItPct === null ? 2 : 1 - item.worthItPct / 100),
  },
  { id: "closest", label: "Closest", key: distanceKey },
  {
    id: "closing-soon",
    label: "Closing soon",
    key: (item, ctx) =>
      minutesUntilClose(item.hours, nyClock(ctx.now).minutes) ?? Infinity,
  },
];

const OUTLETS_RANK: Record<string, number> = { good: 0, limited: 1, bad: 2 };

const STUDY_SORTS: SortOption[] = [
  {
    id: "best-outlets",
    label: "Best outlets",
    key: (item) => {
      const rating = attr(item, "outlets");
      return typeof rating === "string" ? (OUTLETS_RANK[rating] ?? 3) : 3;
    },
  },
  {
    id: "quietest",
    label: "Quietest",
    key: (item, ctx) => {
      if (item.noise === "quiet") return 0;
      if (item.noise === "normal") return 1;
      if (item.noise === "loud") return 3;
      return liveOrTypicalCrowd(item, ctx);
    },
  },
  // Proxy until real seat counts exist: emptier = more seats open.
  { id: "most-seats", label: "Most seats", key: liveOrTypicalCrowd },
  { id: "closest", label: "Closest", key: distanceKey },
];

export const SORTS_BY_CATEGORY: Record<Category, SortOption[]> = {
  food: FOOD_SORTS,
  study: STUDY_SORTS,
};

export function sortSpots(
  items: SpotListItem[],
  sort: SortOption,
  ctx: SortContext,
): SpotListItem[] {
  return [...items].sort((a, b) => {
    if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
    return sort.key(a, ctx) - sort.key(b, ctx); // stable → name order breaks ties
  });
}
