// Campus-clock helpers. All spot hours are UMBC-local (America/New_York), and
// the server renders in UTC on Vercel — so every day/hour computation goes
// through this timezone explicitly (§5.4). Never use bare getHours()/getDay()
// for anything hours- or baseline-related.

const NY_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  hour: "numeric",
  minute: "numeric",
  hour12: false,
});

const DOW: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/** Day-of-week (0=Sun) and minutes-since-midnight in America/New_York. */
export function nyClock(date: Date): { dow: number; minutes: number } {
  const parts = NY_FORMAT.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = Number(get("hour")) % 24; // hour12:false can yield "24"
  return {
    dow: DOW[get("weekday")] ?? 0,
    minutes: hour * 60 + Number(get("minute")),
  };
}

/** "07:00:00" (Postgres time) → minutes since midnight. */
export function timeToMinutes(time: string): number {
  const [h = 0, m = 0] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Minutes since midnight → "7 AM" / "10:30 PM". */
export function formatMinutes(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const ampm = h24 < 12 ? "AM" : "PM";
  return mm === 0 ? `${h12} ${ampm}` : `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
}

export type HoursInterval = {
  /** Minutes since midnight, NY time. */
  opens: number;
  /** May exceed 1440 when the interval crosses midnight (§3.1). */
  closes: number;
  /** 0 = today, -1 = yesterday (a cross-midnight interval still open now). */
  dayOffset: 0 | -1;
};

/**
 * Minutes until the current open interval ends, or null if no interval
 * contains `nowMinutes`. Yesterday's cross-midnight intervals are shifted
 * back 1440 so 1 AM inside "Fri 18:00–02:00" resolves correctly.
 */
export function minutesUntilClose(
  intervals: HoursInterval[],
  nowMinutes: number,
): number | null {
  for (const { opens, closes, dayOffset } of intervals) {
    const shift = dayOffset * 1440;
    const start = opens + shift;
    const end = (closes <= opens ? closes + 1440 : closes) + shift;
    if (nowMinutes >= start && nowMinutes < end) return end - nowMinutes;
  }
  return null;
}

/** Next opening later today, as display text ("opens 7 AM"), or null. */
export function nextOpensToday(
  intervals: HoursInterval[],
  nowMinutes: number,
): string | null {
  const upcoming = intervals
    .filter((i) => i.dayOffset === 0 && i.opens > nowMinutes)
    .sort((a, b) => a.opens - b.opens)[0];
  return upcoming ? `opens ${formatMinutes(upcoming.opens)}` : null;
}
