// Seasonal palettes (2026-11-18). Two named themes, both defined as token
// sets in globals.css:
//   "original"  — Original GritCheck: the §4.1 navy palette, used all year.
//   "christmas" — Christmas GritCheck: evergreen + snow, Nov 18 – Dec 31.
// Only surfaces and neutrals change. Gold (signal) and go/hold/skip/closed
// (status) keep their meaning, so a seasonal skin can never make a "skip"
// look like decoration.
//
// Picked on the server per request (America/New_York, so the switch happens
// at UMBC midnight, not UTC). THEME=christmas|original forces one — for
// previewing locally, never needed in production.
export type ThemeName = "original" | "christmas";

/** Christmas GritCheck starts on this day of November each year. */
const CHRISTMAS_START_DAY = 18;

export function activeTheme(now: Date = new Date()): ThemeName {
  const forced = process.env.THEME;
  if (forced === "original" || forced === "christmas") return forced;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  // Season: Nov 18 through Dec 31 (Alan moved the start up from Dec 1 on
  // 2026-11-18). Back to Original on Jan 1, no deploy needed.
  const inSeason = month === 12 || (month === 11 && day >= CHRISTMAS_START_DAY);
  return inSeason ? "christmas" : "original";
}
