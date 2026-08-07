import type { Json } from "./database.types";
import type { Category } from "./types";

// Filter chips (§1.3) — all static `attributes` reads (§3.2), so filtering is
// fully functional at zero users. Single-select with an implicit "All", per
// the mockup's chip behavior.

export type FilterChip = {
  id: string;
  label: string;
  match: (attributes: Record<string, Json | undefined>) => boolean;
};

const FOOD_CHIPS: FilterChip[] = [
  { id: "coffee", label: "Coffee", match: (a) => a.coffee === true },
  { id: "vegetarian", label: "Vegetarian", match: (a) => a.vegetarian === true },
  { id: "vegan", label: "Vegan", match: (a) => a.vegan === true },
  { id: "halal", label: "Halal", match: (a) => a.halal === true },
  { id: "open_late", label: "Open late", match: (a) => a.open_late === true },
  { id: "meal_swipe", label: "Meal swipe", match: (a) => a.meal_swipe === true },
];

const STUDY_CHIPS: FilterChip[] = [
  // Was labelled "Silent" and matched only `noise === 'silent'` plus the legacy
  // `silent` flag — which found exactly ONE spot, while eight zones marked
  // `quiet` (including Math & Psych Base Floor, the recon's highest-value
  // entry) stayed invisible. `silent` is a legal value in the recon vocabulary
  // (silent|quiet|mid|loud|varies), it is just vanishingly rare; a filter that
  // returns one row is a dead control. Widened to both and relabelled to the
  // plainer word (Phase 7, §4.7 reading level).
  //
  // `silent` the boolean predates the recon and is still set on the seeded AOK
  // 5th/6th row, so all three spellings are accepted.
  {
    id: "quiet",
    label: "Quiet",
    match: (a) =>
      a.silent === true || a.noise === "silent" || a.noise === "quiet",
  },
  { id: "group_ok", label: "Group OK", match: (a) => a.group_ok === true },
  // The "Outlets" chip is gone (Alan, 2026-08-07: outlets data abandoned).
  // It matched `outlets === 'good'` — true for 1 of 35 study zones and never
  // going to improve, so it burned one of the eight slots in a row where only
  // three fit on screen. The attribute stays in §3.2 and on spot detail; only
  // the filter is retired.
  { id: "whiteboards", label: "Whiteboards", match: (a) => a.whiteboards === true },
  { id: "open_24h", label: "Open 24h", match: (a) => a.open_24h === true },
  { id: "near_food", label: "Near food", match: (a) => a.near_food === true },
  // §3.2 amendment 2026-08-04. fill_tendency is a STATIC tendency, not a live
  // reading — which is exactly why it earns a chip: it is the one field that
  // answers "where can I actually sit right now" with zero updates in the
  // system. Without it, the best entry in the recon (Math & Psych base floor,
  // "almost always empty, very quiet") is unreachable in the UI.
  {
    id: "usually_free",
    label: "Usually free",
    match: (a) =>
      a.fill_tendency === "reliably_open" || a.fill_tendency === "usually_open",
  },
];

export const CHIPS_BY_CATEGORY: Record<Category, FilterChip[]> = {
  food: FOOD_CHIPS,
  study: STUDY_CHIPS,
};

export function matchesChip(chip: FilterChip | null, attributes: Json): boolean {
  if (!chip) return true; // "All"
  if (typeof attributes !== "object" || attributes === null || Array.isArray(attributes)) {
    return false;
  }
  return chip.match(attributes as Record<string, Json | undefined>);
}
