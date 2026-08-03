// Maps parsed feeds onto GritCheck spots and builds the replace_scraped_hours
// argument. The mapping itself already exists: scraper/seed/spots.json carries
// `hours_source` per spot (§Phase 0), validated by scraper/seed/schema.ts.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { seedFileSchema, type Spot } from "../seed/schema.ts";
import type { DiningFeed, LibcalFeed, ScrapePayload, SpotHours } from "./types.ts";

const here = dirname(fileURLToPath(import.meta.url));

export function loadSpots(): Spot[] {
  const raw = JSON.parse(readFileSync(join(here, "..", "seed", "spots.json"), "utf8"));
  const parsed = seedFileSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`spots.json is invalid:\n  ${issues.join("\n  ")}`);
  }
  return parsed.data.spots;
}

/**
 * Builds the payload for every spot whose hours come from a feed.
 *
 * Spots with hours_source.kind === "manual" are omitted entirely — omission is
 * what leaves them untouched, which is exactly right for hours no scrape can
 * know (Alan's data debt, §0.7).
 *
 * Not a 1:1 join: LibCal lid 27 is "Building Hours" and feeds THREE spots (AOK
 * 2nd, 3rd/4th and 5th/6th floors), which all inherit the building's schedule.
 *
 * A mapped source that is absent from its feed throws, listing every miss at
 * once rather than dying on the first. A renamed venue is the single likeliest
 * way this pipeline breaks, and skipping it would write 19 spots and call it a
 * success — the silent partial the exit criterion forbids.
 */
/** Which feeds a run is responsible for. See ALL_FEEDS. */
export type FeedKind = "dining" | "library";
export const ALL_FEEDS: ReadonlySet<FeedKind> = new Set(["dining", "library"]);

export function buildPayload(
  spots: Spot[],
  dining: DiningFeed,
  libcal: LibcalFeed,
  feeds: ReadonlySet<FeedKind> = ALL_FEEDS,
): ScrapePayload {
  const covered: SpotHours[] = [];
  const missing: string[] = [];

  for (const spot of spots) {
    const src = spot.hours_source;
    if (src.kind === "manual") continue;
    // A feed this run is not responsible for: omit the spot entirely, which is
    // what leaves its existing hours standing. Critically it must NOT be marked
    // as covered — coverage suppresses the provisional seed, so a library-only
    // run that "covered" the dining spots would show all 16 food venues closed.
    if (!feeds.has(src.kind)) continue;

    if (src.kind === "dining") {
      const hours = dining.get(src.source_slug);
      if (hours === undefined) {
        missing.push(`${spot.slug} -> dining "${src.source_slug}"`);
        continue;
      }
      covered.push({ slug: spot.slug, hours });
      continue;
    }

    const hours = libcal.get(src.source_lid);
    if (hours === undefined) {
      missing.push(`${spot.slug} -> libcal lid ${src.source_lid}`);
      continue;
    }
    covered.push({ slug: spot.slug, hours });
  }

  if (missing.length > 0) {
    throw new Error(
      `mapped source(s) absent from the feed — renamed or retired upstream:\n  ${missing.join("\n  ")}`,
    );
  }

  return { spots: covered };
}
