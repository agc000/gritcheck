// Pure parsers for both UMBC hours feeds. Grown from scraper/spikes/parse-hours.ts.
//
// PURE ON PURPOSE: these take an already-fetched object and return rows. No
// network, no clock, no database. That is what lets the fixture tests exercise
// the real parser offline (§Phase 6 "scraper unit tests on fixtures") — a test
// cannot pass merely because UMBC's site happened to be up, and the late-August
// re-capture drops in as new input to unchanged code.
//
// EVERYTHING UNRECOGNIZED THROWS. A feed that grows a new status or reindexes
// its days must redden the run, never quietly yield fewer hours: silently
// dropping a venue looks identical to that venue being closed, and the phase's
// exit criterion exists to keep those two apart.
import { ALL_DAY, type DiningFeed, type HoursRow, type LibcalFeed } from "./types.ts";

const pad = (n: number) => String(n).padStart(2, "0");

// ── DineOnCampus (apiv4 weekly_schedule) ────────────────────────────────────

type DocHour = {
  start_hour: number;
  start_minutes: number;
  end_hour: number;
  end_minutes: number;
};

type DocDay = {
  day: number;
  date: string;
  closed: boolean;
  always_open: boolean;
  hours: DocHour[];
};

type DocLocation = {
  name: string;
  slug: string;
  is_building: boolean;
  week: DocDay[];
};

/**
 * The feed's `day` is its own index, not derived from `date`. They agree today
 * (verified across the fixture: day 0 = 2026-07-05 = Sunday = Postgres dow 0),
 * and the whole schedule silently shifts by a day if that ever stops being
 * true — so it is checked rather than trusted.
 */
function assertDayIndex(loc: DocLocation, day: DocDay): void {
  const fromDate = new Date(`${day.date}T12:00:00Z`).getUTCDay();
  if (Number.isNaN(fromDate)) {
    throw new Error(`dining: ${loc.slug} has an unparseable date "${day.date}"`);
  }
  if (day.day !== fromDate) {
    throw new Error(
      `dining: ${loc.slug} day index ${day.day} disagrees with date ${day.date} (dow ${fromDate}) — feed reindexed?`,
    );
  }
}

function diningTime(hour: number, minutes: number, where: string): string {
  if (!Number.isInteger(hour) || hour < 0 || hour > 24) {
    throw new Error(`dining: ${where} has hour ${hour} out of range`);
  }
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
    throw new Error(`dining: ${where} has minutes ${minutes} out of range`);
  }
  // The feed uses 24:00 for midnight-at-end-of-day; spot_hours wants 00:00,
  // which the closes <= opens rule then reads as crossing midnight.
  return `${pad(hour === 24 ? 0 : hour)}:${pad(minutes)}`;
}

export function parseDining(raw: unknown): DiningFeed {
  const feed = raw as { theLocations?: DocLocation[] };
  if (!Array.isArray(feed?.theLocations)) {
    throw new Error("dining: feed has no theLocations array — shape changed or capture failed");
  }

  const out: DiningFeed = new Map();
  for (const loc of feed.theLocations) {
    // Building rows restate the union of their venues' hours; the venues carry
    // the real schedule, and True Grit's appears as both.
    if (loc.is_building) continue;
    if (typeof loc.slug !== "string" || loc.slug.length === 0) {
      throw new Error(`dining: a location has no slug (name: ${loc.name ?? "?"})`);
    }
    if (out.has(loc.slug)) {
      throw new Error(`dining: duplicate location slug "${loc.slug}" — mapping would be ambiguous`);
    }
    if (!Array.isArray(loc.week)) {
      throw new Error(`dining: ${loc.slug} has no week array`);
    }

    const rows: HoursRow[] = [];
    for (const day of loc.week) {
      assertDayIndex(loc, day);
      if (day.closed) continue;
      if (day.always_open) {
        rows.push({ day_of_week: day.day, ...ALL_DAY });
        continue;
      }
      for (const h of day.hours ?? []) {
        const where = `${loc.slug} day ${day.day}`;
        rows.push({
          day_of_week: day.day,
          opens: diningTime(h.start_hour, h.start_minutes, where),
          closes: diningTime(h.end_hour, h.end_minutes, where),
        });
      }
    }
    out.set(loc.slug, rows);
  }
  return out;
}

// ── LibCal (api3.libcal.com api_hours_grid.php, iid=991) ────────────────────

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type LibcalTimes = {
  status: string;
  hours?: { from: string; to: string }[];
};

type LibcalDay = { date?: string; times: LibcalTimes };
type LibcalLocation = { lid: number; name: string; weeks: Record<string, LibcalDay>[] };

/** "8am" | "8:30pm" | "12pm" | "12am" -> "HH:MM" */
export function libcalTime(t: string): string {
  const m = t.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (!m) throw new Error(`libcal: unparseable time "${t}"`);
  let hour = Number(m[1]) % 12;
  if (m[3] === "pm") hour += 12;
  return `${pad(hour)}:${m[2] ?? "00"}`;
}

export function parseLibCal(raw: unknown): LibcalFeed {
  const feed = raw as { locations?: LibcalLocation[] };
  if (!Array.isArray(feed?.locations)) {
    throw new Error("libcal: feed has no locations array — shape changed or request failed");
  }

  const out: LibcalFeed = new Map();
  for (const loc of feed.locations) {
    if (typeof loc.lid !== "number") {
      throw new Error(`libcal: a location has no numeric lid (name: ${loc.name ?? "?"})`);
    }
    if (out.has(loc.lid)) {
      throw new Error(`libcal: duplicate lid ${loc.lid} — mapping would be ambiguous`);
    }
    // The feed carries two weeks; spot_hours models a RECURRING weekly schedule,
    // so the current week is the answer. weeks[1] exists if lookahead is ever
    // wanted — not built (§0.3).
    const week = loc.weeks?.[0];
    if (!week) throw new Error(`libcal: lid ${loc.lid} has no weeks`);

    const rows: HoursRow[] = [];
    for (const [dayName, day] of Object.entries(week)) {
      const dow = WEEKDAYS.indexOf(dayName);
      if (dow < 0) throw new Error(`libcal: lid ${loc.lid} has unknown day key "${dayName}"`);

      const status = day?.times?.status;
      switch (status) {
        case "open": {
          const hours = day.times.hours;
          if (!Array.isArray(hours) || hours.length === 0) {
            throw new Error(`libcal: lid ${loc.lid} ${dayName} is "open" but lists no hours`);
          }
          for (const h of hours) {
            rows.push({
              day_of_week: dow,
              opens: libcalTime(h.from),
              closes: libcalTime(h.to),
            });
          }
          break;
        }

        // The branch the Phase 0 spike was missing. lid 469 is the RLC, which is
        // 24-hour during term — the spike kept only status "open", so a real
        // mapped study spot silently produced zero rows.
        case "24hours":
          rows.push({ day_of_week: dow, ...ALL_DAY });
          break;

        // No PUBLIC open hours. "ByApp" is by-appointment access and "text" is
        // free-form chatter ("Chat 10 am - 5 pm") that is not a schedule —
        // neither is a door a student can walk through, so neither is an hour.
        // "not-set" means LibCal published nothing for that day.
        case "closed":
        case "not-set":
        case "ByApp":
        case "text":
          break;

        default:
          throw new Error(
            `libcal: unhandled status "${status}" (lid ${loc.lid}, ${dayName}) — LibCal added a state; decide what it means`,
          );
      }
    }
    out.set(loc.lid, rows);
  }
  return out;
}
