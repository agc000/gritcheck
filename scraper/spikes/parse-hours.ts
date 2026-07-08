// Phase 0 parse spike — proves we can extract normalized hours from both fixture
// snapshots. Not production code; the real scraper (Phase 6) grows from this.
// Run: node scraper/spikes/parse-hours.ts   (Node 24 strips types natively)
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

// Normalized shape mirroring the future spot_hours table (BUILD_PLAN §3.1).
type HoursRow = {
  source: "dining" | "library";
  location: string;
  day_of_week: number; // 0 = Sunday
  opens: string; // "HH:MM"
  closes: string; // "HH:MM" — may be past midnight logically; flagged below
  crosses_midnight: boolean;
};

const pad = (n: number) => String(n).padStart(2, "0");

// ---------- DineOnCampus (apiv4 weekly_schedule, captured via headless browser) ----------
type DocDay = {
  day: number;
  date: string;
  closed: boolean;
  always_open: boolean;
  hours: { start_hour: number; start_minutes: number; end_hour: number; end_minutes: number }[];
};
type DocLocation = { name: string; slug: string; is_building: boolean; week: DocDay[] };

function parseDineOnCampus(): HoursRow[] {
  const raw = JSON.parse(readFileSync(join(fixtures, "dineoncampus-weekly-schedule.json"), "utf8"));
  const rows: HoursRow[] = [];
  for (const loc of raw.theLocations as DocLocation[]) {
    if (loc.is_building) continue; // building rows duplicate their venues' coverage
    for (const day of loc.week) {
      if (day.closed) continue;
      for (const h of day.hours) {
        const opens = h.start_hour * 60 + h.start_minutes;
        const closes = h.end_hour * 60 + h.end_minutes;
        rows.push({
          source: "dining",
          location: loc.name,
          day_of_week: day.day,
          opens: `${pad(h.start_hour)}:${pad(h.start_minutes)}`,
          closes: `${pad(h.end_hour)}:${pad(h.end_minutes)}`,
          crosses_midnight: closes <= opens,
        });
      }
    }
  }
  return rows;
}

// ---------- LibCal (api3.libcal.com api_hours_grid.php, iid=991) ----------
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// "8am" | "8:30pm" | "12pm" | "12am" -> "HH:MM"
function libcalTime(t: string): string {
  const m = t.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
  if (!m) throw new Error(`Unparseable LibCal time: "${t}"`);
  let hour = Number(m[1]) % 12;
  if (m[3] === "pm") hour += 12;
  return `${pad(hour)}:${m[2] ?? "00"}`;
}

type LibcalDay = { date: string; times: { status: string; hours?: { from: string; to: string }[] } };
type LibcalLocation = { lid: number; name: string; weeks: Record<string, LibcalDay>[] };

function parseLibCal(): HoursRow[] {
  const raw = JSON.parse(readFileSync(join(fixtures, "libcal-hours-grid.json"), "utf8"));
  const rows: HoursRow[] = [];
  for (const loc of raw.locations as LibcalLocation[]) {
    const week = loc.weeks[0]; // current week; scraper will decide how many weeks ahead to keep
    for (const [dayName, day] of Object.entries(week)) {
      if (day.times.status !== "open" || !day.times.hours) continue;
      for (const h of day.times.hours) {
        const opens = libcalTime(h.from);
        const closes = libcalTime(h.to);
        rows.push({
          source: "library",
          location: loc.name,
          day_of_week: WEEKDAYS.indexOf(dayName),
          opens,
          closes,
          crosses_midnight: closes <= opens,
        });
      }
    }
  }
  return rows;
}

// ---------- Prove it ----------
const dining = parseDineOnCampus();
const library = parseLibCal();

const assert = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
};

assert(dining.length > 20, `expected >20 dining rows, got ${dining.length}`);
assert(library.length > 5, `expected >5 library rows, got ${library.length}`);
assert(dining.every((r) => /^\d{2}:\d{2}$/.test(r.opens) && /^\d{2}:\d{2}$/.test(r.closes)), "dining times malformed");
assert(library.every((r) => r.day_of_week >= 0 && r.day_of_week <= 6), "library day_of_week out of range");

const show = (rows: HoursRow[], name: string) =>
  rows.filter((r) => r.location.includes(name)).forEach((r) =>
    console.log(`  ${r.location} · dow ${r.day_of_week} · ${r.opens}–${r.closes}${r.crosses_midnight ? " (crosses midnight)" : ""}`)
  );

console.log(`Dining: ${dining.length} hour rows across ${new Set(dining.map((r) => r.location)).size} locations`);
show(dining, "True Grit's");
console.log(`Library: ${library.length} hour rows across ${new Set(library.map((r) => r.location)).size} locations`);
show(library, "Building Hours");
console.log("\nPASS — both fixtures parse into spot_hours-shaped rows.");
