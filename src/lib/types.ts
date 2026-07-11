import type { Database } from "./database.types";
import type { HoursInterval } from "./time";

export type SpotRow = Database["public"]["Tables"]["spots"]["Row"];
export type SpotStatusRow =
  Database["public"]["Views"]["spot_current_status"]["Row"];

export type Category = "food" | "study";

// What the browse list needs per spot: static identity + the live-status
// fields the view computes. Assembled server-side in page.tsx, passed as
// serializable props to the client browser (16–40 rows — trivial payload).
export type SpotListItem = {
  slug: string;
  name: string;
  category: Category;
  building: string;
  lat: number;
  lng: number;
  consensus: string | null;
  attributes: SpotRow["attributes"];
  baseline: SpotRow["baseline"];
  /** Today's open intervals (plus yesterday's if they cross midnight). */
  hours: HoursInterval[];
  isOpen: boolean;
  confidence: string | null;
  line: string | null;
  crowd: string | null;
  noise: string | null;
  worthItPct: number | null;
  lastUpdateAt: string | null;
};
