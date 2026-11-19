// Seasonal palettes (2026-11-18). Two named themes, both defined as token
// sets in globals.css:
//   "original"  — Original GritCheck: the §4.1 navy palette, used all year.
//   "christmas" — Christmas GritCheck: evergreen + snow, December only.
// Only surfaces and neutrals change. Gold (signal) and go/hold/skip/closed
// (status) keep their meaning, so a seasonal skin can never make a "skip"
// look like decoration.
//
// Picked on the server per request (America/New_York, so the switch happens
// at UMBC midnight, not UTC). THEME=christmas|original forces one — for
// previewing locally, never needed in production.
export type ThemeName = "original" | "christmas";

export function activeTheme(now: Date = new Date()): ThemeName {
  const forced = process.env.THEME;
  if (forced === "original" || forced === "christmas") return forced;
  const month = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "numeric",
    }).format(now),
  );
  return month === 12 ? "christmas" : "original";
}
