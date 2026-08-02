// The scrape run (BUILD_PLAN §Phase 6).
//
//   node scraper/src/run.ts                     fetch live, write to Supabase
//   node scraper/src/run.ts --dry-run           fetch live, print, write NOTHING
//   node scraper/src/run.ts --fixtures          parse the committed snapshots, print only
//   node scraper/src/run.ts --fixtures --write  same, but write (local stack only)
//   node scraper/src/run.ts --allow-empty-feed  confirm a genuinely shut campus
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
import { buildPayload, loadSpots } from "./payload.ts";
import type { ScrapePayload } from "./types.ts";

const args = new Set(process.argv.slice(2));
const useFixtures = args.has("--fixtures");
// Confirms that a feed returning zero hours everywhere is genuinely a shut
// campus (break week) and not a broken parser. See assertNoFeedCollapse.
const allowEmptyFeed = args.has("--allow-empty-feed");
// Fixture runs print and stop unless --write is explicit, so a stray --fixtures
// can never publish summer-session hours over real ones.
const dryRun = args.has("--dry-run") || (useFixtures && !args.has("--write"));

function summarize(payload: ScrapePayload): string {
  const spots = payload.spots.length;
  const rows = payload.spots.reduce((n, s) => n + s.hours.length, 0);
  const closed = payload.spots.filter((s) => s.hours.length === 0).length;
  return `${spots} spots covered · ${rows} hour rows · ${closed} closed all week`;
}

async function main() {
  const source = useFixtures ? "fixtures" : "live";
  console.log(`Scrape run (${source}${dryRun ? ", dry run" : ""})`);

  const [diningRaw, libcalRaw] = useFixtures
    ? [readDiningFixture(), readLibcalFixture()]
    : await Promise.all([fetchDining(), fetchLibCal()]);

  const dining = parseDining(diningRaw);
  const libcal = parseLibCal(libcalRaw);
  console.log(`  parsed ${dining.size} dining locations, ${libcal.size} libcal locations`);

  const spots = loadSpots();
  const payload = buildPayload(spots, dining, libcal);

  // Throws before anything is written: a run that cannot be trusted must leave
  // the previous hours standing rather than replace them with nonsense.
  runAllInvariants(payload, spots, dining, libcal, allowEmptyFeed);

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
