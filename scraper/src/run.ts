// The scrape run (BUILD_PLAN §Phase 6).
//
//   node scraper/src/run.ts                     fetch live, write to Supabase
//   node scraper/src/run.ts --dry-run           fetch live, print, write NOTHING
//   node scraper/src/run.ts --fixtures          parse the committed snapshots, print only
//   node scraper/src/run.ts --fixtures --write  same, but write (local stack only)
//   node scraper/src/run.ts --allow-empty-feed  confirm a genuinely shut campus
//   node scraper/src/run.ts --feeds=library     run one feed only (default: all)
//
// --feeds exists because dining cannot be scraped from CI: Cloudflare challenges
// both the page and the apiv4 endpoint from any non-browser client and from
// datacenter IPs (§Phase 6, amended 2026-08-03). The scheduled workflow runs
// --feeds=library; the default stays `all` so a bare run still attempts dining
// and fails loudly rather than quietly pretending dining is not a problem.
//
// Exit code IS the alert: GH Actions turns a non-zero exit into a failure
// notification, which §Phase 6 accepts as sufficient alerting. So every failure
// path here throws rather than logging and carrying on — the one outcome this
// phase must never produce is a green run that changed nothing.
import { createClient } from "@supabase/supabase-js";
import {
  fetchDining,
  fetchLibCal,
  readDiningFixture,
  readLibcalFixture,
} from "./fetch.ts";
import { runAllInvariants } from "./invariants.ts";
import { parseDining, parseLibCal } from "./parse.ts";
import { ALL_FEEDS, buildPayload, loadSpots, type FeedKind } from "./payload.ts";
import type { DiningFeed, LibcalFeed, ScrapePayload } from "./types.ts";

const args = new Set(process.argv.slice(2));
const useFixtures = args.has("--fixtures");
// Confirms that a feed returning zero hours everywhere is genuinely a shut
// campus (break week) and not a broken parser. See assertNoFeedCollapse.
const allowEmptyFeed = args.has("--allow-empty-feed");
// Fixture runs print and stop unless --write is explicit, so a stray --fixtures
// can never publish summer-session hours over real ones.
const dryRun = args.has("--dry-run") || (useFixtures && !args.has("--write"));

function parseFeedsArg(): ReadonlySet<FeedKind> {
  const raw = [...args].find((a) => a.startsWith("--feeds="))?.split("=")[1];
  if (raw === undefined || raw === "all") return ALL_FEEDS;
  const picked = raw.split(",").map((s) => s.trim());
  const bad = picked.filter((p) => p !== "dining" && p !== "library");
  if (bad.length > 0 || picked.length === 0) {
    throw new Error(`--feeds must be all, dining, library (got "${raw}")`);
  }
  return new Set(picked as FeedKind[]);
}

function summarize(payload: ScrapePayload): string {
  const spots = payload.spots.length;
  const rows = payload.spots.reduce((n, s) => n + s.hours.length, 0);
  const closed = payload.spots.filter((s) => s.hours.length === 0).length;
  return `${spots} spots covered · ${rows} hour rows · ${closed} closed all week`;
}

async function main() {
  const feeds = parseFeedsArg();
  const source = useFixtures ? "fixtures" : "live";
  console.log(
    `Scrape run (${source}${dryRun ? ", dry run" : ""}) · feeds: ${[...feeds].join("+")}`,
  );

  // A feed we are not responsible for is never fetched and stays an empty map;
  // every consumer is told which feeds are live, so an empty map is understood
  // as "not asked for" rather than "came back empty".
  let dining: DiningFeed = new Map();
  let libcal: LibcalFeed = new Map();

  if (feeds.has("dining")) {
    dining = parseDining(useFixtures ? readDiningFixture() : await fetchDining());
    console.log(`  parsed ${dining.size} dining locations`);
  }
  if (feeds.has("library")) {
    libcal = parseLibCal(useFixtures ? readLibcalFixture() : await fetchLibCal());
    console.log(`  parsed ${libcal.size} libcal locations`);
  }

  const spots = loadSpots();
  const payload = buildPayload(spots, dining, libcal, feeds);

  // Throws before anything is written: a run that cannot be trusted must leave
  // the previous hours standing rather than replace them with nonsense.
  runAllInvariants(payload, spots, dining, libcal, allowEmptyFeed, feeds);

  console.log(`  ${summarize(payload)}`);

  for (const spot of payload.spots) {
    const detail =
      spot.hours.length === 0
        ? "closed all week"
        : spot.hours
            .map((h) => `${h.day_of_week}:${h.opens}-${h.closes}`)
            .join(" ");
    console.log(`    ${spot.slug.padEnd(26)} ${detail}`);
  }

  if (dryRun) {
    console.log("\nDry run — nothing written.");
    return;
  }

  // GH Actions secrets (§0.10: the service key never reaches the client bundle).
  // NEXT_PUBLIC_SUPABASE_URL is accepted too so a local --env-file run works.
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(url, serviceKey);
  const { data, error } = await supabase.rpc("replace_scraped_hours", { payload });
  if (error) {
    throw new Error(`replace_scraped_hours failed: ${error.message}`);
  }

  console.log(`\nWrote: ${JSON.stringify(data)}`);
}

// Fail loudly: print the reason and exit non-zero so the Action goes red.
main().catch((err: unknown) => {
  console.error(`\nSCRAPE FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
