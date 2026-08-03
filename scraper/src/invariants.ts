// The fail-loudly layer (BUILD_PLAN §Phase 6 exit: "a deliberately broken
// fixture fails loudly, not silently").
//
// DIVISION OF LABOUR. parse.ts rejects anything structurally wrong — an unknown
// status, a reindexed day, an unparseable time. replace_scraped_hours() rejects
// anything wrong at the data layer — an empty run, an unknown slug. This file
// covers the gap between them: input that is individually well-formed but
// collectively implausible. That gap is where a scraper rots quietly, because
// every single row still looks fine.
//
// WHY THE CHECKS ARE SHAPED THIS WAY. The fixtures are summer session (12 of 22
// dining venues closed all week), and the late-August re-capture will change
// nearly every number in them. So the invariants assert on CONTRACT — is the
// feed there, is every mapped spot present, is the shape sane — and never on
// the calendar. Nothing here encodes which venue is open on which day; those
// assertions would pass all summer and fail every September.
import { ALL_FEEDS, type FeedKind } from "./payload.ts";
import type { DiningFeed, LibcalFeed, ScrapePayload } from "./types.ts";
import type { Spot } from "../seed/schema.ts";

/**
 * Floors, not exact counts. A feed that returns 2 locations instead of 17 is
 * broken; a feed that returns 18 because UMBC opened a venue is fine and must
 * not fail the run. Fixture counts today: 17 dining, 11 libcal.
 */
const MIN_DINING_LOCATIONS = 10;
const MIN_LIBCAL_LOCATIONS = 5;

const TIME_RE = /^\d{2}:\d{2}$/;

export class InvariantError extends Error {}

function fail(message: string): never {
  throw new InvariantError(message);
}

/** Did each feed actually arrive? Catches truncation and silent emptying. */
export function assertFeedsPlausible(
  dining: DiningFeed,
  libcal: LibcalFeed,
  feeds: ReadonlySet<FeedKind> = ALL_FEEDS,
): void {
  if (feeds.has("dining") && dining.size < MIN_DINING_LOCATIONS) {
    fail(
      `dining feed returned ${dining.size} locations, expected at least ${MIN_DINING_LOCATIONS} — truncated or the shape moved`,
    );
  }
  if (feeds.has("library") && libcal.size < MIN_LIBCAL_LOCATIONS) {
    fail(
      `libcal feed returned ${libcal.size} locations, expected at least ${MIN_LIBCAL_LOCATIONS} — truncated or the shape moved`,
    );
  }
}

/**
 * Every spot that CAN be scraped must appear in the payload. payload.ts already
 * throws on a source missing from its feed; this catches the other direction —
 * a spot quietly dropped between mapping and writing. Cheap, and the failure it
 * prevents (19 of 20 spots written, run reports success) is exactly the silent
 * partial the phase forbids.
 */
export function assertCoverageComplete(
  payload: ScrapePayload,
  spots: Spot[],
  feeds: ReadonlySet<FeedKind> = ALL_FEEDS,
): void {
  const expected = spots
    .filter((s) => s.hours_source.kind !== "manual" && feeds.has(s.hours_source.kind))
    .map((s) => s.slug);
  const got = new Set(payload.spots.map((s) => s.slug));
  const absent = expected.filter((slug) => !got.has(slug));
  if (absent.length > 0) {
    fail(`scrapable spot(s) missing from the payload: ${absent.join(", ")}`);
  }
}

/** Row-level shape. The DB would reject most of this too — better to die before writing. */
export function assertRowsWellFormed(payload: ScrapePayload): void {
  const seen = new Set<string>();
  for (const spot of payload.spots) {
    for (const h of spot.hours) {
      const where = `${spot.slug} dow ${h.day_of_week} ${h.opens}-${h.closes}`;
      if (!Number.isInteger(h.day_of_week) || h.day_of_week < 0 || h.day_of_week > 6) {
        fail(`${where}: day_of_week out of range`);
      }
      if (!TIME_RE.test(h.opens) || !TIME_RE.test(h.closes)) {
        fail(`${where}: times must be HH:MM`);
      }
      // The same interval twice for one spot means the mapping fanned out
      // wrongly — e.g. a building row and its venue both matched.
      const key = `${spot.slug}|${h.day_of_week}|${h.opens}|${h.closes}`;
      if (seen.has(key)) fail(`${where}: duplicate interval — mapping fanned out wrongly`);
      seen.add(key);
    }
  }
}

/**
 * Per-feed collapse: every spot fed by one source coming back with zero hours.
 *
 * This is the check that catches the realistic silent break — a feed starts
 * returning all-closed because a field was renamed, so every row is valid and
 * the run is green while the app tells students the whole campus is shut.
 *
 * It is per-feed rather than run-wide on purpose: a run-wide check would miss
 * exactly this, since the other feed still returns hours and keeps the total
 * non-zero.
 *
 * It CAN legitimately fire — winter break, when dining really is entirely
 * closed. That case needs a human to look and agree, which is why the override
 * is a deliberate flag on a manual dispatch rather than an automatic tolerance.
 * "Is the whole campus really shut?" is a judgment call, and quietly assuming
 * yes is the failure this phase exists to prevent.
 */
export function assertNoFeedCollapse(
  payload: ScrapePayload,
  spots: Spot[],
  allowEmptyFeed: boolean,
  feeds: ReadonlySet<FeedKind> = ALL_FEEDS,
): void {
  if (allowEmptyFeed) return;

  const kindBySlug = new Map(spots.map((s) => [s.slug, s.hours_source.kind]));
  for (const kind of feeds) {
    const fromFeed = payload.spots.filter((s) => kindBySlug.get(s.slug) === kind);
    if (fromFeed.length === 0) continue;
    const withHours = fromFeed.filter((s) => s.hours.length > 0).length;
    if (withHours === 0) {
      fail(
        `every ${kind} spot came back with zero hours (${fromFeed.length} spots) — ` +
          `a broken feed looks exactly like this. If campus really is shut (break week), ` +
          `re-run the workflow with allow_empty_feed to confirm it deliberately.`,
      );
    }
  }
}

// ── Warnings: suspicious, not wrong ─────────────────────────────────────────

/** Slug comparison ignoring punctuation and case: "blends-and-bowls" -> "blendsandbowls". */
const normalizeSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Levenshtein distance, bailing out once it cannot beat `max`. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      rowMin = Math.min(rowMin, curr[j]);
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[b.length];
}

// Both real cases sit at or under 3: piccolaitalia/picolaitalia is 1,
// blendsandbowls/blendsbowls is 3. The length floor keeps short slugs from
// matching each other on noise.
const NEAR_DUPLICATE_DISTANCE = 3;
const MIN_SLUG_LENGTH = 8;

/**
 * WARNS, never fails: a mapped venue reporting closed all week WHILE a
 * near-identical slug sits in the same feed.
 *
 * This is the one silent failure the invariants cannot legitimately catch.
 * UMBC currently publishes both `blends-and-bowls` and `blends-bowls`, and both
 * `piccola-italia` and `picola-italia`. If they populate the new slug for the
 * fall and leave the mapped one present-but-empty, every check still passes —
 * the venue exists, and "closed" is a legal answer that assertNoFeedCollapse
 * only rejects when the WHOLE feed is empty. One venue would read closed all
 * semester with nothing going red.
 *
 * It cannot be an error: closed-all-week is genuinely normal in summer and over
 * breaks, so failing on it would redden runs that are perfectly correct and
 * train everyone to ignore the alert. A warning is the honest strength of the
 * signal — it says "look at this", not "this is broken", because from the feed
 * alone those two are indistinguishable.
 */
export function findSuspiciousDuplicates(
  payload: ScrapePayload,
  spots: Spot[],
  dining: DiningFeed,
): string[] {
  const sourceBySlug = new Map(
    spots
      .filter((s) => s.hours_source.kind === "dining")
      .map((s) => [s.slug, (s.hours_source as { source_slug: string }).source_slug]),
  );

  const warnings: string[] = [];
  for (const spot of payload.spots) {
    if (spot.hours.length > 0) continue;
    const mine = sourceBySlug.get(spot.slug);
    if (!mine) continue;
    const mineNorm = normalizeSlug(mine);
    if (mineNorm.length < MIN_SLUG_LENGTH) continue;

    for (const other of dining.keys()) {
      if (other === mine) continue;
      const otherNorm = normalizeSlug(other);
      if (otherNorm.length < MIN_SLUG_LENGTH) continue;
      if (editDistance(mineNorm, otherNorm, NEAR_DUPLICATE_DISTANCE) > NEAR_DUPLICATE_DISTANCE) {
        continue;
      }
      const otherRows = dining.get(other)?.length ?? 0;
      warnings.push(
        `${spot.slug}: mapped to "${mine}" which reports CLOSED ALL WEEK, while the feed ` +
          `also carries the near-identical "${other}" (${otherRows} hour rows). ` +
          `If UMBC moved this venue to the new slug, repoint hours_source.source_slug — ` +
          `otherwise it reads closed all semester and nothing fails.`,
      );
    }
  }
  return warnings;
}

/**
 * NOT BUILT, deliberately (§0.3): comparing this run against the previous one to
 * catch a partial cliff — say LibCal quietly halving its output. It is the
 * strongest check available, and it is also the one most likely to cry wolf,
 * because the semester boundary legitimately rewrites nearly every row. Building
 * it now means tuning a threshold against summer data that will not resemble
 * September's. TRIGGER: revisit once two consecutive in-term runs exist to
 * compare, which is the first point real data can set the threshold.
 */
export function runAllInvariants(
  payload: ScrapePayload,
  spots: Spot[],
  dining: DiningFeed,
  libcal: LibcalFeed,
  allowEmptyFeed: boolean,
  feeds: ReadonlySet<FeedKind> = ALL_FEEDS,
): void {
  assertFeedsPlausible(dining, libcal, feeds);
  assertCoverageComplete(payload, spots, feeds);
  assertRowsWellFormed(payload);
  assertNoFeedCollapse(payload, spots, allowEmptyFeed, feeds);
}
