// Shared shapes for the hours scraper (BUILD_PLAN §Phase 6).

/** One open interval, already normalized to the spot_hours shape (§3.1). */
export type HoursRow = {
  day_of_week: number; // Postgres dow: 0 = Sunday
  opens: string; // "HH:MM"
  closes: string; // "HH:MM"; closes <= opens means it crosses midnight
};

/**
 * One spot the run COVERED. `hours: []` is meaningful and different from the
 * spot being absent: it says "we looked and this venue is shut all week", which
 * is what lets migration 20260731000100 suppress the provisional seed instead
 * of falling back to it.
 */
export type SpotHours = {
  slug: string;
  hours: HoursRow[];
};

/** The exact argument replace_scraped_hours(payload jsonb) expects. */
export type ScrapePayload = {
  spots: SpotHours[];
};

/** Parsed feeds, keyed by the identity spots.json's hours_source refers to. */
export type DiningFeed = Map<string, HoursRow[]>; // key: dineoncampus location slug
export type LibcalFeed = Map<number, HoursRow[]>; // key: LibCal lid

/**
 * A day that spans the clock. `closes <= opens` is how §3.1 encodes crossing
 * midnight, so 00:00–00:00 reads as "open for the whole of this day" in the
 * spot_current_status predicate.
 */
export const ALL_DAY = { opens: "00:00", closes: "00:00" } as const;
