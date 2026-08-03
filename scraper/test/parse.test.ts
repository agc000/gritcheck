// Parser tests against the committed fixtures (BUILD_PLAN §Phase 6).
//
// WRITTEN TO SURVIVE THE RE-CAPTURE. The fixtures in scraper/fixtures/ are
// summer-session snapshots: 12 of 22 dining venues are closed all week and only
// 2 of 11 LibCal locations report "open". §Phase 6 calls for re-capturing both
// in late August, and nearly every number in them will change.
//
// So these assert on CONTRACT and SHAPE — does the feed parse, is every mapped
// source present, are the rows well-formed, does each status branch do what it
// claims — and never on the calendar. A test that said "Chick-fil-A is closed
// on Tuesday" would pass all summer, fail every September, and teach us nothing
// either time. Presence in the feed is a contract and is asserted hard;
// openness is seasonal data and is only ever asserted as shape.
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { readDiningFixture, readLibcalFixture } from "../src/fetch.ts";
import { parseDining, parseLibCal, libcalTime } from "../src/parse.ts";
import { buildPayload, loadSpots } from "../src/payload.ts";
import { findSuspiciousDuplicates, runAllInvariants } from "../src/invariants.ts";
import type { HoursRow } from "../src/types.ts";

const spots = loadSpots();
const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));
const TIME_RE = /^\d{2}:\d{2}$/;

// Mutable mirrors of the two raw feed shapes. The parsers accept `unknown` on
// purpose — they are the boundary that validates — so the tests declare the
// shape they intend to corrupt rather than reaching for `any`.
type RawDiningHour = {
  start_hour: number;
  start_minutes: number;
  end_hour: number;
  end_minutes: number;
};
type RawDiningDay = {
  day: number;
  date: string;
  closed: boolean;
  always_open: boolean;
  hours: RawDiningHour[];
};
type RawDiningLocation = {
  slug: string;
  name: string;
  is_building: boolean;
  week: RawDiningDay[];
};
type RawDining = { theLocations: RawDiningLocation[] };

type RawLibcalDay = { times: { status: string; hours?: { from: string; to: string }[] } };
type RawLibcalLocation = { lid: number; name: string; weeks: Record<string, RawLibcalDay>[] };
type RawLibcal = { locations: RawLibcalLocation[] };

const diningFixture = () => readDiningFixture() as RawDining;
const libcalFixture = () => readLibcalFixture() as RawLibcal;
const firstVenue = (raw: RawDining) => raw.theLocations.find((l) => !l.is_building)!;

const wellFormed = (rows: HoursRow[]) =>
  rows.every(
    (r) =>
      Number.isInteger(r.day_of_week) &&
      r.day_of_week >= 0 &&
      r.day_of_week <= 6 &&
      TIME_RE.test(r.opens) &&
      TIME_RE.test(r.closes),
  );

describe("dining parser", () => {
  const feed = parseDining(readDiningFixture());

  it("parses every venue in the fixture", () => {
    assert.ok(feed.size >= 10, `expected >=10 venues, got ${feed.size}`);
  });

  it("emits only well-formed rows", () => {
    for (const [slug, rows] of feed) {
      assert.ok(wellFormed(rows), `malformed row for ${slug}`);
    }
  });

  it("drops building rows, which restate their venues' hours", () => {
    // True Grit's appears twice in the feed: once as a building, once as the
    // venue. Keeping both would double every interval.
    const raw = diningFixture();
    const buildings = raw.theLocations.filter((l) => l.is_building).map((l) => l.slug);
    assert.ok(buildings.length > 0, "fixture should contain building rows to drop");
    const venueSlugs = new Set(
      raw.theLocations.filter((l) => !l.is_building).map((l) => l.slug),
    );
    for (const b of buildings) {
      if (!venueSlugs.has(b)) assert.equal(feed.has(b), false, `building ${b} leaked into the feed`);
    }
  });

  it("normalizes a 24:00 end to 00:00 so it reads as crossing midnight", () => {
    const raw = clone(diningFixture());
    const loc = firstVenue(raw);
    loc.week[0].closed = false;
    loc.week[0].always_open = false;
    loc.week[0].hours = [{ start_hour: 21, start_minutes: 0, end_hour: 24, end_minutes: 0 }];
    const row = parseDining(raw).get(loc.slug)!.find((r) => r.day_of_week === 0)!;
    assert.equal(row.opens, "21:00");
    assert.equal(row.closes, "00:00");
  });

  it("treats an always_open day as spanning the clock", () => {
    const raw = clone(diningFixture());
    const loc = firstVenue(raw);
    loc.week[0].closed = false;
    loc.week[0].always_open = true;
    const rows = parseDining(raw).get(loc.slug)!.filter((r) => r.day_of_week === 0);
    assert.deepEqual(rows, [{ day_of_week: 0, opens: "00:00", closes: "00:00" }]);
  });
});

describe("libcal parser", () => {
  const feed = parseLibCal(readLibcalFixture());

  it("parses every location in the fixture", () => {
    assert.ok(feed.size >= 5, `expected >=5 locations, got ${feed.size}`);
  });

  it("emits only well-formed rows", () => {
    for (const [lid, rows] of feed) {
      assert.ok(wellFormed(rows), `malformed row for lid ${lid}`);
    }
  });

  // The bug the Phase 0 spike shipped with: it kept only status "open", so the
  // RLC — a real mapped study spot that is 24-hour — produced zero rows and
  // would have rendered Closed around the clock.
  it("keeps 24hours days, which the Phase 0 spike dropped", () => {
    const rlc = feed.get(469);
    assert.ok(rlc, "lid 469 (RLC) should be in the feed");
    const allDay = rlc!.filter((r) => r.opens === "00:00" && r.closes === "00:00");
    assert.ok(allDay.length > 0, "RLC should have at least one all-day row");
  });

  it("emits nothing for by-appointment, free-text, and unset days", () => {
    // "Chat 10 am - 5 pm" is chatter, not a door a student can walk through.
    const raw = clone(libcalFixture());
    const loc = raw.locations[0];
    for (const key of Object.keys(loc.weeks[0])) {
      loc.weeks[0][key] = { times: { status: "ByApp" } };
    }
    assert.deepEqual(parseLibCal(raw).get(loc.lid), []);
  });

  it("parses the time formats LibCal actually uses", () => {
    assert.equal(libcalTime("8am"), "08:00");
    assert.equal(libcalTime("8:30pm"), "20:30");
    assert.equal(libcalTime("12pm"), "12:00");
    assert.equal(libcalTime("12am"), "00:00");
  });
});

describe("mapping onto spots", () => {
  const dining = parseDining(readDiningFixture());
  const libcal = parseLibCal(readLibcalFixture());
  const payload = buildPayload(spots, dining, libcal);

  it("covers every spot whose hours come from a feed", () => {
    const expected = spots.filter((s) => s.hours_source.kind !== "manual").length;
    assert.equal(payload.spots.length, expected);
  });

  it("omits manual spots entirely, leaving their hours untouched", () => {
    const manual = spots
      .filter((s) => s.hours_source.kind === "manual")
      .map((s) => s.slug);
    assert.ok(manual.length > 0, "fixture data should include manual spots");
    for (const slug of manual) {
      assert.equal(
        payload.spots.some((s) => s.slug === slug),
        false,
        `${slug} is manual and must not be covered`,
      );
    }
  });

  it("fans one LibCal building out to every floor that inherits it", () => {
    // lid 27 is "Building Hours" and feeds three AOK floor spots.
    const sharing = spots.filter(
      (s) => s.hours_source.kind === "library" && s.hours_source.source_lid === 27,
    );
    assert.ok(sharing.length > 1, "expected multiple spots on lid 27");
    const sets = sharing.map((s) =>
      JSON.stringify(payload.spots.find((p) => p.slug === s.slug)!.hours),
    );
    assert.equal(new Set(sets).size, 1, "spots sharing a lid must get identical hours");
  });

  // Dining cannot be scraped from CI (Cloudflare; §Phase 6 amended 2026-08-03),
  // so the scheduled run covers the library only. The danger is coverage: a
  // dining spot wrongly marked covered would have its provisional hours
  // suppressed and would render closed. Omission is what keeps it safe.
  it("a library-only run omits dining spots entirely", () => {
    const libraryOnly = buildPayload(spots, dining, libcal, new Set(["library"] as const));
    const covered = new Set(libraryOnly.spots.map((s) => s.slug));
    const expected = spots.filter((s) => s.hours_source.kind === "library");
    assert.equal(libraryOnly.spots.length, expected.length);
    for (const s of spots) {
      if (s.hours_source.kind === "dining") {
        assert.equal(covered.has(s.slug), false, `${s.slug} must not be covered`);
      }
    }
  });

  it("a library-only run still demands every library spot", () => {
    const libraryOnly = buildPayload(spots, dining, libcal, new Set(["library"] as const));
    assert.doesNotThrow(() =>
      runAllInvariants(libraryOnly, spots, dining, libcal, false, new Set(["library"] as const)),
    );
  });

  it("expresses a closed-all-week venue as [], not as absence", () => {
    // This is what lets migration 20260731000100 suppress the provisional seed
    // rather than fall back to it.
    const closed = payload.spots.filter((s) => s.hours.length === 0);
    assert.ok(closed.length > 0, "the summer fixture should contain closed venues");
  });
});

describe("near-duplicate slug warnings", () => {
  const dining = parseDining(readDiningFixture());
  const libcal = parseLibCal(readLibcalFixture());
  const payload = buildPayload(spots, dining, libcal);

  it("stays quiet when nothing is suspicious", () => {
    // The July fixture predates the duplicate slugs, so a clean run must warn
    // about nothing — a warning that always fires is one nobody reads.
    assert.deepEqual(findSuspiciousDuplicates(payload, spots, dining), []);
  });

  it("flags a closed mapped venue sitting beside a near-identical slug", () => {
    // Reproduces what UMBC actually published in August: the mapped venue goes
    // quiet while a differently-spelled twin appears alongside it.
    const raw = clone(diningFixture());
    const mapped = raw.theLocations.find((l) => l.slug === "piccola-italia")!;
    for (const day of mapped.week) {
      day.closed = true;
      day.hours = [];
    }
    raw.theLocations.push({ ...clone(mapped), slug: "picola-italia", name: "Picola Italia" });

    const feed = parseDining(raw);
    const warnings = findSuspiciousDuplicates(
      buildPayload(spots, feed, libcal),
      spots,
      feed,
    );
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /piccolo-italia/);
    assert.match(warnings[0], /picola-italia/);
  });

  it("says nothing when the mapped venue still reports hours", () => {
    // A twin slug is only worth flagging if OUR venue went quiet.
    const raw = clone(diningFixture());
    const mapped = raw.theLocations.find((l) => l.slug === "piccola-italia")!;
    raw.theLocations.push({ ...clone(mapped), slug: "picola-italia", name: "Picola Italia" });
    const feed = parseDining(raw);
    assert.deepEqual(
      findSuspiciousDuplicates(buildPayload(spots, feed, libcal), spots, feed),
      [],
    );
  });

  it("does not confuse two genuinely different venues", () => {
    // Commons Retriever Market vs True Grit's Retriever Market share a suffix
    // and must never be reported as the same venue.
    const raw = clone(diningFixture());
    for (const loc of raw.theLocations) {
      if (loc.slug !== "commons-retriever-market") continue;
      for (const day of loc.week) {
        day.closed = true;
        day.hours = [];
      }
    }
    const feed = parseDining(raw);
    assert.deepEqual(
      findSuspiciousDuplicates(buildPayload(spots, feed, libcal), spots, feed),
      [],
    );
  });
});

describe("a deliberately broken feed fails loudly", () => {
  // §Phase 6's exit criterion, as executable cases. Each corruption is one a
  // real feed could plausibly produce.
  const run = (dRaw: unknown, lRaw: unknown, allowEmpty = false) => {
    const d = parseDining(dRaw);
    const l = parseLibCal(lRaw);
    const p = buildPayload(spots, d, l);
    runAllInvariants(p, spots, d, l, allowEmpty);
    return p;
  };

  it("the uncorrupted fixtures pass — otherwise the rest proves nothing", () => {
    assert.doesNotThrow(() => run(readDiningFixture(), readLibcalFixture()));
  });

  /** Every dining day marked shut — valid rows, present venues, empty campus. */
  const allDiningClosed = (): RawDining => {
    const d = clone(diningFixture());
    for (const loc of d.theLocations) {
      for (const day of loc.week) {
        day.closed = true;
        day.hours = [];
      }
    }
    return d;
  };

  it("rejects a LibCal status nobody has decided the meaning of", () => {
    const l = clone(libcalFixture());
    l.locations[0].weeks[0].Monday.times.status = "seasonal";
    assert.throws(() => run(diningFixture(), l), /unhandled status "seasonal"/);
  });

  it("rejects a renamed venue instead of skipping it", () => {
    const d = clone(diningFixture());
    d.theLocations.find((x) => x.slug === "starbucks")!.slug = "starbucks-cafe";
    assert.throws(() => run(d, libcalFixture()), /absent from the feed/);
  });

  it("rejects a truncated feed", () => {
    const d = clone(diningFixture());
    d.theLocations = d.theLocations.slice(0, 3);
    assert.throws(() => run(d, libcalFixture()));
  });

  it("rejects days reindexed out from under us", () => {
    const d = clone(diningFixture());
    for (const loc of d.theLocations) for (const day of loc.week) day.day = (day.day + 1) % 7;
    assert.throws(() => run(d, libcalFixture()), /disagrees with date/);
  });

  it("rejects garbled times", () => {
    const l = clone(libcalFixture());
    const loc = l.locations.find((x) => x.lid === 27)!;
    for (const day of Object.values(loc.weeks[0])) {
      if (day.times.hours) day.times.hours[0].from = "half eight";
    }
    assert.throws(() => run(diningFixture(), l), /unparseable time/);
  });

  // The one that matters most: every row valid, every venue present, and the
  // whole feed quietly saying "closed". Green runs, empty campus.
  it("rejects a feed where every venue silently went closed", () => {
    assert.throws(() => run(allDiningClosed(), libcalFixture()), /came back with zero hours/);
  });

  it("...unless a human confirms campus really is shut", () => {
    assert.doesNotThrow(() => run(allDiningClosed(), libcalFixture(), true));
  });
});
