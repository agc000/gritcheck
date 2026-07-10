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
  { id: "silent", label: "Silent", match: (a) => a.silent === true },
  { id: "group_ok", label: "Group OK", match: (a) => a.group_ok === true },
  // "Outlets" chip means outlets worth going for, not merely present.
  { id: "outlets", label: "Outlets", match: (a) => a.outlets === "good" },
  { id: "whiteboards", label: "Whiteboards", match: (a) => a.whiteboards === true },
  { id: "open_24h", label: "Open 24h", match: (a) => a.open_24h === true },
  { id: "near_food", label: "Near food", match: (a) => a.near_food === true },
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
